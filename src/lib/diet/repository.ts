import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DietDraft, LoggedItem, MealLog } from "./types";
import { emptyDraft } from "./types";

/**
 * Persistence for a single player's diet log for one day (continuous log). The
 * whole draft is the unit of save: the parent diet_logs row is upserted on
 * (player_id, log_date) and the child meals/items are replaced wholesale
 * (deleting diet_log_meals cascades to diet_log_items). Keeps autosave
 * idempotent with no per-row diffing.
 *
 * The draft speaks in catalogue *keys* (meal_slots.key, food_catalog.key); the
 * DB stores foreign keys to ids, so save/load translate via small key↔id maps.
 */

/** Load a player's diet draft for a day. Returns an empty draft if none. */
export async function loadDietLog(
  playerId: string,
  dateKey: string,
): Promise<DietDraft> {
  const admin = createAdminClient();

  const { data: log } = await admin
    .from("diet_logs")
    .select("id, narration")
    .eq("player_id", playerId)
    .eq("log_date", dateKey)
    .maybeSingle();

  if (!log) return emptyDraft();

  // Pull every touched slot for this log, with its slot key and item rows
  // (items carry the catalogue key via the joined food_catalog).
  const { data: mealRows } = await admin
    .from("diet_log_meals")
    .select(
      `id, skipped,
       meal_slots ( key ),
       diet_log_items (
         id, custom_name, custom_unit, custom_notes, count, sort_order,
         food_catalog ( key )
       )`,
    )
    .eq("diet_log_id", log.id);

  const meals: Record<string, MealLog> = {};
  for (const m of mealRows ?? []) {
    // Supabase types embedded relations as arrays; the FK guarantees one row.
    const slot = Array.isArray(m.meal_slots) ? m.meal_slots[0] : m.meal_slots;
    const slotKey = slot?.key;
    if (!slotKey) continue;

    const items: LoggedItem[] = (m.diet_log_items ?? [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((it) => {
        const food = Array.isArray(it.food_catalog)
          ? it.food_catalog[0]
          : it.food_catalog;
        return {
          id: it.id,
          foodKey: food?.key ?? null,
          customName: it.custom_name ?? undefined,
          customUnit: it.custom_unit ?? undefined,
          customNotes: it.custom_notes ?? undefined,
          count: Number(it.count),
        };
      });

    meals[slotKey] = { skipped: m.skipped, items };
  }

  return { meals, narration: log.narration ?? "" };
}

/**
 * Upsert a player's diet draft for a day. The parent row is upserted on
 * (player_id, log_date); meals + items are deleted and re-inserted wholesale.
 */
export async function saveDietLog(
  playerId: string,
  dateKey: string,
  draft: DietDraft,
): Promise<void> {
  const admin = createAdminClient();

  const { data: log, error: upsertErr } = await admin
    .from("diet_logs")
    .upsert(
      {
        player_id: playerId,
        log_date: dateKey,
        narration: draft.narration.trim() || null,
      },
      { onConflict: "player_id,log_date" },
    )
    .select("id")
    .single();

  if (upsertErr || !log) {
    throw new Error(
      `Failed to save diet log: ${upsertErr?.message ?? "unknown"}`,
    );
  }

  // Replace children wholesale (cascade clears items too).
  await admin.from("diet_log_meals").delete().eq("diet_log_id", log.id);

  // Resolve catalogue keys → ids for the touched slots and logged foods.
  const slotKeys = Object.keys(draft.meals).filter((k) =>
    isTouched(draft.meals[k]),
  );
  if (slotKeys.length === 0) return;

  const foodKeys = Array.from(
    new Set(
      slotKeys.flatMap((k) =>
        draft.meals[k].items
          .map((it) => it.foodKey)
          .filter((fk): fk is string => fk !== null),
      ),
    ),
  );

  const [slotRes, foodRes] = await Promise.all([
    admin.from("meal_slots").select("id, key").in("key", slotKeys),
    foodKeys.length
      ? admin.from("food_catalog").select("id, key").in("key", foodKeys)
      : Promise.resolve({ data: [] as { id: string; key: string }[] }),
  ]);

  const slotIdByKey = new Map((slotRes.data ?? []).map((r) => [r.key, r.id]));
  const foodIdByKey = new Map((foodRes.data ?? []).map((r) => [r.key, r.id]));

  for (const slotKey of slotKeys) {
    const slotId = slotIdByKey.get(slotKey);
    if (!slotId) continue; // unknown slot key — skip rather than fail the save
    const meal = draft.meals[slotKey];

    const { data: mealRow, error: mealErr } = await admin
      .from("diet_log_meals")
      .insert({
        diet_log_id: log.id,
        meal_slot_id: slotId,
        skipped: meal.skipped,
      })
      .select("id")
      .single();

    if (mealErr || !mealRow) {
      throw new Error(
        `Failed to save meal ${slotKey}: ${mealErr?.message ?? "unknown"}`,
      );
    }

    if (meal.skipped) continue; // skipped meals carry no items

    const itemRows = meal.items
      .filter((it) => it.count > 0)
      .map((it, i) => ({
        diet_log_meal_id: mealRow.id,
        food_item_id: it.foodKey ? foodIdByKey.get(it.foodKey) ?? null : null,
        custom_name: it.foodKey ? null : it.customName?.trim() || "Custom item",
        custom_unit: it.foodKey ? null : it.customUnit?.trim() || null,
        custom_notes: it.foodKey ? null : it.customNotes?.trim() || null,
        count: it.count,
        sort_order: i,
      }))
      // Guard the DB check: need either a catalogue id or a custom name.
      .filter((r) => r.food_item_id !== null || r.custom_name !== null);

    if (itemRows.length > 0) {
      const { error: itemErr } = await admin
        .from("diet_log_items")
        .insert(itemRows);
      if (itemErr) {
        throw new Error(`Failed to save diet items: ${itemErr.message}`);
      }
    }
  }
}

/** A slot is worth persisting once it is skipped or has any logged items. */
function isTouched(meal: MealLog): boolean {
  return meal.skipped || meal.items.length > 0;
}
