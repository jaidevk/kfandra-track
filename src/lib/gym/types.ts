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

/**
 * A logged item is either a normal `exercise` (body part + equipment + sets) or
 * an S&C `test` (Bronco, Bleep, the 1-minute tests). Tests reshape the entry
 * sheet: the Equipment picker becomes a Test picker and the Sets section
 * becomes TIME TAKEN or REPS depending on the test's metric.
 */
export type EntryType = "exercise" | "test";

/** How an S&C test is measured: `time` (Bronco/Bleep) or `reps` (1-min tests). */
export type TestMetric = "time" | "reps";

/**
 * One attempt of an S&C test. A test can be done more than once — each attempt
 * is one entry (mirrors an exercise's sets). Timed tests use mins/seconds;
 * rep tests use reps. The unused fields stay 0.
 */
export interface TestAttempt {
  mins: number;
  seconds: number;
  reps: number;
}

/** The body-part/movement value that flips the sheet into test mode. */
export const SANDC_TESTS_BODY_PART = "S and C Tests";

export interface ExerciseRow {
  /** Client-stable id (also the gym_log_exercises id when round-tripped). */
  id: string;
  /** `exercise` (default) or `test`. Discriminates the two logged-item shapes. */
  entryType: EntryType;
  bodyPart: string;
  /** null when no equipment / bodyweight movement. Always null for tests. */
  equipment: string | null;
  weightUnit: WeightUnit;
  /** Per-set reps & weight (exercise rows). Empty for tests. */
  sets: ExerciseSet[];
  /** Selected test name (test rows only; null for exercises). */
  testName: string | null;
  /** How the test is measured (test rows only; null for exercises). */
  testMetric: TestMetric | null;
  /** Per-attempt time/reps (test rows). Empty for exercises. */
  attempts: TestAttempt[];
  /**
   * Display summary string. Regenerated from `sets`/`attempts` on save (see
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
    entryType: "exercise",
    bodyPart: defaults.bodyPart,
    equipment: "None",
    weightUnit: "kg",
    sets: [{ reps: DEFAULT_REPS, weight: 0 }],
    testName: null,
    testMetric: null,
    attempts: [],
    scheme: "",
    notes: "",
  };
}

/**
 * A brand-new S&C test row, seeded with one attempt. Rep tests start at
 * DEFAULT_REPS; timed tests start at 0m 0s.
 */
export function newTest(
  id: string,
  test: { name: string; metric: TestMetric },
): ExerciseRow {
  return {
    id,
    entryType: "test",
    bodyPart: SANDC_TESTS_BODY_PART,
    equipment: null,
    weightUnit: "kg",
    sets: [],
    testName: test.name,
    testMetric: test.metric,
    attempts: [
      { mins: 0, seconds: 0, reps: test.metric === "reps" ? DEFAULT_REPS : 0 },
    ],
    scheme: "",
    notes: "",
  };
}

/** Weight increment per tap for a unit (0.5 kg / 1 lb). */
export function weightStep(unit: WeightUnit): number {
  return unit === "kg" ? 0.5 : 1;
}
