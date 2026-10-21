/**
 * Pure. The recorder's "League points" preview line for a draft, so the
 * submit panel shows the tier and points the league table will award.
 *
 * Score and points both come from `matchResult`, so they are read from the
 * same halves (a normal match uses half 1 only; a combined match aggregates).
 * Completeness and the club labels look at those same counted halves, so a
 * stray empty half 2 on a normal match neither blocks nor relabels it.
 * No DB/server imports: the recorder is a Client Component.
 */
import { sideClubLabel, toLeagueMatch } from "./league-data";
import { matchResult } from "./league-table";
import { TIER_LABELS, type StandingsRules } from "./standings-rules";
import type { MatchDraft } from "./types";

export type LeaguePointsLine =
  | { kind: "friendly" }
  | { kind: "incomplete" }
  | {
      kind: "scored";
      /** "Kraken" for a normal match; "Kraken + Ninja" (club pair) for a combined one. */
      homeLabel: string;
      awayLabel: string;
      text: string;
    };

export function leaguePointsLine(match: MatchDraft, rules: StandingsRules): LeaguePointsLine {
  if (match.isFriendly) return { kind: "friendly" };
  // The halves that count, as in league-table's resultHalves.
  const counted = match.isCombined ? match.halves : match.halves.filter((h) => h.halfNo === 1);
  const draft: MatchDraft = { ...match, halves: counted };
  const lm = toLeagueMatch(draft);
  // toLeagueMatch keeps only halves with a club on both sides.
  if (counted.length === 0 || lm.halves.length !== counted.length) {
    return { kind: "incomplete" };
  }
  const { agg, pts } = matchResult(lm, rules);
  const homeLabel = sideClubLabel(draft, "home");
  const awayLabel = sideClubLabel(draft, "away");
  const tier = pts.tier ? `Tier ${TIER_LABELS[pts.tier]}` : "Under 2 players";
  // Combined: sides are labelled by club pair, and every club that led a slot
  // gets that slot's full points ("each"). Normal: one club per side.
  const text = match.isCombined
    ? `${tier} · ${homeLabel} ${agg.home} – ${agg.away} ${awayLabel} · ${pts.home} each · ${pts.away} each`
    : `${tier} · ${agg.home} – ${agg.away} · ${homeLabel} ${pts.home} · ${awayLabel} ${pts.away}`;
  return { kind: "scored", homeLabel, awayLabel, text };
}
