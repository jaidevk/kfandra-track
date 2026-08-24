import { describe, it, expect } from "vitest";
import { computeStandingPoints } from "./standings";
import {
  DEFAULT_STANDINGS_RULES as R,
  parseStandingsRules,
} from "./standings-rules";

describe("computeStandingPoints", () => {
  it("6+ players, home win 2-1 → 3 / 0", () => {
    expect(computeStandingPoints(2, 1, 6, R)).toEqual({ home: 3, away: 0 });
  });

  it("6+ players, draw → 1 / 1", () => {
    expect(computeStandingPoints(1, 1, 6, R)).toEqual({ home: 1, away: 1 });
  });

  it("fewer than 6 players, home win → 0.2 / 0", () => {
    expect(computeStandingPoints(2, 1, 5, R)).toEqual({ home: 0.2, away: 0 });
  });

  it("fewer than 6 players, draw → 0.05 each", () => {
    expect(computeStandingPoints(0, 0, 4, R)).toEqual({ home: 0.05, away: 0.05 });
  });

  it("margin ≥20 in the big tier → +1 winner, -1 loser", () => {
    expect(computeStandingPoints(25, 3, 6, R)).toEqual({ home: 4, away: -1 });
  });

  it("margin ≥20 in the small tier stacks on the fraction", () => {
    expect(computeStandingPoints(25, 3, 4, R)).toEqual({ home: 1.2, away: -1 });
  });

  it("a 19-point win does not trigger the margin bonus", () => {
    expect(computeStandingPoints(20, 1, 6, R)).toEqual({ home: 3, away: 0 });
  });

  it("an exactly-20 margin does trigger it", () => {
    expect(computeStandingPoints(21, 1, 6, R)).toEqual({ home: 4, away: -1 });
  });

  it("away win is symmetric", () => {
    expect(computeStandingPoints(1, 2, 6, R)).toEqual({ home: 0, away: 3 });
  });

  it("a big away win applies the margin the other way", () => {
    expect(computeStandingPoints(3, 25, 6, R)).toEqual({ home: -1, away: 4 });
  });

  it("never awards a margin bonus on a draw, even at threshold 0", () => {
    // With the default threshold of 20 a draw's margin of 0 excludes itself,
    // so the explicit homeScore !== awayScore guard is only load-bearing when
    // an admin configures a threshold of 0. Without it, BOTH sides would
    // collect the winner bonus on a draw.
    const r = parseStandingsRules({ margin: { threshold: 0 } });
    expect(computeStandingPoints(1, 1, 6, r)).toEqual({ home: 1, away: 1 });
  });
});
