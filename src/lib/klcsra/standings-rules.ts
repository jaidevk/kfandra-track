/** Pure KLCSRA standings rules (no DB/server imports). DB loader in config.ts. */

export interface PointsTuple {
  win: number;
  draw: number;
  loss: number;
}

export interface StandingsRules {
  /** Matches with total players >= this use `atOrAbove`; below it use `below`. */
  playerThreshold: number;
  atOrAbove: PointsTuple;
  below: PointsTuple;
  margin: { threshold: number; winnerBonus: number; loserPenalty: number };
  combined: { halfWin: number; aggregateBonus: number };
}

export const DEFAULT_STANDINGS_RULES: StandingsRules = {
  playerThreshold: 6,
  atOrAbove: { win: 3, draw: 1, loss: 0 },
  below: { win: 0.2, draw: 0.05, loss: 0 },
  margin: { threshold: 20, winnerBonus: 1, loserPenalty: -1 },
  combined: { halfWin: 0.2, aggregateBonus: 0.1 },
};

function num(x: unknown, fallback: number): number {
  return typeof x === "number" && Number.isFinite(x) ? x : fallback;
}

function parseTuple(raw: unknown, def: PointsTuple): PointsTuple {
  const v = (raw ?? {}) as Record<string, unknown>;
  return { win: num(v.win, def.win), draw: num(v.draw, def.draw), loss: num(v.loss, def.loss) };
}

/** Coerce a raw app_config JSON value into StandingsRules with fallbacks. */
export function parseStandingsRules(value: unknown): StandingsRules {
  const v = (value ?? {}) as Record<string, unknown>;
  const d = DEFAULT_STANDINGS_RULES;
  const margin = (v.margin ?? {}) as Record<string, unknown>;
  const combined = (v.combined ?? {}) as Record<string, unknown>;
  return {
    playerThreshold: num(v.playerThreshold, d.playerThreshold),
    atOrAbove: parseTuple(v.atOrAbove, d.atOrAbove),
    below: parseTuple(v.below, d.below),
    margin: {
      threshold: num(margin.threshold, d.margin.threshold),
      winnerBonus: num(margin.winnerBonus, d.margin.winnerBonus),
      loserPenalty: num(margin.loserPenalty, d.margin.loserPenalty),
    },
    combined: {
      halfWin: num(combined.halfWin, d.combined.halfWin),
      aggregateBonus: num(combined.aggregateBonus, d.combined.aggregateBonus),
    },
  };
}
