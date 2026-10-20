# Handover — KLC League Scoring ready to start

**Date:** 2026-10-19 · **Branch:** `main` @ `f4861a2` · **Previous:** none (first handover)

## TL;DR
Diet nutrition and the e2e hydration fix are merged. KFANDRA's 16 Oct answers are
recorded in both KLC handover specs. League Scoring is unblocked: the next
session should start its brainstorm → spec → plan. Ticket sales stay blocked on
KFANDRA's formula.

## Done this session
- **Helper-8co** (closed), PR #6 merged: e2e `createMatch` filled the date before
  React hydrated, so matches were saved on today's date on slow machines. Added
  `src/hooks/use-hydrated.ts`; `NewMatchForm` and `SeasonsAdmin` expose
  `data-hydrated`; `e2e/helpers/recorder.ts` and `e2e/klcsra-seasons.spec.ts`
  wait for it and assert values before submit; specs now check stored dates in
  the DB. e2e 16/16 twice, unit 365/365.
- `f4861a2`: KFANDRA's 16 Oct answers written into
  `docs/superpowers/specs/2026-10-16-klc-league-scoring-handover.md` (Q6, §3.3)
  and `docs/superpowers/specs/2026-10-16-klc-finance-stadium-handover.md`
  (F6, §3.4, Q1/Q2/Q7, new Q13–Q15, §7).
- `bd remember` key `heads-up-before-going-live`.
- This `handover/` folder and the `/handover-capture` skill.

## In flight
- None. No open PRs, no unmerged branches, no beads in progress.
- A follow-up email to KFANDRA was drafted but **not sent** (see Waiting on).

## Decisions
| Decision | Who | Date | Recorded in |
|---|---|---|---|
| Combined match = one match between two club pairs (AB vs CD); each club gets one result vs the other pair, not one per half | KFANDRA | 2026-10-16 | Scoring spec Q6, §3.3 |
| Combined winner is decided by the aggregate score over both halves | Jaidev | 2026-10-20 | Scoring spec Q6, §3.3 |
| Default until confirmed: full points to each club in the pair; one match played per club | Jaidev (default) | 2026-10-19 | Scoring spec §3.3 |
| Each club sets its own ticket price; every club in a match sells, combined included | KFANDRA | 2026-10-16 | Finance spec Q1 |
| Two ratings per match (one per club); random band draw replaced by a rating + price formula, still undecided; KFANDRA sets tickets for a club's first match | KFANDRA | 2026-10-16 | Finance spec F6, Q13–Q15 |
| Bigger stadium sells more (bought seats add to capacity) | KFANDRA | 2026-10-16 | Finance spec Q2 |
| Opening balance: secret amount, entered by KFANDRA as admin, then locked | KFANDRA | 2026-10-16 | Finance spec Q7 |
| Give KFANDRA a heads-up before anything goes live | KFANDRA | 2026-10-16 | `bd memories heads-up` |

## Waiting on
- **Jaidev → KFANDRA: send the follow-up email** (reply on the 16 Oct thread). It asks:
  1. Combined: do both clubs in the winning pair get full points? (Scoring Q6; aggregate-score winner confirmed 2026-10-20)
  2. Ticket formula and what the "ticket price limit" is (Finance Q13). **Blocks ticket sales.**
  3. Who gives each club's rating (Finance Q14).
  4. "First match": ever, or per season (Finance Q15).
  5. The KLCFERRSXVSG1 session sheet from Drive (Scoring Q11), for test fixtures.
- Still unasked, on defaults: Scoring Q2–Q5, Q7–Q10 (under-7, over-cap, tie-breaks, Variation, friendlies, Rugby Sox naming). Jaidev was deciding whether to add them to the email.
- **Before shipping League Scoring:** confirm prod KLCSRA migrations, S2 status and any recorded matches (Scoring spec §5); use the `querying-production-data` skill.

## Next steps
1. Invoke the `brainstorming` skill for **KLC League Scoring**, starting from
   `docs/superpowers/specs/2026-10-16-klc-league-scoring-handover.md`. Combined
   matches: one aggregate result per club (replaces `computeCombinedPoints` in
   `src/lib/klcsra/combined.ts`).
2. Create the suggested beads from the scoring spec §8 under **Helper-bsr**;
   Helper-0gr and Helper-r01 are part of this package.
3. Finance package after that: fix **Helper-3jr** (P1) first; ledger, stadium
   and opening balance can proceed while the ticket formula is pending.

## Gotchas
- **e2e and hydration:** controlled inputs filled before hydration are silently
  reset. Wait for `data-hydrated="true"` (pattern in `e2e/helpers/recorder.ts`
  `createMatch`) on any new form the suite fills right after `goto`.
- e2e needs local Supabase running (`npx supabase start`) and reuses a dev
  server on :3000; one worker by design (single active season).
- **Auto mode blocks `gh pr merge`** ("merge without review"). Jaidev merges
  via `! gh pr merge <n> --merge --delete-branch`.
- MCP servers `posthog-kfandra` and `claude.ai OTB` failed to connect this
  session; `usage-analyst` depends on PostHog.
- Terminal.app: Option+Enter newline was enabled via `/terminal-setup`
  (needs a Terminal restart). `\` + Enter always works.

## Pointers
- `docs/superpowers/specs/2026-10-16-klc-league-scoring-handover.md` — next feature
- `docs/superpowers/specs/2026-10-16-klc-finance-stadium-handover.md` — after that
- `docs/superpowers/specs/2026-08-10-klcsra-match-recorder-design.md` — recorder model, combined halves
- Beads: Helper-bsr (KLCSRA parent), Helper-3jr, Helper-0gr, Helper-r01
