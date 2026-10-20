import { describe, it, expect } from "vitest";
import {
  DEFAULT_TABLE_GROUPS as G,
  groupScoreKinds,
  parseTableGroups,
  sportInGroup,
} from "./table-groups";

describe("DEFAULT_TABLE_GROUPS", () => {
  it("is All + the 4 separate tables, in display order", () => {
    expect(Object.keys(G)).toEqual([
      "all", "football_fooba", "rugby_sox", "rugby_variations", "short_game_variations",
    ]);
  });

  it("puts multi-game variation in All only (Q2)", () => {
    expect(sportInGroup("multi_game_variation", "all", G)).toBe(true);
    for (const k of Object.keys(G).filter((k) => k !== "all")) {
      expect(sportInGroup("multi_game_variation", k, G)).toBe(false);
    }
  });
});

describe("sportInGroup", () => {
  it("matches listed sports and rejects unknown groups", () => {
    expect(sportInGroup("fooba", "football_fooba", G)).toBe(true);
    expect(sportInGroup("rugby", "football_fooba", G)).toBe(false);
    expect(sportInGroup("rugby", "nope", G)).toBe(false);
  });
});

describe("groupScoreKinds", () => {
  it("All shows both; rugby groups tries only; football groups goals only", () => {
    expect(groupScoreKinds("all", G)).toEqual({ goals: true, tries: true });
    expect(groupScoreKinds("rugby_sox", G)).toEqual({ goals: false, tries: true });
    expect(groupScoreKinds("rugby_variations", G)).toEqual({ goals: false, tries: true });
    expect(groupScoreKinds("football_fooba", G)).toEqual({ goals: true, tries: false });
    expect(groupScoreKinds("short_game_variations", G)).toEqual({ goals: true, tries: false });
  });
});

describe("parseTableGroups", () => {
  it("round-trips the defaults", () => {
    expect(parseTableGroups(JSON.parse(JSON.stringify(G)))).toEqual(G);
  });

  it("falls back for garbage and for an object with no usable groups", () => {
    expect(parseTableGroups(null)).toEqual(G);
    expect(parseTableGroups({ x: ["hockey"] })).toEqual(G);
  });

  it("drops unknown sports and keeps order", () => {
    expect(parseTableGroups({ all: "*", mixed: ["fooba", "hockey"] })).toEqual({
      all: "*",
      mixed: ["fooba"],
    });
  });

  it("drops an empty group and de-duplicates sports", () => {
    expect(parseTableGroups({ all: "*", empty: [], dup: ["fooba", "fooba"] })).toEqual({
      all: "*",
      dup: ["fooba"],
    });
  });

  it("ignores a __proto__ key", () => {
    const r = parseTableGroups(JSON.parse('{"__proto__": ["fooba"], "all": "*"}'));
    expect(r).toEqual({ all: "*" });
    expect(Object.getPrototypeOf(r)).toBe(Object.prototype);
  });

  it("returns a fresh copy on fallback, never the defaults themselves", () => {
    const r = parseTableGroups(null);
    (r.football_fooba as string[]).push("rugby");
    delete r.all;
    expect(G.football_fooba).toEqual(["football", "fooba"]);
    expect(G.all).toBe("*");
  });
});
