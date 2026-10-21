import { describe, it, expect } from "vitest";
import { leaguePointsLine } from "./points-preview";
import { DEFAULT_STANDINGS_RULES as rules } from "./standings-rules";
import type { AppearanceDraft, HalfDraft, MatchDraft, SideKey } from "./types";

const side = (s: SideKey, clubId: string, score: number) =>
  ({ id: `${s}-${clubId}`, side: s, clubId, clubName: clubId, score });
const half = (halfNo: number, home: [string, number] | null, away: [string, number] | null): HalfDraft => ({
  id: `h${halfNo}`,
  halfNo,
  sides: [
    ...(home ? [side("home", home[0], home[1])] : []),
    ...(away ? [side("away", away[0], away[1])] : []),
  ],
});
const players = (n: number): AppearanceDraft[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `a${i}`, playerId: `p${i}`, displayName: `P${i}`,
    side: (i % 2 === 0 ? "home" : "away") as SideKey, slot: i + 1, stats: {},
  }));

function match(overrides: Partial<MatchDraft>): MatchDraft {
  return {
    id: "m1", entryDate: "2026-10-01", sport: "football",
    isFriendly: false, isCombined: false, durationMinutes: null,
    status: "draft", submittedAt: null, seasonId: null, seasonName: null, createdBy: null,
    halves: [half(1, ["A", 1], ["B", 0])],
    appearances: players(8),
    ...overrides,
  };
}

describe("leaguePointsLine", () => {
  it("a friendly scores no league points", () => {
    expect(leaguePointsLine(match({ isFriendly: true }), rules)).toEqual({ kind: "friendly" });
  });

  it("is incomplete until every half has both clubs", () => {
    expect(leaguePointsLine(match({ halves: [half(1, ["A", 1], null)] }), rules))
      .toEqual({ kind: "incomplete" });
    expect(leaguePointsLine(match({ halves: [] }), rules)).toEqual({ kind: "incomplete" });
    expect(leaguePointsLine(match({
      isCombined: true,
      halves: [half(1, ["A", 1], ["B", 0]), half(2, null, null)],
    }), rules)).toEqual({ kind: "incomplete" });
  });

  it("shows the tier, the score and each side's points", () => {
    expect(leaguePointsLine(match({}), rules))
      .toEqual({ kind: "scored", text: "Tier 7+ · 1 – 0 · Home 5 · Away 0" });
    expect(leaguePointsLine(match({ appearances: players(5) }), rules))
      .toEqual({ kind: "scored", text: "Tier 4–6 · 1 – 0 · Home 1 · Away 0" });
  });

  it("under 2 players: the result stands but scores nothing", () => {
    expect(leaguePointsLine(match({ appearances: players(1) }), rules))
      .toEqual({ kind: "scored", text: "Under 2 players · 1 – 0 · Home 0 · Away 0" });
  });

  it("a combined match aggregates both halves and credits each club", () => {
    const m = match({
      isCombined: true,
      halves: [half(1, ["A", 1], ["B", 0]), half(2, ["C", 0], ["D", 2])],
    });
    expect(leaguePointsLine(m, rules))
      .toEqual({ kind: "scored", text: "Tier 7+ · 1 – 2 · Home 0 each · Away 5 each" });
  });
});
