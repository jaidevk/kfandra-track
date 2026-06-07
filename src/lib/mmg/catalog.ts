import type { GameTypeKey, StatKey } from "./types";

/**
 * UI catalogue: which stats are relevant per game type, and how they group.
 * This is presentation logic (which inputs to render) — the point VALUES come
 * from point_rules in the DB, not from here. Keys match point_rules.rule_key.
 *
 * Note `goalConceded` appears only on Fooba (Big Goal) — matching the seed,
 * where Goal conceded (−200) is a Big-Goal-only per-game-type rule.
 */

export const PENALTY_KEYS: StatKey[] = [
  "yellowCards",
  "redCards",
  "blueCards",
  "lateChallenges",
  "fouls",
];

export const STATS_BY_TYPE: Record<GameTypeKey, StatKey[]> = {
  "football-short": [
    "goals", "assists", "preAssists", "saves", "goalLineSaves", "tackles",
    ...PENALTY_KEYS,
  ],
  "fooba-big-goal": [
    "goals", "assists", "preAssists", "saves", "goalLineSaves", "tackles", "goalConceded",
    ...PENALTY_KEYS,
  ],
  "fooba-rebound": [
    "goals", "reboundWall", "assists", "preAssists", "saves", "goalLineSaves", "tackles",
    ...PENALTY_KEYS,
  ],
  "three-and-in": [
    "goals", "assists", "preAssists", "tackles",
    ...PENALTY_KEYS,
  ],
  "rugby-short": [
    "tries", "assists", "preAssists", "tackles",
    ...PENALTY_KEYS,
  ],
  "rugby-full": [
    "tries", "assists", "preAssists", "tackles",
    ...PENALTY_KEYS,
  ],
  other: [
    "goals", "tries", "assists", "preAssists", "saves", "goalLineSaves", "reboundWall", "tackles",
    ...PENALTY_KEYS,
  ],
};

/** True for stats that subtract points (cards, fouls, conceded). */
export function isPenaltyStat(key: StatKey): boolean {
  return PENALTY_KEYS.includes(key) || key === "goalConceded";
}

/** Game-type display order (matches the seed sort_order). */
export const GAME_TYPE_ORDER: GameTypeKey[] = [
  "football-short",
  "rugby-short",
  "rugby-full",
  "fooba-big-goal",
  "fooba-rebound",
  "three-and-in",
  "other",
];
