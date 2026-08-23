import { describe, it, expect } from "vitest";
import { computeCombinedPoints, type HalfResult } from "./combined";
import { DEFAULT_STANDINGS_RULES as R } from "./standings-rules";

describe("computeCombinedPoints", () => {
  it("matches the KFANDRA worked example (KL 0.3, BOCI 0.1, SOG 0.2, DP 0)", () => {
    // Home group across halves = KL + BOCI; away group = DP + SOG.
    // H1: KL(home) 3 - 1 DP(away)  → KL wins half.
    // H2: BOCI(home) 1 - 2 SOG(away) → SOG wins half.
    // Aggregate: home 3+1=4 vs away 1+2=3 → home group (KL+BOCI) win aggregate.
    const halves: HalfResult[] = [
      { homeClubId: "KL", awayClubId: "DP", homeScore: 3, awayScore: 1 },
      { homeClubId: "BOCI", awayClubId: "SOG", homeScore: 1, awayScore: 2 },
    ];
    expect(computeCombinedPoints(halves, R)).toEqual({
      KL: 0.3, BOCI: 0.1, SOG: 0.2, DP: 0,
    });
  });

  it("awards nothing extra on a drawn aggregate", () => {
    // H1: KL 1-0 DP (KL half win). H2: SOG 1-0 BOCI (SOG half win).
    // Aggregate home 1+0=1 vs away 0+1=1 → draw, no bonus.
    const halves: HalfResult[] = [
      { homeClubId: "KL", awayClubId: "DP", homeScore: 1, awayScore: 0 },
      { homeClubId: "BOCI", awayClubId: "SOG", homeScore: 0, awayScore: 1 },
    ];
    expect(computeCombinedPoints(halves, R)).toEqual({
      KL: 0.2, SOG: 0.2, BOCI: 0, DP: 0,
    });
  });

  it("a drawn half awards no half-win points", () => {
    const halves: HalfResult[] = [
      { homeClubId: "KL", awayClubId: "DP", homeScore: 2, awayScore: 2 },
      { homeClubId: "BOCI", awayClubId: "SOG", homeScore: 3, awayScore: 0 },
    ];
    // H1 draw → no half points. H2 BOCI win → BOCI 0.2.
    // Aggregate home 2+3=5 vs away 2+0=2 → home group win → KL+BOCI +0.1.
    expect(computeCombinedPoints(halves, R)).toEqual({
      BOCI: 0.3, KL: 0.1, DP: 0, SOG: 0,
    });
  });

  it("handles a single half (degenerate case)", () => {
    const halves: HalfResult[] = [
      { homeClubId: "KL", awayClubId: "DP", homeScore: 2, awayScore: 1 },
    ];
    // KL wins the half (0.2) and the aggregate (0.1).
    expect(computeCombinedPoints(halves, R)).toEqual({ KL: 0.3, DP: 0 });
  });

  it("returns an empty map for no halves", () => {
    expect(computeCombinedPoints([], R)).toEqual({});
  });

  it("pays the aggregate bonus once to a club playing both halves on one side", () => {
    // The DB's uniques on klc_match_sides are scoped to half_id, so this is a
    // legal arrangement. KL wins both halves (0.2 x 2) and the aggregate 3-0,
    // but the 0.1 aggregate bonus is per CLUB, not per half-slot: 0.5, not 0.6.
    const halves: HalfResult[] = [
      { homeClubId: "KL", awayClubId: "DP", homeScore: 2, awayScore: 0 },
      { homeClubId: "KL", awayClubId: "SOG", homeScore: 1, awayScore: 0 },
    ];
    expect(computeCombinedPoints(halves, R)).toEqual({
      KL: 0.5, DP: 0, SOG: 0,
    });
  });
});
