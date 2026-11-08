import { describe, it, expect } from "vitest";
import { goalTally, officialScore } from "./tally";
import type { AppearanceDraft, MatchDraft } from "./types";

const app = (side: "home" | "away", stats: AppearanceDraft["stats"]): AppearanceDraft =>
  ({ id: `${side}-${Math.random()}`, playerId: "p", displayName: "P", side, slot: 1, stats });
const m = (over: Partial<MatchDraft>): Pick<MatchDraft, "isCombined" | "halves" | "appearances"> => ({
  isCombined: false,
  halves: [{ id: "h1", halfNo: 1, sides: [] }],
  appearances: [],
  ...over,
});

describe("goalTally", () => {
  it("counts every scoring stat for the side, and own goals for the other side", () => {
    const t = goalTally(m({
      appearances: [
        app("home", { 1: { goal: 1, mainGoal: 1, reboundGoal: 1, try: 1, conversion: 1, assist: 3 } }),
        app("away", { 1: { ownGoal: 2 } }),
      ],
    }));
    expect(t).toEqual({ home: 7, away: 0 });
  });

  it("a normal match counts half 1 only; a combined match adds both halves", () => {
    const appearances = [app("home", { 1: { goal: 1 }, 2: { goal: 2 } })];
    const halves = [{ id: "h1", halfNo: 1, sides: [] }, { id: "h2", halfNo: 2, sides: [] }];
    expect(goalTally(m({ appearances, halves })).home).toBe(1);
    expect(goalTally(m({ appearances, halves, isCombined: true })).home).toBe(3);
  });
});

describe("officialScore", () => {
  it("sums the counted halves' side scores", () => {
    const side = (s: "home" | "away", score: number) =>
      ({ id: s, side: s, clubId: s, clubName: s, score });
    const halves = [
      { id: "h1", halfNo: 1, sides: [side("home", 2), side("away", 1)] },
      { id: "h2", halfNo: 2, sides: [side("home", 1), side("away", 1)] },
    ];
    expect(officialScore(m({ halves }))).toEqual({ home: 2, away: 1 });
    expect(officialScore(m({ halves, isCombined: true }))).toEqual({ home: 3, away: 2 });
  });
});
