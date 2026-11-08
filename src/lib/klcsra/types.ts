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

export type MatchStatus = "draft" | "sent" | "submitted";
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
  /**
   * Goal/try minutes per half per stat, in entry order (null = not entered).
   * Absent when none are recorded.
   */
  times?: Record<number, Partial<Record<StatKey, (number | null)[]>>>;
}

export interface MatchDraft {
  id: string; entryDate: string; sport: Sport;
  isFriendly: boolean; isCombined: boolean;
  durationMinutes: number | null;
  status: MatchStatus; submittedAt: string | null;
  /** When each team's manager tapped Send my team; null until then. */
  homeSentAt: string | null;
  awaySentAt: string | null;
  seasonId: string | null; seasonName: string | null;
  /** Who created the draft; null for matches created before 2026-10-20. */
  createdBy: string | null;
  halves: HalfDraft[];
  appearances: AppearanceDraft[];
}

export interface MatchSummary {
  id: string; entryDate: string; sport: Sport;
  isFriendly: boolean; isCombined: boolean;
  status: MatchStatus; seasonName: string | null;
  createdBy: string | null;
  /** Every club on any side of any half. */
  clubIds: string[];
  homeSentAt: string | null;
  awaySentAt: string | null;
  /** Every (side, club) pair across the halves. Used for duplicate detection. */
  sideClubs: { side: SideKey; clubId: string }[];
  homeLabel: string; awayLabel: string; scoreLine: string;
}

/** What Submit produces. Displayed in Phase 2; written to the sheet in Phase 5. */
export interface PayoutLine {
  playerId: string; displayName: string;
  side: SideKey; clubName: string | null;
  kr: number; mmg: number;
}
