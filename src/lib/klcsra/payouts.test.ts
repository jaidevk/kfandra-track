import { describe, it, expect } from "vitest";
import { computePlayerPayout } from "./payouts";
import { DEFAULT_STAT_RATES, parseStatRates } from "./stat-rates";
import { statsForSport, parseSportStats } from "./sport-stats";

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

describe("computePlayerPayout — malformed counts", () => {
  it("treats a NaN count as zero rather than poisoning the total", () => {
    // A recorder input doing parseInt("") yields NaN. `if (!n) continue` skips
    // it, so one bad field cannot turn a whole payout into NaN and write that
    // to the balance sheet. Pinned because a refactor to
    // `if (n === 0 || n === undefined)` would silently break it.
    expect(computePlayerPayout({ goal: NaN, assist: 1 }, DEFAULT_STAT_RATES))
      .toEqual({ kr: 10, mmg: 200 });
  });

  it("does process negative and fractional counts", () => {
    // This function is a pure sum and does not validate its input. Non-negative
    // integer counts are enforced one layer down by klc_player_stats'
    // check (stat_count >= 0). Pinned so the division of responsibility is
    // explicit rather than assumed.
    expect(computePlayerPayout({ goal: -1 }, DEFAULT_STAT_RATES))
      .toEqual({ kr: -20, mmg: -500 });
    expect(computePlayerPayout({ goal: 1.5 }, DEFAULT_STAT_RATES))
      .toEqual({ kr: 30, mmg: 750 });
  });
});

describe("computePlayerPayout — parsed config end to end", () => {
  it("composes with parsed app_config values, not just the defaults", () => {
    // Every other compute test imports DEFAULT_* directly, so nothing would
    // notice if a parser's output shape drifted from what the compute
    // functions expect. This walks the real Phase 2 chain.
    const rates = parseStatRates({ goal: { kr: 99, mmg: 1000 } });
    const sports = parseSportStats({ football: ["goal", "assist"] });
    expect(computePlayerPayout(
      { goal: 1, assist: 1, try: 1 },
      rates,
      { allowed: statsForSport("football", sports) },
    )).toEqual({ kr: 109, mmg: 1200 });
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
