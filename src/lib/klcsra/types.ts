/**
 * Canonical KLCSRA match-recorder shapes — shared by the repository, the
 * server actions, and the (Phase 2 placeholder) recorder UI. Pure types only:
 * no DB or server imports, so Client Components may import them freely.
 *
 * Mirrors the DB:
 *   MatchDraft      → klc_matches (+ klc_seasons for the tag)
 *   HalfDraft       → klc_match_halves
 *   SideDraft       → klc_match_sides   (per-half club + score)
 *   AppearanceDraft → klc_match_appearances (+ klc_player_stats keyed by half)
 *
 * Squads are MATCH-level: a player is on exactly one side for the whole match
 * (`unique (match_id, player_id)`). What changes at half-time is the club
 * leading each side, which is why stats carry `half_no`.
 */

import type { StatKey } from "./stat-rates";
import type { Sport } from "./sport-stats";

export type MatchStatus = "draft" | "submitted";
export type SideKey = "home" | "away";
export type SeasonStatus = "upcoming" | "active" | "closed";

export interface Season {
  id: string; seasonNo: number; name: string;
  startDate: string; endDate: string | null; status: SeasonStatus;
}

export interface ClubOption { id: string; name: string; managerName: string; }
export interface MemberOption { id: string; displayName: string; }

export interface SideDraft {
  id: string; side: SideKey;
  clubId: string | null; clubName: string | null;
  score: number;
}
export interface HalfDraft { id: string; halfNo: number; sides: SideDraft[]; }

/** One player, one team, whole match. Stats are keyed by half. */
export interface AppearanceDraft {
  id: string; playerId: string; displayName: string;
  side: SideKey; slot: number;
  stats: Record<number, Partial<Record<StatKey, number>>>;
}

export interface MatchDraft {
  id: string; entryDate: string; sport: Sport;
  isFriendly: boolean; isCombined: boolean;
  durationMinutes: number | null;
  status: MatchStatus; submittedAt: string | null;
  seasonId: string | null; seasonName: string | null;
  halves: HalfDraft[];
  appearances: AppearanceDraft[];
}

export interface MatchSummary {
  id: string; entryDate: string; sport: Sport;
  isFriendly: boolean; isCombined: boolean;
  status: MatchStatus; seasonName: string | null;
  homeLabel: string; awayLabel: string; scoreLine: string;
}

/** What Submit produces. Displayed in Phase 2; written to the sheet in Phase 5. */
export interface PayoutLine {
  playerId: string; displayName: string;
  side: SideKey; clubName: string | null;
  kr: number; mmg: number;
}
