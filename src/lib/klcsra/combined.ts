import { round4 } from "./round";
import type { StandingsRules } from "./standings-rules";

/** One half of a combined match: a normal 1-v-1 with its own clubs & scores. */
export interface HalfResult {
  homeClubId: string;
  awayClubId: string;
  homeScore: number;
  awayScore: number;
}

/**
 * Pure. League points per club for a combined (two-half) match.
 *  - Each half: the winning club gets `combined.halfWin` (draw → nothing).
 *  - Aggregate: sum of home scores vs sum of away scores across halves; the
 *    winning side's clubs (all "home" clubs, or all "away" clubs) each get
 *    `combined.aggregateBonus` (draw → nothing).
 *
 * "home"/"away" here are the AGGREGATE-TEAM SLOTS from klc_match_sides.side,
 * not the venue role — the home sides across both halves form one aggregate
 * team, the away sides the other.
 *
 * Returns a map of clubId → total points (every club that appears is present).
 */
export function computeCombinedPoints(
  halves: HalfResult[],
  rules: StandingsRules,
): Record<string, number> {
  const points: Record<string, number> = {};
  const add = (clubId: string, n: number) => {
    points[clubId] = (points[clubId] ?? 0) + n;
  };

  let homeAgg = 0;
  let awayAgg = 0;
  const homeClubs: string[] = [];
  const awayClubs: string[] = [];

  for (const h of halves) {
    add(h.homeClubId, 0); // ensure every club is present in the result
    add(h.awayClubId, 0);
    homeClubs.push(h.homeClubId);
    awayClubs.push(h.awayClubId);
    homeAgg += h.homeScore;
    awayAgg += h.awayScore;

    if (h.homeScore > h.awayScore) add(h.homeClubId, rules.combined.halfWin);
    else if (h.awayScore > h.homeScore) add(h.awayClubId, rules.combined.halfWin);
  }

  if (homeAgg > awayAgg) for (const c of homeClubs) add(c, rules.combined.aggregateBonus);
  else if (awayAgg > homeAgg) for (const c of awayClubs) add(c, rules.combined.aggregateBonus);

  for (const k of Object.keys(points)) points[k] = round4(points[k]);
  return points;
}
