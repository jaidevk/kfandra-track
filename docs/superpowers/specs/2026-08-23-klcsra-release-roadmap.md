# KLCSRA — Release Roadmap (Phases 2 – 5)

**Companion to:** [`2026-08-10-klcsra-match-recorder-design.md`](2026-08-10-klcsra-match-recorder-design.md) (v0.4) · **Beads:** Helper-bsr · **For:** KFANDRA staff review

This roadmap lays out what ships in each remaining phase, what KFANDRA will see
and test at each checkpoint, and what a "green" review looks like before we move
on. Phase 1 (data model + pure domain logic) is planned out in
[`2026-08-15-klcsra-phase1-foundation.md`](../plans/2026-08-15-klcsra-phase1-foundation.md)
and produces no user-visible surface — it's the foundation the next phases stand on.

## Machine-transition checkpoint

**Recommended:** transition to the second machine **now**, before Phase 1 code
is written.

- Everything the next session needs is in git on `feat/klcsra-match-recorder`:
  the v0.4 design spec, the Phase 1 plan, and the beads state
  (`.beads/issues.jsonl`).
- Phase 1 is entirely pure code + a migration — no design decisions left, TDD
  steps are spelled out task-by-task. It runs unattended well.
- The alternative — finishing Phase 1 here, then handing off — offers no
  benefit; the other machine picks up cleanly at the same commit.

Everything in this roadmap therefore runs on the second machine.

---

## Phase 2 — Recorder core: repository + server actions + season lifecycle

**Goal:** everything you need to record and submit a match programmatically,
but with only a minimal placeholder UI. This is the layer the recorder UI in
Phase 3 sits on top of.

**Deliverables**

1. **Repository layer** (`src/lib/klcsra/repository.ts`, server-only): read/write
   helpers over matches, halves, sides, appearances, stats, seasons — all
   staff-scoped via RLS.
2. **Server actions** — Next.js server actions for:
   - Create draft match (single or combined, league or friendly).
   - Add / update / remove appearances and per-stat counts.
   - Enter score, set duration.
   - **Submit** — computes final KR (zero for friendlies) and MMG per player,
     tags the active season on league matches, flips status to `submitted`,
     emits a write-back plan (payloads only in this phase; Phase 5 lands them
     on the balance sheet).
   - **Reopen** — KFANDRA-only, unlocks a submitted match.
3. **Season lifecycle** — server actions and a minimal `Seasons` admin page
   under `/admin/klc/seasons` (list, `Start`, `Close`, `Rename`, `Edit dates`).
   Enforces the one-active-at-a-time rule and blocks close when drafts remain.
4. **Placeholder recorder UI** — a functional but visually minimal page at
   `/admin/klc/matches` that lets an admin exercise every server action
   end-to-end. Enough surface to prove the backend works; full UX lands in
   Phase 3.
5. **Tests** — server-action tests against a local Supabase (create → add
   stats → submit → verify totals; friendly → verify KR = 0; reopen → verify
   revert; season close blocked when draft exists; single-active-season
   invariant).

**KFANDRA checkpoint (Phase 2 review)**

- Can I create a Season 2, mark it active, and see the "S2" tag stick to
  matches submitted after that point?
- Can I record a simple football match end-to-end (pick clubs → add players
  → tap stats → enter score → Submit) and see the correct KR + MMG totals?
- Can I record a friendly and confirm no KR is credited?
- Can I reopen a submitted match (as KFANDRA) and re-submit?

The UI will look barebones on purpose — you're testing the mechanics, not the
polish. Green = all four questions above pass in your hands.

---

## Phase 3 — Recorder UI (all six screens)

**Goal:** the recorder that KFANDRA actually uses on match days — mobile-first,
matches the app's existing light-theme patterns.

**Deliverables** (mockups locked in the design spec; this phase turns them into
live components)

1. **Matches page** (`/admin/klc/matches`) — grouped by date, season pill,
   between-seasons variant, single "＋ New match" CTA. [Screen 1]
2. **Recorder header** — Sport chips (Football / Rugby / Fooba / Variation),
   Date, Duration, Friendly toggle, Combined (2 halves) toggle, season
   auto-tag, autosave badge. [Screen 2]
3. **Team cards + squads** — unified dark scoreboard bar on top; two white
   cards below (club + manager + role pill + 6 slots each); slot pills show
   event count + KR delta. Player picker filters to club-registered first
   with "Show all members" toggle and cross-club soft-warn. [Screen 3]
4. **Stats popup** — sport-filtered list of stats with `+`/`−` buttons and a
   running count, live per-player KR + MMG preview, single Done button. Fooba
   swaps in `Main Goal` / `Rebound Goal` / `Switchover` tiles. [Screen 4]
5. **Combined match** — H1 / H2 tab row, slim aggregate status line, one-time
   swap-clubs prompt when opening H2, roster auto-copied, single Submit for
   both halves. Cross-half stats shown per-half. [Screen 5]
6. **Submit & lock** — pre-submit checks list, totals preview, balance-sheet
   write-back preview, green `Submit & lock` CTA, locked read-only state with
   Copy report / View balance sheets / Reopen (KFANDRA-only, dialog-gated).
   [Screen 6]

Playwright E2E covers the golden path (Screen 1 → Submit) plus combined-match
and friendly variants.

**KFANDRA checkpoint (Phase 3 review)**

- Does recording a real match on your phone feel fast? Does the tap-to-add
  keep up with a live game?
- Do the six screens read the way you expect? Anything jarring, mis-labelled,
  or missing?
- Combined-match flow: does the H1 → H2 handoff feel natural?
- Fooba: are the new tiles (Main / Rebound / Switch) understandable to a
  scorer who's never seen them before?

Green = you'd hand this to a helper Manager mid-session without hovering.

---

## Phase 4 — Outputs: leaderboards, standings, per-match report

**Goal:** the read-side surfaces KFANDRA and members look at after matches.

**Deliverables**

1. **Season standings** table (`/klc/standings?season=…`) — P, W, D, L, PF,
   PA, PDIFF, Pts using the size-tiered rule + margin bonus + combined-match
   points. Friendlies excluded.
2. **Leaderboards** — four boards, defaulting to the active season:
   - Scorers per-sport (Goals / Tries / Assists / Pre-Assists)
   - Discipline (YC / RC / BC / LC)
   - Kroopies (league matches only)
   - MMG (league + friendlies)
3. **Per-match report** — a copy-as-text output on the locked match view:
   sport · duration · date · per-side score · each player's stat line +
   KR/MMG. Format kept simple for v1 per your call; iterate after real use.
4. **Season switcher** on standings and leaderboards for browsing past seasons
   (S1 archive).

**KFANDRA checkpoint (Phase 4 review)**

- Standings match what you'd compute by hand for a couple of test matches.
- Leaderboards feel useful — right stats surfaced, right ordering, right
  season filter default.
- Copy-report output pastes cleanly into WhatsApp / your website drafts.

Green = you're ready to use this instead of the spreadsheet for a full round.

---

## Phase 5 — Balance-sheet write-back

**Goal:** close the loop between the recorder and the club balance sheets so
Submit fills the numbers automatically instead of KFANDRA copying by hand.

**Deliverables**

1. **Source-tagged rows** — extend the balance-sheet entry schema with a
   `source` field. Recorder-written rows tag as `match:<id>`; manual entries
   have no tag.
2. **Submit write-back** (league matches only) — Submit deletes any existing
   rows tagged with the match's id and inserts fresh ones from the write-back
   payload the server action already emits (Phase 2). Populates:
   - Results (played / W / D / L / PF / PA) for each club — locked "from
     match".
   - KR per loanee — the final per-stat KR, credited to the loanee row for
     the club that player played for.
   - Club Bonus stays manager-owned.
3. **Reopen revert** — deletes the match-tagged rows and unlocks the recorder;
   manual entries are untouched (they have no matching tag).
4. **Friendlies write nothing** to the balance sheet (no KR, no standings).
5. **MMG remains copy-out** — the locked-match view still shows MMG totals for
   manual copy into MMG mode. Direct MMG write-back is deliberately out of
   scope.

**KFANDRA checkpoint (Phase 5 review)**

- After Submit, the club balance sheets show the right numbers, and the
  loanee rows for scorers reflect their earned KR.
- Reopening a match cleanly reverts the write-back and leaves your manual
  entries alone.
- No surprises on friendlies — MMG credited, KR untouched.

Green = KFANDRA can stop maintaining the balance sheet by hand and trust the
recorder for it.

---

## Aggregate timeline (rough, adjustable)

| Phase | Scope | Approx effort (Claude-driven) |
|---|---|---|
| 1 | DB migration + pure domain logic | Small — a few hours end-to-end |
| 2 | Repository + server actions + season lifecycle + placeholder UI | Medium |
| 3 | Full recorder UI (six screens) | Medium-large — UX polish is the long tail |
| 4 | Standings + leaderboards + copy-report | Medium |
| 5 | Balance-sheet write-back | Small-medium |

The plan is to run each phase's implementation-plan write with
`superpowers:writing-plans` right before it starts, so the plan reflects
whatever we learned from the previous phase's KFANDRA review.

## What's not in this roadmap

- Public read surfaces (member-facing standings on a landing page) — separate
  spec once we know the design language KLCSRA uses across the app.
- Automated MMG write-back — deferred by design; MMG remains a copy-out for v1.
- 11-a-side + subs support (currently 6 fixed slots) — schema is future-friendly;
  UI change lands when the football team grows.
- Historical backfill (recording S1 retroactively into KLCSRA) — treat as a
  one-off migration script if you decide to import it.
