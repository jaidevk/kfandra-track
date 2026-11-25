import { describe, it, expect } from "vitest";
import { DEFAULT_VALUE_RULES, parseValueRules } from "./value-rules";

describe("parseValueRules", () => {
  it("returns a fresh copy of the defaults for null or garbage", () => {
    expect(parseValueRules(null)).toEqual(DEFAULT_VALUE_RULES);
    expect(parseValueRules("x")).toEqual(DEFAULT_VALUE_RULES);
    const a = parseValueRules(null);
    a.result.win = 99;
    expect(DEFAULT_VALUE_RULES.result.win).toBe(20);
  });

  it("keeps valid fields and falls back field by field", () => {
    const r = parseValueRules({
      version: 1,
      result: { win: 30, draw: "x" },
      floor: 10,
      smallSided: { enabled: false },
    });
    expect(r.result).toEqual({ win: 30, draw: 5, loss: -10 });
    expect(r.floor).toBe(10);
    expect(r.smallSided).toEqual({ enabled: false, belowPlayers: 7, freeMatches: 5 });
    expect(r.stats).toEqual(DEFAULT_VALUE_RULES.stats);
  });

  it("uses only the numeric stats given; a missing stat is worth 0", () => {
    const r = parseValueRules({ version: 1, stats: { goal: 3, tackle: 1, bogus: 9, assist: "x" } });
    expect(r.stats).toEqual({ goal: 3, tackle: 1 });
  });

  it("rejects negative or fractional small-sided counts", () => {
    const r = parseValueRules({ version: 1, smallSided: { enabled: true, belowPlayers: -1, freeMatches: 2.5 } });
    expect(r.smallSided).toEqual({ enabled: true, belowPlayers: 7, freeMatches: 5 });
  });
});
