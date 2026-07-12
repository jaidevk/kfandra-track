import { DEFAULT_REPS, type TestAttempt, type TestMetric } from "./types";

/**
 * Pure helpers for a test's per-attempt list. Attempts carry forward like sets:
 * a new attempt inherits the previous one's values, so the player only taps
 * what changed. All functions return new arrays (no mutation) for React state.
 *
 * Timed tests step minutes by 1 and seconds by 5 (clean 5-second granularity,
 * 0–55; finer detail goes in Notes). Rep tests step reps by 1.
 */

export const MIN_ATTEMPTS = 1;
export const MAX_ATTEMPTS = 8;
export const SECONDS_STEP = 5;
export const MAX_SECONDS = 55;
export const MAX_MINS = 59;

type TimeField = "mins" | "seconds" | "reps";

export function newAttempt(metric: TestMetric): TestAttempt {
  return { mins: 0, seconds: 0, reps: metric === "reps" ? DEFAULT_REPS : 0 };
}

/** Append an attempt inheriting the last one's values. Capped at MAX_ATTEMPTS. */
export function addAttempt(attempts: TestAttempt[]): TestAttempt[] {
  if (attempts.length >= MAX_ATTEMPTS) return attempts;
  const last = attempts[attempts.length - 1];
  return [...attempts, last ? { ...last } : { mins: 0, seconds: 0, reps: 0 }];
}

/** Drop the last attempt. Never below MIN_ATTEMPTS. */
export function removeAttempt(attempts: TestAttempt[]): TestAttempt[] {
  if (attempts.length <= MIN_ATTEMPTS) return attempts;
  return attempts.slice(0, -1);
}

function stepField(
  attempts: TestAttempt[],
  index: number,
  field: TimeField,
  delta: number,
  min: number,
  max: number,
): TestAttempt[] {
  return attempts.map((a, i) =>
    i === index
      ? { ...a, [field]: Math.max(min, Math.min(max, a[field] + delta)) }
      : a,
  );
}

export function stepMins(
  attempts: TestAttempt[],
  index: number,
  dir: 1 | -1,
): TestAttempt[] {
  return stepField(attempts, index, "mins", dir, 0, MAX_MINS);
}

export function stepSeconds(
  attempts: TestAttempt[],
  index: number,
  dir: 1 | -1,
): TestAttempt[] {
  return stepField(attempts, index, "seconds", dir * SECONDS_STEP, 0, MAX_SECONDS);
}

export function stepAttemptReps(
  attempts: TestAttempt[],
  index: number,
  dir: 1 | -1,
): TestAttempt[] {
  return stepField(attempts, index, "reps", dir, 0, 9999);
}

/** Signed reps change vs the previous attempt; null for the first attempt. */
export function attemptRepsDelta(
  attempts: TestAttempt[],
  index: number,
): number | null {
  if (index <= 0) return null;
  return attempts[index].reps - attempts[index - 1].reps;
}

/** Total seconds for an attempt (mins·60 + seconds). */
export function attemptTotalSeconds(a: TestAttempt): number {
  return a.mins * 60 + a.seconds;
}

/** Signed time change (in seconds) vs the previous attempt; null for the first. */
export function attemptTimeDelta(
  attempts: TestAttempt[],
  index: number,
): number | null {
  if (index <= 0) return null;
  return attemptTotalSeconds(attempts[index]) - attemptTotalSeconds(attempts[index - 1]);
}
