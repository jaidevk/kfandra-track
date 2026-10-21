/** Pure. `/klc/league` URL state: ?tab=&season=&group=. Unknown values fall back. */
import type { TableGroups } from "./table-groups";
import type { Season } from "./types";

export const LEAGUE_TABS = ["table", "matches", "leaders", "seasons", "scoring"] as const;
export type LeagueTab = (typeof LEAGUE_TABS)[number];

export interface LeagueParams {
  tab: LeagueTab;
  seasonId: string | null;
  group: string;
}

type RawParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** A sorted copy, highest season number first. Never mutates the input. */
export function newestFirstSeasons(seasons: readonly Season[]): Season[] {
  return [...seasons].sort((a, b) => b.seasonNo - a.seasonNo);
}

/** The active season, else the newest closed one, else null. */
export function defaultSeasonId(seasons: Season[]): string | null {
  const active = seasons.find((s) => s.status === "active");
  if (active) return active.id;
  return newestFirstSeasons(seasons).find((s) => s.status === "closed")?.id ?? null;
}

export function parseLeagueParams(
  raw: RawParams,
  seasons: Season[],
  groups: TableGroups,
): LeagueParams {
  const tab = first(raw.tab);
  const season = first(raw.season);
  const group = first(raw.group);
  const groupKeys = Object.keys(groups);
  return {
    tab: (LEAGUE_TABS as readonly string[]).includes(tab ?? "") ? (tab as LeagueTab) : "table",
    seasonId: seasons.some((s) => s.id === season) ? season! : defaultSeasonId(seasons),
    group: group !== undefined && groupKeys.includes(group) ? group : groupKeys[0],
  };
}

export function leagueHref(current: LeagueParams, patch: Partial<LeagueParams>): string {
  const next = { ...current, ...patch };
  const q = new URLSearchParams();
  q.set("tab", next.tab);
  if (next.seasonId) q.set("season", next.seasonId);
  q.set("group", next.group);
  return `/klc/league?${q.toString()}`;
}

/**
 * Columns a table-group chip spans in the picker's 6-column grid: rows of 3,
 * with a short last row split evenly (5 groups → 3 + 2), so every chip is
 * visible at phone width with no sideways scroll.
 */
export function chipSpan(index: number, count: number): number {
  const lastRowStart = count - (count % 3 || 3);
  return index >= lastRowStart ? 6 / (count - lastRowStart) : 2;
}
