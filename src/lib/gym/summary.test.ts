import { describe, it, expect } from "vitest";
import { estimateSets, exerciseCount, totalSets, hasWeight } from "./summary";
import { emptyDraft, newExercise, type GymDraft } from "./types";

describe("estimateSets", () => {
  it("reads the leading set count from preset schemes", () => {
    expect(estimateSets("6 sets, 8, 4×6, 8")).toBe(6);
    expect(estimateSets("6 sets, All 6")).toBe(6);
    expect(estimateSets("4 sets, super 4's")).toBe(4);
  });

  it("tolerates leading whitespace and case", () => {
    expect(estimateSets("  10 SETS, whatever")).toBe(10);
  });

  it("falls back to 4 for schemes with no leading count", () => {
    expect(estimateSets("Variation!")).toBe(4);
    expect(estimateSets("")).toBe(4);
    expect(estimateSets("12-10-8-8-6")).toBe(4); // count not at the start
  });
});

describe("exerciseCount / totalSets", () => {
  const row = (id: string, scheme: string) => ({
    ...newExercise(id, { bodyPart: "Shoulders", scheme }),
  });

  it("counts rows and sums estimated sets", () => {
    const draft: GymDraft = {
      ...emptyDraft(),
      rows: [
        row("r1", "6 sets, 8, 4×6, 8"), // 6
        row("r2", "4 sets, super 7's"), // 4
        row("r3", "Variation!"), // fallback 4
      ],
    };
    expect(exerciseCount(draft)).toBe(3);
    expect(totalSets(draft)).toBe(14);
  });

  it("an empty draft has no exercises and zero sets", () => {
    expect(exerciseCount(emptyDraft())).toBe(0);
    expect(totalSets(emptyDraft())).toBe(0);
  });
});

describe("hasWeight", () => {
  const base = newExercise("r1", { bodyPart: "Biceps", scheme: "6 sets, All 6" });

  it("is true only with positive weight and real equipment", () => {
    expect(hasWeight({ ...base, equipment: "Dumbbells", weight: 12 })).toBe(true);
  });

  it("is false for zero weight, None, or null equipment", () => {
    expect(hasWeight({ ...base, equipment: "Dumbbells", weight: 0 })).toBe(false);
    expect(hasWeight({ ...base, equipment: "None", weight: 20 })).toBe(false);
    expect(hasWeight({ ...base, equipment: null, weight: 20 })).toBe(false);
  });
});
