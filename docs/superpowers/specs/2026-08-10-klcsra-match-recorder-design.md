# KLCSRA — KLC Stats Recording App — Design (v0.4)

**Beads:** Helper-bsr · **Status:** Design signed off (green-lit) · **Review deck:** [docs/klcsra-proposal.pdf](../../klcsra-proposal.pdf)

KFANDRA-only tool to record a KLC match (football / rugby / fooba / variation) —
clubs, per-game squads, score, and every player's stats — total each player's
**Kroopies (KR)** and **MMG points**, produce copy-ready output, feed the balance
sheets, and lock on Submit.

> **v0.4** adds, over v0.3: **Seasons** (upcoming/active/closed lifecycle with a
> single active season), **Friendlies** (MMG-only, no KR, no standings, no season),
> **Fooba** as a fourth sport with three new stats (mainGoal / reboundGoal /
> switchover), sport allow-list in `app_config`, KFANDRA-only reopen (naming
> convention across the app), balance-sheet overwrite on submit, and a locked UX
> spec (light-theme, matches existing `admin/klc` patterns).
>
> v0.3 added, over v0.2: per-stat KR+MMG payouts; Tackle & re-added Save;
> PF/PA/PDIFF standings; configurable size-tiered points + margin bonus; combined
> (two-half) matches; KR auto-fills loanee amounts; per-match Submit & lock.

## Users & placement

- **KFANDRA staff only** (roles `coach` and `super_admin` internally; surfaced
  everywhere in the app as "KFANDRA"). Lives at `/admin/klc/matches` in the admin
  shell. A helper Manager may be handed the device to fill the *live* match but
  cannot edit a **submitted** one.

## Match setup

- **Sport** — Football / Rugby / **Fooba** / Variation (drives the stat popup).
- **Date**, **Duration** (typed minutes).
- **Two clubs**, each tagged **Home / Away / Neutral** (per-side role).
- **Score entered per team** (a number; not auto-derived).
- **Friendly** — toggle in the header. Friendlies pay **MMG only** (no KR, no
  standings, no season, no balance-sheet write-back). Can be recorded any time,
  including between seasons.
- **Combined (2 halves)** — toggle in the header; splits the recorder into
  Half 1 / Half 2 tabs sharing one Submit (see § Combined match).
- **Season** — auto-tagged at Submit from the currently-active season (read-only
  in the recorder). Friendlies always have `season_id = null`.

## Squads

- **Up to 6 players/side** (fixed 6 slots now; → 11 + subs later). Empty slots
  blank. Slot picker shows the club's registered players first, with a
  "Show all members" toggle to open the pool to the full member list. If the
  picked player already appeared for a different club on the same day, the
  recorder shows a **soft warning** but doesn't block.
- Players shown **initial + surname**.

## Per-player stats — tap-to-add popup

Popup opens when a slot is tapped. **List with +/− buttons** (consistent with
existing app entry patterns), running count per stat, live per-player KR + MMG
preview at the top, and a single **Done** button (closes the popup only — never
Submits; autosave persists edits on every tap so there's no Cancel).

**16 stats total**, each paying **KR + MMG** (all editable in
`app_config klcsra_stat_rates`):

| Stat | KR | MMG |  | Stat | KR | MMG |
|---|--:|--:|---|---|--:|--:|
| Goal | 20 | 500 |  | Yellow Card | −10 | −200 |
| Try | 25 | 500 |  | Red Card | −20 | −500 |
| Assist | 10 | 200 |  | Blue Card | −30 | −1000 |
| Pre-Assist | 5 | 100 |  | Late Challenge | −5 | −100 |
| Tackle | 5 | 100 |  | Own Goal | −20 | −500 |
| Save | 5 | 200 |  | Own Assist | −10 | −200 |
| **Main Goal** *(Fooba)* | 20 | 500 |  | Own Pre-Assist | −5 | −100 |
| **Rebound Goal** *(Fooba)* | 10 | 300 |  |  |  |  |
| **Switchover** *(Fooba)* | 5 | 100 |  |  |  |  |

MMG values do **not** derive from the existing `point_rules` table — KLCSRA owns
its own MMG rates alongside KR because the two domains have already diverged
(Tackle, Save differ; Fooba stats don't exist in `point_rules`). KR is a **new**
per-stat value (KLC-scoped).

**Friendlies:** the same stats are captured, but at Submit **KR is zeroed** for
every player; MMG is credited as normal.

### Sport allow-list

Stored in `app_config klcsra_sport_stats` (JSON, admin-editable). Defaults:

- **Football:** Goal, Assist, PreAssist, Save, YellowCard, RedCard, BlueCard,
  LateChallenge, OwnGoal, OwnAssist, OwnPreAssist
- **Rugby:** Try, Tackle, Assist, PreAssist, YellowCard, RedCard, BlueCard,
  LateChallenge
- **Fooba:** MainGoal, ReboundGoal, Switchover, Assist, PreAssist, Save,
  YellowCard, RedCard, BlueCard, LateChallenge, OwnGoal, OwnAssist, OwnPreAssist
  *(Fooba is offence/defence; carries the full football stat set with `Goal`
  replaced by MainGoal + ReboundGoal, plus the new Switchover)*
- **Variation:** all 16

The recorder filters the stats popup by the match's sport; unknown / disallowed
keys entered outside the recorder are ignored by the payout compute.

## Seasons

- **Table:** `klc_seasons` (`season_no` unique, `name`, `start_date`, `end_date`
  nullable, `status ∈ upcoming | active | closed`).
- **One active season at a time** — enforced by a partial unique index on
  `status = 'active'`.
- **Lifecycle:**
  - `upcoming` — season row exists (dates set) but the recorder still tags
    matches to the currently-active season.
  - `active` — the target of every league-match Submit.
  - `closed` — read-only for standings/leaderboards; no new matches attach.
- **Actions** (KFANDRA-only): **Start Season N** (upcoming → active; requires
  prior season closed), **Close Season N** (active → closed; blocked if any of
  its matches are still `draft`), **Rename**, **Edit dates**.
- **Between seasons** (S1 closed, S2 not yet started): the matches page shows a
  yellow "Start Season 2" prompt; the recorder refuses to Submit a league match
  but happily submits friendlies (`season_id = null`).
- **Season doesn't correlate with calendar year.** Seasons are named
  (`KLCFERRSXVSG1`, `KLCFERRSXVSG2`, …) and admins pick start/end dates.

## Standings (all configurable)

- Columns **PF / PA / PDIFF** (Points For / Against / Difference — renamed from
  GF/GA/GD). Per-player Goals/Ass/PA leaderboard is unchanged.
- **Size-tiered points** by total players in the match: **≥6 → Win 3 / Draw 1 /
  Loss 0**; **<6 → Win 0.2 / Draw 0.05 / Loss 0**.
- **Margin bonus:** win by **≥20 → +1** winner, **−1** loser.
- **Rugby scoring:** the per-team score is entered as raw match points (like
  football's Goal count next to the score) — the per-stat `Try` count on players
  is what drives the try-scorer leaderboard.
- **Standings-points preview** is *not* shown live in the recorder — final values
  compute at Submit.

## Combined match (two halves)

Two aggregate "sides" carry across both halves; each half is a normal 1-v-1 with
its own clubs, score and stats. In KLCSRA, a "team" = a manager; a combined
match is one manager-pair vs another, so each aggregate side has **two managers**
(one per half).

- **Rosters:** the same six physical players play both halves for the same
  aggregate side. On opening H2, the recorder auto-copies the H1 roster; the
  admin only picks H2's two clubs and managers (a one-time swap prompt).
- **Cross-half stats:** the same player earns KR and MMG **independently in each
  half** under whichever club they played for that half.
- **Points:** each **half-win = 0.2** to the winning club; **aggregate-score
  winner = +0.1** to *both* its clubs. Worked example: KL+BOCI vs DP+SOG → KL
  0.3, BOCI 0.1, SOG 0.2, DP 0.
- **Aggregate scoreboard** shown as a slim status line at the top of the
  recorder; UI splits below into **H1 / H2 tabs** (one visible at a time). A
  single Submit locks both halves.

A normal (non-combined) match is a single game.

## Finalise — Submit & lock

Autosave while entering; a per-match **Submit** computes all KR/MMG and locks
the match **read-only**. Only **KFANDRA** may reopen. `Done` on the stats popup
only closes that popup — it is not Submit.

- The pre-submit view shows: pre-submit checks list, standings-point totals,
  total KR / MMG, and a **balance-sheet write-back preview** (per-loanee KR).
- **For friendlies**, KR is zeroed before write-back; the preview shows MMG only.
- **Reopen** (KFANDRA-only): reverts the KR write-back on all involved clubs,
  keeps manual entries intact (source-tag preserved), unlocks the recorder.
  Re-submit rewrites cleanly (overwrite policy).

## Outputs

1. **Per-match report** (copy-as-text): sport · duration · date · per-side score
   · each player's stat line + **+KR / MMG**. **Format kept simple for v1**;
   iterate on wording after real use.
2. **Season leaderboards** — filter defaults to the active season:
   - **Scorers** (G/T/Ass/PA), per-sport
   - **Discipline** (YC/RC/BC/LC)
   - **KR** board (league matches only)
   - **MMG** board (league + friendly)
3. **Standings** — P, W, D, L, PF, PA, PDIFF, Pts (size-tiered rule + margin).
   League matches only; friendlies excluded.

## Balance Sheet integration (option 1, extended)

On Submit of a **league** match, each club's dated balance entry is filled and
locked:

- **Results** (played/W/D/L, from the entered score) → read-only "from match".
- **KR** each player earned → **auto-fills that player's loanee amount** for the
  club they played for. Final KR (not the pre-`loaneePerShare` share number) —
  the recorder's stat-KR is the exact amount credited.
- **Overwrite policy:** rows written by the recorder carry a `source =
  'match:<id>'` tag. Submit deletes existing rows for that tag and rewrites;
  manual entries (no source tag) are kept intact. Reopen deletes the tagged rows
  and unlocks the recorder.
- Manager is left owning only **Club Bonus**.
- One-way (recorder → sheet). **MMG** totals are shown to copy into MMG (direct
  write-back is a later, optional phase).
- **Friendlies do not write anything** to the balance sheet (no KR, no
  standings).

## UI conventions

- **Light theme, mobile-first**, `max-w-md`. Patterns lifted from
  `src/app/admin/klc/page.tsx`: white cards on `bg-gray-50`, blue-50 overview
  panels, `text-[11px] uppercase tracking-wide` labels, `bg-gray-900` primary
  CTAs. Every user-facing string that would reference the elevated role says
  **"KFANDRA"** (never "Coach" or "super-admin"; internal role IDs unchanged in
  code).
- **Matches page** — glass-free light card list, grouped by date, single
  "＋ New match" CTA (Friendly is a toggle inside the recorder). Season pill
  under the H1. Between-seasons variant swaps in an amber "Start Season N"
  prompt.
- **Match recorder header** — Sport as chips (4 across), Date/Duration as
  inline inputs, Friendly and Combined as segmented toggles, Season pill
  next to the "Draft" label (read-only). Autosaved badge top-right.
- **Team cards + squads** — unified dark scoreboard bar at the top spanning both
  teams; below it two white cards (club + manager + role pill + 6 slots each).
  Slot shows event-count + KR-delta pill (green positive / red negative). Empty
  slots are dashed placeholders.
- **Stats popup** — `ui/dialog` or `ui/sheet`. **List row per stat with +/−
  buttons and a live count**. Live per-player KR/MMG total at the top. Sport
  filter applied. **Done** closes; there is no Cancel.
- **Combined match** — slim aggregate status line + H1/H2 tab row. Only one
  half visible at a time. H2 opens with an auto-copied roster and a one-time
  swap-clubs prompt.
- **Submit** — green `Submit & lock` at the bottom. Locked view shows the final
  totals, actions (Copy match report, View balance sheets, Reopen), and audit
  info (submitted by, timestamp). Reopen sits behind a warning dialog.

## Open (minor — won't block build)

- Exact website-report wording (v1 is intentionally simple).

## Next step

`superpowers:writing-plans` → the Phase 1 plan
(`docs/superpowers/plans/2026-08-15-klcsra-phase1-foundation.md`) is being
amended in-place to reflect v0.4: new `klc_seasons` table, `season_id` +
`is_friendly` on `klc_matches`, `klcsra_sport_stats` app_config key, Fooba stat
keys, and the `includeKR` option on `computePlayerPayout`. Phases 2–5
(repository/actions/submit-lock, recorder UI, outputs, balance-sheet link)
follow as separate plans.
