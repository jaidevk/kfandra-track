import { describe, it, expect } from "vitest";
import {
  DEFAULT_TABLE_GROUPS as G,
  groupScoreKinds,
  parseTableGroups,
  sportInGroup,
} from "./table-groups";

describe("DEFAULT_TABLE_GROUPS", () => {
  it("is All + the 5 separate tables, in display order", () => {
    expect(Object.keys(G)).toEqual([
      "all", "football_fooba", "rugby_sox", "rugby_variations", "short_game_variations",
      "multi_game_variations",
    ]);
  });

  it("puts multi-game variation in All and its own table only (Sir, 2026-10-28)", () => {
    const own = ["all", "multi_game_variations"];
    for (const k of Object.keys(G)) {
      expect(sportInGroup("multi_game_variation", k, G)).toBe(own.includes(k));
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

/** The stored (array) form of a record. */
const toStored = (g: Record<string, unknown>) =>
  Object.entries(g).map(([key, sports]) => ({ key, sports }));

describe("parseTableGroups", () => {
  it("round-trips the defaults from the stored array form, in order", () => {
    const r = parseTableGroups(JSON.parse(JSON.stringify(toStored(G))));
    expect(r).toEqual(G);
    expect(Object.keys(r)).toEqual(Object.keys(G));
  });

  it("preserves array order even when it is not the default order", () => {
    const r = parseTableGroups([
      { key: "short_game_variations", sports: ["short_game_variation"] },
      { key: "all", sports: "*" },
      { key: "rugby_sox", sports: ["rugby"] },
    ]);
    expect(Object.keys(r)).toEqual(["short_game_variations", "all", "rugby_sox"]);
  });

  it("falls back for garbage, for the old object form, and for no usable groups", () => {
    expect(parseTableGroups(null)).toEqual(G);
    expect(parseTableGroups("all")).toEqual(G);
    expect(parseTableGroups({ all: "*", rugby_sox: ["rugby"] })).toEqual(G);
    expect(parseTableGroups([])).toEqual(G);
    expect(parseTableGroups([{ key: "x", sports: ["hockey"] }])).toEqual(G);
  });

  it("drops invalid entries", () => {
    expect(parseTableGroups([
      null, "all", ["all", "*"], { sports: "*" }, { key: "", sports: "*" },
      { key: 7, sports: "*" }, { key: "nosports" }, { key: "bad", sports: "rugby" },
      { key: "all", sports: "*" },
    ])).toEqual({ all: "*" });
  });

  it("keeps the first of duplicate keys", () => {
    expect(parseTableGroups([
      { key: "all", sports: "*" },
      { key: "g", sports: ["fooba"] },
      { key: "g", sports: ["rugby"] },
    ])).toEqual({ all: "*", g: ["fooba"] });
  });

  it("drops unknown sports, empty groups and duplicate sports", () => {
    expect(parseTableGroups([
      { key: "all", sports: "*" },
      { key: "mixed", sports: ["fooba", "hockey"] },
      { key: "empty", sports: [] },
      { key: "dup", sports: ["rugby", "rugby"] },
    ])).toEqual({ all: "*", mixed: ["fooba"], dup: ["rugby"] });
  });

  it("ignores a __proto__ key", () => {
    const r = parseTableGroups(JSON.parse('[{"key":"__proto__","sports":["fooba"]},{"key":"all","sports":"*"}]'));
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
