# Handover — League Scoring brainstorm paused (rules settled)

**Date:** 2026-10-20 · **Branch:** `main` @ `f2257a3` · **Previous:** [2026-10-19](2026-10-19-klc-league-scoring-ready.md)

## TL;DR
The League Scoring brainstorm is half done: every rules and scope question is
decided and written into the scoring handover spec. Still to do: approaches,
design sections (with League page mockups), then the design doc and plan.
Next action: resume the `brainstorming` skill at "propose 2–3 approaches".

## Done this session
- Brainstorm decisions written into
  `docs/superpowers/specs/2026-10-16-klc-league-scoring-handover.md`
  (`1921ee1`, `d586258`, `f2257a3`). See its §4 for the full question table.
- Coach follow-up email drafted (below). **Not sent.**

## In flight
- **Brainstorm, paused.** No design doc yet, no beads created for the spec's §8 list.
- No open PRs, no beads in progress.
- `origin/claude/bold-lichterman-03fcb1` is unmerged but stale (May 2026, landing-page work); unrelated.

## Decisions
| Decision | Who | Date | Recorded in |
|---|---|---|---|
| Combined winner = aggregate score over both halves | Jaidev | 2026-10-20 | Spec Q6, §3.3 |
| Combined (joint-manager) match: **full points to each club** (win 5 each, draw 1 each) | KFANDRA (chat) | 2026-10-20 | Spec Q6, §3.3 |
| Combined player count = distinct players; same players both halves, only the managing club changes | Jaidev | 2026-10-20 | Spec §3.3 |
| Session cap ("not more than 3/2 matches per session") is **not enforced**: no block, no warning, every match scores | Jaidev | 2026-10-20 | Spec R4, Q4, §3.3 |
| Under 7 players, Football/Fooba/Rugby Sox earn the variation points (4–6: win 1 / draw 0.2; 2–3: win 0.5 / draw 0.1) | Jaidev | 2026-10-20 | Spec points table, §3.2, Q3 |
| **Club managers record and submit their own club's matches**; only KFANDRA reopens (≈ +2–3 days) | Jaidev | 2026-10-20 | Spec R1, §3.6, Q9, bead #9 in §8 |
| Player Matches tab is a **list only**, no match report page (later bead) | Jaidev | 2026-10-20 | Spec §3.6 |
| Table order: Pts, Diff, scored (GF + TF), club name. Draws stay as results; this is only for ranking | Jaidev | 2026-10-20 | Spec Q5 |
| Defaults kept: Multi-Game Variation in "All" only; main + rebound goals count; Diff = goals + tries; friendlies excluded (except MMG board); Rugby Sox = `rugby` | Jaidev | 2026-10-20 | Spec Q2, Q7, Q8, Q10 |

## Waiting on
- **Jaidev → KFANDRA: send the email below.** The ticket questions block
  ticket sales in the finance package, not League Scoring. The S1 sheet is
  needed for the League Scoring acceptance replay (spec §7).
- **Prod check before the match-types migration:** any `variation` rows?
  `select sport, status, count(*) from klc_matches group by 1,2` via the
  `querying-production-data` skill. Also confirm S2 status and applied
  KLCSRA migrations (spec §5).

## Next steps
1. Invoke `brainstorming` and resume at step 4, **propose 2–3 approaches**. The
   main architecture choices:
   - Where tables and points are computed: in a SQL view, or in TypeScript on read.
   - How managers get the recorder: a new non-admin route, or admitting managers to `/admin/klc/matches`.
   - How RLS lets a manager write only drafts involving their own club.
2. Present the design sections. The visual companion was in use; restart it with
   `.claude/skills/brainstorming/scripts/start-server.sh --project-dir /Users/otb/Fun/kfandra-track`
   and mock up `/klc/league` (Table · Matches · Leaders · Seasons · Scoring).
3. Write `docs/superpowers/specs/YYYY-MM-DD-klc-league-scoring-design.md`, self-review, get Jaidev's review, then `writing-plans`.
4. Create the beads from spec §8 (now 9 items) under Helper-bsr.

## Gotchas
- The 2 Oct email's "(Not more than 3 matches per session)" is only a note in
  brackets; the "0 points past the cap" idea was ours and has been dropped.
- "Common list" + Coach's "Club A are supposed to fill in the data" is why
  managers record matches. Don't revert to staff-only.
- Coach chat (2026-10-20): an ordinary 6 v 6 official match has **one** managing
  club per side; only an officially sanctioned joint-manager match is "combined".
- Auto mode blocks `gh pr merge`; Jaidev merges with `! gh pr merge …`.
- Newlines: Jaidev is restarting Terminal so Option+Enter works.

## Coach follow-up email (draft, not sent)
Reply on the 16 Oct thread:

> Hi Coach,
>
> Thanks for the quick reply, and noted: I'll give you a heads-up before anything goes live from now on.
>
> Combined matches: all clear, thanks for confirming the full points for each club.
>
> Tickets: thanks for explaining. Each club gets its own rating and sets its own price, and KFANDRA enters the tickets sold for a club's first match. A few things I need before I can build the ticket sales:
>   1. How should rating and price give the number of tickets sold? Is the "ticket price limit" the highest fair price for each rating (for example, rating 5 = at most X Kroopies)? Send it whenever you've fixed it.
>   2. Who gives each club its rating: KFANDRA, or the clubs themselves?
>   3. "First match": is that a club's first official match ever, or its first match each season?
>
> Opening balance: perfect, KFANDRA will enter it as admin and it locks after that. Your secret is safe!
>
> One more request: could you share the KLCFERRSXVSG1 session sheet (Drive)? I'll use the S1 results to test the new league tables.
>
> Very exciting indeed!
>
> Thanks,
> Jaidev

## Pointers
- `docs/superpowers/specs/2026-10-16-klc-league-scoring-handover.md` — the input, now with every decision (§4)
- `docs/superpowers/specs/2026-10-16-klc-finance-stadium-handover.md` — next package (Q13–Q15 pending)
- `docs/KFANDRA-Jacaranda-updates-2026-10-02.pdf` — original requirements (local only, gitignored)
- `src/lib/klcsra/standings.ts`, `combined.ts`, `standings-rules.ts` — code being replaced
- Beads: Helper-bsr (parent), Helper-0gr, Helper-r01, Helper-h9i, Helper-3jr
