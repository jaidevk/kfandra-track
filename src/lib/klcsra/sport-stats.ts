/**
 * Pure KLCSRA per-sport stat allow-list (no DB/server imports). The recorder
 * filters its stats popup by sport, and the payout compute ignores disallowed
 * keys. DB loader lives in config.ts.
 */

import { STAT_KEYS, type StatKey } from "./stat-rates";

export type Sport = "football" | "rugby" | "fooba" | "variation";

export const SPORTS: readonly Sport[] = ["football", "rugby", "fooba", "variation"];

export const SPORT_LABELS: Record<Sport, string> = {
  football: "Football",
  rugby: "Rugby",
  fooba: "Fooba",
  variation: "Variation",
};

export type SportStats = Record<Sport, StatKey[]>;

/**
 * Spec v0.4 §Sport allow-list. Note two deliberate quirks: rugby carries
 * neither `save` nor any own-* stat, and rugby is the only sport with
 * `tackle`. Fooba is the football set with `goal` replaced by
 * `mainGoal` + `reboundGoal`, plus `switchover`.
 */
export const DEFAULT_SPORT_STATS: SportStats = {
  football: [
    "goal", "assist", "preAssist", "save",
    "yellowCard", "redCard", "blueCard", "lateChallenge",
    "ownGoal", "ownAssist", "ownPreAssist",
  ],
  rugby: [
    "try", "tackle", "assist", "preAssist",
    "yellowCard", "redCard", "blueCard", "lateChallenge",
  ],
  fooba: [
    "mainGoal", "reboundGoal", "switchover", "assist", "preAssist", "save",
    "yellowCard", "redCard", "blueCard", "lateChallenge",
    "ownGoal", "ownAssist", "ownPreAssist",
  ],
  variation: [...STAT_KEYS],
};

const KNOWN_STATS = new Set<string>(STAT_KEYS);
const ORDER = new Map<StatKey, number>(STAT_KEYS.map((k, i) => [k, i]));

/** Sort a stat list into canonical STAT_KEYS order. */
function inCanonicalOrder(keys: StatKey[]): StatKey[] {
  return [...keys].sort((a, b) => (ORDER.get(a) ?? 0) - (ORDER.get(b) ?? 0));
}

/**
 * Coerce a raw app_config JSON value into SportStats. An override must be an
 * array; unknown stat keys are dropped, and a sport whose override yields no
 * valid keys falls back to its default (an empty allow-list is never useful).
 */
export function parseSportStats(value: unknown): SportStats {
  const v = (value ?? {}) as Record<string, unknown>;
  const out = {} as SportStats;
  for (const sport of SPORTS) {
    const raw = v[sport];
    if (!Array.isArray(raw)) {
      out[sport] = [...DEFAULT_SPORT_STATS[sport]];
      continue;
    }
    // De-duplicate: app_config is hand-editable JSON with no uniqueness
    // constraint, and a repeated key would render the same button twice in the
    // recorder's stats popup.
    const keys = [...new Set(
      raw.filter((k): k is StatKey => typeof k === "string" && KNOWN_STATS.has(k)),
    )];
    out[sport] = keys.length > 0 ? keys : [...DEFAULT_SPORT_STATS[sport]];
  }
  return out;
}

/**
 * The stat keys a sport allows, in canonical display order.
 *
 * Note this deliberately DISCARDS the order the stats appear in `app_config`:
 * the allow-list configures MEMBERSHIP, and the recorder's stats popup should
 * group identically across sports (scoring, contributions, defensive,
 * sanctions, own-goals) rather than varying per sport.
 */
export function statsForSport(
  sport: Sport,
  config: SportStats = DEFAULT_SPORT_STATS,
): StatKey[] {
  // `klc_matches.sport` is a CHECK-constrained text column, not an enum, so it
  // reaches TypeScript as `string` and every call site is an unchecked cast.
  // An unrecognised sport therefore has to degrade, not throw. Falling back to
  // `variation` (every known stat) is the fail-safe direction: it never
  // silently excludes a stat and so never silently zeroes a payout.
  const allowed =
    config[sport] ?? DEFAULT_SPORT_STATS[sport] ?? DEFAULT_SPORT_STATS.variation;
  return inCanonicalOrder(allowed);
}
