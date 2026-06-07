/**
 * Canonical MMG entry (draft) shape — shared by the client form, the autosave
 * layer, the scoring engine, and the server repository. Mirrors the DB:
 *   participation → mmg_entries columns
 *   games         → submission_games + submission_game_stats (EAV)
 *   others        → submission_others
 *   narration     → mmg_entries.narration
 *
 * Stats are held as a sparse Record keyed by StatKey so they map 1:1 onto the
 * EAV stat rows (and onto point_rules.rule_key).
 */

export type GameTypeKey =
  | "football-short"
  | "rugby-short"
  | "rugby-full"
  | "fooba-big-goal"
  | "fooba-rebound"
  | "three-and-in"
  | "other";

export type GameResult = "won" | "drew" | "lost";

export type StatKey =
  | "goals"
  | "tries"
  | "assists"
  | "preAssists"
  | "saves"
  | "goalLineSaves"
  | "reboundWall"
  | "tackles"
  | "goalConceded"
  | "yellowCards"
  | "redCards"
  | "blueCards"
  | "lateChallenges"
  | "fouls";

export interface Participation {
  confirmationOrder: number | null;
  arrivalOrder: number | null;
  unpacking: boolean | null;
  packingWeights: boolean | null;
  packingKit: boolean | null; // training material / PTM
  confirmedBy11am: boolean | null;
}

export interface GameDraft {
  /** Client-stable id (also the submission_games id when round-tripped). */
  id: string;
  type: GameTypeKey;
  result: GameResult | null;
  /** Sparse stat counts; absent or 0 means "not recorded". */
  stats: Partial<Record<StatKey, number>>;
}

export interface OtherRow {
  id: string;
  description: string;
  /** Free-form points; kept as string in the form, coerced on save. */
  points: string;
}

export interface MmgDraft {
  participation: Participation;
  games: GameDraft[];
  others: OtherRow[];
  narration: string;
}

export const emptyParticipation: Participation = {
  confirmationOrder: null,
  arrivalOrder: null,
  unpacking: null,
  packingWeights: null,
  packingKit: null,
  confirmedBy11am: null,
};

export function emptyDraft(): MmgDraft {
  return {
    participation: { ...emptyParticipation },
    games: [],
    others: [],
    narration: "",
  };
}

export function emptyGame(id: string): GameDraft {
  return { id, type: "football-short", result: "won", stats: {} };
}
