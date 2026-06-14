import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/* ── Per-player gym detail ──────────────────────────────────────────────── */

export type GymExercise = {
  bodyPart: string;
  equipment: string | null;
  weight: number | null;
  unit: string;
  scheme: string | null;
  notes: string | null;
};
export type GymDay = {
  date: string;
  bodyWeight: number | null;
  unit: string;
  narration: string | null;
  exercises: GymExercise[];
};

export async function getPlayerGym(playerId: string): Promise<GymDay[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("gym_logs")
    .select(
      "log_date, body_weight, body_weight_unit, narration, gym_log_exercises(body_part, equipment, weight, weight_unit, scheme, notes, sort_order)",
    )
    .eq("player_id", playerId)
    .order("log_date", { ascending: false });

  return (data ?? []).map((g) => ({
    date: g.log_date,
    bodyWeight: g.body_weight,
    unit: g.body_weight_unit,
    narration: g.narration,
    exercises: (
      (g.gym_log_exercises as Array<Record<string, unknown>>) ?? []
    )
      .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
      .map((e) => ({
        bodyPart: e.body_part as string,
        equipment: (e.equipment as string) ?? null,
        weight: (e.weight as number) ?? null,
        unit: e.weight_unit as string,
        scheme: (e.scheme as string) ?? null,
        notes: (e.notes as string) ?? null,
      })),
  }));
}

/* ── Per-player diet detail ─────────────────────────────────────────────── */

export type DietItem = { name: string; count: number };
export type DietMeal = { slot: string; skipped: boolean; items: DietItem[] };
export type DietDay = { date: string; narration: string | null; meals: DietMeal[] };

export async function getPlayerDiet(playerId: string): Promise<DietDay[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("diet_logs")
    .select(
      "log_date, narration, diet_log_meals(skipped, meal_slots(name, sort_order), diet_log_items(count, custom_name, food_catalog(name)))",
    )
    .eq("player_id", playerId)
    .order("log_date", { ascending: false });

  return (data ?? []).map((d) => ({
    date: d.log_date,
    narration: d.narration,
    meals: ((d.diet_log_meals as Array<Record<string, unknown>>) ?? [])
      .map((m) => {
        const slot = m.meal_slots as { name: string; sort_order: number } | null;
        return {
          slot: slot?.name ?? "Meal",
          slotOrder: slot?.sort_order ?? 0,
          skipped: Boolean(m.skipped),
          items: ((m.diet_log_items as Array<Record<string, unknown>>) ?? []).map(
            (it) => {
              const food = it.food_catalog as { name: string } | null;
              return {
                name: (it.custom_name as string) ?? food?.name ?? "Item",
                count: Number(it.count),
              };
            },
          ),
        };
      })
      .sort((a, b) => a.slotOrder - b.slotOrder)
      .map((m) => ({ slot: m.slot, skipped: m.skipped, items: m.items })),
  }));
}

/* ── By-date overviews (all players on one day, per type) ───────────────── */

async function listDates(table: "gym_logs" | "diet_logs"): Promise<string[]> {
  const admin = createAdminClient();
  const { data } = await admin.from(table).select("log_date");
  return [...new Set((data ?? []).map((r) => r.log_date))].sort().reverse();
}

export const listGymDates = () => listDates("gym_logs");
export const listDietDates = () => listDates("diet_logs");

async function activePlayerNames(): Promise<Map<string, string>> {
  const admin = createAdminClient();
  const { data } = await admin.from("players").select("id, display_name").eq("is_active", true);
  return new Map((data ?? []).map((p) => [p.id, p.display_name]));
}

export type GymDayRow = {
  playerId: string;
  displayName: string;
  exercises: number;
  bodyWeight: number | null;
};

/** Each player who logged gym on `date`, with a summary. */
export async function getGymDay(date: string): Promise<GymDayRow[]> {
  const admin = createAdminClient();
  const [res, names] = await Promise.all([
    admin
      .from("gym_logs")
      .select("player_id, body_weight, gym_log_exercises(id)")
      .eq("log_date", date),
    activePlayerNames(),
  ]);
  return (res.data ?? [])
    .map((r) => ({
      playerId: r.player_id,
      displayName: names.get(r.player_id) ?? "Unknown",
      exercises: ((r.gym_log_exercises as unknown[]) ?? []).length,
      bodyWeight: r.body_weight as number | null,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export type DietDayRow = {
  playerId: string;
  displayName: string;
  meals: number;
};

/** Each player who logged diet on `date`, with a summary. */
export async function getDietDay(date: string): Promise<DietDayRow[]> {
  const admin = createAdminClient();
  const [res, names] = await Promise.all([
    admin.from("diet_logs").select("player_id, diet_log_meals(id)").eq("log_date", date),
    activePlayerNames(),
  ]);
  return (res.data ?? [])
    .map((r) => ({
      playerId: r.player_id,
      displayName: names.get(r.player_id) ?? "Unknown",
      meals: ((r.diet_log_meals as unknown[]) ?? []).length,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
