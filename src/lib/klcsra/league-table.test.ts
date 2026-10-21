import { describe, it, expect } from "vitest";
import {
  aggregateScores,
  buildLeagueTable,
  clubsOnSide,
  type LeagueMatch,
} from "./league-table";
import { DEFAULT_STANDINGS_RULES as R } from "./standings-rules";
import { DEFAULT_TABLE_GROUPS as G } from "./table-groups";
import type { Sport } from "./sport-stats";

const CLUBS = ["A", "B", "C", "D", "E"].map((id) => ({ id, name: `Club ${id}` }));

let n = 0;
function single(sport: Sport, home: string, hs: number, away: string, as: number, players = 12,
  extra: Partial<LeagueMatch> = {}): LeagueMatch {
  n += 1;
  return {
    id: `m${n}`, entryDate: "2026-10-18", sport, isCombined: false, isFriendly: false,
    totalPlayers: players,
    halves: [{ halfNo: 1, home: { clubId: home, score: hs }, away: { clubId: away, score: as } }],
    ...extra,
  };
}
const row = (rows: ReturnType<typeof buildLeagueTable>, id: string) => rows.find((r) => r.clubId === id)!;

describe("buildLeagueTable", () => {
  it("counts W/D/L, goals and points for a 7+ football win", () => {
    const t = buildLeagueTable([single("football", "A", 3, "B", 1)], "all", CLUBS, R, G);
    expect(row(t, "A")).toMatchObject({ P: 1, W: 1, D: 0, L: 0, GF: 3, GA: 1, TF: 0, TA: 0, Diff: 2, Pts: 5 });
    expect(row(t, "B")).toMatchObject({ P: 1, W: 0, L: 1, GF: 1, GA: 3, Diff: -2, Pts: 0 });
  });

  it("rugby scores go to tries, not goals", () => {
    const t = buildLeagueTable([single("rugby", "A", 2, "B", 2)], "all", CLUBS, R, G);
    expect(row(t, "A")).toMatchObject({ GF: 0, GA: 0, TF: 2, TA: 2, D: 1, Pts: 1 });
  });

  it("Diff combines goals and tries", () => {
    const t = buildLeagueTable(
      [single("football", "A", 2, "B", 0), single("rugby_variation", "B", 3, "A", 2)],
      "all", CLUBS, R, G,
    );
    expect(row(t, "A")).toMatchObject({ GF: 2, GA: 0, TF: 2, TA: 3, Diff: 1 });
  });

  it("filters by group and skips friendlies", () => {
    const ms = [
      single("football", "A", 1, "B", 0),
      single("rugby", "C", 1, "D", 0),
      single("football", "E", 1, "A", 0, 12, { isFriendly: true }),
    ];
    const foot = buildLeagueTable(ms, "football_fooba", CLUBS, R, G);
    expect(foot.map((r) => r.clubId).sort()).toEqual(["A", "B"]);
    const all = buildLeagueTable(ms, "all", CLUBS, R, G);
    expect(all.map((r) => r.clubId).sort()).toEqual(["A", "B", "C", "D"]);
  });

  it("multi-game variation counts in All only", () => {
    const ms = [single("multi_game_variation", "A", 1, "B", 0)];
    expect(buildLeagueTable(ms, "all", CLUBS, R, G)).toHaveLength(2);
    expect(buildLeagueTable(ms, "short_game_variations", CLUBS, R, G)).toHaveLength(0);
  });

  it("sorts by Pts, then Diff, then scored, then name", () => {
    const ms = [
      single("football", "A", 1, "E", 0),   // A 5 pts, diff +1, scored 1
      single("football", "B", 5, "E", 4),   // B 5 pts, diff +1, scored 5
      single("football", "C", 3, "E", 0),   // C 5 pts, diff +3
      single("football", "D", 1, "E", 0),   // D 5 pts, diff +1, scored 1 (ties A on all but name)
    ];
    const t = buildLeagueTable(ms, "all", CLUBS, R, G);
    expect(t.map((r) => r.clubId)).toEqual(["C", "B", "A", "D", "E"]);
  });

  it("combined match: one aggregate result, full points to every club", () => {
    const m: LeagueMatch = {
      id: "c1", entryDate: "2026-10-16", sport: "fooba", isCombined: true, isFriendly: false,
      totalPlayers: 12,
      halves: [
        { halfNo: 1, home: { clubId: "A", score: 2 }, away: { clubId: "C", score: 3 } },
        { halfNo: 2, home: { clubId: "B", score: 3 }, away: { clubId: "D", score: 0 } },
      ],
    };
    const t = buildLeagueTable([m], "all", CLUBS, R, G);
    for (const id of ["A", "B"]) {
      expect(row(t, id)).toMatchObject({ P: 1, W: 1, GF: 5, GA: 3, Pts: 5 });
    }
    for (const id of ["C", "D"]) {
      expect(row(t, id)).toMatchObject({ P: 1, L: 1, GF: 3, GA: 5, Pts: 0 });
    }
  });

  it("combined match: a club on the same side in both halves counts once", () => {
    const m: LeagueMatch = {
      id: "c2", entryDate: "2026-10-16", sport: "football", isCombined: true, isFriendly: false,
      totalPlayers: 12,
      halves: [
        { halfNo: 1, home: { clubId: "A", score: 1 }, away: { clubId: "C", score: 1 } },
        { halfNo: 2, home: { clubId: "A", score: 1 }, away: { clubId: "D", score: 1 } },
      ],
    };
    const t = buildLeagueTable([m], "all", CLUBS, R, G);
    expect(row(t, "A")).toMatchObject({ P: 1, D: 1, GF: 2, GA: 2, Pts: 1 });
  });

  it("uses the tier from total players", () => {
    const t = buildLeagueTable([single("football", "A", 1, "B", 0, 5)], "all", CLUBS, R, G);
    expect(row(t, "A").Pts).toBe(1);
  });

  it("names an unknown club rather than crashing", () => {
    const t = buildLeagueTable([single("football", "Z", 1, "A", 0)], "all", CLUBS, R, G);
    expect(row(t, "Z").clubName).toBe("Unknown club");
  });
});

describe("helpers", () => {
  it("aggregateScores sums each side over halves", () => {
    const m = single("football", "A", 2, "B", 1);
    expect(aggregateScores(m)).toEqual({ home: 2, away: 1 });
  });
  it("clubsOnSide is distinct, in half order", () => {
    const m: LeagueMatch = {
      ...single("football", "A", 0, "B", 0),
      halves: [
        { halfNo: 1, home: { clubId: "A", score: 0 }, away: { clubId: "B", score: 0 } },
        { halfNo: 2, home: { clubId: "C", score: 0 }, away: { clubId: "B", score: 0 } },
      ],
    };
    expect(clubsOnSide(m, "home")).toEqual(["A", "C"]);
    expect(clubsOnSide(m, "away")).toEqual(["B"]);
  });
});
