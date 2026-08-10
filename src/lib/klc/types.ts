/**
 * Canonical Club Balance Sheet draft — shared by the client form, the compute
 * engine, the repository, and the admin view. Mirrors the DB:
 *   sheet fields → club_balance_sheets columns
 *   shares       → club_player_shares (dynamic loanee rows the Manager adds)
 * Totals (items 8/9/10) are NOT stored here; they are computed in compute.ts.
 */

export interface ClubSummary {
  id: string;
  slug: string;
  name: string;
  managerName: string;
  managerPlayerId: string | null;
  logoPath: string;
}

/** A member available to be added as a loanee (picker option). */
export interface MemberOption {
  id: string;
  displayName: string;
}

/** One loanee row: which member, and their item-4 number. */
export interface ClubPlayerShare {
  playerId: string;
  playerName: string;
  amount: number;
}

export interface ClubBalanceDraft {
  asOfDate: string | null; // item 1 — 'YYYY-MM-DD' or null
  matchesPlayed: number; // item 2
  matchesWon: number; // item 3
  matchesDrawn: number; // item 5
  matchesLost: number; // item 6
  clubBonus: number; // item 7 (Kroopies)
  shares: ClubPlayerShare[]; // item 4 — dynamic loanee rows
}

/** A blank running sheet (no loanees yet). */
export function emptyBalanceDraft(): ClubBalanceDraft {
  return {
    asOfDate: null,
    matchesPlayed: 0,
    matchesWon: 0,
    matchesDrawn: 0,
    matchesLost: 0,
    clubBonus: 0,
    shares: [],
  };
}
