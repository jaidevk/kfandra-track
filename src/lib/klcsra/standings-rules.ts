/**
 * Pure KLCSRA league points rules, v2 (no DB/server imports). DB loader in
 * config.ts. Shape and numbers: league-scoring handover spec §3.2.
 *
 * Every type has a win value for every tier: below 7 players all types earn
 * the variation points (Q3), so a win always beats a draw.
 */
import { SPORTS, type Sport } from "./sport-stats";

export type TierKey = "7plus" | "4to6" | "2to3";
export const TIER_KEYS: readonly TierKey[] = ["7plus", "4to6", "2to3"];
export const TIER_LABELS: Record<TierKey, string> = {
  "7plus": "7+",
  "4to6": "4–6",
  "2to3": "2–3",
};

export interface Tier {
  key: TierKey;
  min: number;
  max: number | null;
}
export type TierPoints = Record<TierKey, number>;

export interface StandingsRules {
  version: 2;
  /** Players are counted across both sides together. */
  playerCount: "total";
  tiers: Tier[];
  win: Record<Sport, TierPoints>;
  draw: TierPoints;
  loss: number;
}

const MAIN: TierPoints = { "7plus": 5, "4to6": 1, "2to3": 0.5 };
const VARIATION: TierPoints = { "7plus": 3, "4to6": 1, "2to3": 0.5 };

export const DEFAULT_STANDINGS_RULES: StandingsRules = {
  version: 2,
  playerCount: "total",
  tiers: [
    { key: "7plus", min: 7, max: null },
    { key: "4to6", min: 4, max: 6 },
    { key: "2to3", min: 2, max: 3 },
  ],
  win: {
    football: { ...MAIN },
    fooba: { ...MAIN },
    rugby: { ...MAIN },
    rugby_variation: { ...VARIATION },
    short_game_variation: { ...VARIATION },
    multi_game_variation: { ...VARIATION },
  },
  draw: { "7plus": 1, "4to6": 0.2, "2to3": 0.1 },
  loss: 0,
};

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

function parseTierPoints(raw: unknown): TierPoints | null {
  if (!isObj(raw)) return null;
  const out = {} as TierPoints;
  for (const k of TIER_KEYS) {
    if (!isNum(raw[k])) return null;
    out[k] = raw[k];
  }
  return out;
}

function parseTiers(raw: unknown): Tier[] | null {
  if (!Array.isArray(raw) || raw.length !== TIER_KEYS.length) return null;
  const out: Tier[] = [];
  for (const t of raw) {
    if (!isObj(t) || !TIER_KEYS.includes(t.key as TierKey) || !isNum(t.min)) return null;
    if (t.max !== null && !isNum(t.max)) return null;
    if (t.max !== null && t.min > t.max) return null;
    out.push({ key: t.key as TierKey, min: t.min, max: t.max as number | null });
  }
  return new Set(out.map((t) => t.key)).size === TIER_KEYS.length ? out : null;
}

/**
 * Coerce a raw app_config value into v2 rules. Anything that isn't a valid v2
 * object (null, garbage, the old v1 shape) falls back to the defaults whole.
 * A single sport's malformed `win` entry falls back to that sport's default.
 * Shape is validated, but overlaps or gaps between tiers are not (admin-edited
 * config). Never throws: a bad config must not take the league page down.
 */
export function parseStandingsRules(value: unknown): StandingsRules {
  const d = DEFAULT_STANDINGS_RULES;
  // Fallbacks are fresh copies so callers can never mutate the defaults.
  if (!isObj(value) || value.version !== 2) return structuredClone(d);
  const tiers = parseTiers(value.tiers);
  const draw = parseTierPoints(value.draw);
  if (!tiers || !draw || !isNum(value.loss) || !isObj(value.win)) {
    return structuredClone(d);
  }
  const winRaw = value.win;
  const win = {} as Record<Sport, TierPoints>;
  for (const s of SPORTS) win[s] = parseTierPoints(winRaw[s]) ?? { ...d.win[s] };
  return { version: 2, playerCount: "total", tiers, win, draw, loss: value.loss };
}

/** The tier a match falls in by total players, or null when no tier matches (with the defaults: fewer than 2 players). */
export function tierFor(totalPlayers: number, rules: StandingsRules): TierKey | null {
  for (const t of rules.tiers) {
    if (totalPlayers >= t.min && (t.max === null || totalPlayers <= t.max)) return t.key;
  }
  return null;
}
