import { describe, it, expect } from "vitest";
import {
  exerciseCount,
  testCount,
  totalSets,
  hasWeight,
  buildSchemeSummary,
  buildTestSummary,
} from "./summary";
import {
  emptyDraft,
  newExercise,
  newTest,
  type ExerciseRow,
  type GymDraft,
} from "./types";

const rowWithSets = (
  id: string,
  sets: ExerciseRow["sets"],
  extra: Partial<ExerciseRow> = {},
): ExerciseRow => ({ ...newExercise(id, { bodyPart: "Shoulders" }), sets, ...extra });

const testRow = (
  id: string,
  metric: "time" | "reps",
  attempts: ExerciseRow["attempts"],
): ExerciseRow => ({ ...newTest(id, { name: "Bronco Test", metric }), attempts });

describe("exerciseCount / totalSets", () => {
  it("counts rows and sums actual set counts", () => {
    const draft: GymDraft = {
      ...emptyDraft(),
      rows: [
        rowWithSets("r1", [{ reps: 8, weight: 10 }, { reps: 8, weight: 10 }]), // 2
        rowWithSets("r2", [{ reps: 12, weight: 0 }]), // 1
      ],
    };
    expect(exerciseCount(draft)).toBe(2);
    expect(totalSets(draft)).toBe(3);
  });

  it("an empty draft has no exercises and zero sets", () => {
    expect(exerciseCount(emptyDraft())).toBe(0);
    expect(totalSets(emptyDraft())).toBe(0);
  });

  it("tests do not count as exercises or sets", () => {
    const draft: GymDraft = {
      ...emptyDraft(),
      rows: [
        rowWithSets("r1", [{ reps: 8, weight: 10 }]),
        testRow("t1", "time", [{ mins: 5, seconds: 10, reps: 0 }]),
        testRow("t2", "reps", [{ mins: 0, seconds: 0, reps: 42 }]),
      ],
    };
    expect(exerciseCount(draft)).toBe(1);
    expect(totalSets(draft)).toBe(1);
    expect(testCount(draft)).toBe(2);
  });
});

describe("buildTestSummary", () => {
  it("joins timed attempts as 'Xm YYs'", () => {
    const row = testRow("t", "time", [
      { mins: 5, seconds: 12, reps: 0 },
      { mins: 5, seconds: 5, reps: 0 },
    ]);
    expect(buildTestSummary(row)).toBe("5m 12s / 5m 05s");
    expect(buildSchemeSummary(row)).toBe("5m 12s / 5m 05s");
  });
  it("joins rep attempts and labels 'reps' once", () => {
    const row = testRow("t", "reps", [
      { mins: 0, seconds: 0, reps: 42 },
      { mins: 0, seconds: 0, reps: 39 },
    ]);
    expect(buildTestSummary(row)).toBe("42 / 39 reps");
  });
  it("returns '' when a test has no attempts", () => {
    expect(buildTestSummary(testRow("t", "reps", []))).toBe("");
  });
});

describe("hasWeight", () => {
  it("is true when any set carries weight", () => {
    expect(hasWeight(rowWithSets("r", [{ reps: 8, weight: 0 }, { reps: 8, weight: 12 }]))).toBe(true);
  });
  it("is false when every set is weightless", () => {
    expect(hasWeight(rowWithSets("r", [{ reps: 14, weight: 0 }]))).toBe(false);
  });
});

describe("buildSchemeSummary", () => {
  it("formats weighted sets as reps×weight with the unit labeled once", () => {
    const row = rowWithSets(
      "r",
      [
        { reps: 14, weight: 10 },
        { reps: 8, weight: 15 },
        { reps: 8, weight: 25 },
        { reps: 8, weight: 20 },
        { reps: 8, weight: 20 },
        { reps: 14, weight: 20 },
      ],
      { weightUnit: "lb" },
    );
    expect(buildSchemeSummary(row)).toBe(
      "6 sets · 14×10 · 8×15 · 8×25 · 8×20 · 8×20 · 14×20 lb",
    );
  });

  it("formats no-weight sets as reps only", () => {
    const row = rowWithSets("r", [
      { reps: 14, weight: 0 },
      { reps: 8, weight: 0 },
      { reps: 8, weight: 0 },
    ]);
    expect(buildSchemeSummary(row)).toBe("3 sets · 14 · 8 · 8 reps");
  });

  it("uses the singular 'set' for a single set", () => {
    expect(buildSchemeSummary(rowWithSets("r", [{ reps: 10, weight: 0 }]))).toBe(
      "1 set · 10 reps",
    );
  });

  it("returns an empty string when there are no sets", () => {
    expect(buildSchemeSummary(rowWithSets("r", []))).toBe("");
  });
});
