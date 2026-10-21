/**
 * Pure. Season leaderboards from per-half stat rows.
 *
 * Only positive totals are listed: these are leader boards. Friendlies are
 * excluded everywhere except MMG (Q8). Every board applies the same per-sport
 * allow-list as the payout compute, so a stat hidden by a sport-stats change
 * counts nowhere and a board never disagrees with a payout.
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
  /** Raw contribution of one row; the allow-list is applied by the caller. */
  value: (row: StatRow, rates: StatRates) => number;
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
    value: (row, rates) => row.count * rates[row.statKey].kr,
  },
  {
    key: "mmg", label: "MMG", includeFriendlies: true,
    value: (row, rates) => row.count * rates[row.statKey].mmg,
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

  // Name from any row; club from the player's latest match that has one,
  // ordered by (entryDate, submittedAt, matchId, halfNo).
  const key = (r: StatRow) => [r.entryDate, r.submittedAt ?? "", r.matchId, String(r.halfNo).padStart(4, "0")].join("\u0000");
  const who = new Map<string, { name: string; club: string | null; k: string }>();
  for (const r of inGroup) {
    const cur = who.get(r.playerId) ?? { name: r.displayName, club: null, k: "" };
    cur.name = r.displayName;
    if (r.clubName !== null && key(r) >= cur.k) {
      cur.club = r.clubName;
      cur.k = key(r);
    }
    who.set(r.playerId, cur);
  }

  const boards: Board[] = [];
  for (const def of BOARDS) {
    const totals = new Map<string, number>();
    for (const r of inGroup) {
      if (r.isFriendly && !def.includeFriendlies) continue;
      if (!allowed(r.sport).has(r.statKey)) continue;
      const v = def.value(r, rates);
      if (v !== 0) totals.set(r.playerId, (totals.get(r.playerId) ?? 0) + v);
    }

    const sorted = [...totals]
      .map(([playerId, v]) => ({ playerId, value: round4(v), name: who.get(playerId)?.name ?? "" }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "en"))
      // A tie across 10th/11th place is cut alphabetically, by spec ("cuts off at 10").
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
