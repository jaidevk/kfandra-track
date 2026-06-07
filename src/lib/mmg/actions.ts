"use server";

import { getCurrentPlayer } from "@/lib/auth/current-user";
import { getOrCreateSession } from "./sessions";
import { loadScoringConfig } from "./config";
import { loadMmgEntry, saveMmgEntry } from "./repository";
import { computeSessionOrderPoints, type SessionOrderResult } from "./order";
import type { GameTypeKey, MmgDraft } from "./types";

/**
 * Server actions for MMG entry. Every action re-resolves the signed-in player
 * server-side (never trusting a client-supplied id) and operates through the
 * service-role admin client. There is no approval gate — saving is the record.
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const NOT_SIGNED_IN = "You must be signed in.";
const BAD_SESSION = "That is not a valid session day.";

/**
 * Load a player's draft for a session date (find-or-creates the session).
 * Returns the draft plus the resolved session id.
 */
export async function loadMmgDraftAction(
  dateKey: string,
): Promise<ActionResult<{ sessionId: string; draft: MmgDraft }>> {
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };

  const session = await getOrCreateSession(dateKey);
  if (!session) return { ok: false, error: BAD_SESSION };

  // Build id→key map for loading game types.
  const { gameTypes } = await loadScoringConfig();
  const gameTypeKeyById: Record<string, GameTypeKey> = {};
  for (const g of gameTypes) gameTypeKeyById[g.id] = g.key;

  const draft = await loadMmgEntry(player.id, session.id, { gameTypeKeyById });
  return { ok: true, data: { sessionId: session.id, draft } };
}

/** Flush a draft to the server (the autosave + Finalize target). */
export async function saveMmgDraftAction(
  sessionId: string,
  draft: MmgDraft,
): Promise<ActionResult> {
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };

  const { gameTypeIdByKey } = await loadScoringConfig();

  try {
    await saveMmgEntry(player.id, sessionId, draft, { gameTypeIdByKey });
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}

/**
 * Finalize: definitively flush the draft, then return the session's (now
 * recomputed) provisional order ladder. NOT an approval gate — it just commits
 * the latest state and surfaces the order-N result.
 */
export async function finalizeMmgSessionAction(
  sessionId: string,
  draft: MmgDraft,
): Promise<ActionResult<{ order: SessionOrderResult[] }>> {
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };

  const { gameTypeIdByKey } = await loadScoringConfig();

  try {
    await saveMmgEntry(player.id, sessionId, draft, { gameTypeIdByKey });
    const order = await computeSessionOrderPoints(sessionId);
    return { ok: true, data: { order } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Finalize failed." };
  }
}
