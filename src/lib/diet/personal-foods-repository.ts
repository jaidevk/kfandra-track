import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PlayerFoodItem } from "./types";
import { selectEvicteeId } from "./personal-foods";

/**
 * Persistence for a player's "My foods" palette. Uses the service-role admin
 * client (RLS bypassed) and always filters by player_id explicitly. The diet
 * log itself is unaffected — this table is only a reusable palette.
 */

const SELECT_COLS = "id, name, unit, notes, use_count, last_used_at";

type Row = {
  id: string;
  name: string;
  unit: string | null;
  notes: string | null;
  use_count: number;
  last_used_at: string;
};

function toItem(r: Row): PlayerFoodItem {
  return {
    id: r.id,
    name: r.name,
    unit: r.unit,
    notes: r.notes,
    useCount: r.use_count,
  };
}

/** Display order: most-used first, then most recently used. */
function byDisplayOrder(a: Row, b: Row): number {
  if (b.use_count !== a.use_count) return b.use_count - a.use_count;
  return Date.parse(b.last_used_at) - Date.parse(a.last_used_at);
}

/** Load a player's personal foods, most-used first. */
export async function loadPlayerFoods(
  playerId: string,
): Promise<PlayerFoodItem[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("player_food_items")
    .select(SELECT_COLS)
    .eq("player_id", playerId)
    .order("use_count", { ascending: false })
    .order("last_used_at", { ascending: false });
  return ((data ?? []) as Row[]).map(toItem);
}

/**
 * Record that a player used a custom food: bump it if it already exists
 * (case-insensitive name+unit), else insert it. After an insert, enforce the
 * cap by evicting the least-used row. Returns the refreshed palette in display
 * order.
 */
export async function upsertPlayerFood(
  playerId: string,
  food: { name: string; unit: string | null; notes: string | null },
): Promise<PlayerFoodItem[]> {
  const admin = createAdminClient();
  const name = food.name.trim();
  const unit = food.unit?.trim() || null;
  const notes = food.notes?.trim() || null;
  if (!name) return loadPlayerFoods(playerId);

  // Find an existing match (case-insensitive name + unit).
  const { data: existing } = await admin
    .from("player_food_items")
    .select(SELECT_COLS)
    .eq("player_id", playerId)
    .ilike("name", name)
    .order("use_count", { ascending: false });

  const match = ((existing ?? []) as Row[]).find(
    (r) => (r.unit?.toLowerCase() ?? "") === (unit?.toLowerCase() ?? ""),
  );

  const nowIso = new Date().toISOString();

  if (match) {
    await admin
      .from("player_food_items")
      .update({ use_count: match.use_count + 1, last_used_at: nowIso })
      .eq("id", match.id);
    return loadPlayerFoods(playerId);
  }

  await admin
    .from("player_food_items")
    .insert({ player_id: playerId, name, unit, notes, last_used_at: nowIso });

  // Enforce the cap: load all rows, evict the least-used if over.
  const { data: all } = await admin
    .from("player_food_items")
    .select(SELECT_COLS)
    .eq("player_id", playerId);

  const rows = (all ?? []) as Row[];
  const evicteeId = selectEvicteeId(
    rows.map((r) => ({
      id: r.id,
      useCount: r.use_count,
      lastUsedAt: r.last_used_at,
    })),
  );
  if (evicteeId) {
    await admin.from("player_food_items").delete().eq("id", evicteeId);
    return rows
      .filter((r) => r.id !== evicteeId)
      .sort(byDisplayOrder)
      .map(toItem);
  }
  return rows.sort(byDisplayOrder).map(toItem);
}
