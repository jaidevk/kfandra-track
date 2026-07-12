import type { ExerciseRow, GymDraft } from "./types";

/**
 * Pure summaries for the gym log. Gym is unscored, so these are simple counts
 * and display strings — but they live here (not in the component) so the
 * behaviour is unit-tested and the form stays declarative.
 */

/** Number of logged exercise rows (excludes S&C tests). */
export function exerciseCount(draft: GymDraft): number {
  return draft.rows.filter((r) => r.entryType === "exercise").length;
}

/** Number of logged S&C test rows. */
export function testCount(draft: GymDraft): number {
  return draft.rows.filter((r) => r.entryType === "test").length;
}

/** Exact total sets across all logged exercises (tests excluded). */
export function totalSets(draft: GymDraft): number {
  return draft.rows
    .filter((r) => r.entryType === "exercise")
    .reduce((sum, r) => sum + r.sets.length, 0);
}

/** Whether any set in the row carries weight (drives weighted vs reps-only display). */
export function hasWeight(row: ExerciseRow): boolean {
  return row.sets.some((s) => s.weight > 0);
}

/** Format one timed attempt as "5m 05s" (seconds zero-padded). */
export function formatTime(mins: number, seconds: number): string {
  return `${mins}m ${String(seconds).padStart(2, "0")}s`;
}

/**
 * Human-readable summary of a test's attempts, joined by " / ", e.g.
 *   time: "5m 12s / 5m 05s"
 *   reps: "42 reps"  ·  "42 / 39 reps"
 * Returns "" for a test with no attempts.
 */
export function buildTestSummary(row: ExerciseRow): string {
  if (row.attempts.length === 0) return "";
  if (row.testMetric === "time") {
    return row.attempts.map((a) => formatTime(a.mins, a.seconds)).join(" / ");
  }
  return `${row.attempts.map((a) => a.reps).join(" / ")} reps`;
}

/**
 * Human-readable summary of a logged item. Exercises summarise their sets, e.g.
 *   weighted : "6 sets · 14×10 · 8×15 · 8×25 · 8×20 · 8×20 · 14×20 lb"
 *   reps-only: "3 sets · 14 · 8 · 8 reps"
 * Tests summarise their attempts (see buildTestSummary). Returns "" when empty.
 */
export function buildSchemeSummary(row: ExerciseRow): string {
  if (row.entryType === "test") return buildTestSummary(row);
  const n = row.sets.length;
  if (n === 0) return "";
  const label = `${n} ${n === 1 ? "set" : "sets"}`;
  if (hasWeight(row)) {
    const parts = row.sets.map((s) => `${s.reps}×${s.weight}`);
    return `${label} · ${parts.join(" · ")} ${row.weightUnit}`;
  }
  const parts = row.sets.map((s) => `${s.reps}`);
  return `${label} · ${parts.join(" · ")} reps`;
}
