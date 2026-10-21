# Handover — KLC League shipped

**Date:** 2026-10-21 · **Branch:** `main` @ `80f78e5` · **Previous:** [2026-10-20](2026-10-20-league-scoring-brainstorm-paused.md)

## TL;DR
KLC League Scoring is merged (PR #7) and its migration is applied to prod.
Players get automatic points, 5 tables, leaderboards and a `/klc/league` page;
club managers record their own matches at `/klc/matches`. Next action: confirm
the live deploy, send Coach the go-live message, and have KFANDRA press
**Start** on S2.

## Done this session
- Brainstorm finished → design `docs/superpowers/specs/2026-10-20-klc-league-scoring-design.md` → plan `docs/superpowers/plans/2026-10-20-klc-league-scoring.md` (has a "Deviations and decisions" section).
- Built with subagent-driven development: 26 commits, each task spec- and quality-reviewed, plus a final whole-branch review. PR #7 merged 2026-10-21.
- Prod: migration `20261020120000_klc_league_scoring.sql` pushed by Jaidev; verified rules v2, table groups as an ordered array, 4 submit-lock triggers.
- Pre-push prod check: no `variation` rows, no combined match with a club on both sides.
- Gates on the branch: lint, tsc, 507 unit, Playwright 30/30, `next build`.
- Beads closed: Helper-bsr.1–.8, Helper-h9i, Helper-0gr, Helper-r01.

## In flight
- None. No open PRs; feature branch merged. Vercel deploy of `80f78e5` not confirmed from here (no Vercel CLI link, no GitHub deployment records).

## Decisions
| Decision | Who | Date | Recorded in |
|---|---|---|---|
| Season of a league match = season **active at submit** (unchanged); by-match-date rule rejected as needless complexity. Reopening an old match after the next season starts moves it — documented, not handled | Jaidev | 2026-10-21 | Design §7.1, `bd memories season` |
| S1 stays on Coach's sheet; not imported (S1 used old rules: ±1 margin, hand-judged points) | Jaidev | 2026-10-21 | Design §7.2, Helper-bsr.11 |
| S2 starts when the app is ready (late Oct / Nov 2026) | Jaidev | 2026-10-21 | Design §7.1 |
| Combined match: each club stays with its pair; a club can't lead both slots. Old half-2 "Swap clubs" prompt removed | Jaidev | 2026-10-21 | Design §5.1a, `bd memories combined` |
| A club manager must keep one of their clubs on a match (creators too) | Controller, accepted | 2026-10-21 | Design §5.1a |
| Leaderboards stay in scope (KFANDRA asked for them) | Jaidev | 2026-10-21 | Design §3.5 |
| Prod club → manager links already exist; don't ask Coach | Jaidev | 2026-10-21 | `bd memories managers` |
| "No shortcuts": separate league read model + mocked test, draft League/Friendly toggle, season picker built | Jaidev | 2026-10-21 | Plan header |

## Waiting on
- **Jaidev:** check the live app (Home → KLC League; Scoring/Seasons tabs; Record a match as staff/manager).
- **Jaidev → Coach:** send the go-live message (drafted in the session; summary: points, 5 tables, leaderboards, manager recording; please press Start on S2; record one match together). House rule: heads-up before players use it.
- **KFANDRA:** press **Start** on S2 (`/admin/klc/seasons`). Until then no league match can be submitted.
- **Coach:** older 16 Oct follow-up (ticket formula, ratings, "first match") — still blocks ticket sales in the finance package. S1 sheet received; no longer needed.

## Next steps
1. After S2 starts, walk `docs/klc-league-checkpoint.md` with KFANDRA (record one match together on the ground).
2. Optional: Helper-bsr.11 — replay 4 clean 30/06/26 S1 short games locally, compare W/D/L and for/against only.
3. Ask Coach Helper-bsr.12 (3-team matches with a neutral club) and Helper-bsr.13 (per-player Multi-Game points).
4. Next package: KLC Club Finances / Stadium & Tickets — `docs/superpowers/specs/2026-10-16-klc-finance-stadium-handover.md` (start with `brainstorming`).

## Gotchas
- **Docker needs 8 GB.** At 6 GB, local Supabase + `next dev` + Playwright hung for hours (`supabase start` / `db reset` stalls, containers vanishing). See `bd memories docker`.
- **Only one Playwright run and one `supabase db reset` at a time.** Parallel agents clobbered each other's data (`resetKlcsraData` deletes all matches). Sequence DB-touching work.
- **jsonb re-sorts object keys** — any config whose order matters must be an array (`klcsra_table_groups`).
- `query-prod.py` can hang on a macOS keychain prompt; Jaidev runs it with `! …` in the session.
- `npm run build` rewrites `next-env.d.ts`; `git checkout next-env.d.ts` before committing.
- Auto mode blocks `gh pr merge`; Jaidev merges with `! gh pr merge N`.

## Pointers
- Design: `docs/superpowers/specs/2026-10-20-klc-league-scoring-design.md`
- Plan + deviations: `docs/superpowers/plans/2026-10-20-klc-league-scoring.md`
- Acceptance: `docs/klc-league-checkpoint.md`
- Code: `src/lib/klcsra/{points,league-table,leaderboards,league-data,league-repository,access,actions}.ts`, `src/app/klc/league/`, `src/app/klc/matches/`
- Open beads under Helper-bsr: .9 (manager-assignment UI), .10 (match report page), .11, .12, .13
