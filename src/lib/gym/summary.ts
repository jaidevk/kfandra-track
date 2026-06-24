import type { ExerciseRow, GymDraft } from "./types";

/**
 * Pure summaries for the gym log. Gym is unscored, so these are simple counts
 * and display strings — but they live here (not in the component) so the
 * behaviour is unit-tested and the form stays declarative.
 */

/** Number of logged exercise rows. */
export function exerciseCount(draft: GymDraft): number {
  return draft.rows.length;
}

/** Exact total sets across all logged exercises. */
export function totalSets(draft: GymDraft): number {
  return draft.rows.reduce((sum, r) => sum + r.sets.length, 0);
}

/** Whether any set in the row carries weight (drives weighted vs reps-only display). */
export function hasWeight(row: ExerciseRow): boolean {
  return row.sets.some((s) => s.weight > 0);
}

/**
 * Human-readable summary of an exercise's sets, e.g.
 *   weighted : "6 sets · 14×10 · 8×15 · 8×25 · 8×20 · 8×20 · 14×20 lb"
 *   reps-only: "3 sets · 14 · 8 · 8 reps"
 * Returns "" for a row with no sets.
 */
export function buildSchemeSummary(row: ExerciseRow): string {
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
