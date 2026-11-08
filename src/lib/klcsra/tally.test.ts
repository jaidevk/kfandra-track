import { describe, it, expect } from "vitest";
import { goalTally, hideLeagueScore, leagueScoreHidden, officialScore } from "./tally";
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

describe("hideLeagueScore", () => {
  const halves = [
    { id: "h1", halfNo: 1, sides: [
      { id: "s1", side: "home" as const, clubId: "a", clubName: "A", score: 3 },
      { id: "s2", side: "away" as const, clubId: "b", clubName: "B", score: 1 },
    ] },
  ];
  const scores = (x: { halves: typeof halves }) => x.halves.flatMap((h) => h.sides.map((s) => s.score));

  it("zeroes every side score on a league match that is not official yet", () => {
    for (const status of ["draft", "sent"] as const) {
      const out = hideLeagueScore({ isFriendly: false, status, halves });
      expect(scores(out)).toEqual([0, 0]);
      expect(out.halves[0].sides[0].clubName).toBe("A");
    }
    expect(scores({ halves })).toEqual([3, 1]);
  });

  it("leaves an official league match and every friendly alone", () => {
    expect(scores(hideLeagueScore({ isFriendly: false, status: "submitted", halves }))).toEqual([3, 1]);
    expect(scores(hideLeagueScore({ isFriendly: true, status: "draft", halves }))).toEqual([3, 1]);
  });

  it("leagueScoreHidden says the same", () => {
    expect(leagueScoreHidden({ isFriendly: false, status: "sent" })).toBe(true);
    expect(leagueScoreHidden({ isFriendly: false, status: "submitted" })).toBe(false);
    expect(leagueScoreHidden({ isFriendly: true, status: "draft" })).toBe(false);
  });
});
