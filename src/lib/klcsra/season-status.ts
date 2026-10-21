/**
 * Pure. One colour scheme for a season's status, shared by the admin Seasons
 * screen's StatusBadge and the public league page.
 */
import type { SeasonStatus } from "./types";

export const SEASON_STATUS_TONE: Record<SeasonStatus, string> = {
  active: "bg-green-600 text-white",
  upcoming: "bg-amber-100 text-amber-900 border border-amber-300",
  closed: "bg-gray-100 text-gray-700 border border-gray-300",
};
