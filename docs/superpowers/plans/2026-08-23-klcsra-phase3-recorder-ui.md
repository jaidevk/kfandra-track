# KLCSRA Phase 3 — Recorder UI (the six screens)

**Goal:** replace the Phase 2 placeholder with the recorder KFANDRA actually uses
on match day — mobile-first, light theme, matching the app's existing patterns.

**Phase 2 stays exactly as it is underneath.** Every server action, the
repository and the domain logic are done and proven (223 unit + 10 e2e tests).
This phase is **presentational only**. If you find yourself editing
`src/lib/klcsra/actions.ts` or `repository.ts`, stop and ask — it almost
certainly means a screen has been misread.

**Design source:** `docs/superpowers/specs/2026-08-10-klcsra-match-recorder-design.md`
§UI conventions (lines 197–224) is the authority on look and layout.

---

## Production facts that shape this (checked 2026-08-23, not assumed)

These came from querying the real database and they overrule the roadmap's
Phase 3 wording where they disagree.

| Fact | Consequence |
|---|---|
| **13 players, 13 clubs, 12 managers — 1:1** | Every player *is* a club. Picking a club tells you its first squad member. |
| The 13th player is `Neel Sir/Khare Sensei`, role `kfandra` | KFANDRA has an account and manages no club. Reopen is testable in prod. |
| "Deep Waters" has **no** `manager_player_id` | The manager auto-fill must tolerate a club with no manager. |
| **`club_player_shares` is empty (0 rows)** | There is no historical player↔club data to mine. Any "registered players" filter would have nothing to filter on. |
| A 6-a-side match uses **12 of 13** players | The member pool is one short list. Grouping/filtering solves a scale problem that does not exist. |

**So the roadmap's "player picker filters to club-registered first, with a Show
all members toggle and cross-club soft-warn" is dropped.** It was written before
we knew there is no roster. Replaced by the picker in Screen 3 below.

## Decisions taken (do not re-litigate)

1. **Squads: 6 fixed slots, overflow allowed below.** Six dashed placeholders per
   team; a 7th+ player appends beneath the grid.
2. **Autosave, not explicit saves.** Reuse `useAutosaveDraft`
   (`src/hooks/use-autosave-draft.ts`) and copy the local `SyncBadge` pattern —
   it is duplicated per-feature in this repo (`club-balance-entry.tsx:328`,
   `diet-entry.tsx:633`, `mmg-entry.tsx:395`); follow that convention rather
   than extracting a shared one.
3. **Submit screen is checks + totals only.** No "Copy match report" (Phase 4),
   no "View balance sheets" (Phase 5). Do not stub them as disabled buttons.

---

## Screens

### Screen 1 — Matches list (`/admin/klc/matches`)

Light card list on `bg-gray-50`, grouped by date (newest first). Season pill
under the H1. Single `＋ New match` CTA; Friendly is a toggle inside the
recorder, **not** a second CTA. Between-seasons variant: when no season is
active, swap in an amber "Start Season N" prompt linking to `/admin/klc/seasons`
— this is the live state today, so it is the first thing KFANDRA sees.

Each row: clubs + aggregate score, sport, Combined/Friendly badges, status.

### Screen 2 — Recorder header

Sport as **chips, 4 across** (Football / Rugby / Fooba / Variation). Date and
Duration as inline inputs. Friendly and Combined as segmented toggles. Season
pill beside the "Draft" label, read-only. **Autosaved badge top-right.**

Changing sport re-filters the stat set live (already works in Phase 2 — keep it).

### Screen 3 — Team cards + squads

Unified **dark scoreboard bar** at the top spanning both teams. Below it two
white cards: club + manager + role pill + six slots each.

- Slot shows the player, their event count, and a **KR-delta pill** — green
  positive, red negative. Empty slots are dashed placeholders.
- **On choosing a club, auto-place its manager in slot 1** (skip when the club
  has no `manager_player_id`, and skip if they are already on the other side).
  Do not block the user from removing them.
- **Picker: one flat list of all active members.** Players already in this match
  are shown disabled with a `(home)` / `(away)` suffix — the database enforces
  one team per player per match, so the UI should make that visible rather than
  let it fail. No grouping, no "show all" toggle, no soft-warn.

### Screen 4 — Stats popup

`ui/dialog` or `ui/sheet`. One **row per stat with `+` / `−` and a live count**.
Live per-player **KR + MMG total at the top**, recomputed as you tap. Sport
filter applied via `statsForSport`. Single **Done**; there is no Cancel.

Fooba swaps in `Main Goal` / `Rebound Goal` / `Switchover`.

### Screen 5 — Combined match

Slim aggregate status line + **H1 / H2 tab row**, one half visible at a time.
Opening H2 offers a one-time swap-clubs prompt. Roster carries across
automatically — squads are match-level in the schema, so this is already true;
just make sure the UI does not imply otherwise. Cross-half stats shown per half.

Single Submit covers both halves.

### Screen 6 — Submit & lock

Pre-submit **checks list** (clubs picked, at least one player, active season for
a league match), **totals preview** (per player KR/MMG plus a total row), green
**`Submit & lock`** CTA.

Locked state: final totals, audit line (submitted by, timestamp), and **Reopen
behind a warning dialog**, visible only to `super_admin` / `kfandra`.

---

## Constraints

- **Do not touch** `src/lib/klcsra/{actions,repository,types}.ts` or any pure
  domain module.
- Import `statsForSport` from `./sport-stats` and `STAT_LABELS` from
  `./stat-rates` **directly**, never via `config.ts` — that pulls `server-only`
  into the client bundle and fails the build.
- Keep every `ActionResult.error` surfaced inline. The action layer returns
  carefully-worded messages ("No active season. Start one in Seasons first.")
  that KFANDRA needs to read.
- `max-w-md`, mobile-first. Every user-facing string says **KFANDRA**, never
  "Coach" or "super-admin".

## Verification

- `npm run test` (223), `npx tsc --noEmit` (**0 errors** — the old "3 lucide
  baseline" was a broken local install, now fixed), `npm run lint`, `npm run build`.
- **`npm run test:e2e` must stay green.** The 10 existing specs are the
  regression net for this rewrite. Selectors will move — update
  `e2e/helpers/recorder.ts` rather than weakening assertions, and keep the
  `data-testid` names where you can. Autosave removes `score-save-*`: replace
  those calls with an assertion that the value settled.
- Drive the recorder in a real browser before reporting done.
