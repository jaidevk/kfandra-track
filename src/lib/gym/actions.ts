"use server";

import { getCurrentPlayer } from "@/lib/auth/current-user";
import { loadGymLog, saveGymLog } from "./repository";
import { isValidDateKey } from "./dates";
import type { GymDraft } from "./types";

/**
 * Server actions for Gym entry. Every action re-resolves the signed-in player
 * server-side (never trusting a client-supplied id) and operates through the
 * service-role admin client. Gym is unscored and per-day — there is no
 * Finalize step; saving is the record.
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const NOT_SIGNED_IN = "You must be signed in.";
const BAD_DATE = "That is not a valid date.";

/** Load a player's gym draft for a day. */
export async function loadGymLogAction(
  dateKey: string,
): Promise<ActionResult<{ draft: GymDraft }>> {
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };
  if (!isValidDateKey(dateKey)) return { ok: false, error: BAD_DATE };

  const draft = await loadGymLog(player.id, dateKey);
  return { ok: true, data: { draft } };
}

/** Flush a gym draft to the server (the autosave target). */
export async function saveGymLogAction(
  dateKey: string,
  draft: GymDraft,
): Promise<ActionResult> {
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };
  if (!isValidDateKey(dateKey)) return { ok: false, error: BAD_DATE };

  try {
    await saveGymLog(player.id, dateKey, draft);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}
