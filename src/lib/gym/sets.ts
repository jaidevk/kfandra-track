import { weightStep, DEFAULT_REPS, type ExerciseSet, type WeightUnit } from "./types";

/**
 * Pure helpers for an exercise's per-set list. Sets carry forward: a new set
 * inherits the previous set's reps & weight, so the player only taps what
 * changed. All functions return new arrays (no mutation) for React state.
 */

export const MIN_SETS = 1;
export const MAX_SETS = 8;

export function newSet(reps: number = DEFAULT_REPS, weight = 0): ExerciseSet {
  return { reps, weight };
}

/** Append a set inheriting the last set's values (or a default). Capped at MAX_SETS. */
export function addSet(sets: ExerciseSet[]): ExerciseSet[] {
  if (sets.length >= MAX_SETS) return sets;
  const last = sets[sets.length - 1];
  return [...sets, last ? { ...last } : newSet()];
}

/** Drop the last set. Never below MIN_SETS. */
export function removeSet(sets: ExerciseSet[]): ExerciseSet[] {
  if (sets.length <= MIN_SETS) return sets;
  return sets.slice(0, -1);
}

/** Adjust reps on one set by ±1; reps floor at 1. */
export function stepReps(
  sets: ExerciseSet[],
  index: number,
  dir: 1 | -1,
): ExerciseSet[] {
  return sets.map((s, i) =>
    i === index ? { ...s, reps: Math.max(1, s.reps + dir) } : s,
  );
}

/** Adjust weight on one set by the unit step; weight floors at 0. */
export function stepSetWeight(
  sets: ExerciseSet[],
  index: number,
  dir: 1 | -1,
  unit: WeightUnit,
): ExerciseSet[] {
  const step = weightStep(unit);
  return sets.map((s, i) =>
    i === index ? { ...s, weight: Math.max(0, s.weight + dir * step) } : s,
  );
}

/** Signed reps change vs the previous set; null for the first set. */
export function repsDelta(sets: ExerciseSet[], index: number): number | null {
  if (index <= 0) return null;
  return sets[index].reps - sets[index - 1].reps;
}

/** Signed weight change vs the previous set; null for the first set. */
export function weightDelta(sets: ExerciseSet[], index: number): number | null {
  if (index <= 0) return null;
  return sets[index].weight - sets[index - 1].weight;
}
