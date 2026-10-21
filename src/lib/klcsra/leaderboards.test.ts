import { describe, it, expect } from "vitest";
import { BOARDS, buildLeaderboards, LEADERBOARD_SIZE } from "./leaderboards";
import type { StatRow } from "./league-data";
import { DEFAULT_STAT_RATES as RATES, type StatKey } from "./stat-rates";
import { DEFAULT_SPORT_STATS as SS, type Sport } from "./sport-stats";
import { DEFAULT_TABLE_GROUPS as G } from "./table-groups";

function r(playerId: string, statKey: StatKey, count: number, over: Partial<StatRow> = {}): StatRow {
  return {
    matchId: "m", entryDate: "2026-10-18", playerId, displayName: playerId.toUpperCase(),
    clubName: "Club", sport: "football" as Sport, isFriendly: false, statKey, count, ...over,
  };
}
const board = (rows: StatRow[], key: string, group = "all") =>
  buildLeaderboards(rows, group, G, RATES, SS).find((b) => b.key === key);

describe("BOARDS", () => {
  it("are the 9 boards in display order", () => {
    expect(BOARDS.map((b) => b.key)).toEqual([
      "goals", "tries", "assists", "preAssists", "saves", "tackles", "discipline", "kroopies", "mmg",
    ]);
  });
});

describe("buildLeaderboards", () => {
  it("Goals sums goal + mainGoal + reboundGoal, not own goals", () => {
    const rows = [
      r("a", "goal", 1),
      r("a", "mainGoal", 2, { sport: "fooba" }),
      r("a", "reboundGoal", 1, { sport: "fooba" }),
      r("a", "ownGoal", 3),
    ];
    expect(board(rows, "goals")!.entries).toEqual([
      { rank: 1, playerId: "a", name: "A", club: "Club", value: 4 },
    ]);
  });

  it("Discipline sums all four sanctions", () => {
    const rows = [r("a", "yellowCard", 1), r("a", "redCard", 1), r("a", "blueCard", 1), r("a", "lateChallenge", 2)];
    expect(board(rows, "discipline")!.entries[0].value).toBe(5);
  });

  it("friendlies count only on MMG", () => {
    const rows = [r("a", "goal", 1, { isFriendly: true })];
    expect(board(rows, "goals")).toBeUndefined();
    expect(board(rows, "kroopies")).toBeUndefined();
    expect(board(rows, "mmg")!.entries[0].value).toBe(RATES.goal.mmg);
  });

  it("Kroopies ignore stats the sport doesn't allow", () => {
    // football does not allow `try`
    const rows = [r("a", "goal", 1), r("a", "try", 1)];
    expect(board(rows, "kroopies")!.entries[0].value).toBe(RATES.goal.kr);
  });

  it("filters by group", () => {
    const rows = [r("a", "try", 2, { sport: "rugby" }), r("b", "goal", 1)];
    expect(board(rows, "tries", "rugby_sox")!.entries.map((e) => e.playerId)).toEqual(["a"]);
    expect(board(rows, "goals", "rugby_sox")).toBeUndefined();
  });

  it("ties share a rank (1, 2, 2, 4) and the list stops at 10", () => {
    const rows = [
      r("a", "goal", 5), r("b", "goal", 3), r("c", "goal", 3), r("d", "goal", 1),
      ...Array.from({ length: 12 }, (_, i) => r(`z${i}`, "goal", 1)),
    ];
    const e = board(rows, "goals")!.entries;
    expect(e.slice(0, 4).map((x) => x.rank)).toEqual([1, 2, 2, 4]);
    expect(e).toHaveLength(LEADERBOARD_SIZE);
  });

  it("shows the club from the player's most recent match", () => {
    const rows = [
      r("a", "goal", 1, { entryDate: "2026-10-01", clubName: "Old" }),
      r("a", "goal", 1, { entryDate: "2026-10-18", clubName: "New" }),
    ];
    expect(board(rows, "goals")!.entries[0].club).toBe("New");
  });

  it("omits empty boards", () => {
    expect(buildLeaderboards([], "all", G, RATES, SS)).toEqual([]);
  });
});
