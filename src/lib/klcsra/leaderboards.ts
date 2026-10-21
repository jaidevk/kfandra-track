/**
 * Pure. Season leaderboards from per-half stat rows.
 *
 * Only positive totals are listed: these are leader boards. Friendlies are
 * excluded everywhere except MMG (Q8). Kroopies/MMG apply the same per-sport
 * allow-list as the payout compute, so a board never disagrees with a payout.
 */
import type { StatRow } from "./league-data";
import { round4 } from "./round";
import { statsForSport, type Sport, type SportStats } from "./sport-stats";
import type { StatKey, StatRates } from "./stat-rates";
import { sportInGroup, type TableGroups } from "./table-groups";

export const LEADERBOARD_SIZE = 10;

export type BoardKey =
  | "goals" | "tries" | "assists" | "preAssists" | "saves" | "tackles"
  | "discipline" | "kroopies" | "mmg";

type Allowed = (sport: Sport) => ReadonlySet<StatKey>;

interface BoardDef {
  key: BoardKey;
  label: string;
  includeFriendlies: boolean;
  value: (row: StatRow, rates: StatRates, allowed: Allowed) => number;
}

const tally = (keys: StatKey[]) => (row: StatRow) => (keys.includes(row.statKey) ? row.count : 0);

export const BOARDS: readonly BoardDef[] = [
  { key: "goals", label: "Goals", includeFriendlies: false, value: tally(["goal", "mainGoal", "reboundGoal"]) },
  { key: "tries", label: "Tries", includeFriendlies: false, value: tally(["try"]) },
  { key: "assists", label: "Assists", includeFriendlies: false, value: tally(["assist"]) },
  { key: "preAssists", label: "Pre-assists", includeFriendlies: false, value: tally(["preAssist"]) },
  { key: "saves", label: "Saves", includeFriendlies: false, value: tally(["save"]) },
  { key: "tackles", label: "Tackles", includeFriendlies: false, value: tally(["tackle"]) },
  {
    key: "discipline", label: "Discipline", includeFriendlies: false,
    value: tally(["yellowCard", "redCard", "blueCard", "lateChallenge"]),
  },
  {
    key: "kroopies", label: "Kroopies", includeFriendlies: false,
    value: (row, rates, allowed) =>
      allowed(row.sport).has(row.statKey) ? row.count * rates[row.statKey].kr : 0,
  },
  {
    key: "mmg", label: "MMG", includeFriendlies: true,
    value: (row, rates, allowed) =>
      allowed(row.sport).has(row.statKey) ? row.count * rates[row.statKey].mmg : 0,
  },
];

export interface LeaderEntry {
  rank: number;
  playerId: string;
  name: string;
  club: string | null;
  value: number;
}

export interface Board {
  key: BoardKey;
  label: string;
  entries: LeaderEntry[];
}

export function buildLeaderboards(
  rows: StatRow[],
  groupKey: string,
  groups: TableGroups,
  rates: StatRates,
  sportStats: SportStats,
): Board[] {
  const allowCache = new Map<Sport, ReadonlySet<StatKey>>();
  const allowed: Allowed = (sport) => {
    let s = allowCache.get(sport);
    if (!s) {
      s = new Set(statsForSport(sport, sportStats));
      allowCache.set(sport, s);
    }
    return s;
  };

  const inGroup = rows.filter((r) => sportInGroup(r.sport, groupKey, groups));

  // Name + the club from each player's most recent match.
  const who = new Map<string, { name: string; club: string | null; date: string }>();
  for (const r of inGroup) {
    const cur = who.get(r.playerId);
    if (!cur || r.entryDate >= cur.date) {
      who.set(r.playerId, { name: r.displayName, club: r.clubName, date: r.entryDate });
    }
  }

  const boards: Board[] = [];
  for (const def of BOARDS) {
    const totals = new Map<string, number>();
    for (const r of inGroup) {
      if (r.isFriendly && !def.includeFriendlies) continue;
      const v = def.value(r, rates, allowed);
      if (v !== 0) totals.set(r.playerId, (totals.get(r.playerId) ?? 0) + v);
    }

    const sorted = [...totals]
      .map(([playerId, v]) => ({ playerId, value: round4(v), name: who.get(playerId)?.name ?? "" }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
      .slice(0, LEADERBOARD_SIZE);
    if (sorted.length === 0) continue;

    const entries: LeaderEntry[] = [];
    sorted.forEach((e, i) => {
      const prev = entries[i - 1];
      entries.push({
        rank: prev && prev.value === e.value ? prev.rank : i + 1,
        playerId: e.playerId,
        name: e.name,
        club: who.get(e.playerId)?.club ?? null,
        value: e.value,
      });
    });
    boards.push({ key: def.key, label: def.label, entries });
  }
  return boards;
}
