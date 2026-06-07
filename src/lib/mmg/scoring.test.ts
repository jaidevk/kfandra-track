import { describe, it, expect } from "vitest";
import {
  buildScoringConfig,
  computeDraftPoints,
  gameTotal,
  statValue,
  type PointRuleRow,
} from "./scoring";
import { emptyDraft, type MmgDraft } from "./types";

// Mirrors the seed (20260607120006). Kept here so the test pins the exact
// mapping from point_rules rows → scoring behaviour.
const SEED_ROWS: PointRuleRow[] = [
  { scope: "result", rule_key: "won", points: 1000, game_type_key: null },
  { scope: "result", rule_key: "drew", points: 100, game_type_key: null },
  { scope: "result", rule_key: "lost", points: 0, game_type_key: null },
  { scope: "stat", rule_key: "goals", points: 500, game_type_key: null },
  { scope: "stat", rule_key: "tries", points: 500, game_type_key: null },
  { scope: "stat", rule_key: "assists", points: 200, game_type_key: null },
  { scope: "stat", rule_key: "preAssists", points: 100, game_type_key: null },
  { scope: "stat", rule_key: "saves", points: 500, game_type_key: null },
  { scope: "stat", rule_key: "goalLineSaves", points: 500, game_type_key: null },
  { scope: "stat", rule_key: "reboundWall", points: 500, game_type_key: null },
  { scope: "stat", rule_key: "tackles", points: 200, game_type_key: null },
  { scope: "stat", rule_key: "yellowCards", points: -100, game_type_key: null },
  { scope: "stat", rule_key: "redCards", points: -500, game_type_key: null },
  { scope: "stat", rule_key: "blueCards", points: -1000, game_type_key: null },
  { scope: "stat", rule_key: "lateChallenges", points: -100, game_type_key: null },
  { scope: "stat", rule_key: "fouls", points: -200, game_type_key: null },
  // overrides
  { scope: "stat", rule_key: "tackles", points: 500, game_type_key: "rugby-short" },
  { scope: "stat", rule_key: "tackles", points: 500, game_type_key: "rugby-full" },
  { scope: "stat", rule_key: "goalConceded", points: -200, game_type_key: "fooba-big-goal" },
  // participation
  { scope: "participation", rule_key: "unpacking", points: 500, game_type_key: null },
  { scope: "participation", rule_key: "packing_weights", points: 500, game_type_key: null },
  { scope: "participation", rule_key: "packing_kit", points: 200, game_type_key: null },
  { scope: "participation", rule_key: "confirmed_by_11am", points: 500, game_type_key: null },
  // order
  { scope: "order", rule_key: "base_per_rank", points: 100, game_type_key: null },
];

const config = buildScoringConfig(SEED_ROWS);

describe("buildScoringConfig", () => {
  it("maps result, participation and order rules", () => {
    expect(config.result).toEqual({ won: 1000, drew: 100, lost: 0 });
    expect(config.participation).toEqual({
      unpacking: 500,
      packingWeights: 500,
      packingKit: 200,
      confirmedBy11am: 500,
    });
    expect(config.orderBasePerRank).toBe(100);
  });
});

describe("statValue", () => {
  it("uses the default when no override exists", () => {
    expect(statValue(config, "football-short", "tackles")).toBe(200);
    expect(statValue(config, "football-short", "goals")).toBe(500);
  });

  it("applies the rugby tackle override (500, not the default 200)", () => {
    expect(statValue(config, "rugby-short", "tackles")).toBe(500);
    expect(statValue(config, "rugby-full", "tackles")).toBe(500);
  });

  it("scores goalConceded only on Fooba (Big Goal)", () => {
    expect(statValue(config, "fooba-big-goal", "goalConceded")).toBe(-200);
    // No default, no override elsewhere → worth nothing.
    expect(statValue(config, "football-short", "goalConceded")).toBe(0);
    expect(statValue(config, "fooba-rebound", "goalConceded")).toBe(0);
  });
});

describe("gameTotal", () => {
  it("won football game: result + goals + assist", () => {
    // 1000 (won) + 2×500 (goals) + 1×200 (assist) = 2200
    const total = gameTotal(config, {
      id: "g1",
      type: "football-short",
      results: { won: 1, drew: 0, lost: 0 },
      stats: { goals: 2, assists: 1 },
    });
    expect(total).toBe(2200);
  });

  it("multiplies result points by the win/draw/loss counts", () => {
    // 3 won×1000 + 2 drew×100 + 1 lost×0 = 3200, + 4 goals×500 = 5200
    const total = gameTotal(config, {
      id: "g1b",
      type: "football-short",
      results: { won: 3, drew: 2, lost: 1 },
      stats: { goals: 4 },
    });
    expect(total).toBe(5200);
  });

  it("rugby game charges 500 per tackle", () => {
    // drew 100 + 3 tries×500 + 2 tackles×500 = 100 + 1500 + 1000 = 2600
    const total = gameTotal(config, {
      id: "g2",
      type: "rugby-full",
      results: { won: 0, drew: 1, lost: 0 },
      stats: { tries: 3, tackles: 2 },
    });
    expect(total).toBe(2600);
  });

  it("big-goal game subtracts conceded goals and penalties", () => {
    // won 1000 + 1 goal×500 − 2 conceded×200 − 1 red×500 = 1000 + 500 − 400 − 500 = 600
    const total = gameTotal(config, {
      id: "g3",
      type: "fooba-big-goal",
      results: { won: 1, drew: 0, lost: 0 },
      stats: { goals: 1, goalConceded: 2, redCards: 1 },
    });
    expect(total).toBe(600);
  });

  it("ignores zero/absent stats and zero result counts", () => {
    const total = gameTotal(config, {
      id: "g4",
      type: "football-short",
      results: { won: 0, drew: 0, lost: 1 },
      stats: { goals: 0 },
    });
    expect(total).toBe(0); // lost = 0
  });
});

describe("computeDraftPoints", () => {
  it("sums participation, games and others", () => {
    const draft: MmgDraft = {
      participation: {
        confirmationOrder: 1,
        arrivalOrder: 1,
        unpacking: true, // +500
        packingWeights: false,
        packingKit: true, // +200
        confirmedBy11am: true, // +500
      },
      games: [
        { id: "g1", type: "football-short", results: { won: 1, drew: 0, lost: 0 }, stats: { goals: 1 } }, // 1500
        { id: "g2", type: "rugby-short", results: { won: 0, drew: 0, lost: 1 }, stats: { tackles: 1 } }, // 0 + 500
      ],
      others: [
        { id: "o1", description: "MOTM", points: "300" },
        { id: "o2", description: "blank", points: "" }, // ignored
      ],
      narration: "",
    };

    const b = computeDraftPoints(config, draft);
    expect(b.participation).toBe(1200); // 500 + 200 + 500
    expect(b.games).toBe(2000); // 1500 + 500
    expect(b.others).toBe(300);
    expect(b.total).toBe(3500);
  });

  it("an empty draft scores zero", () => {
    expect(computeDraftPoints(config, emptyDraft())).toEqual({
      participation: 0,
      games: 0,
      others: 0,
      total: 0,
    });
  });
});
