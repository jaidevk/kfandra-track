/**
 * Pure. League tables, derived on read from submitted matches.
 *
 * `home` / `away` are the AGGREGATE-TEAM SLOTS (`klc_match_sides.side`), not
 * the venue role. A combined match is ONE result between the two slots,
 * decided by the aggregate over both halves; every distinct club that led a
 * slot gets that slot's result and full points (KFANDRA, 2026-10-20).
 */
import { computeMatchPoints, type MatchPoints } from "./points";
import { round4 } from "./round";
import { TRY_SPORTS, type Sport } from "./sport-stats";
import type { StandingsRules } from "./standings-rules";
import { sportInGroup, type TableGroups } from "./table-groups";
import type { SideKey } from "./types";

export interface LeagueSide { clubId: string; score: number }
export interface LeagueHalf { halfNo: number; home: LeagueSide; away: LeagueSide }

export interface LeagueMatch {
  id: string;
  entryDate: string;
  sport: Sport;
  isCombined: boolean;
  isFriendly: boolean;
  /** Distinct players across both sides. */
  totalPlayers: number;
  /** Only halves with a club on both sides. */
  halves: LeagueHalf[];
}

export interface ClubRef { id: string; name: string }

export interface TableRow {
  clubId: string;
  clubName: string;
  P: number; W: number; D: number; L: number;
  GF: number; GA: number; TF: number; TA: number;
  Diff: number;
  Pts: number;
}

export function aggregateScores(m: LeagueMatch): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const h of m.halves) {
    home += h.home.score;
    away += h.away.score;
  }
  return { home, away };
}

/** Distinct clubs that led a slot, in half order. */
export function clubsOnSide(m: LeagueMatch, side: SideKey): string[] {
  const ids: string[] = [];
  for (const h of m.halves) {
    const id = h[side].clubId;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * The halves that decide the result. A normal match is one result from
 * half 1 (design §3.4); only a combined match aggregates over both halves.
 * Generic so the recorder's MatchDraft halves use the same rule.
 */
export function countedHalves<H extends { halfNo: number }>(
  m: { isCombined: boolean; halves: H[] },
): H[] {
  return m.isCombined ? m.halves : m.halves.filter((h) => h.halfNo === 1);
}

/**
 * The halves that decide the result, their aggregate and the points, from one
 * place, so a displayed score and its points always agree.
 */
export function matchResult(
  m: LeagueMatch,
  rules: StandingsRules,
): { scored: LeagueMatch; agg: { home: number; away: number }; pts: MatchPoints } {
  const scored: LeagueMatch = { ...m, halves: countedHalves(m) };
  const agg = aggregateScores(scored);
  const pts = computeMatchPoints(
    { sport: m.sport, totalPlayers: m.totalPlayers, homeScore: agg.home, awayScore: agg.away },
    rules,
  );
  return { scored, agg, pts };
}

export function scoreMatch(m: LeagueMatch, rules: StandingsRules): MatchPoints {
  return matchResult(m, rules).pts;
}

function compareRows(a: TableRow, b: TableRow): number {
  return (
    b.Pts - a.Pts ||
    b.Diff - a.Diff ||
    b.GF + b.TF - (a.GF + a.TF) ||
    a.clubName.localeCompare(b.clubName, "en")
  );
}

export function buildLeagueTable(
  matches: LeagueMatch[],
  groupKey: string,
  clubs: ClubRef[],
  rules: StandingsRules,
  groups: TableGroups,
): TableRow[] {
  const names = new Map(clubs.map((c) => [c.id, c.name]));
  const rows = new Map<string, TableRow>();
  const rowFor = (clubId: string): TableRow => {
    let r = rows.get(clubId);
    if (!r) {
      r = {
        clubId, clubName: names.get(clubId) ?? "Unknown club",
        P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, TF: 0, TA: 0, Diff: 0, Pts: 0,
      };
      rows.set(clubId, r);
    }
    return r;
  };

  for (const m of matches) {
    if (m.isFriendly) continue;
    if (!sportInGroup(m.sport, groupKey, groups)) continue;

    const { scored: sm, agg, pts } = matchResult(m, rules);
    if (sm.halves.length === 0) continue;
    // Defensive: a club leading home in one counted half and away in another
    // would be scored a W and an L for one match. Submit now refuses this
    // (the pair rule), but submitted matches from before it, made via the
    // removed half-2 "Swap clubs" prompt, can still hold one. Such a match is
    // left out of the table rather than scored wrongly.
    const homeClubs = clubsOnSide(sm, "home");
    if (clubsOnSide(sm, "away").some((id) => homeClubs.includes(id))) continue;
    const tries = TRY_SPORTS.has(m.sport);

    for (const side of ["home", "away"] as const) {
      const scored = side === "home" ? agg.home : agg.away;
      const conceded = side === "home" ? agg.away : agg.home;
      const result = pts.outcome === "draw" ? "D" : pts.outcome === side ? "W" : "L";
      for (const clubId of clubsOnSide(sm, side)) {
        const r = rowFor(clubId);
        r.P += 1;
        r[result] += 1;
        if (tries) {
          r.TF += scored;
          r.TA += conceded;
        } else {
          r.GF += scored;
          r.GA += conceded;
        }
        r.Pts = round4(r.Pts + pts[side]);
      }
    }
  }

  for (const r of rows.values()) r.Diff = r.GF + r.TF - (r.GA + r.TA);
  return [...rows.values()].sort(compareRows);
}
