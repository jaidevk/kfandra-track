import { describe, it, expect } from "vitest";
import {
  newAttempt,
  addAttempt,
  removeAttempt,
  stepMins,
  stepSeconds,
  stepAttemptReps,
  attemptRepsDelta,
  attemptTimeDelta,
  MIN_ATTEMPTS,
  MAX_ATTEMPTS,
  MAX_SECONDS,
} from "./attempts";
import type { TestAttempt } from "./types";

const t = (mins: number, seconds: number, reps = 0): TestAttempt => ({
  mins,
  seconds,
  reps,
});

describe("newAttempt", () => {
  it("seeds reps for a rep test and zero time for a timed test", () => {
    expect(newAttempt("reps")).toEqual({ mins: 0, seconds: 0, reps: 10 });
    expect(newAttempt("time")).toEqual({ mins: 0, seconds: 0, reps: 0 });
  });
});

describe("addAttempt / removeAttempt", () => {
  it("appends an attempt inheriting the last one's values", () => {
    expect(addAttempt([t(5, 10, 0)])).toEqual([t(5, 10, 0), t(5, 10, 0)]);
  });
  it("never exceeds MAX_ATTEMPTS", () => {
    const full = Array.from({ length: MAX_ATTEMPTS }, () => t(1, 0));
    expect(addAttempt(full)).toHaveLength(MAX_ATTEMPTS);
  });
  it("never drops below MIN_ATTEMPTS", () => {
    const one = [t(1, 0)];
    expect(removeAttempt(one)).toHaveLength(MIN_ATTEMPTS);
    expect(removeAttempt([t(1, 0), t(2, 0)])).toEqual([t(1, 0)]);
  });
});

describe("steppers", () => {
  it("steps minutes by 1 and floors at 0", () => {
    expect(stepMins([t(2, 0)], 0, 1)).toEqual([t(3, 0)]);
    expect(stepMins([t(0, 0)], 0, -1)).toEqual([t(0, 0)]);
  });
  it("steps seconds by 5, clamped to [0, MAX_SECONDS]", () => {
    expect(stepSeconds([t(0, 10)], 0, 1)).toEqual([t(0, 15)]);
    expect(stepSeconds([t(0, 0)], 0, -1)).toEqual([t(0, 0)]);
    expect(stepSeconds([t(0, MAX_SECONDS)], 0, 1)).toEqual([t(0, MAX_SECONDS)]);
  });
  it("steps reps by 1 and floors at 0", () => {
    expect(stepAttemptReps([t(0, 0, 42)], 0, 1)).toEqual([t(0, 0, 43)]);
    expect(stepAttemptReps([t(0, 0, 0)], 0, -1)).toEqual([t(0, 0, 0)]);
  });
  it("only touches the targeted attempt", () => {
    expect(stepMins([t(1, 0), t(2, 0)], 1, 1)).toEqual([t(1, 0), t(3, 0)]);
  });
});

describe("deltas", () => {
  it("reps delta is null for the first attempt, signed thereafter", () => {
    const a = [t(0, 0, 42), t(0, 0, 39)];
    expect(attemptRepsDelta(a, 0)).toBeNull();
    expect(attemptRepsDelta(a, 1)).toBe(-3);
  });
  it("time delta compares total seconds vs the previous attempt", () => {
    const a = [t(5, 12), t(5, 5)]; // 312s → 305s
    expect(attemptTimeDelta(a, 0)).toBeNull();
    expect(attemptTimeDelta(a, 1)).toBe(-7);
  });
});
