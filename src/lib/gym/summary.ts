import type { ExerciseRow, GymDraft } from "./types";

/**
 * Pure summaries for the gym log header. Gym is unscored, so these are simple
 * counts rather than points — but they live here (not in the component) so the
 * behaviour is unit-tested and the form stays declarative.
 */

/**
 * Best-effort set count from a scheme string. Matches a leading "N sets …"
 * pattern (e.g. "6 sets, 8, 4×6, 8" → 6). Falls back to 4 when the scheme has
 * no leading count (custom free-form schemes, "Variation!", etc.).
 */
export function estimateSets(scheme: string): number {
  const m = scheme.match(/^\s*(\d+)\s*sets/i);
  if (m) return parseInt(m[1], 10);
  return 4;
}

/** Number of logged exercise rows. */
export function exerciseCount(draft: GymDraft): number {
  return draft.rows.length;
}

/** Estimated total sets across all logged exercises. */
export function totalSets(draft: GymDraft): number {
  return draft.rows.reduce((sum, r) => sum + estimateSets(r.scheme), 0);
}

/** Whether a weight value is meaningful for a row (>0 and equipment present). */
export function hasWeight(row: ExerciseRow): boolean {
  return row.weight > 0 && row.equipment !== null && row.equipment !== "None";
}
