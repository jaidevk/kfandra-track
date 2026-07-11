<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the KFANDRA Helper app. Here is a summary of what was done:

- **Env vars** — `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` written to `.env.local`.
- **Reverse proxy** — `/ingest/*`, `/ingest/static/*`, and `/ingest/array/*` rewrites added to `next.config.ts` so PostHog traffic routes through the app's own domain (avoids ad-blockers, improves reliability).
- **Client init upgraded** — `src/lib/observability/analytics.ts` updated with `api_host: "/ingest"`, `defaults: "2026-01-30"`, `capture_exceptions: true`, and `debug` mode in development.
- **Server-side client** — new `src/lib/posthog-server.ts` with a `getPostHogClient()` singleton using `posthog-node`.
- **Server-side events** — `src/lib/auth/actions.ts` now identifies and captures `player_registered` / `player_logged_in` server-side on every successful auth, correlating server and client events via the player UUID.
- **Four new event capture sites** added across the app (see table below).

| Event name | Description | File |
|---|---|---|
| `player_registered` | Player creates a new account (client + server) | `src/app/login/login-form.tsx`, `src/lib/auth/actions.ts` |
| `player_logged_in` | Player signs in (client + server) | `src/app/login/login-form.tsx`, `src/lib/auth/actions.ts` |
| `mode_opened` | Player taps MMG, Gym, or Diet card on the home screen | `src/app/page.tsx` |
| `gym_exercise_logged` | Player saves an exercise in the gym log | `src/app/gym/gym-entry.tsx` |
| `diet_meal_logged` | Player logs a catalog or custom food item in a meal slot | `src/app/diet/diet-entry.tsx` |
| `mmg_session_finalized` | Player finalizes their MMG session entry | `src/app/mmg/mmg-entry.tsx` |

## Next steps

We've built a dashboard and five insights for you to keep an eye on player behavior:

- [Analytics basics (wizard) — Dashboard](https://us.posthog.com/project/458932/dashboard/1682069)
- [Daily active players](https://us.posthog.com/project/458932/insights/TUPZOWRV)
- [New player registrations](https://us.posthog.com/project/458932/insights/7meFZtBk)
- [Registration → Mode opened funnel](https://us.posthog.com/project/458932/insights/QfVBagsC)
- [Mode popularity by type](https://us.posthog.com/project/458932/insights/68ruXnms)
- [Core activity events over time](https://us.posthog.com/project/458932/insights/0AWRID4I)

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
