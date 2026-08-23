import { describe, it, expect } from "vitest";
import { computePlayerPayout } from "./payouts";
import { DEFAULT_STAT_RATES } from "./stat-rates";
import { statsForSport } from "./sport-stats";

describe("computePlayerPayout", () => {
  it("is zero for no stats", () => {
    expect(computePlayerPayout({}, DEFAULT_STAT_RATES)).toEqual({ kr: 0, mmg: 0 });
  });

  it("sums a goal + assist (the J. Karanth example)", () => {
    expect(computePlayerPayout({ goal: 1, assist: 1 }, DEFAULT_STAT_RATES))
      .toEqual({ kr: 30, mmg: 700 }); // 20+10 KR, 500+200 MMG
  });

  it("multiplies by the count (hat-trick)", () => {
    expect(computePlayerPayout({ goal: 3 }, DEFAULT_STAT_RATES))
      .toEqual({ kr: 60, mmg: 1500 });
  });

  it("applies negative stats (a yellow card deducts)", () => {
    expect(computePlayerPayout({ yellowCard: 1 }, DEFAULT_STAT_RATES))
      .toEqual({ kr: -10, mmg: -200 });
  });

  it("ignores unknown keys and zero counts", () => {
    expect(computePlayerPayout({ goal: 0, bogus: 5 } as never, DEFAULT_STAT_RATES))
      .toEqual({ kr: 0, mmg: 0 });
  });

  it("scores the Fooba stats", () => {
    expect(computePlayerPayout(
      { mainGoal: 1, reboundGoal: 1, switchover: 2 },
      DEFAULT_STAT_RATES,
    )).toEqual({ kr: 40, mmg: 1000 }); // 20+10+10 KR, 500+300+200 MMG
  });
});

describe("computePlayerPayout — friendlies (includeKR: false)", () => {
  it("zeroes KR when includeKR is false", () => {
    expect(computePlayerPayout(
      { goal: 1, assist: 1 },
      DEFAULT_STAT_RATES,
      { includeKR: false },
    )).toEqual({ kr: 0, mmg: 700 });
  });

  it("zeroes negative KR too", () => {
    expect(computePlayerPayout(
      { redCard: 1 },
      DEFAULT_STAT_RATES,
      { includeKR: false },
    )).toEqual({ kr: 0, mmg: -500 });
  });

  it("includeKR: true is the default", () => {
    expect(computePlayerPayout({ goal: 1 }, DEFAULT_STAT_RATES, {}))
      .toEqual({ kr: 20, mmg: 500 });
  });
});

describe("computePlayerPayout — sport allow-list", () => {
  it("ignores a stat the sport does not allow", () => {
    // `try` is rugby-only; on a football match it must score nothing.
    expect(computePlayerPayout(
      { goal: 1, try: 1 },
      DEFAULT_STAT_RATES,
      { allowed: statsForSport("football") },
    )).toEqual({ kr: 20, mmg: 500 });
  });

  it("ignores goal on a Fooba match (Fooba uses mainGoal/reboundGoal)", () => {
    expect(computePlayerPayout(
      { goal: 3, mainGoal: 1 },
      DEFAULT_STAT_RATES,
      { allowed: statsForSport("fooba") },
    )).toEqual({ kr: 20, mmg: 500 });
  });

  it("scores everything when no allow-list is given", () => {
    expect(computePlayerPayout({ goal: 1, try: 1 }, DEFAULT_STAT_RATES))
      .toEqual({ kr: 45, mmg: 1000 });
  });

  it("combines with includeKR", () => {
    expect(computePlayerPayout(
      { goal: 1, try: 1 },
      DEFAULT_STAT_RATES,
      { includeKR: false, allowed: statsForSport("football") },
    )).toEqual({ kr: 0, mmg: 500 });
  });
});
