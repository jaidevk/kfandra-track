import { describe, it, expect } from "vitest";
import { cleanTimes, isTimed, scorersLine, trimTimes } from "./goal-times";
import type { AppearanceDraft } from "./types";

describe("isTimed", () => {
  it("is league Fooba goals and Rugby Sox tries only", () => {
    expect(isTimed("fooba", "mainGoal", false)).toBe(true);
    expect(isTimed("fooba", "reboundGoal", false)).toBe(true);
    expect(isTimed("rugby", "try", false)).toBe(true);
    expect(isTimed("rugby", "conversion", false)).toBe(false);
    expect(isTimed("football", "goal", false)).toBe(false);
    expect(isTimed("fooba", "mainGoal", true)).toBe(false);
  });
});

describe("trimTimes", () => {
  it("keeps at most `count` entries and drops trailing blanks", () => {
    expect(trimTimes([12, 34, 56], 2)).toEqual([12, 34]);
    expect(trimTimes([12, null, null], 3)).toEqual([12]);
    expect(trimTimes([null, 40], 2)).toEqual([null, 40]);
  });
});

describe("cleanTimes", () => {
  it("accepts whole minutes 0..150 and blanks", () => {
    expect(cleanTimes([12, null, 0, 150])).toEqual([12, null, 0, 150]);
  });
  it("rejects anything else", () => {
    expect(cleanTimes([151])).toBeNull();
    expect(cleanTimes([-1])).toBeNull();
    expect(cleanTimes([1.5])).toBeNull();
    expect(cleanTimes(["12"])).toBeNull();
    expect(cleanTimes("12" as unknown as unknown[])).toBeNull();
  });
});

describe("scorersLine", () => {
  const a = (name: string, side: "home" | "away", stats: AppearanceDraft["stats"], times?: AppearanceDraft["times"]): AppearanceDraft =>
    ({ id: name, playerId: name, displayName: name, side, slot: 1, stats, ...(times ? { times } : {}) });

  it("lists scorers with counts and sorted times, earliest scorer first", () => {
    const apps = [
      a("Acid", "home", { 1: { mainGoal: 1 } }),
      a("Caveman", "home", { 1: { mainGoal: 2 } }, { 1: { mainGoal: [34, 12] } }),
      a("Pam", "away", { 1: { mainGoal: 1 } }, { 1: { mainGoal: [5] } }),
    ];
    expect(scorersLine(apps, "home", [1])).toBe("Caveman ×2 (12', 34') · Acid");
    expect(scorersLine(apps, "away", [1])).toBe("Pam (5')");
  });

  it("ignores halves that don't count, and non-scoring stats", () => {
    const apps = [a("X", "home", { 1: { assist: 2 }, 2: { goal: 1 } })];
    expect(scorersLine(apps, "home", [1])).toBe("");
  });
});
