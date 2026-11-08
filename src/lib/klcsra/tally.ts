/**
 * Pure. The managers' goal tally, shown to KFANDRA next to the official score
 * (spec §3.3). It never changes the score: KFANDRA's score wins (D4).
 */
import { countedHalves } from "./league-table";
import type { StatKey } from "./stat-rates";
import type { MatchDraft, SideKey } from "./types";

/** Stats that put points on the scoreboard for the scorer's own side. */
export const SCORING_STATS: readonly StatKey[] = ["goal", "mainGoal", "reboundGoal", "try", "conversion"];

type Score = Record<SideKey, number>;
type TallyMatch = Pick<MatchDraft, "isCombined" | "halves" | "appearances">;

export function goalTally(m: TallyMatch): Score {
  const halfNos = new Set(countedHalves(m).map((h) => h.halfNo));
  const t: Score = { home: 0, away: 0 };
  for (const a of m.appearances) {
    const other: SideKey = a.side === "home" ? "away" : "home";
    for (const [half, counts] of Object.entries(a.stats)) {
      if (!halfNos.has(Number(half))) continue;
      for (const k of SCORING_STATS) t[a.side] += counts[k] ?? 0;
      t[other] += counts.ownGoal ?? 0;
    }
  }
  return t;
}

/** The score entered for the counted halves, aggregated as the league table does. */
export function officialScore(m: TallyMatch): Score {
  const s: Score = { home: 0, away: 0 };
  for (const h of countedHalves(m)) for (const side of h.sides) s[side.side] += side.score;
  return s;
}

/** A league score stays with staff until the match is official (D4). */
export function leagueScoreHidden(m: Pick<MatchDraft, "isFriendly" | "status">): boolean {
  return !m.isFriendly && m.status !== "submitted";
}

/**
 * The match as a non-staff viewer may receive it: every side score zeroed
 * while {@link leagueScoreHidden}. Applied on the server, so the score never
 * reaches a manager's browser, not just their screen.
 */
export function hideLeagueScore<M extends Pick<MatchDraft, "isFriendly" | "status" | "halves">>(m: M): M {
  if (!leagueScoreHidden(m)) return m;
  return {
    ...m,
    halves: m.halves.map((h) => ({ ...h, sides: h.sides.map((s) => ({ ...s, score: 0 })) })),
  };
}
