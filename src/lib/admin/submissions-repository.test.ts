import { describe, it, expect } from "vitest";
import {
  toSessionRows,
  buildSelfScored,
  classifyOther,
  type SelfScored,
} from "./submissions-rows";
import type { ScoringConfig } from "@/lib/mmg/scoring";
import type { MmgDraft } from "@/lib/mmg/types";

const players = [
  { id: "a", displayName: "Abe" },
  { id: "b", displayName: "Baz" },
  { id: "c", displayName: "Crank" },
];

const self = (over: Partial<SelfScored> = {}): SelfScored => ({
  games: 0,
  packing: 0,
  other: 0,
  detail: {
    games: [],
    packing: [],
    otherGroups: [],
    confirmationOrder: null,
    arrivalOrder: null,
  },
  ...over,
});

describe("toSessionRows", () => {
  it("sums order + games + packing + other into the grand total", () => {
    const order = [{ playerId: "a", arrivalPoints: 300, confirmationPoints: 200 }];
    const rows = toSessionRows(players, order, ["a"], {
      a: self({ games: 1500, packing: 600, other: 400 }),
    });
    const abe = rows.find((r) => r.playerId === "a")!;
    expect(abe).toMatchObject({
      submitted: true,
      arrivalPoints: 300,
      confirmationPoints: 200,
      gamesPoints: 1500,
      packingPoints: 600,
      otherPoints: 400,
      total: 3000,
    });
  });

  it("defaults missing players to zero across every column", () => {
    const rows = toSessionRows(players, [], [], {});
    const baz = rows.find((r) => r.playerId === "b")!;
    expect(baz).toMatchObject({
      submitted: false,
      arrivalPoints: 0,
      confirmationPoints: 0,
      gamesPoints: 0,
      packingPoints: 0,
      otherPoints: 0,
      total: 0,
      detail: null,
    });
  });

  it("counts self-scored-only submitters (no order points) toward their total", () => {
    const rows = toSessionRows(players, [], ["c"], { c: self({ other: 1000 }) });
    const crank = rows.find((r) => r.playerId === "c")!;
    expect(crank.submitted).toBe(true);
    expect(crank.total).toBe(1000);
  });

  it("adds gym rep points to the total, even for non-MMG-submitters", () => {
    // Baz did gym (30 reps → 3000) but never submitted an MMG entry.
    const rows = toSessionRows(players, [], [], {}, { b: { reps: 30, points: 3000 } });
    const baz = rows.find((r) => r.playerId === "b")!;
    expect(baz.submitted).toBe(false);
    expect(baz.repReps).toBe(30);
    expect(baz.repPoints).toBe(3000);
    expect(baz.total).toBe(3000);
  });
});

const config: ScoringConfig = {
  result: { won: 500, drew: 200, lost: 100 },
  statDefault: { goals: 300, assists: 100 },
  statOverride: {},
  participation: {
    unpacking: 500,
    packingWeights: 1000,
    packingKit: 1000,
    confirmedBy11am: 500,
  },
  orderBasePerRank: 100,
  pointsPerRep: 100,
};

const draft: MmgDraft = {
  participation: {
    confirmationOrder: 1,
    arrivalOrder: 2,
    unpacking: true,
    packingWeights: true,
    packingKit: false,
    confirmedBy11am: null,
  },
  games: [
    {
      id: "g1",
      type: "football-short",
      results: { won: 2, drew: 0, lost: 1 },
      stats: { goals: 3, assists: 0 },
    },
  ],
  others: [
    { id: "o1", description: "Rugby Win as Manager", points: "2000" },
    { id: "o2", description: "blank", points: "" },
    { id: "o3", description: "zero", points: "0" },
  ],
  narration: "",
};

describe("buildSelfScored", () => {
  const result = buildSelfScored(config, draft, (k) => `Game:${k}`);

  it("computes games as result + stat points", () => {
    // 2 won ×500 + 1 lost ×100 = 1100; goals 3 ×300 = 900 → 2000
    expect(result.games).toBe(2000);
    expect(result.detail.games[0]).toMatchObject({
      name: "Game:football-short",
      won: 2,
      lost: 1,
      resultPoints: 1100,
    });
    expect(result.detail.games[0].stats).toEqual([
      { key: "goals", count: 3, points: 900 },
    ]);
  });

  it("sums only the true packing flags and lists them", () => {
    // unpacking 500 + weights 1000 = 1500
    expect(result.packing).toBe(1500);
    expect(result.detail.packing.map((p) => p.label)).toEqual([
      "Unpacking",
      "Packing weights",
    ]);
  });

  it("keeps only non-zero other rows and groups them by type", () => {
    expect(result.other).toBe(2000);
    expect(result.detail.otherGroups).toEqual([
      {
        category: "Other",
        points: 2000,
        lines: [{ label: "Rugby Win as Manager", points: 2000 }],
      },
    ]);
  });

  it("carries the order ranks into the detail", () => {
    expect(result.detail.confirmationOrder).toBe(1);
    expect(result.detail.arrivalOrder).toBe(2);
  });
});

describe("classifyOther", () => {
  it("tags free-form descriptions into coarse buckets by keyword", () => {
    expect(classifyOther("GWtW PUs, Squats, Calves, Abs 1 mins")).toBe("Fitness");
    expect(classifyOther("Passing drill 5 wins 1 tie")).toBe("Drill");
    expect(classifyOther("Rugby win margin of 12")).toBe("Bonus");
    expect(classifyOther("MMG tyre game")).toBe("Game");
    expect(classifyOther("Skill (Shibobo 2 + Backheel 1)")).toBe("Skill");
    expect(classifyOther("Celebration")).toBe("Other");
  });

  it("groups multiple lines of the same type and subtotals them, desc by points", () => {
    const grouped = buildSelfScored(
      config,
      {
        ...draft,
        others: [
          { id: "a", description: "Passing drill", points: "5500" },
          { id: "b", description: "Football crossing drill", points: "4000" },
          { id: "c", description: "MMG tyre game", points: "16900" },
        ],
      },
      (k) => k,
    ).detail.otherGroups;
    expect(grouped.map((g) => [g.category, g.points])).toEqual([
      ["Game", 16900],
      ["Drill", 9500],
    ]);
  });
});
