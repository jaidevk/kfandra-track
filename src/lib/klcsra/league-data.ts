/**
 * Pure adapters from the recorder's MatchDraft to the league read model.
 * No DB/server imports, so the recorder (a Client Component) can use them
 * for the submit-panel points preview.
 */
import { countedHalves, type ClubRef, type LeagueHalf, type LeagueMatch } from "./league-table";
import type { Sport } from "./sport-stats";
import type { StatKey } from "./stat-rates";
import type { MatchDraft, SideKey } from "./types";

export interface StatRow {
  matchId: string;
  entryDate: string;
  submittedAt: string | null;
  halfNo: number;
  playerId: string;
  displayName: string;
  /** Club that led the player's side in the half the stat was recorded in. */
  clubName: string | null;
  sport: Sport;
  isFriendly: boolean;
  statKey: StatKey;
  count: number;
}

export function toLeagueMatch(d: MatchDraft): LeagueMatch {
  const halves: LeagueHalf[] = [];
  for (const h of d.halves) {
    const home = h.sides.find((s) => s.side === "home");
    const away = h.sides.find((s) => s.side === "away");
    if (!home?.clubId || !away?.clubId) continue;
    halves.push({
      halfNo: h.halfNo,
      home: { clubId: home.clubId, score: home.score },
      away: { clubId: away.clubId, score: away.score },
    });
  }
  return {
    id: d.id,
    entryDate: d.entryDate,
    sport: d.sport,
    isCombined: d.isCombined,
    isFriendly: d.isFriendly,
    totalPlayers: new Set(d.appearances.map((a) => a.playerId)).size,
    halves,
  };
}

export function toStatRows(d: MatchDraft): StatRow[] {
  const rows: StatRow[] = [];
  for (const a of d.appearances) {
    for (const [halfNo, stats] of Object.entries(a.stats)) {
      const half = d.halves.find((h) => h.halfNo === Number(halfNo));
      const clubName = half?.sides.find((s) => s.side === a.side)?.clubName ?? null;
      for (const [statKey, count] of Object.entries(stats)) {
        if (!count) continue;
        rows.push({
          matchId: d.id, entryDate: d.entryDate,
          submittedAt: d.submittedAt, halfNo: Number(halfNo),
          playerId: a.playerId, displayName: a.displayName, clubName,
          sport: d.sport, isFriendly: d.isFriendly,
          statKey: statKey as StatKey, count,
        });
      }
    }
  }
  return rows;
}

/**
 * "Club A + Club B": every distinct club (by id) that led a side, in half order.
 * With `{ counted: true }` only the halves that count are read (a normal
 * match uses half 1; see `countedHalves`), so a stray half 2 never relabels it.
 */
export function sideClubLabel(
  d: MatchDraft,
  side: SideKey,
  opts: { counted?: boolean } = {},
): string {
  const halves = opts.counted ? countedHalves(d) : d.halves;
  const names: string[] = [];
  const seen = new Set<string>();
  for (const h of halves) {
    const s = h.sides.find((x) => x.side === side);
    if (!s?.clubId || !s.clubName || seen.has(s.clubId)) continue;
    seen.add(s.clubId);
    names.push(s.clubName);
  }
  return names.length > 0 ? names.join(" + ") : "TBD";
}

/**
 * Club id → name, taken from the drafts' own sides, so a club that has since
 * been deactivated still shows its name in a past season's table. Drafts are
 * newest first, so the newest name wins.
 */
export function clubNamesFromDrafts(drafts: MatchDraft[]): ClubRef[] {
  const names = new Map<string, string>();
  for (const d of drafts) {
    for (const h of d.halves) {
      for (const s of h.sides) {
        if (s.clubId && s.clubName && !names.has(s.clubId)) names.set(s.clubId, s.clubName);
      }
    }
  }
  return [...names].map(([id, name]) => ({ id, name }));
}
