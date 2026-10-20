import { describe, it, expect } from "vitest";
import {
  DEFAULT_STANDINGS_RULES as D,
  TIER_KEYS,
  parseStandingsRules,
  tierFor,
} from "./standings-rules";
import { SPORTS } from "./sport-stats";

describe("DEFAULT_STANDINGS_RULES (v2)", () => {
  it("has a win entry for every sport and tier", () => {
    for (const s of SPORTS) for (const t of TIER_KEYS) {
      expect(typeof D.win[s][t]).toBe("number");
    }
  });

  it("7+ wins: 5 for football/fooba/rugby, 3 for the variations", () => {
    expect(D.win.football["7plus"]).toBe(5);
    expect(D.win.fooba["7plus"]).toBe(5);
    expect(D.win.rugby["7plus"]).toBe(5);
    expect(D.win.rugby_variation["7plus"]).toBe(3);
    expect(D.win.short_game_variation["7plus"]).toBe(3);
    expect(D.win.multi_game_variation["7plus"]).toBe(3);
  });

  it("below 7 every type earns the variation points", () => {
    for (const s of SPORTS) {
      expect(D.win[s]["4to6"]).toBe(1);
      expect(D.win[s]["2to3"]).toBe(0.5);
    }
  });

  it("draws 1 / 0.2 / 0.1 and loss 0", () => {
    expect(D.draw).toEqual({ "7plus": 1, "4to6": 0.2, "2to3": 0.1 });
    expect(D.loss).toBe(0);
  });
});

describe("tierFor", () => {
  it.each([
    [12, "7plus"], [7, "7plus"], [6, "4to6"], [4, "4to6"],
    [3, "2to3"], [2, "2to3"], [1, null], [0, null],
  ])("%i players -> %s", (n, tier) => {
    expect(tierFor(n, D)).toBe(tier);
  });
});

describe("parseStandingsRules", () => {
  it("parses the defaults as a round trip", () => {
    expect(parseStandingsRules(JSON.parse(JSON.stringify(D)))).toEqual(D);
  });

  it("falls back to defaults for null, garbage and v1", () => {
    expect(parseStandingsRules(null)).toEqual(D);
    expect(parseStandingsRules("nope")).toEqual(D);
    expect(
      parseStandingsRules({
        playerThreshold: 6,
        atOrAbove: { win: 3, draw: 1, loss: 0 },
        below: { win: 0.2, draw: 0.05, loss: 0 },
      }),
    ).toEqual(D);
  });

  it("falls back to defaults when tiers or draw are malformed", () => {
    const bad = JSON.parse(JSON.stringify(D));
    bad.draw = { "7plus": 1 };
    expect(parseStandingsRules(bad)).toEqual(D);
    const bad2 = JSON.parse(JSON.stringify(D));
    bad2.tiers = [{ key: "7plus", min: 7, max: null }];
    expect(parseStandingsRules(bad2)).toEqual(D);
  });

  it("honours a tuned value", () => {
    const tuned = JSON.parse(JSON.stringify(D));
    tuned.win.football["7plus"] = 6;
    expect(parseStandingsRules(tuned).win.football["7plus"]).toBe(6);
  });

  it("defaults one sport whose win entry is malformed, keeping the rest", () => {
    const v = JSON.parse(JSON.stringify(D));
    v.win.fooba = { "7plus": "five" };
    v.win.football["7plus"] = 6;
    const r = parseStandingsRules(v);
    expect(r.win.fooba).toEqual(D.win.fooba);
    expect(r.win.football["7plus"]).toBe(6);
  });

  it("falls back to defaults when a tier has min > max", () => {
    const bad = JSON.parse(JSON.stringify(D));
    bad.tiers[1] = { key: "4to6", min: 6, max: 4 };
    expect(parseStandingsRules(bad)).toEqual(D);
  });

  it("returns a fresh copy on fallback, never the defaults themselves", () => {
    const r = parseStandingsRules(null);
    r.win.football["7plus"] = 99;
    r.tiers[0].min = 99;
    expect(D.win.football["7plus"]).toBe(5);
    expect(D.tiers[0].min).toBe(7);
  });
});
