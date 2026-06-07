/**
 * Canonical Gym log (draft) shape — shared by the client form, the autosave
 * layer and the server repository. Mirrors the DB:
 *   bodyWeight/unit/narration → gym_logs columns
 *   rows                      → gym_log_exercises
 *
 * Gym logging carries NO points; it is performance tracking only. The log is
 * keyed per (player, day), so unlike MMG there is no Finalize step.
 */

export type WeightUnit = "kg" | "lb";

export interface ExerciseRow {
  /** Client-stable id (also the gym_log_exercises id when round-tripped). */
  id: string;
  bodyPart: string;
  /** null when no equipment / bodyweight movement. */
  equipment: string | null;
  /** 0 when the equipment carries no weight. */
  weight: number;
  weightUnit: WeightUnit;
  /** Preset or free-form set/rep scheme string. */
  scheme: string;
  notes: string;
}

export interface GymDraft {
  rows: ExerciseRow[];
  /** Free-form so a player can type 78.5 etc.; coerced on save. */
  bodyWeight: string;
  bodyWeightUnit: WeightUnit;
  narration: string;
}

export function emptyDraft(): GymDraft {
  return {
    rows: [],
    bodyWeight: "",
    bodyWeightUnit: "kg",
    narration: "",
  };
}

export function newExercise(
  id: string,
  defaults: { bodyPart: string; scheme: string },
): ExerciseRow {
  return {
    id,
    bodyPart: defaults.bodyPart,
    equipment: "None",
    weight: 0,
    weightUnit: "kg",
    scheme: defaults.scheme,
    notes: "",
  };
}

/** Weight increment per tap for a unit (2 kg / 5 lb). */
export function weightStep(unit: WeightUnit): number {
  return unit === "kg" ? 2 : 5;
}
