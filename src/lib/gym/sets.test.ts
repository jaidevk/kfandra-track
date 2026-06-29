import { describe, it, expect } from "vitest";
import {
  MIN_SETS,
  MAX_SETS,
  newSet,
  addSet,
  removeSet,
  stepReps,
  stepSetWeight,
  repsDelta,
  weightDelta,
} from "./sets";

describe("addSet", () => {
  it("appends a set inheriting the last set's reps & weight", () => {
    const out = addSet([{ reps: 8, weight: 15 }]);
    expect(out).toHaveLength(2);
    expect(out[1]).toEqual({ reps: 8, weight: 15 });
  });

  it("seeds a default set when the list is empty", () => {
    expect(addSet([])).toEqual([newSet()]);
  });

  it("never exceeds MAX_SETS", () => {
    const full = Array.from({ length: MAX_SETS }, () => newSet());
    expect(addSet(full)).toHaveLength(MAX_SETS);
  });
});

describe("removeSet", () => {
  it("drops the last set", () => {
    expect(removeSet([newSet(), { reps: 8, weight: 15 }])).toEqual([newSet()]);
  });

  it("never drops below MIN_SETS", () => {
    expect(removeSet([newSet()])).toHaveLength(MIN_SETS);
  });
});

describe("stepReps", () => {
  it("adjusts only the targeted set and floors reps at 1", () => {
    const sets = [{ reps: 1, weight: 0 }, { reps: 8, weight: 0 }];
    expect(stepReps(sets, 1, 1)[1].reps).toBe(9);
    expect(stepReps(sets, 0, -1)[0].reps).toBe(1); // floored
  });
});

describe("stepSetWeight", () => {
  it("steps weight by the unit step (0.5 kg / 1 lb) and floors at 0", () => {
    const sets = [{ reps: 8, weight: 0 }];
    expect(stepSetWeight(sets, 0, 1, "lb")[0].weight).toBe(1);
    expect(stepSetWeight(sets, 0, 1, "kg")[0].weight).toBe(0.5);
    expect(stepSetWeight(sets, 0, -1, "lb")[0].weight).toBe(0); // floored
  });
});

describe("deltas", () => {
  const sets = [{ reps: 14, weight: 10 }, { reps: 8, weight: 15 }];
  it("returns null for the first set", () => {
    expect(repsDelta(sets, 0)).toBeNull();
    expect(weightDelta(sets, 0)).toBeNull();
  });
  it("returns the signed change vs the previous set", () => {
    expect(repsDelta(sets, 1)).toBe(-6);
    expect(weightDelta(sets, 1)).toBe(5);
  });
});
