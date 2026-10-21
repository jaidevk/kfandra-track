/** Pure league points for one result (design spec §3.3). Rules come from app_config via standings-rules.ts. */
import { round4 } from "./round";
import type { Sport } from "./sport-stats";
import { tierFor, type StandingsRules, type TierKey } from "./standings-rules";

export type Outcome = "home" | "away" | "draw";

export interface MatchPointsInput {
  sport: Sport;
  /** Distinct players across both sides. */
  totalPlayers: number;
  homeScore: number;
  awayScore: number;
}

export interface MatchPoints {
  tier: TierKey | null;
  outcome: Outcome;
  home: number;
  away: number;
}

/**
 * Pure. League points for one result. Higher score wins; equal scores draw.
 * No tier (fewer than 2 players) scores 0 for both, but the result stands.
 * An unknown sport (unchecked DB text) scores as a multi-game variation.
 */
export function computeMatchPoints(input: MatchPointsInput, rules: StandingsRules): MatchPoints {
  const { sport, totalPlayers, homeScore, awayScore } = input;
  const outcome: Outcome =
    homeScore > awayScore ? "home" : homeScore < awayScore ? "away" : "draw";
  const tier = tierFor(totalPlayers, rules);
  if (tier === null) return { tier, outcome, home: 0, away: 0 };

  const win = (rules.win[sport] ?? rules.win.multi_game_variation)[tier];
  const draw = rules.draw[tier];
  const home = outcome === "home" ? win : outcome === "draw" ? draw : rules.loss;
  const away = outcome === "away" ? win : outcome === "draw" ? draw : rules.loss;
  return { tier, outcome, home: round4(home), away: round4(away) };
}
