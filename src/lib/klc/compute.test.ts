import { describe, it, expect } from "vitest";
import { computeClubTotals } from "./compute";
import { DEFAULT_KLC_RATES } from "./rates";
import type { ClubBalanceDraft } from "./types";

const base: ClubBalanceDraft = {
  asOfDate: "2026-07-20",
  matchesPlayed: 6,
  matchesWon: 4,
  matchesDrawn: 1,
  matchesLost: 1,
  clubBonus: 50,
  shares: [
    { playerId: "a", playerName: "A", amount: 5 },
    { playerId: "b", playerName: "B", amount: 4 },
  ],
};

describe("computeClubTotals", () => {
  it("matches the worked example (played 6, won 4, bonus 50, loanees 5+4)", () => {
    expect(computeClubTotals(base, DEFAULT_KLC_RATES)).toEqual({
      paidToKfandra: 60, // 6 * 10
      receivedFromKfandra: 130, // 4 * 20 + 50
      distributedToLoanees: 90, // (5 + 4) * 10
    });
  });

  it("is all zero for an empty sheet", () => {
    const empty: ClubBalanceDraft = {
      asOfDate: null, matchesPlayed: 0, matchesWon: 0, matchesDrawn: 0,
      matchesLost: 0, clubBonus: 0, shares: [],
    };
    expect(computeClubTotals(empty, DEFAULT_KLC_RATES)).toEqual({
      paidToKfandra: 0, receivedFromKfandra: 0, distributedToLoanees: 0,
    });
  });

  it("adds the club bonus even with zero wins", () => {
    expect(computeClubTotals({ ...base, matchesWon: 0 }, DEFAULT_KLC_RATES).receivedFromKfandra)
      .toBe(50);
  });
});
