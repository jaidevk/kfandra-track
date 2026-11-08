# Handover — KLC match workflow built, PR #12 open

**Date:** 2026-11-08 · **Branch:** `feat/klc-match-workflow` @ `5975e35` · **Previous:** [2026-10-21](2026-10-21-klc-league-shipped.md)

## TL;DR
Helper-bsr.16 is built, reviewed and green (663 unit, 40 e2e). PR #12 is open.
Next action: Jaidev runs `npx supabase db push` **before** squash-merging PR #12, then gives Sir a heads-up.

## Done this session
- Spec + plan: `docs/superpowers/specs/2026-11-08-klc-match-workflow-design.md`, `docs/superpowers/plans/2026-11-08-klc-match-workflow.md` (19 tasks, run subagent-driven with a review after each batch).
- PR #12: per-team entry on one shared match, Send my team → Waiting for KFANDRA → Make official, Send back, Reopen to Sent, duplicate warning, Conversion stat, goal/try minutes, guide + PDF.
- Bead Helper-bsr.16 closed. Follow-ups filed as Helper-8t7 (P3, minor review items).

## Beyond the plan (caught in review, all fixed on the branch)
- Own-side clubs fixed once either team is sent (plan let the other manager change theirs).
- Managers could carry a score into a league match via the Friendly toggle → any non-staff League/Friendly switch now clears scores.
- League score was hidden only in the UI → now stripped server-side for non-staff until Official (recorder, list shows "vs", duplicate candidates).
- Goal-minute autosave races on slow phones (count vs times saves) → chained saves, latest-times ref.

## In flight
- PR #12 awaiting Jaidev's merge. Nothing else uncommitted.

## Decisions
| Decision | Who | Date | Recorded in |
|---|---|---|---|
| Keep A simple (Sir adds goal times); each club enters its own team only | Jaidev | 2026-11-08 | spec D-table, §12 |
| Per-team send; friendlies use it too; Reopen → Sent | Jaidev | 2026-11-08 | spec §12 |
| Subagent-driven execution | Jaidev | 2026-11-08 | this file |

## Waiting on
- Jaidev: `npx supabase db push` (migrations `20261108120000`, `20261108120100`), then **Squash and merge** PR #12. Order matters: the new app 404s match pages without the new columns; the migrations are safe for the current app.
- Sir/KFANDRA: heads-up before it goes live; ticket formula (Helper-bsr.22).

## Next steps
1. Jaidev: db push → squash-merge PR #12 → check a match page on prod → heads-up to Sir.
2. Arrange the players' trial (Helper-bsr.17).
3. Then Helper-bsr.18 (player register + values), Helper-3jr, ledger/loans (bsr.19/20).

## Gotchas
- Run the pre-PR confidentiality grep from bd memories before any KLC PR. Squash-merge PR #12.
- Auto mode blocks some pushes/merges and read-only prod queries; Jaidev does those.
- `npm run build` rewrites `next-env.d.ts` — `git checkout -- next-env.d.ts` before committing.

## Pointers
- PR: https://github.com/jaidevk/kfandra-track/pull/12
- Beads: Helper-bsr.16 (closed), Helper-8t7, Helper-bsr.17
