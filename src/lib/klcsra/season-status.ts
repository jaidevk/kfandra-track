/**
 * Pure. One colour scheme for a season's status, shared by the admin Seasons
 * screen's StatusBadge and the public league page.
 */
import type { Season, SeasonStatus } from "./types";

export const SEASON_STATUS_TONE: Record<SeasonStatus, string> = {
  active: "bg-green-600 text-white",
  upcoming: "bg-amber-100 text-amber-900 border border-amber-300",
  closed: "bg-gray-100 text-gray-700 border border-gray-300",
};

/**
 * The season whose window [startDate, endDate] holds `date` (ISO yyyy-mm-dd,
 * both ends inclusive; a null endDate is open-ended), or null. Friendlies
 * carry no season_id, so this is how a friendly is placed in a season, the
 * same window rule as listSubmittedMatchDrafts.
 */
export function seasonForDate(seasons: readonly Season[], date: string): Season | null {
  return (
    seasons.find((s) => s.startDate <= date && (s.endDate === null || date <= s.endDate)) ?? null
  );
}
