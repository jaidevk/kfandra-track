/**
 * Pure mapping between stored DB rows and the ClubBalanceDraft shape. Kept free
 * of server-only imports so it is unit-testable. The DB I/O lives in
 * repository.ts.
 */
import type { ClubBalanceDraft } from "./types";

export interface SheetRow {
  as_of_date: string | null;
  matches_played: number;
  matches_won: number;
  matches_drawn: number;
  matches_lost: number;
  club_bonus: number;
}
export interface ShareRowWithName {
  player_id: string;
  amount: number;
  display_name: string;
}

/** Merge stored sheet + loanee rows into a draft. */
export function buildBalanceDraft(
  sheet: SheetRow | null,
  shares: ShareRowWithName[],
): ClubBalanceDraft {
  return {
    asOfDate: sheet?.as_of_date ?? null,
    matchesPlayed: sheet?.matches_played ?? 0,
    matchesWon: sheet?.matches_won ?? 0,
    matchesDrawn: sheet?.matches_drawn ?? 0,
    matchesLost: sheet?.matches_lost ?? 0,
    clubBonus: sheet?.club_bonus ?? 0,
    shares: shares.map((s) => ({
      playerId: s.player_id,
      playerName: s.display_name,
      amount: s.amount,
    })),
  };
}
