/**
 * Pure. The recorder's "League points" preview line for a draft, so the
 * submit panel shows the tier and points the league table will award.
 *
 * Score and points both come from `matchResult`, so they are read from the
 * same halves (a normal match uses half 1 only; a combined match aggregates).
 * No DB/server imports: the recorder is a Client Component.
 */
import { toLeagueMatch } from "./league-data";
import { matchResult } from "./league-table";
import { TIER_LABELS, type StandingsRules } from "./standings-rules";
import type { MatchDraft } from "./types";

export type LeaguePointsLine =
  | { kind: "friendly" }
  | { kind: "incomplete" }
  | { kind: "scored"; text: string };

export function leaguePointsLine(match: MatchDraft, rules: StandingsRules): LeaguePointsLine {
  if (match.isFriendly) return { kind: "friendly" };
  const lm = toLeagueMatch(match);
  // toLeagueMatch keeps only halves with a club on both sides.
  if (match.halves.length === 0 || lm.halves.length !== match.halves.length) {
    return { kind: "incomplete" };
  }
  const { agg, pts } = matchResult(lm, rules);
  // Every club that led a slot in a combined match gets that slot's full points.
  const each = match.isCombined ? " each" : "";
  const tier = pts.tier ? `Tier ${TIER_LABELS[pts.tier]}` : "Under 2 players";
  return {
    kind: "scored",
    text: `${tier} · ${agg.home} – ${agg.away} · Home ${pts.home}${each} · Away ${pts.away}${each}`,
  };
}
