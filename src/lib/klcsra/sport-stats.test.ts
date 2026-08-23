import { describe, it, expect } from "vitest";
import {
  DEFAULT_SPORT_STATS,
  SPORTS,
  parseSportStats,
  statsForSport,
} from "./sport-stats";
import { STAT_KEYS } from "./stat-rates";

describe("DEFAULT_SPORT_STATS", () => {
  it("covers all four sports", () => {
    expect(SPORTS).toEqual(["football", "rugby", "fooba", "variation"]);
  });

  it("matches the spec allow-lists", () => {
    expect(DEFAULT_SPORT_STATS.football).toHaveLength(11);
    expect(DEFAULT_SPORT_STATS.rugby).toHaveLength(8);
    expect(DEFAULT_SPORT_STATS.fooba).toHaveLength(13);
    expect(DEFAULT_SPORT_STATS.variation).toHaveLength(16);
  });

  it("football has goal+save but no try/tackle/fooba stats", () => {
    expect(DEFAULT_SPORT_STATS.football).toContain("goal");
    expect(DEFAULT_SPORT_STATS.football).toContain("save");
    expect(DEFAULT_SPORT_STATS.football).not.toContain("try");
    expect(DEFAULT_SPORT_STATS.football).not.toContain("tackle");
    expect(DEFAULT_SPORT_STATS.football).not.toContain("mainGoal");
  });

  it("rugby has try+tackle but deliberately no save and no own-* stats", () => {
    expect(DEFAULT_SPORT_STATS.rugby).toContain("try");
    expect(DEFAULT_SPORT_STATS.rugby).toContain("tackle");
    expect(DEFAULT_SPORT_STATS.rugby).not.toContain("save");
    expect(DEFAULT_SPORT_STATS.rugby).not.toContain("ownGoal");
  });

  it("fooba replaces goal with mainGoal/reboundGoal and adds switchover", () => {
    expect(DEFAULT_SPORT_STATS.fooba).toContain("mainGoal");
    expect(DEFAULT_SPORT_STATS.fooba).toContain("reboundGoal");
    expect(DEFAULT_SPORT_STATS.fooba).toContain("switchover");
    expect(DEFAULT_SPORT_STATS.fooba).not.toContain("goal");
  });

  it("variation allows every known stat", () => {
    expect([...DEFAULT_SPORT_STATS.variation].sort()).toEqual([...STAT_KEYS].sort());
  });
});

describe("parseSportStats", () => {
  it("returns defaults for null/garbage input", () => {
    expect(parseSportStats(null)).toEqual(DEFAULT_SPORT_STATS);
    expect(parseSportStats("nope")).toEqual(DEFAULT_SPORT_STATS);
  });

  it("overrides one sport, keeping defaults for the rest", () => {
    const r = parseSportStats({ football: ["goal", "assist"] });
    expect(r.football).toEqual(["goal", "assist"]);
    expect(r.rugby).toEqual(DEFAULT_SPORT_STATS.rugby);
  });

  it("drops unknown stat keys from an override", () => {
    const r = parseSportStats({ football: ["goal", "bogus", "assist"] });
    expect(r.football).toEqual(["goal", "assist"]);
  });

  it("falls back to the default when an override is not an array", () => {
    const r = parseSportStats({ rugby: "try,tackle" });
    expect(r.rugby).toEqual(DEFAULT_SPORT_STATS.rugby);
  });

  it("falls back to the default when an override has no valid keys", () => {
    const r = parseSportStats({ rugby: ["bogus", "alsoBogus"] });
    expect(r.rugby).toEqual(DEFAULT_SPORT_STATS.rugby);
  });

  it("ignores unknown sports", () => {
    const r = parseSportStats({ hockey: ["goal"] });
    expect(r).toEqual(DEFAULT_SPORT_STATS);
  });
});

describe("statsForSport", () => {
  it("returns the configured list for a sport", () => {
    // statsForSport re-sorts into canonical STAT_KEYS order, so rugby's
    // seeded order (tackle listed 2nd) comes back with tackle after preAssist.
    expect(statsForSport("rugby")).toEqual([
      "try", "assist", "preAssist", "tackle",
      "yellowCard", "redCard", "blueCard", "lateChallenge",
    ]);
    expect([...statsForSport("rugby")].sort()).toEqual(
      [...DEFAULT_SPORT_STATS.rugby].sort(),
    );
  });

  it("honours a custom config", () => {
    const cfg = parseSportStats({ football: ["goal"] });
    expect(statsForSport("football", cfg)).toEqual(["goal"]);
  });

  it("returns keys in canonical STAT_KEYS order", () => {
    const cfg = parseSportStats({ football: ["ownGoal", "goal", "save"] });
    expect(statsForSport("football", cfg)).toEqual(["goal", "save", "ownGoal"]);
  });
});
