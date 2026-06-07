/**
 * Client-side product analytics (PostHog).
 *
 * Goal: learn how players use the app and where the UX can be simplified —
 * without storing PII. We key everything on the opaque player UUID, never the
 * phone number or PIN. Input values are masked by PostHog's session-replay
 * defaults (maskAllInputs), and the PIN field is type=password.
 *
 * Everything here is a safe no-op when NEXT_PUBLIC_POSTHOG_KEY is unset (e.g.
 * in CI, local dev, or before the project is provisioned), so the app builds
 * and runs identically with or without analytics configured.
 */

import posthog from "posthog-js";

/** Stable event names — keep this the single source of truth for analytics. */
export const AnalyticsEvent = {
  Registered: "player_registered",
  LoggedIn: "player_logged_in",
  LoggedOut: "player_logged_out",
  ModeOpened: "mode_opened",
  DietMealLogged: "diet_meal_logged",
  GymExerciseLogged: "gym_exercise_logged",
  MmgSessionFinalized: "mmg_session_finalized",
} as const;

export type AnalyticsEventName =
  (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

type Props = Record<string, string | number | boolean | null | undefined>;

let initialized = false;

function key(): string | undefined {
  return process.env.NEXT_PUBLIC_POSTHOG_KEY;
}

/**
 * Initialize PostHog in the browser. Idempotent and guarded: does nothing on
 * the server, when already initialized, or when no key is configured.
 */
export function initAnalytics(): void {
  if (initialized) return;
  if (typeof window === "undefined") return;
  const apiKey = key();
  if (!apiKey) return;

  posthog.init(apiKey, {
    api_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    // We capture pageviews manually on route change (App Router has no full
    // page reloads), so disable the automatic one to avoid duplicates.
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: true,
    persistence: "localStorage+cookie",
    // Respect privacy: session replay masks all inputs by default; keep it.
    session_recording: {
      maskAllInputs: true,
    },
  });
  initialized = true;
}

/** True once PostHog has actually been initialized (key present, browser). */
export function analyticsReady(): boolean {
  return initialized;
}

/** Capture a typed product event. No-op until initialized. */
export function capture(event: AnalyticsEventName, props?: Props): void {
  if (!initialized) return;
  posthog.capture(event, props);
}

/** Manual pageview capture for App Router navigations. No-op until ready. */
export function capturePageview(url: string): void {
  if (!initialized) return;
  posthog.capture("$pageview", { $current_url: url });
}

/**
 * Associate subsequent events with a player. Pass the opaque UUID only — never
 * phone/PIN/name. `role` is safe, non-identifying context for segmentation.
 */
export function identifyPlayer(playerId: string, role?: string): void {
  if (!initialized) return;
  posthog.identify(playerId, role ? { role } : undefined);
}

/** Clear identity on logout so the next user starts a fresh anonymous session. */
export function resetAnalytics(): void {
  if (!initialized) return;
  posthog.reset();
}
