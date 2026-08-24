# KLC Match Recorder — first-run checks

Shared with KFANDRA on 2026-08-24, before the first real match.
Web version: https://claude.ai/code/artifact/1ccfb4a5-2c37-4acc-9ddf-103e01f1ae90

Twenty minutes, on a phone. In order — the first step unlocks the rest.

## Start here

Season 1 is closed and Season 2 has not been started. Until it is started, the
recorder refuses to submit a league match. That is correct behaviour, not a
fault, but as a cold open it looks like one.

## Before you begin

- Sign in with phone number and PIN as usual.
- Use a **phone**, not a laptop — that is how it will be used on a match day
  and it is the least-tested part.
- Everything is under **Admin**, which now shows **Match Recorder** and
  **Seasons**.

## 1. Start Season 2

Admin → Seasons. Tap **Start** on `S2 · KLCFERRSXVSG2`, confirm.

**Expect:** green "Active season" banner, S2 marked `ACTIVE`, amber note gone.

Only one season can be active; starting one closes any other, with a warning
first.

## 2. Record a friendly

Safe first run — friendlies pay no Kroopies.

Admin → Match Recorder → ＋ New match. **Friendly on**, today's date, Football.
Pick a club per side.

**Expect:** each club's manager appears in slot 1 unprompted.

Add 2–3 more players a side. Tap a player, add a goal or two.

**Expect:** the KR/MMG figures at the top of the popup change as you tap.

Done → enter scores → **Submit & lock**. There is no Save button; watch for
`Autosaved ✓`.

**Expect:** every Kroopies figure `0` or `—`, MMG real, no season tag.

## 3. Record a league match, and check the maths

The one that matters. As above but **Friendly off**.

**Before submitting, write down the expected earnings.** Then submit and compare.

**Expect:** figures agree; match tagged `KLCFERRSXVSG2`.

If the money is wrong: stop, record nothing further, report it.

## 4. Try to break the lock

Change a stat on the submitted match.

**Expect:** `This match is locked. Reopen it first.`

Then Reopen (KFANDRA only) → confirm → change something → submit again.

## 5. Record a combined match

New match, **Combined on**.

**Expect:** `H1` / `H2` tabs, one half at a time, swap-clubs offer on first
opening H2. Record in H1, switch to H2 — H1's counts stay put, squad carries
across.

## Looks wrong, isn't

- **Deep Waters fills no manager** — Seito has no player account yet.
- **Friendly and Combined are fixed at creation** — delete and recreate to
  change them. Widening `updateMatchMetaAction` is the fix; not yet done.
- **Kroopies show `—` on friendlies** — by design, friendlies pay MMG only.

## If something's wrong

- **Numbers don't match** — stop, report the match date and the expected
  figures. The only one worth interrupting for.
- **Match recorded wrongly** — Reopen, fix, re-submit.
- **Won't submit a league match** — check a season is active.
- **Anything else** — screenshot; what was on screen matters most.

## Notes for whoever picks this up next

- Verified by 223 unit tests and 13 Playwright e2e tests, plus manual browser
  runs — all against local Supabase with seeded data. No real match had been
  recorded against production at the time of writing.
- **Never point `npm run test:e2e` at production.** Its helpers call
  `resetKlcsraData()`, which deletes every player and match row. It hardcodes
  `127.0.0.1:54322` for that reason.
- Rollback: `git revert` the app; leave the database alone. The migrations are
  additive and the previous app does not touch the `klc_*` tables.
