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
