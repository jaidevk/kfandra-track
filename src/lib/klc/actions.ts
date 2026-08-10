"use server";

import { getCurrentPlayer } from "@/lib/auth/current-user";
import { isStaffRole } from "@/lib/auth/roles";
import { getClub, saveClubBalance } from "./repository";
import type { ClubBalanceDraft } from "./types";

/**
 * Save action for the Club Balance Sheet. Re-resolves the signed-in player and
 * enforces: staff may edit any club; otherwise the player MUST be this club's
 * Player Manager (clubs.manager_player_id). Saving is the record (no approval
 * gate), mirroring MMG.
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const NOT_SIGNED_IN = "You must be signed in.";
const NOT_MANAGER = "Only this club's Player Manager can edit its balance sheet.";
const NO_CLUB = "Club not found.";

/** Sanitise a client draft: coerce to non-negative integers, drop empty rows. */
function sanitize(draft: ClubBalanceDraft): ClubBalanceDraft {
  const n = (x: unknown) => {
    const v = Math.trunc(Number(x));
    return Number.isFinite(v) && v > 0 ? v : 0;
  };
  return {
    asOfDate: draft.asOfDate || null,
    matchesPlayed: n(draft.matchesPlayed),
    matchesWon: n(draft.matchesWon),
    matchesDrawn: n(draft.matchesDrawn),
    matchesLost: n(draft.matchesLost),
    clubBonus: n(draft.clubBonus),
    shares: (draft.shares ?? [])
      .filter((s) => s.playerId)
      .map((s) => ({ playerId: s.playerId, playerName: s.playerName, amount: n(s.amount) })),
  };
}

export async function saveClubBalanceAction(
  clubId: string,
  draft: ClubBalanceDraft,
): Promise<ActionResult> {
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };

  const club = await getClub(clubId);
  if (!club) return { ok: false, error: NO_CLUB };

  const allowed = isStaffRole(player.role) || club.managerPlayerId === player.id;
  if (!allowed) return { ok: false, error: NOT_MANAGER };

  try {
    await saveClubBalance(clubId, sanitize(draft), player.id);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}
