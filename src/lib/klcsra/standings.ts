import { round4 } from "./round";
import type { PointsTuple, StandingsRules } from "./standings-rules";

/**
 * Pure. League points for both sides of ONE match result.
 * Base points come from the size tier (total players in the match); the ≥margin
 * bonus/penalty is then added to the winner/loser. A draw earns no margin.
 *
 * Friendlies never reach here — spec §Standings excludes them from standings
 * entirely, so the caller filters on `is_friendly = false`.
 */
export function computeStandingPoints(
  homeScore: number,
  awayScore: number,
  totalPlayers: number,
  rules: StandingsRules,
): { home: number; away: number } {
  const tier: PointsTuple =
    totalPlayers >= rules.playerThreshold ? rules.atOrAbove : rules.below;

  let home: number;
  let away: number;
  if (homeScore > awayScore) {
    home = tier.win;
    away = tier.loss;
  } else if (homeScore < awayScore) {
    home = tier.loss;
    away = tier.win;
  } else {
    home = tier.draw;
    away = tier.draw;
  }

  const margin = Math.abs(homeScore - awayScore);
  if (homeScore !== awayScore && margin >= rules.margin.threshold) {
    if (homeScore > awayScore) {
      home += rules.margin.winnerBonus;
      away += rules.margin.loserPenalty;
    } else {
      away += rules.margin.winnerBonus;
      home += rules.margin.loserPenalty;
    }
  }

  return { home: round4(home), away: round4(away) };
}
