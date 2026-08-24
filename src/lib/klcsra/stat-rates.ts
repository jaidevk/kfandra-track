/**
 * Pure KLCSRA per-stat payout rates (no DB/server imports — safe for Client
 * Components and unit tests). DB loader lives in config.ts. Mirrors the
 * balance-sheet rates.ts pattern.
 */

export type StatKey =
  | "goal" | "try" | "mainGoal" | "reboundGoal"
  | "assist" | "preAssist" | "switchover"
  | "tackle" | "save"
  | "yellowCard" | "redCard" | "blueCard" | "lateChallenge"
  | "ownGoal" | "ownAssist" | "ownPreAssist";

export interface StatRate {
  kr: number;
  mmg: number;
}

export type StatRates = Record<StatKey, StatRate>;

/**
 * Canonical stat order (also the display order): scoring events, then
 * contributions, then defensive, then sanctions, then own-goals.
 */
export const STAT_KEYS: readonly StatKey[] = [
  "goal", "try", "mainGoal", "reboundGoal",
  "assist", "preAssist", "switchover",
  "tackle", "save",
  "yellowCard", "redCard", "blueCard", "lateChallenge",
  "ownGoal", "ownAssist", "ownPreAssist",
];

/** Short human labels for UI. */
export const STAT_LABELS: Record<StatKey, string> = {
  goal: "Goal",
  try: "Try",
  mainGoal: "Main Goal",
  reboundGoal: "Rebound Goal",
  assist: "Assist",
  preAssist: "Pre-Assist",
  switchover: "Switchover",
  tackle: "Tackle",
  save: "Save",
  yellowCard: "Yellow Card",
  redCard: "Red Card",
  blueCard: "Blue Card",
  lateChallenge: "Late Challenge",
  ownGoal: "Own Goal",
  ownAssist: "Own Assist",
  ownPreAssist: "Own Pre-Assist",
};

export const DEFAULT_STAT_RATES: StatRates = {
  goal: { kr: 20, mmg: 500 },
  try: { kr: 25, mmg: 500 },
  mainGoal: { kr: 20, mmg: 500 },
  reboundGoal: { kr: 10, mmg: 300 },
  assist: { kr: 10, mmg: 200 },
  preAssist: { kr: 5, mmg: 100 },
  switchover: { kr: 5, mmg: 100 },
  tackle: { kr: 5, mmg: 100 },
  save: { kr: 5, mmg: 200 },
  yellowCard: { kr: -10, mmg: -200 },
  redCard: { kr: -20, mmg: -500 },
  blueCard: { kr: -30, mmg: -1000 },
  lateChallenge: { kr: -5, mmg: -100 },
  ownGoal: { kr: -20, mmg: -500 },
  ownAssist: { kr: -10, mmg: -200 },
  ownPreAssist: { kr: -5, mmg: -100 },
};

/** Coerce a raw app_config JSON value into StatRates with per-field fallbacks. */
export function parseStatRates(value: unknown): StatRates {
  const v = (value ?? {}) as Record<string, unknown>;
  const num = (x: unknown, fallback: number) =>
    typeof x === "number" && Number.isFinite(x) ? x : fallback;
  const out = {} as StatRates;
  for (const key of STAT_KEYS) {
    const raw = (v[key] ?? {}) as Record<string, unknown>;
    const def = DEFAULT_STAT_RATES[key];
    out[key] = { kr: num(raw.kr, def.kr), mmg: num(raw.mmg, def.mmg) };
  }
  return out;
}
