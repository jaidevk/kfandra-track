/**
 * Pure KLC player value rules (spec 2026-11-22 §2). No DB/server imports.
 * DB loader: config.ts `loadValueRules`. Seed: migration 20261125120000.
 */
import { STAT_KEYS, type StatKey } from "./stat-rates";

export type ResultKey = "win" | "draw" | "loss";

export interface ValueRules {
  version: 1;
  result: Record<ResultKey, number>;
  /** Value change per stat. A stat missing here is worth 0. */
  stats: Partial<Record<StatKey, number>>;
  /** A value never drops below this, applied after each session day. */
  floor: number;
  smallSided: { enabled: boolean; belowPlayers: number; freeMatches: number };
}

export const DEFAULT_VALUE_RULES: ValueRules = {
  version: 1,
  result: { win: 20, draw: 5, loss: -10 },
  stats: {
    goal: 2, mainGoal: 2, reboundGoal: 2, try: 2, conversion: 2,
    assist: 1, preAssist: 0.5, save: 2,
    yellowCard: -10, redCard: -20, blueCard: -50,
  },
  floor: 0,
  smallSided: { enabled: true, belowPlayers: 7, freeMatches: 5 },
};

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isCount = (x: unknown): x is number => isNum(x) && Number.isInteger(x) && x >= 0;

/**
 * Coerce a raw app_config value into ValueRules, field by field. Never throws:
 * a bad config must not take the Values tab down.
 */
export function parseValueRules(value: unknown): ValueRules {
  const d = structuredClone(DEFAULT_VALUE_RULES);
  if (!isObj(value)) return d;

  const res = isObj(value.result) ? value.result : {};
  const result = {
    win: isNum(res.win) ? res.win : d.result.win,
    draw: isNum(res.draw) ? res.draw : d.result.draw,
    loss: isNum(res.loss) ? res.loss : d.result.loss,
  };

  let stats = d.stats;
  if (isObj(value.stats)) {
    stats = {};
    for (const k of STAT_KEYS) {
      const v = value.stats[k];
      if (isNum(v)) stats[k] = v;
    }
  }

  const ss = isObj(value.smallSided) ? value.smallSided : {};
  const smallSided = {
    enabled: typeof ss.enabled === "boolean" ? ss.enabled : d.smallSided.enabled,
    belowPlayers: isCount(ss.belowPlayers) ? ss.belowPlayers : d.smallSided.belowPlayers,
    freeMatches: isCount(ss.freeMatches) ? ss.freeMatches : d.smallSided.freeMatches,
  };

  return { version: 1, result, stats, floor: isNum(value.floor) ? value.floor : d.floor, smallSided };
}
