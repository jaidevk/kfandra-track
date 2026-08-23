import { describe, it, expect } from "vitest";
import { DEFAULT_STANDINGS_RULES, parseStandingsRules } from "./standings-rules";

describe("DEFAULT_STANDINGS_RULES", () => {
  it("matches the agreed defaults", () => {
    expect(DEFAULT_STANDINGS_RULES).toEqual({
      playerThreshold: 6,
      atOrAbove: { win: 3, draw: 1, loss: 0 },
      below: { win: 0.2, draw: 0.05, loss: 0 },
      margin: { threshold: 20, winnerBonus: 1, loserPenalty: -1 },
      combined: { halfWin: 0.2, aggregateBonus: 0.1 },
    });
  });
});

describe("parseStandingsRules", () => {
  it("returns defaults for null input", () => {
    expect(parseStandingsRules(null)).toEqual(DEFAULT_STANDINGS_RULES);
  });

  it("overrides the threshold but keeps the rest", () => {
    const r = parseStandingsRules({ playerThreshold: 8 });
    expect(r.playerThreshold).toBe(8);
    expect(r.atOrAbove).toEqual({ win: 3, draw: 1, loss: 0 });
    expect(r.combined).toEqual({ halfWin: 0.2, aggregateBonus: 0.1 });
  });

  it("overrides a nested tuple field per-field", () => {
    const r = parseStandingsRules({ below: { win: 0.5 } });
    expect(r.below).toEqual({ win: 0.5, draw: 0.05, loss: 0 });
  });
});
