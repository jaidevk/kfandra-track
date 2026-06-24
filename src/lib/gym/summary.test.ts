import { describe, it, expect } from "vitest";
import { exerciseCount, totalSets, hasWeight, buildSchemeSummary } from "./summary";
import { emptyDraft, newExercise, type ExerciseRow, type GymDraft } from "./types";

const rowWithSets = (
  id: string,
  sets: ExerciseRow["sets"],
  extra: Partial<ExerciseRow> = {},
): ExerciseRow => ({ ...newExercise(id, { bodyPart: "Shoulders" }), sets, ...extra });

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
