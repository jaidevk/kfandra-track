"use server";

import { getCurrentPlayer } from "@/lib/auth/current-user";
import { loadDietLog, saveDietLog } from "./repository";
import { loadPlayerFoods, upsertPlayerFood } from "./personal-foods-repository";
import { isValidDateKey } from "./dates";
import type { DietDraft, PlayerFoodItem } from "./types";

/**
 * Server actions for Diet entry. Every action re-resolves the signed-in player
 * server-side (never trusting a client-supplied id) and operates through the
 * service-role admin client. Diet is unscored and per-day — there is no
 * Finalize step; saving is the record.
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const NOT_SIGNED_IN = "You must be signed in.";
const BAD_DATE = "That is not a valid date.";

/** Load a player's diet draft for a day. */
export async function loadDietLogAction(
  dateKey: string,
): Promise<ActionResult<{ draft: DietDraft }>> {
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };
  if (!isValidDateKey(dateKey)) return { ok: false, error: BAD_DATE };

  const draft = await loadDietLog(player.id, dateKey);
  return { ok: true, data: { draft } };
}

/** Flush a diet draft to the server (the autosave target). */
export async function saveDietLogAction(
  dateKey: string,
  draft: DietDraft,
): Promise<ActionResult> {
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };
  if (!isValidDateKey(dateKey)) return { ok: false, error: BAD_DATE };

  try {
    await saveDietLog(player.id, dateKey, draft);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}

/** Record a used custom food in the player's palette; returns the refreshed list. */
export async function savePlayerFoodAction(food: {
  name: string;
  unit: string | null;
  notes: string | null;
}): Promise<ActionResult<{ foods: PlayerFoodItem[] }>> {
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };
  if (!food.name.trim()) {
    const foods = await loadPlayerFoods(player.id);
    return { ok: true, data: { foods } };
  }
  try {
    const foods = await upsertPlayerFood(player.id, food);
    return { ok: true, data: { foods } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}
