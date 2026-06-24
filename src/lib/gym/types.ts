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

/** Reps & weight performed in one set. weight is 0 for no-weight movements. */
export interface ExerciseSet {
  reps: number;
  weight: number;
}

/** Default reps for the first set of a brand-new exercise. */
export const DEFAULT_REPS = 10;

export interface ExerciseRow {
  /** Client-stable id (also the gym_log_exercises id when round-tripped). */
  id: string;
  bodyPart: string;
  /** null when no equipment / bodyweight movement. */
  equipment: string | null;
  weightUnit: WeightUnit;
  /** Per-set reps & weight; always at least one set for a logged exercise. */
  sets: ExerciseSet[];
  /**
   * Display summary string. Regenerated from `sets` on save (see
   * summary.buildSchemeSummary). May hold a legacy scheme for old rows that
   * predate per-set logging and have not been re-saved.
   */
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
  defaults: { bodyPart: string },
): ExerciseRow {
  return {
    id,
    bodyPart: defaults.bodyPart,
    equipment: "None",
    weightUnit: "kg",
    sets: [{ reps: DEFAULT_REPS, weight: 0 }],
    scheme: "",
    notes: "",
  };
}

/** Weight increment per tap for a unit (2 kg / 5 lb). */
export function weightStep(unit: WeightUnit): number {
  return unit === "kg" ? 2 : 5;
}
