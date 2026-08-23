# KLCSRA Phase 1 — Foundation (data model + domain logic) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **This plan is self-contained.** Every code block below is final — copy it verbatim. There is no amendment section to apply mentally. (Revision 2, 2026-08-23: v0.4 amendments folded into the task bodies; pre-flight gaps resolved — see Decisions Log.)

**Goal:** Establish the KLCSRA database schema (seasons → matches → halves → sides → appearances → stats, with RLS) plus the pure, fully-tested domain logic for per-player KR/MMG payouts, size-tiered + margin standings points, and combined two-half match points.

**Spec:** `docs/superpowers/specs/2026-08-10-klcsra-match-recorder-design.md` (v0.4).
**Roadmap:** `docs/superpowers/specs/2026-08-23-klcsra-release-roadmap.md` (Phases 2–5).
**Bead:** `Helper-bsr`.

---

## Decisions Log (resolved before execution — do not re-litigate)

These were open assumptions in revision 1. KFANDRA resolved them on 2026-08-23:

1. **Sport allow-list is enforced in the payout compute.** Spec §Sport allow-list says
   disallowed keys "are ignored by the payout compute". `computePlayerPayout` therefore
   takes an optional `allowed` list. It takes a `StatKey[]`, **not** a `Sport` — this keeps
   `payouts.ts` dependent only on `stat-rates.ts`; the caller resolves the list via
   `statsForSport()`.
2. **Season 1 is seeded with status `upcoming`, not `active`.** KFANDRA presses *Start* in
   the Phase 2 Seasons page. League Submit stays blocked until then, which is correct
   lifecycle behaviour. `start_date` is seeded to the clubs-migration date and is editable.
3. **The balance-sheet `source` column lands in Phase 1** (Task 2), as a separate migration.
   Spec §Balance sheet requires `source = 'match:<id>'` on recorder-written rows with manual
   entries kept intact — impossible against today's `unique (club_id, entry_date, player_id)`.
   The write-back *logic* remains Phase 5; only the schema moves forward.
4. **Managers are derived from `clubs.manager_player_id`.** Each club has exactly one manager;
   a match has one manager per half, who leads their own club. So `klc_match_sides` gets **no**
   `manager_player_id` column.
5. **There is no club roster table.** Only the manager is assigned to a club for a season; all
   other players are assigned to clubs per-game via `klc_appearances`. Phase 3's "registered
   players first" picker must therefore be **derived from appearance history**, not read from a
   table. Filed as a bead for Phase 3.
6. **`database.types.ts` is regenerated in this phase** (Task 10). The repo keeps it exactly in
   sync with migrations; skipping it would leave the tree inconsistent and break Phase 2.
7. **Data-integrity constraints are enforced in the database, not just the app** (added after
   the Task 1 code-quality review). `stat_count >= 0` and `score >= 0` matter most: the +/-
   sign lives in the rates table, so a negative tally would *invert* a payout and pay a player
   for a red card. Also added: submitted-state coherence on `klc_matches`, one-club-per-half on
   `klc_match_sides`, season date sanity, `slot >= 1`, and indexes on the `on delete restrict`
   foreign keys. The stats tally column is named `stat_count`, matching the sibling EAV table
   `submission_game_stats(stat_key, stat_value)` and avoiding the bare SQL function name.

### Deferred to Phase 2 (filed as beads in Task 11)

- **RLS does not enforce the submit lock.** Policies are a uniform `app.is_staff()`, and
  `is_staff()` includes the lowest `admin` tier, while `src/lib/supabase/client.ts` exposes an
  anon-key browser client. So "submitted matches cannot be edited" is a convention in server
  actions, not an invariant. There is no live exposure in Phase 1 (nothing writes these tables
  yet), and Phase 2 is where Submit/Reopen is built, so it is fixed there — either split the
  policies so `update`/`delete` require `status = 'draft'`, or add a trigger on the child
  tables rejecting writes to a submitted match.
- **A player can appear on both sides of the same half** — double-paid, and double-counted
  toward the `playerThreshold` that selects the standings tier. `unique (side_id, player_id)`
  is scoped to a side; enforcing it at half grain needs a denormalized `half_id` on
  `klc_appearances` plus a composite FK, so it rides with the Phase 2 schema work.
- **Editing a child row does not bump `klc_matches.updated_at`**, so the autosave/SyncBadge
  watermark is stale for the most common edit in the recorder. Needs a touch-parent trigger.
- **KLCSRA tables are staff-only for SELECT**, diverging from `clubs_select_all`. Phase 3's
  player-facing standings and leaderboards must route through the service-role client, or the
  policies need a read-only public path.

### Known, accepted quirks

- The seeded sport allow-list follows the spec exactly: **rugby has no `save` and none of the
  three own-* stats, and rugby is the only sport carrying `tackle`.** These are admin-editable
  `app_config` values, so they are cheap to change later.
- `club_player_shares.amount` is a *share count* multiplied by `klc_rates.loaneePerShare` (=10),
  but spec §Balance sheet says the recorder writes **final KR**. Writing KR into `amount` would
  10x it. This is a Phase 5 write-back decision, filed as a bead — Task 2 only adds the column.

---

**Architecture:** A new `src/lib/klcsra/` namespace kept separate from the existing balance-sheet `src/lib/klc/`. Domain modules are **pure** (no server/DB imports) so they unit-test with Vitest and are safe to import from Client Components, mirroring the existing `rates.ts` / `compute.ts` split; a `server-only` `config.ts` loads the editable rules from `app_config`. Rules (stat rates, sport allow-list, standings tiers, combined bonuses) live in `app_config`, never hardcoded — matching the project convention.

**Tech Stack:** Next.js 14 (App Router) · TypeScript strict · Supabase Postgres 17 + RLS · Vitest.

**Verified pre-flight (do not re-check):** `app.set_updated_at()`, `app.is_staff()` (staff = `super_admin` | `kfandra` | `admin`), `public.clubs`, `public.players` all exist. `app_config.key` is the PK, so `on conflict (key)` is valid, and `description` is a real column. Migration timestamp `20260815120000` sorts after all 20 existing migrations. `npm run test` is `vitest run` (one-shot, will not hang). The full Task 1 + Task 2 SQL has been dry-run against local Postgres in a rolled-back transaction and applies cleanly.

---

## File Structure

- `supabase/migrations/20260815120000_klcsra_core.sql` — **create** — 6 KLCSRA tables + RLS + `updated_at` triggers + seed of the three `app_config` rule keys + Season 1.
- `supabase/migrations/20260815120100_klc_sheet_source_tags.sql` — **create** — `source` / `results_source` columns on the shipped balance-sheet tables.
- `src/lib/klcsra/stat-rates.ts` / `.test.ts` — **create** — 16 `StatKey`s, `STAT_LABELS`, `DEFAULT_STAT_RATES`, `parseStatRates`. Pure.
- `src/lib/klcsra/sport-stats.ts` / `.test.ts` — **create** — `Sport`, `SportStats`, `DEFAULT_SPORT_STATS`, `parseSportStats`, `statsForSport`. Pure.
- `src/lib/klcsra/standings-rules.ts` / `.test.ts` — **create** — `PointsTuple`, `StandingsRules`, `DEFAULT_STANDINGS_RULES`, `parseStandingsRules`. Pure.
- `src/lib/klcsra/payouts.ts` / `.test.ts` — **create** — `PlayerStatCounts`, `Payout`, `PayoutOptions`, `computePlayerPayout`. Pure.
- `src/lib/klcsra/round.ts` / `.test.ts` — **create** — shared `round4` float-noise helper.
- `src/lib/klcsra/standings.ts` / `.test.ts` — **create** — `computeStandingPoints`. Pure.
- `src/lib/klcsra/combined.ts` / `.test.ts` — **create** — `HalfResult`, `computeCombinedPoints`. Pure.
- `src/lib/klcsra/config.ts` — **create** — `server-only` loaders `loadStatRates`, `loadSportStats`, `loadStandingsRules`.
- `src/lib/supabase/database.types.ts` — **regenerate**.

---

## Task 1: Database migration — KLCSRA core tables + RLS + seed rules

**Files:**
- Create: `supabase/migrations/20260815120000_klcsra_core.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================================
-- 20260815120000 — KLCSRA (KLC Stats Recording App) core schema
-- ----------------------------------------------------------------------------
-- Admin-only match recorder. A season groups league matches; friendlies sit
-- outside any season. A match holds one or two halves (single vs combined);
-- each half has two sides (home/away) each tied to a club with a role and a
-- score; each side has up to N player appearances; each appearance carries
-- per-stat counts. Payout (KR/MMG) and standings rules live in app_config and
-- are computed in the app, never stored.
--
-- A side's manager is NOT stored: each club has exactly one manager, so the
-- manager for a side is clubs.manager_player_id of that side's club.
--
-- RLS: staff only (app.is_staff()) for all rows. Submit/lock is enforced in
-- server actions (Phase 2); RLS here is the staff gate + defence in depth.
-- ============================================================================

-- ─── klc_seasons ────────────────────────────────────────────────────────────
-- Created first: klc_matches references it.
create table public.klc_seasons (
  id         uuid primary key default gen_random_uuid(),
  season_no  int  not null unique,
  name       text not null,
  start_date date not null,
  end_date   date,
  status     text not null default 'upcoming',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint klc_seasons_status_chk check (status in ('upcoming','active','closed')),
  constraint klc_seasons_dates_chk  check (end_date is null or end_date >= start_date)
);
comment on table public.klc_seasons is
  'KLCSRA seasons. Exactly one may be active at a time; league matches tag the active season at Submit. Friendlies carry no season.';

-- At most one active season, enforced in the database.
create unique index klc_seasons_one_active
  on public.klc_seasons ((true)) where status = 'active';

create trigger klc_seasons_set_updated_at
  before update on public.klc_seasons
  for each row execute function app.set_updated_at();

-- ─── klc_matches ────────────────────────────────────────────────────────────
create table public.klc_matches (
  id               uuid primary key default gen_random_uuid(),
  entry_date       date not null,
  season_id        uuid references public.klc_seasons(id) on delete restrict,
  is_friendly      boolean not null default false,
  sport            text not null default 'football',   -- football | rugby | fooba | variation
  duration_minutes int,
  is_combined      boolean not null default false,
  status           text not null default 'draft',      -- draft | submitted
  submitted_at     timestamptz,
  submitted_by     uuid references public.players(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint klc_matches_sport_chk  check (sport in ('football','rugby','fooba','variation')),
  constraint klc_matches_status_chk check (status in ('draft','submitted')),
  constraint klc_matches_duration_chk check (duration_minutes is null or duration_minutes > 0),
  -- Spec: "Friendlies always have season_id = null."
  constraint klc_matches_friendly_season_chk check (not is_friendly or season_id is null),
  -- A submitted match must record when it was submitted. Reopen must clear
  -- submitted_at, or "was this locked, and when" can never be reconstructed.
  constraint klc_matches_submitted_at_chk check (status <> 'submitted' or submitted_at is not null),
  -- A submitted LEAGUE match must carry a season. Without this it pays out
  -- Kroopies and then never appears in any standings query, silently.
  constraint klc_matches_league_season_chk
    check (is_friendly or status <> 'submitted' or season_id is not null)
);
comment on table public.klc_matches is
  'KLCSRA match header. One or two halves (is_combined). Friendlies pay MMG only and carry no season. Locks when status=submitted.';
create index klc_matches_date_idx         on public.klc_matches (entry_date);
create index klc_matches_season_idx       on public.klc_matches (season_id);
create index klc_matches_submitted_by_idx on public.klc_matches (submitted_by);

create trigger klc_matches_set_updated_at
  before update on public.klc_matches
  for each row execute function app.set_updated_at();

-- ─── klc_match_halves ───────────────────────────────────────────────────────
create table public.klc_match_halves (
  id       uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.klc_matches(id) on delete cascade,
  half_no  int  not null,                                -- 1 (single/first) or 2
  unique (match_id, half_no),
  constraint klc_halves_no_chk check (half_no in (1, 2))
);
comment on table public.klc_match_halves is
  'A single match has one half (half_no=1); a combined match has half_no 1 and 2.';

-- ─── klc_match_sides ────────────────────────────────────────────────────────
create table public.klc_match_sides (
  id      uuid primary key default gen_random_uuid(),
  half_id uuid not null references public.klc_match_halves(id) on delete cascade,
  side    text not null,                                 -- home | away
  club_id uuid not null references public.clubs(id) on delete restrict,
  role    text not null default 'home',                  -- home | away | neutral
  score   int  not null default 0,
  unique (half_id, side),
  -- A club cannot play itself: at most one side per club per half. Combined
  -- matches are unaffected -- half 2 has its own half_id, and the spec allows
  -- a club to reappear in the other half.
  unique (half_id, club_id),
  constraint klc_sides_side_chk  check (side in ('home','away')),
  constraint klc_sides_role_chk  check (role in ('home','away','neutral')),
  constraint klc_sides_score_chk check (score >= 0)
);
comment on table public.klc_match_sides is
  'Two sides per half. `side` is the AGGREGATE-TEAM SLOT (the "home" sides across halves form one aggregate team, the "away" sides the other); `role` is the venue role. The side''s manager is clubs.manager_player_id of club_id.';
-- club_id is `on delete restrict`, which seq-scans this table without an index.
create index klc_sides_club_idx on public.klc_match_sides (club_id);

-- ─── klc_appearances ────────────────────────────────────────────────────────
create table public.klc_appearances (
  id        uuid primary key default gen_random_uuid(),
  side_id   uuid not null references public.klc_match_sides(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  slot      int  not null,                               -- 1..6 (grows later)
  unique (side_id, player_id),
  -- Deferrable so the recorder can swap two players' slots in one transaction.
  -- Note for Phase 2: a deferrable constraint cannot be an ON CONFLICT target,
  -- so upserts must conflict on (side_id, player_id), which is immediate.
  constraint klc_appearances_slot_uniq unique (side_id, slot)
    deferrable initially deferred,
  -- Upper bound stays app-side; the spec says the slot cap grows later.
  constraint klc_appearances_slot_chk check (slot >= 1)
);
comment on table public.klc_appearances is
  'Players who turned out for a side in a half. There is no club roster: club membership for a match IS this row. slot is display order.';
-- player_id is `on delete restrict`, and per-player totals aggregate on it.
create index klc_appearances_player_idx on public.klc_appearances (player_id);

-- ─── klc_player_stats ───────────────────────────────────────────────────────
create table public.klc_player_stats (
  id            uuid primary key default gen_random_uuid(),
  appearance_id uuid not null references public.klc_appearances(id) on delete cascade,
  stat_key      text not null,                           -- goal, try, mainGoal, ...
  stat_count    int  not null default 0,
  unique (appearance_id, stat_key),
  -- stat_count is an event TALLY; the +/- sign lives in the rates. A negative
  -- tally would invert the payout -- count = -1 on redCard would PAY the
  -- player +20 KR for a sending-off.
  constraint klc_player_stats_count_chk check (stat_count >= 0)
);
comment on table public.klc_player_stats is
  'Per-appearance per-stat event tallies. stat_key values validated in the app against app_config klcsra_stat_rates / klcsra_sport_stats. Named stat_count to match the sibling EAV table submission_game_stats(stat_key, stat_value) and to avoid the bare SQL function name `count`.';

-- ─── RLS: staff only for all KLCSRA tables ──────────────────────────────────
alter table public.klc_seasons       enable row level security;
alter table public.klc_matches       enable row level security;
alter table public.klc_match_halves  enable row level security;
alter table public.klc_match_sides   enable row level security;
alter table public.klc_appearances   enable row level security;
alter table public.klc_player_stats  enable row level security;

create policy klc_seasons_rw_staff on public.klc_seasons
  for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy klc_matches_rw_staff on public.klc_matches
  for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy klc_halves_rw_staff on public.klc_match_halves
  for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy klc_sides_rw_staff on public.klc_match_sides
  for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy klc_appearances_rw_staff on public.klc_appearances
  for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy klc_player_stats_rw_staff on public.klc_player_stats
  for all to authenticated using (app.is_staff()) with check (app.is_staff());

-- ─── Seed Season 1 (upcoming; KFANDRA presses Start in the Seasons page) ────
insert into public.klc_seasons (season_no, name, start_date, status)
values (1, 'KLCFERRSXVSG1', '2026-07-20', 'upcoming')
on conflict (season_no) do nothing;

-- ─── Seed editable rules into app_config ────────────────────────────────────
-- 16 stats. Keys are camelCase and MUST match StatKey in src/lib/klcsra/stat-rates.ts.
insert into public.app_config (key, value, description) values (
  'klcsra_stat_rates',
  '{
    "goal":         {"kr": 20,  "mmg": 500},
    "try":          {"kr": 25,  "mmg": 500},
    "mainGoal":     {"kr": 20,  "mmg": 500},
    "reboundGoal":  {"kr": 10,  "mmg": 300},
    "assist":       {"kr": 10,  "mmg": 200},
    "preAssist":    {"kr": 5,   "mmg": 100},
    "switchover":   {"kr": 5,   "mmg": 100},
    "tackle":       {"kr": 5,   "mmg": 100},
    "save":         {"kr": 5,   "mmg": 200},
    "yellowCard":   {"kr": -10, "mmg": -200},
    "redCard":      {"kr": -20, "mmg": -500},
    "blueCard":     {"kr": -30, "mmg": -1000},
    "lateChallenge":{"kr": -5,  "mmg": -100},
    "ownGoal":      {"kr": -20, "mmg": -500},
    "ownAssist":    {"kr": -10, "mmg": -200},
    "ownPreAssist": {"kr": -5,  "mmg": -100}
  }'::jsonb,
  'KLCSRA per-stat payout: Kroopies (kr) + MMG points (mmg) per event. Admin-editable.'
) on conflict (key) do nothing;

-- Which stats the recorder offers per sport. Follows spec v0.4 §Sport allow-list
-- exactly: rugby deliberately has no save and no own-* stats, and is the only
-- sport carrying tackle.
insert into public.app_config (key, value, description) values (
  'klcsra_sport_stats',
  '{
    "football":  ["goal","assist","preAssist","save","yellowCard","redCard","blueCard","lateChallenge","ownGoal","ownAssist","ownPreAssist"],
    "rugby":     ["try","tackle","assist","preAssist","yellowCard","redCard","blueCard","lateChallenge"],
    "fooba":     ["mainGoal","reboundGoal","switchover","assist","preAssist","save","yellowCard","redCard","blueCard","lateChallenge","ownGoal","ownAssist","ownPreAssist"],
    "variation": ["goal","try","mainGoal","reboundGoal","assist","preAssist","switchover","tackle","save","yellowCard","redCard","blueCard","lateChallenge","ownGoal","ownAssist","ownPreAssist"]
  }'::jsonb,
  'KLCSRA per-sport stat allow-list. The recorder filters the stats popup by sport; disallowed keys are ignored by the payout compute.'
) on conflict (key) do nothing;

insert into public.app_config (key, value, description) values (
  'klcsra_standings_rules',
  '{
    "playerThreshold": 6,
    "atOrAbove": {"win": 3,   "draw": 1,    "loss": 0},
    "below":     {"win": 0.2, "draw": 0.05, "loss": 0},
    "margin":    {"threshold": 20, "winnerBonus": 1, "loserPenalty": -1},
    "combined":  {"halfWin": 0.2, "aggregateBonus": 0.1}
  }'::jsonb,
  'KLCSRA standings: size-tiered W/D/L by total players in the match, >=20-margin bonus, and combined two-half match points.'
) on conflict (key) do nothing;
```

- [ ] **Step 2: Apply the migration to local Supabase**

Run: `npx supabase db reset`
Expected: reset completes and applies all migrations including `20260815120000_klcsra_core.sql` with no errors.

- [ ] **Step 3: Verify the tables and seed exist**

> Note: the CLI subcommand is `db query` with SQL as a **positional** argument. There is no `db execute`.

```bash
npx supabase db query --local "select count(*) as tables from information_schema.tables where table_name in ('klc_seasons','klc_matches','klc_match_halves','klc_match_sides','klc_appearances','klc_player_stats');"
npx supabase db query --local "select key from public.app_config where key like 'klcsra_%' order by key;"
npx supabase db query --local "select season_no, name, status from public.klc_seasons;"
```
Expected: `tables = 6`; three keys `klcsra_sport_stats`, `klcsra_standings_rules`, `klcsra_stat_rates`; one season row `1 | KLCFERRSXVSG1 | upcoming`.

- [ ] **Step 4: Verify the invariants actually bite**

Each of these MUST fail with the named constraint. A success is a bug. Nothing is
inserted, so no cleanup is needed.

```bash
# A friendly may not carry a season.
npx supabase db query --local "insert into public.klc_matches (entry_date, is_friendly, season_id) values ('2026-08-01', true, (select id from public.klc_seasons where season_no=1));"
# A submitted league match must carry a season.
npx supabase db query --local "insert into public.klc_matches (entry_date, status, submitted_at) values ('2026-08-01', 'submitted', now());"
# A submitted match must record when it was submitted.
npx supabase db query --local "insert into public.klc_matches (entry_date, status, season_id) values ('2026-08-01', 'submitted', (select id from public.klc_seasons where season_no=1));"
# A season may not end before it starts.
npx supabase db query --local "insert into public.klc_seasons (season_no, name, start_date, end_date) values (99, 'Bad', '2026-05-01', '2026-04-01');"
```

Expected, in order: `klc_matches_friendly_season_chk`, `klc_matches_league_season_chk`,
`klc_matches_submitted_at_chk`, `klc_seasons_dates_chk`.

The non-negative tallies need a parent chain, so prove those two with a single
scripted transaction that rolls back. Build a match -> half -> side ->
appearance chain with `gen_random_uuid()`, then attempt `score = -1` on the side
and `stat_count = -1` on a stat row. Expected: `klc_sides_score_chk` and
`klc_player_stats_count_chk` violations respectively, and the transaction rolled
back so the tables are left empty. Report the actual error text for both.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260815120000_klcsra_core.sql
git commit -m "feat(klcsra): core schema (seasons/matches/halves/sides/appearances/stats) + RLS + seed rules"
```

---

## Task 2: Balance-sheet source tags migration

Spec §Balance sheet: recorder-written rows carry `source = 'match:<id>'`; Submit deletes rows for that tag and rewrites; **manual entries are kept intact**. Today's `unique (club_id, entry_date, player_id)` makes a manual row and a match row mutually exclusive, so that policy is unimplementable. This task fixes the schema only — the write-back logic is Phase 5.

`nulls not distinct` (Postgres 15+) is what makes this work: `null` source means "manual", and because nulls are compared as equal, the original "one manual row per (club, date, player)" invariant is preserved while match-sourced rows coexist alongside it.

**Files:**
- Create: `supabase/migrations/20260815120100_klc_sheet_source_tags.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================================
-- 20260815120100 — Balance-sheet source tags (KLCSRA write-back prerequisite)
-- ----------------------------------------------------------------------------
-- Spec §Balance sheet: rows written by the match recorder carry
-- source = 'match:<match_id>'; Submit deletes rows for that tag and rewrites,
-- while manual entries (source is null) are kept intact.
--
-- The existing unique (club_id, entry_date, player_id) forced manual and
-- match-sourced rows to collide. Widening it with `source` under
-- NULLS NOT DISTINCT keeps "one manual row per (club, date, player)" while
-- letting one row per match id coexist.
--
-- Schema only. The write-back itself lands in Phase 5.
-- ============================================================================

alter table public.club_player_shares
  add column source text;
comment on column public.club_player_shares.source is
  'null = entered manually by the manager. ''match:<uuid>'' = written by the KLCSRA recorder for that match.';

alter table public.club_player_shares
  drop constraint club_player_shares_club_id_entry_date_player_id_key;

alter table public.club_player_shares
  add constraint club_player_shares_uniq
  unique nulls not distinct (club_id, entry_date, player_id, source);

alter table public.club_balance_sheets
  add column results_source text;
comment on column public.club_balance_sheets.results_source is
  'null = played/won/drawn/lost entered manually. ''match:<uuid>'' = derived from a submitted KLCSRA match; the UI renders those fields read-only.';
```

- [ ] **Step 2: Apply and verify**

```bash
npx supabase db reset
npx supabase db query --local "select column_name from information_schema.columns where (table_name='club_player_shares' and column_name='source') or (table_name='club_balance_sheets' and column_name='results_source') order by column_name;"
```
Expected: reset clean; two rows — `results_source`, `source`.

- [ ] **Step 3: Verify the widened unique key behaves**

```bash
npx supabase db query --local "select conname from pg_constraint where conrelid='public.club_player_shares'::regclass and contype='u';"
```
Expected: `club_player_shares_uniq` (and no `club_player_shares_club_id_entry_date_player_id_key`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260815120100_klc_sheet_source_tags.sql
git commit -m "feat(klc): source tags on balance-sheet rows for KLCSRA write-back"
```

---

## Task 3: Stat rates config (pure)

**Files:**
- Create: `src/lib/klcsra/stat-rates.ts`
- Test: `src/lib/klcsra/stat-rates.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import {
  DEFAULT_STAT_RATES,
  STAT_KEYS,
  STAT_LABELS,
  parseStatRates,
} from "./stat-rates";

describe("DEFAULT_STAT_RATES", () => {
  it("has all 16 stats with the agreed KR/MMG values", () => {
    expect(STAT_KEYS).toHaveLength(16);
    expect(DEFAULT_STAT_RATES.goal).toEqual({ kr: 20, mmg: 500 });
    expect(DEFAULT_STAT_RATES.try).toEqual({ kr: 25, mmg: 500 });
    expect(DEFAULT_STAT_RATES.save).toEqual({ kr: 5, mmg: 200 });
    expect(DEFAULT_STAT_RATES.blueCard).toEqual({ kr: -30, mmg: -1000 });
    expect(DEFAULT_STAT_RATES.ownPreAssist).toEqual({ kr: -5, mmg: -100 });
  });

  it("has the three Fooba stats", () => {
    expect(DEFAULT_STAT_RATES.mainGoal).toEqual({ kr: 20, mmg: 500 });
    expect(DEFAULT_STAT_RATES.reboundGoal).toEqual({ kr: 10, mmg: 300 });
    expect(DEFAULT_STAT_RATES.switchover).toEqual({ kr: 5, mmg: 100 });
  });

  it("labels every key", () => {
    for (const key of STAT_KEYS) {
      expect(STAT_LABELS[key]).toBeTruthy();
    }
    expect(STAT_LABELS.mainGoal).toBe("Main Goal");
    expect(STAT_LABELS.reboundGoal).toBe("Rebound Goal");
    expect(STAT_LABELS.switchover).toBe("Switchover");
  });
});

describe("parseStatRates", () => {
  it("returns defaults for null/garbage input", () => {
    expect(parseStatRates(null)).toEqual(DEFAULT_STAT_RATES);
    expect(parseStatRates("nope")).toEqual(DEFAULT_STAT_RATES);
  });

  it("overrides only the provided stats, keeping defaults for the rest", () => {
    const r = parseStatRates({ goal: { kr: 99, mmg: 1000 } });
    expect(r.goal).toEqual({ kr: 99, mmg: 1000 });
    expect(r.assist).toEqual({ kr: 10, mmg: 200 }); // untouched default
  });

  it("ignores non-numeric fields and falls back per field", () => {
    const r = parseStatRates({ goal: { kr: "x", mmg: 700 } });
    expect(r.goal).toEqual({ kr: 20, mmg: 700 }); // kr falls back, mmg kept
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/klcsra/stat-rates.test.ts`
Expected: FAIL — cannot resolve `./stat-rates`.

- [ ] **Step 3: Write minimal implementation**

```typescript
/**
 * Pure KLCSRA per-stat payout rates (no DB/server imports — safe for Client
 * Components and unit tests). DB loader lives in config.ts. Mirrors the
 * balance-sheet rates.ts pattern.
 */

export type StatKey =
  | "goal" | "try" | "mainGoal" | "reboundGoal"
  | "assist" | "preAssist" | "switchover"
  | "tackle" | "save"
  | "yellowCard" | "redCard" | "blueCard" | "lateChallenge"
  | "ownGoal" | "ownAssist" | "ownPreAssist";

export interface StatRate {
  kr: number;
  mmg: number;
}

export type StatRates = Record<StatKey, StatRate>;

/**
 * Canonical stat order (also the display order): scoring events, then
 * contributions, then defensive, then sanctions, then own-goals.
 */
export const STAT_KEYS: StatKey[] = [
  "goal", "try", "mainGoal", "reboundGoal",
  "assist", "preAssist", "switchover",
  "tackle", "save",
  "yellowCard", "redCard", "blueCard", "lateChallenge",
  "ownGoal", "ownAssist", "ownPreAssist",
];

/** Short human labels for UI. */
export const STAT_LABELS: Record<StatKey, string> = {
  goal: "Goal",
  try: "Try",
  mainGoal: "Main Goal",
  reboundGoal: "Rebound Goal",
  assist: "Assist",
  preAssist: "Pre-Assist",
  switchover: "Switchover",
  tackle: "Tackle",
  save: "Save",
  yellowCard: "Yellow Card",
  redCard: "Red Card",
  blueCard: "Blue Card",
  lateChallenge: "Late Challenge",
  ownGoal: "Own Goal",
  ownAssist: "Own Assist",
  ownPreAssist: "Own Pre-Assist",
};

export const DEFAULT_STAT_RATES: StatRates = {
  goal: { kr: 20, mmg: 500 },
  try: { kr: 25, mmg: 500 },
  mainGoal: { kr: 20, mmg: 500 },
  reboundGoal: { kr: 10, mmg: 300 },
  assist: { kr: 10, mmg: 200 },
  preAssist: { kr: 5, mmg: 100 },
  switchover: { kr: 5, mmg: 100 },
  tackle: { kr: 5, mmg: 100 },
  save: { kr: 5, mmg: 200 },
  yellowCard: { kr: -10, mmg: -200 },
  redCard: { kr: -20, mmg: -500 },
  blueCard: { kr: -30, mmg: -1000 },
  lateChallenge: { kr: -5, mmg: -100 },
  ownGoal: { kr: -20, mmg: -500 },
  ownAssist: { kr: -10, mmg: -200 },
  ownPreAssist: { kr: -5, mmg: -100 },
};

/** Coerce a raw app_config JSON value into StatRates with per-field fallbacks. */
export function parseStatRates(value: unknown): StatRates {
  const v = (value ?? {}) as Record<string, unknown>;
  const num = (x: unknown, fallback: number) =>
    typeof x === "number" && Number.isFinite(x) ? x : fallback;
  const out = {} as StatRates;
  for (const key of STAT_KEYS) {
    const raw = (v[key] ?? {}) as Record<string, unknown>;
    const def = DEFAULT_STAT_RATES[key];
    out[key] = { kr: num(raw.kr, def.kr), mmg: num(raw.mmg, def.mmg) };
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/klcsra/stat-rates.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/klcsra/stat-rates.ts src/lib/klcsra/stat-rates.test.ts
git commit -m "feat(klcsra): pure stat-rates config (16 stats, KR/MMG, app_config parse)"
```

---

## Task 4: Sport allow-list config (pure)

**Files:**
- Create: `src/lib/klcsra/sport-stats.ts`
- Test: `src/lib/klcsra/sport-stats.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import {
  DEFAULT_SPORT_STATS,
  SPORTS,
  parseSportStats,
  statsForSport,
} from "./sport-stats";
import { STAT_KEYS } from "./stat-rates";

describe("DEFAULT_SPORT_STATS", () => {
  it("covers all four sports", () => {
    expect(SPORTS).toEqual(["football", "rugby", "fooba", "variation"]);
  });

  it("matches the spec allow-lists", () => {
    expect(DEFAULT_SPORT_STATS.football).toHaveLength(11);
    expect(DEFAULT_SPORT_STATS.rugby).toHaveLength(8);
    expect(DEFAULT_SPORT_STATS.fooba).toHaveLength(13);
    expect(DEFAULT_SPORT_STATS.variation).toHaveLength(16);
  });

  it("football has goal+save but no try/tackle/fooba stats", () => {
    expect(DEFAULT_SPORT_STATS.football).toContain("goal");
    expect(DEFAULT_SPORT_STATS.football).toContain("save");
    expect(DEFAULT_SPORT_STATS.football).not.toContain("try");
    expect(DEFAULT_SPORT_STATS.football).not.toContain("tackle");
    expect(DEFAULT_SPORT_STATS.football).not.toContain("mainGoal");
  });

  it("rugby has try+tackle but deliberately no save and no own-* stats", () => {
    expect(DEFAULT_SPORT_STATS.rugby).toContain("try");
    expect(DEFAULT_SPORT_STATS.rugby).toContain("tackle");
    expect(DEFAULT_SPORT_STATS.rugby).not.toContain("save");
    expect(DEFAULT_SPORT_STATS.rugby).not.toContain("ownGoal");
  });

  it("fooba replaces goal with mainGoal/reboundGoal and adds switchover", () => {
    expect(DEFAULT_SPORT_STATS.fooba).toContain("mainGoal");
    expect(DEFAULT_SPORT_STATS.fooba).toContain("reboundGoal");
    expect(DEFAULT_SPORT_STATS.fooba).toContain("switchover");
    expect(DEFAULT_SPORT_STATS.fooba).not.toContain("goal");
  });

  it("variation allows every known stat", () => {
    expect([...DEFAULT_SPORT_STATS.variation].sort()).toEqual([...STAT_KEYS].sort());
  });
});

describe("parseSportStats", () => {
  it("returns defaults for null/garbage input", () => {
    expect(parseSportStats(null)).toEqual(DEFAULT_SPORT_STATS);
    expect(parseSportStats("nope")).toEqual(DEFAULT_SPORT_STATS);
  });

  it("overrides one sport, keeping defaults for the rest", () => {
    const r = parseSportStats({ football: ["goal", "assist"] });
    expect(r.football).toEqual(["goal", "assist"]);
    expect(r.rugby).toEqual(DEFAULT_SPORT_STATS.rugby);
  });

  it("drops unknown stat keys from an override", () => {
    const r = parseSportStats({ football: ["goal", "bogus", "assist"] });
    expect(r.football).toEqual(["goal", "assist"]);
  });

  it("falls back to the default when an override is not an array", () => {
    const r = parseSportStats({ rugby: "try,tackle" });
    expect(r.rugby).toEqual(DEFAULT_SPORT_STATS.rugby);
  });

  it("falls back to the default when an override has no valid keys", () => {
    const r = parseSportStats({ rugby: ["bogus", "alsoBogus"] });
    expect(r.rugby).toEqual(DEFAULT_SPORT_STATS.rugby);
  });

  it("ignores unknown sports", () => {
    const r = parseSportStats({ hockey: ["goal"] });
    expect(r).toEqual(DEFAULT_SPORT_STATS);
  });
});

describe("statsForSport", () => {
  it("returns the configured list for a sport", () => {
    expect(statsForSport("rugby")).toEqual(DEFAULT_SPORT_STATS.rugby);
  });

  it("honours a custom config", () => {
    const cfg = parseSportStats({ football: ["goal"] });
    expect(statsForSport("football", cfg)).toEqual(["goal"]);
  });

  it("returns keys in canonical STAT_KEYS order", () => {
    const cfg = parseSportStats({ football: ["ownGoal", "goal", "save"] });
    expect(statsForSport("football", cfg)).toEqual(["goal", "save", "ownGoal"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/klcsra/sport-stats.test.ts`
Expected: FAIL — cannot resolve `./sport-stats`.

- [ ] **Step 3: Write minimal implementation**

```typescript
/**
 * Pure KLCSRA per-sport stat allow-list (no DB/server imports). The recorder
 * filters its stats popup by sport, and the payout compute ignores disallowed
 * keys. DB loader lives in config.ts.
 */

import { STAT_KEYS, type StatKey } from "./stat-rates";

export type Sport = "football" | "rugby" | "fooba" | "variation";

export const SPORTS: Sport[] = ["football", "rugby", "fooba", "variation"];

export const SPORT_LABELS: Record<Sport, string> = {
  football: "Football",
  rugby: "Rugby",
  fooba: "Fooba",
  variation: "Variation",
};

export type SportStats = Record<Sport, StatKey[]>;

/**
 * Spec v0.4 §Sport allow-list. Note two deliberate quirks: rugby carries
 * neither `save` nor any own-* stat, and rugby is the only sport with
 * `tackle`. Fooba is the football set with `goal` replaced by
 * `mainGoal` + `reboundGoal`, plus `switchover`.
 */
export const DEFAULT_SPORT_STATS: SportStats = {
  football: [
    "goal", "assist", "preAssist", "save",
    "yellowCard", "redCard", "blueCard", "lateChallenge",
    "ownGoal", "ownAssist", "ownPreAssist",
  ],
  rugby: [
    "try", "tackle", "assist", "preAssist",
    "yellowCard", "redCard", "blueCard", "lateChallenge",
  ],
  fooba: [
    "mainGoal", "reboundGoal", "switchover", "assist", "preAssist", "save",
    "yellowCard", "redCard", "blueCard", "lateChallenge",
    "ownGoal", "ownAssist", "ownPreAssist",
  ],
  variation: [...STAT_KEYS],
};

const KNOWN_STATS = new Set<string>(STAT_KEYS);
const ORDER = new Map<StatKey, number>(STAT_KEYS.map((k, i) => [k, i]));

/** Sort a stat list into canonical STAT_KEYS order. */
function inCanonicalOrder(keys: StatKey[]): StatKey[] {
  return [...keys].sort((a, b) => (ORDER.get(a) ?? 0) - (ORDER.get(b) ?? 0));
}

/**
 * Coerce a raw app_config JSON value into SportStats. An override must be an
 * array; unknown stat keys are dropped, and a sport whose override yields no
 * valid keys falls back to its default (an empty allow-list is never useful).
 */
export function parseSportStats(value: unknown): SportStats {
  const v = (value ?? {}) as Record<string, unknown>;
  const out = {} as SportStats;
  for (const sport of SPORTS) {
    const raw = v[sport];
    if (!Array.isArray(raw)) {
      out[sport] = [...DEFAULT_SPORT_STATS[sport]];
      continue;
    }
    const keys = raw.filter(
      (k): k is StatKey => typeof k === "string" && KNOWN_STATS.has(k),
    );
    out[sport] = keys.length > 0 ? keys : [...DEFAULT_SPORT_STATS[sport]];
  }
  return out;
}

/** The stat keys a sport allows, in canonical display order. */
export function statsForSport(
  sport: Sport,
  config: SportStats = DEFAULT_SPORT_STATS,
): StatKey[] {
  return inCanonicalOrder(config[sport] ?? DEFAULT_SPORT_STATS[sport]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/klcsra/sport-stats.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/klcsra/sport-stats.ts src/lib/klcsra/sport-stats.test.ts
git commit -m "feat(klcsra): pure per-sport stat allow-list (football/rugby/fooba/variation)"
```

---

## Task 5: Standings rules config (pure)

**Files:**
- Create: `src/lib/klcsra/standings-rules.ts`
- Test: `src/lib/klcsra/standings-rules.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { DEFAULT_STANDINGS_RULES, parseStandingsRules } from "./standings-rules";

describe("DEFAULT_STANDINGS_RULES", () => {
  it("matches the agreed defaults", () => {
    expect(DEFAULT_STANDINGS_RULES).toEqual({
      playerThreshold: 6,
      atOrAbove: { win: 3, draw: 1, loss: 0 },
      below: { win: 0.2, draw: 0.05, loss: 0 },
      margin: { threshold: 20, winnerBonus: 1, loserPenalty: -1 },
      combined: { halfWin: 0.2, aggregateBonus: 0.1 },
    });
  });
});

describe("parseStandingsRules", () => {
  it("returns defaults for null input", () => {
    expect(parseStandingsRules(null)).toEqual(DEFAULT_STANDINGS_RULES);
  });

  it("overrides the threshold but keeps the rest", () => {
    const r = parseStandingsRules({ playerThreshold: 8 });
    expect(r.playerThreshold).toBe(8);
    expect(r.atOrAbove).toEqual({ win: 3, draw: 1, loss: 0 });
    expect(r.combined).toEqual({ halfWin: 0.2, aggregateBonus: 0.1 });
  });

  it("overrides a nested tuple field per-field", () => {
    const r = parseStandingsRules({ below: { win: 0.5 } });
    expect(r.below).toEqual({ win: 0.5, draw: 0.05, loss: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/klcsra/standings-rules.test.ts`
Expected: FAIL — cannot resolve `./standings-rules`.

- [ ] **Step 3: Write minimal implementation**

```typescript
/** Pure KLCSRA standings rules (no DB/server imports). DB loader in config.ts. */

export interface PointsTuple {
  win: number;
  draw: number;
  loss: number;
}

export interface StandingsRules {
  /** Matches with total players >= this use `atOrAbove`; below it use `below`. */
  playerThreshold: number;
  atOrAbove: PointsTuple;
  below: PointsTuple;
  margin: { threshold: number; winnerBonus: number; loserPenalty: number };
  combined: { halfWin: number; aggregateBonus: number };
}

export const DEFAULT_STANDINGS_RULES: StandingsRules = {
  playerThreshold: 6,
  atOrAbove: { win: 3, draw: 1, loss: 0 },
  below: { win: 0.2, draw: 0.05, loss: 0 },
  margin: { threshold: 20, winnerBonus: 1, loserPenalty: -1 },
  combined: { halfWin: 0.2, aggregateBonus: 0.1 },
};

function num(x: unknown, fallback: number): number {
  return typeof x === "number" && Number.isFinite(x) ? x : fallback;
}

function parseTuple(raw: unknown, def: PointsTuple): PointsTuple {
  const v = (raw ?? {}) as Record<string, unknown>;
  return { win: num(v.win, def.win), draw: num(v.draw, def.draw), loss: num(v.loss, def.loss) };
}

/** Coerce a raw app_config JSON value into StandingsRules with fallbacks. */
export function parseStandingsRules(value: unknown): StandingsRules {
  const v = (value ?? {}) as Record<string, unknown>;
  const d = DEFAULT_STANDINGS_RULES;
  const margin = (v.margin ?? {}) as Record<string, unknown>;
  const combined = (v.combined ?? {}) as Record<string, unknown>;
  return {
    playerThreshold: num(v.playerThreshold, d.playerThreshold),
    atOrAbove: parseTuple(v.atOrAbove, d.atOrAbove),
    below: parseTuple(v.below, d.below),
    margin: {
      threshold: num(margin.threshold, d.margin.threshold),
      winnerBonus: num(margin.winnerBonus, d.margin.winnerBonus),
      loserPenalty: num(margin.loserPenalty, d.margin.loserPenalty),
    },
    combined: {
      halfWin: num(combined.halfWin, d.combined.halfWin),
      aggregateBonus: num(combined.aggregateBonus, d.combined.aggregateBonus),
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/klcsra/standings-rules.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/klcsra/standings-rules.ts src/lib/klcsra/standings-rules.test.ts
git commit -m "feat(klcsra): pure standings-rules config (tiers, margin, combined)"
```

---

## Task 6: Player payout compute (pure)

Two behaviours beyond a plain sum, both from spec v0.4:
- **Friendlies pay MMG only** — `includeKR: false` zeroes the KR component; MMG is credited as normal.
- **Disallowed keys are ignored** — pass `allowed` (from `statsForSport()`) and stats outside that list score nothing. `allowed` is a `StatKey[]` rather than a `Sport` so this module stays dependent only on `stat-rates.ts`.

**Files:**
- Create: `src/lib/klcsra/payouts.ts`
- Test: `src/lib/klcsra/payouts.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { computePlayerPayout } from "./payouts";
import { DEFAULT_STAT_RATES } from "./stat-rates";
import { statsForSport } from "./sport-stats";

describe("computePlayerPayout", () => {
  it("is zero for no stats", () => {
    expect(computePlayerPayout({}, DEFAULT_STAT_RATES)).toEqual({ kr: 0, mmg: 0 });
  });

  it("sums a goal + assist (the J. Karanth example)", () => {
    expect(computePlayerPayout({ goal: 1, assist: 1 }, DEFAULT_STAT_RATES))
      .toEqual({ kr: 30, mmg: 700 }); // 20+10 KR, 500+200 MMG
  });

  it("multiplies by the count (hat-trick)", () => {
    expect(computePlayerPayout({ goal: 3 }, DEFAULT_STAT_RATES))
      .toEqual({ kr: 60, mmg: 1500 });
  });

  it("applies negative stats (a yellow card deducts)", () => {
    expect(computePlayerPayout({ yellowCard: 1 }, DEFAULT_STAT_RATES))
      .toEqual({ kr: -10, mmg: -200 });
  });

  it("ignores unknown keys and zero counts", () => {
    expect(computePlayerPayout({ goal: 0, bogus: 5 } as never, DEFAULT_STAT_RATES))
      .toEqual({ kr: 0, mmg: 0 });
  });

  it("scores the Fooba stats", () => {
    expect(computePlayerPayout(
      { mainGoal: 1, reboundGoal: 1, switchover: 2 },
      DEFAULT_STAT_RATES,
    )).toEqual({ kr: 40, mmg: 1000 }); // 20+10+10 KR, 500+300+200 MMG
  });
});

describe("computePlayerPayout — friendlies (includeKR: false)", () => {
  it("zeroes KR when includeKR is false", () => {
    expect(computePlayerPayout(
      { goal: 1, assist: 1 },
      DEFAULT_STAT_RATES,
      { includeKR: false },
    )).toEqual({ kr: 0, mmg: 700 });
  });

  it("zeroes negative KR too", () => {
    expect(computePlayerPayout(
      { redCard: 1 },
      DEFAULT_STAT_RATES,
      { includeKR: false },
    )).toEqual({ kr: 0, mmg: -500 });
  });

  it("includeKR: true is the default", () => {
    expect(computePlayerPayout({ goal: 1 }, DEFAULT_STAT_RATES, {}))
      .toEqual({ kr: 20, mmg: 500 });
  });
});

describe("computePlayerPayout — sport allow-list", () => {
  it("ignores a stat the sport does not allow", () => {
    // `try` is rugby-only; on a football match it must score nothing.
    expect(computePlayerPayout(
      { goal: 1, try: 1 },
      DEFAULT_STAT_RATES,
      { allowed: statsForSport("football") },
    )).toEqual({ kr: 20, mmg: 500 });
  });

  it("ignores goal on a Fooba match (Fooba uses mainGoal/reboundGoal)", () => {
    expect(computePlayerPayout(
      { goal: 3, mainGoal: 1 },
      DEFAULT_STAT_RATES,
      { allowed: statsForSport("fooba") },
    )).toEqual({ kr: 20, mmg: 500 });
  });

  it("scores everything when no allow-list is given", () => {
    expect(computePlayerPayout({ goal: 1, try: 1 }, DEFAULT_STAT_RATES))
      .toEqual({ kr: 45, mmg: 1000 });
  });

  it("combines with includeKR", () => {
    expect(computePlayerPayout(
      { goal: 1, try: 1 },
      DEFAULT_STAT_RATES,
      { includeKR: false, allowed: statsForSport("football") },
    )).toEqual({ kr: 0, mmg: 500 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/klcsra/payouts.test.ts`
Expected: FAIL — cannot resolve `./payouts`.

- [ ] **Step 3: Write minimal implementation**

```typescript
import { STAT_KEYS, type StatKey, type StatRates } from "./stat-rates";

/** Per-stat event counts for one player (missing keys treated as 0). */
export type PlayerStatCounts = Partial<Record<StatKey, number>>;

/** A player's earned Kroopies (kr) and MMG points (mmg). */
export interface Payout {
  kr: number;
  mmg: number;
}

export interface PayoutOptions {
  /**
   * Friendlies pay MMG only. When false the returned `kr` is 0; `mmg` is
   * computed as normal. Defaults to true.
   */
  includeKR?: boolean;
  /**
   * Restrict scoring to this sport's allow-list (see `statsForSport`). Stats
   * outside it score nothing. Omit to score every known stat.
   */
  allowed?: readonly StatKey[];
}

/**
 * Pure. Sum count x rate across all known, allowed stats. Unknown keys are
 * ignored; so are keys the sport does not allow.
 */
export function computePlayerPayout(
  counts: PlayerStatCounts,
  rates: StatRates,
  opts: PayoutOptions = {},
): Payout {
  const { includeKR = true, allowed } = opts;
  const allowSet = allowed ? new Set<StatKey>(allowed) : null;

  let kr = 0;
  let mmg = 0;
  for (const key of STAT_KEYS) {
    if (allowSet && !allowSet.has(key)) continue;
    const n = counts[key];
    if (!n) continue;
    kr += n * rates[key].kr;
    mmg += n * rates[key].mmg;
  }
  return { kr: includeKR ? kr : 0, mmg };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/klcsra/payouts.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/klcsra/payouts.ts src/lib/klcsra/payouts.test.ts
git commit -m "feat(klcsra): pure per-player KR/MMG payout (friendly KR zeroing + sport allow-list)"
```

---

## Task 7: Rounding helper + standings points compute (pure)

Both `standings.ts` and `combined.ts` add fractional points (0.2, 0.05, 0.1) and hit binary-float noise — `0.2 + 0.1` is `0.30000000000000004`. One shared helper, not two copies.

**Files:**
- Create: `src/lib/klcsra/round.ts`
- Test: `src/lib/klcsra/round.test.ts`
- Create: `src/lib/klcsra/standings.ts`
- Test: `src/lib/klcsra/standings.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/klcsra/round.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { round4 } from "./round";

describe("round4", () => {
  it("clears binary-float noise", () => {
    expect(round4(0.2 + 0.1)).toBe(0.3);
    expect(round4(0.05 + 0.05)).toBe(0.1);
  });

  it("leaves clean numbers alone", () => {
    expect(round4(3)).toBe(3);
    expect(round4(-1)).toBe(-1);
    expect(round4(0)).toBe(0);
  });

  it("keeps four decimal places", () => {
    expect(round4(0.12345)).toBe(0.1235);
  });
});
```

`src/lib/klcsra/standings.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeStandingPoints } from "./standings";
import { DEFAULT_STANDINGS_RULES as R } from "./standings-rules";

describe("computeStandingPoints", () => {
  it("6+ players, home win 2-1 → 3 / 0", () => {
    expect(computeStandingPoints(2, 1, 6, R)).toEqual({ home: 3, away: 0 });
  });

  it("6+ players, draw → 1 / 1", () => {
    expect(computeStandingPoints(1, 1, 6, R)).toEqual({ home: 1, away: 1 });
  });

  it("fewer than 6 players, home win → 0.2 / 0", () => {
    expect(computeStandingPoints(2, 1, 5, R)).toEqual({ home: 0.2, away: 0 });
  });

  it("fewer than 6 players, draw → 0.05 each", () => {
    expect(computeStandingPoints(0, 0, 4, R)).toEqual({ home: 0.05, away: 0.05 });
  });

  it("margin ≥20 in the big tier → +1 winner, -1 loser", () => {
    expect(computeStandingPoints(25, 3, 6, R)).toEqual({ home: 4, away: -1 });
  });

  it("margin ≥20 in the small tier stacks on the fraction", () => {
    expect(computeStandingPoints(25, 3, 4, R)).toEqual({ home: 1.2, away: -1 });
  });

  it("a 19-point win does not trigger the margin bonus", () => {
    expect(computeStandingPoints(20, 1, 6, R)).toEqual({ home: 3, away: 0 });
  });

  it("an exactly-20 margin does trigger it", () => {
    expect(computeStandingPoints(21, 1, 6, R)).toEqual({ home: 4, away: -1 });
  });

  it("away win is symmetric", () => {
    expect(computeStandingPoints(1, 2, 6, R)).toEqual({ home: 0, away: 3 });
  });

  it("a big away win applies the margin the other way", () => {
    expect(computeStandingPoints(3, 25, 6, R)).toEqual({ home: -1, away: 4 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/lib/klcsra/round.test.ts src/lib/klcsra/standings.test.ts`
Expected: FAIL — cannot resolve `./round` / `./standings`.

- [ ] **Step 3: Write minimal implementations**

`src/lib/klcsra/round.ts`:

```typescript
/**
 * Standings points are fractional (0.2 half-wins, 0.05 draws, 0.1 aggregate
 * bonuses) so sums pick up binary-float noise: 0.2 + 0.1 is
 * 0.30000000000000004. Four decimal places is far more precision than any
 * configured rule uses, and it renders cleanly.
 */
export function round4(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}
```

`src/lib/klcsra/standings.ts`:

```typescript
import { round4 } from "./round";
import type { PointsTuple, StandingsRules } from "./standings-rules";

/**
 * Pure. League points for both sides of ONE match result.
 * Base points come from the size tier (total players in the match); the ≥margin
 * bonus/penalty is then added to the winner/loser. A draw earns no margin.
 *
 * Friendlies never reach here — spec §Standings excludes them from standings
 * entirely, so the caller filters on `is_friendly = false`.
 */
export function computeStandingPoints(
  homeScore: number,
  awayScore: number,
  totalPlayers: number,
  rules: StandingsRules,
): { home: number; away: number } {
  const tier: PointsTuple =
    totalPlayers >= rules.playerThreshold ? rules.atOrAbove : rules.below;

  let home: number;
  let away: number;
  if (homeScore > awayScore) {
    home = tier.win;
    away = tier.loss;
  } else if (homeScore < awayScore) {
    home = tier.loss;
    away = tier.win;
  } else {
    home = tier.draw;
    away = tier.draw;
  }

  const margin = Math.abs(homeScore - awayScore);
  if (homeScore !== awayScore && margin >= rules.margin.threshold) {
    if (homeScore > awayScore) {
      home += rules.margin.winnerBonus;
      away += rules.margin.loserPenalty;
    } else {
      away += rules.margin.winnerBonus;
      home += rules.margin.loserPenalty;
    }
  }

  return { home: round4(home), away: round4(away) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/lib/klcsra/round.test.ts src/lib/klcsra/standings.test.ts`
Expected: PASS (3 + 10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/klcsra/round.ts src/lib/klcsra/round.test.ts src/lib/klcsra/standings.ts src/lib/klcsra/standings.test.ts
git commit -m "feat(klcsra): pure standings-points compute (size tiers + margin bonus)"
```

---

## Task 8: Combined two-half match points (pure)

**Files:**
- Create: `src/lib/klcsra/combined.ts`
- Test: `src/lib/klcsra/combined.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { computeCombinedPoints, type HalfResult } from "./combined";
import { DEFAULT_STANDINGS_RULES as R } from "./standings-rules";

describe("computeCombinedPoints", () => {
  it("matches the KFANDRA worked example (KL 0.3, BOCI 0.1, SOG 0.2, DP 0)", () => {
    // Home group across halves = KL + BOCI; away group = DP + SOG.
    // H1: KL(home) 3 - 1 DP(away)  → KL wins half.
    // H2: BOCI(home) 1 - 2 SOG(away) → SOG wins half.
    // Aggregate: home 3+1=4 vs away 1+2=3 → home group (KL+BOCI) win aggregate.
    const halves: HalfResult[] = [
      { homeClubId: "KL", awayClubId: "DP", homeScore: 3, awayScore: 1 },
      { homeClubId: "BOCI", awayClubId: "SOG", homeScore: 1, awayScore: 2 },
    ];
    expect(computeCombinedPoints(halves, R)).toEqual({
      KL: 0.3, BOCI: 0.1, SOG: 0.2, DP: 0,
    });
  });

  it("awards nothing extra on a drawn aggregate", () => {
    // H1: KL 1-0 DP (KL half win). H2: SOG 1-0 BOCI (SOG half win).
    // Aggregate home 1+0=1 vs away 0+1=1 → draw, no bonus.
    const halves: HalfResult[] = [
      { homeClubId: "KL", awayClubId: "DP", homeScore: 1, awayScore: 0 },
      { homeClubId: "BOCI", awayClubId: "SOG", homeScore: 0, awayScore: 1 },
    ];
    expect(computeCombinedPoints(halves, R)).toEqual({
      KL: 0.2, SOG: 0.2, BOCI: 0, DP: 0,
    });
  });

  it("a drawn half awards no half-win points", () => {
    const halves: HalfResult[] = [
      { homeClubId: "KL", awayClubId: "DP", homeScore: 2, awayScore: 2 },
      { homeClubId: "BOCI", awayClubId: "SOG", homeScore: 3, awayScore: 0 },
    ];
    // H1 draw → no half points. H2 BOCI win → BOCI 0.2.
    // Aggregate home 2+3=5 vs away 2+0=2 → home group win → KL+BOCI +0.1.
    expect(computeCombinedPoints(halves, R)).toEqual({
      BOCI: 0.3, KL: 0.1, DP: 0, SOG: 0,
    });
  });

  it("handles a single half (degenerate case)", () => {
    const halves: HalfResult[] = [
      { homeClubId: "KL", awayClubId: "DP", homeScore: 2, awayScore: 1 },
    ];
    // KL wins the half (0.2) and the aggregate (0.1).
    expect(computeCombinedPoints(halves, R)).toEqual({ KL: 0.3, DP: 0 });
  });

  it("returns an empty map for no halves", () => {
    expect(computeCombinedPoints([], R)).toEqual({});
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/klcsra/combined.test.ts`
Expected: FAIL — cannot resolve `./combined`.

- [ ] **Step 3: Write minimal implementation**

```typescript
import { round4 } from "./round";
import type { StandingsRules } from "./standings-rules";

/** One half of a combined match: a normal 1-v-1 with its own clubs & scores. */
export interface HalfResult {
  homeClubId: string;
  awayClubId: string;
  homeScore: number;
  awayScore: number;
}

/**
 * Pure. League points per club for a combined (two-half) match.
 *  - Each half: the winning club gets `combined.halfWin` (draw → nothing).
 *  - Aggregate: sum of home scores vs sum of away scores across halves; the
 *    winning side's clubs (all "home" clubs, or all "away" clubs) each get
 *    `combined.aggregateBonus` (draw → nothing).
 *
 * "home"/"away" here are the AGGREGATE-TEAM SLOTS from klc_match_sides.side,
 * not the venue role — the home sides across both halves form one aggregate
 * team, the away sides the other.
 *
 * Returns a map of clubId → total points (every club that appears is present).
 */
export function computeCombinedPoints(
  halves: HalfResult[],
  rules: StandingsRules,
): Record<string, number> {
  const points: Record<string, number> = {};
  const add = (clubId: string, n: number) => {
    points[clubId] = (points[clubId] ?? 0) + n;
  };

  let homeAgg = 0;
  let awayAgg = 0;
  const homeClubs: string[] = [];
  const awayClubs: string[] = [];

  for (const h of halves) {
    add(h.homeClubId, 0); // ensure every club is present in the result
    add(h.awayClubId, 0);
    homeClubs.push(h.homeClubId);
    awayClubs.push(h.awayClubId);
    homeAgg += h.homeScore;
    awayAgg += h.awayScore;

    if (h.homeScore > h.awayScore) add(h.homeClubId, rules.combined.halfWin);
    else if (h.awayScore > h.homeScore) add(h.awayClubId, rules.combined.halfWin);
  }

  if (homeAgg > awayAgg) for (const c of homeClubs) add(c, rules.combined.aggregateBonus);
  else if (awayAgg > homeAgg) for (const c of awayClubs) add(c, rules.combined.aggregateBonus);

  for (const k of Object.keys(points)) points[k] = round4(points[k]);
  return points;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/klcsra/combined.test.ts`
Expected: PASS (5 tests). `round4` turns `0.2 + 0.1` into a clean `0.3`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/klcsra/combined.ts src/lib/klcsra/combined.test.ts
git commit -m "feat(klcsra): pure combined two-half match points compute"
```

---

## Task 9: Config loaders (server-only)

**Files:**
- Create: `src/lib/klcsra/config.ts`

*(No unit test: this is a thin `server-only` DB reader mirroring `src/lib/klc/config.ts`, which likewise has no unit test. It is exercised by the Phase 2 repository tests.)*

- [ ] **Step 1: Write the implementation**

```typescript
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseStatRates, type StatRates } from "./stat-rates";
import { parseSportStats, type SportStats } from "./sport-stats";
import { parseStandingsRules, type StandingsRules } from "./standings-rules";

export type { StatRates } from "./stat-rates";
export type { SportStats, Sport } from "./sport-stats";
export type { StandingsRules } from "./standings-rules";
export { DEFAULT_STAT_RATES } from "./stat-rates";
export { DEFAULT_SPORT_STATS, statsForSport } from "./sport-stats";
export { DEFAULT_STANDINGS_RULES } from "./standings-rules";

async function loadConfigValue(key: string): Promise<unknown> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_config")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? null;
}

/** Load per-stat KR/MMG rates from app_config (key 'klcsra_stat_rates'). */
export async function loadStatRates(): Promise<StatRates> {
  return parseStatRates(await loadConfigValue("klcsra_stat_rates"));
}

/** Load the per-sport stat allow-list from app_config (key 'klcsra_sport_stats'). */
export async function loadSportStats(): Promise<SportStats> {
  return parseSportStats(await loadConfigValue("klcsra_sport_stats"));
}

/** Load standings rules from app_config (key 'klcsra_standings_rules'). */
export async function loadStandingsRules(): Promise<StandingsRules> {
  return parseStandingsRules(await loadConfigValue("klcsra_standings_rules"));
}
```

- [ ] **Step 2: Verify it type-checks and the suite is green**

Run: `npm run test -- src/lib/klcsra` then `npx tsc --noEmit`
Expected: all KLCSRA tests PASS; `tsc` reports no errors. (`@/lib/supabase/admin` exports `createAdminClient` — verified; it is the same import `src/lib/klc/config.ts` uses.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/klcsra/config.ts
git commit -m "feat(klcsra): server-only config loaders for stat rates, sport stats + standings rules"
```

---

## Task 10: Regenerate Supabase types

The repo keeps `src/lib/supabase/database.types.ts` exactly in sync with the migrations (verified: the only table in migrations but not in the types file is `label_overrides`, which was dropped). All three Supabase clients are generic over `Database`, so Phase 2 cannot query the new tables until this runs.

- [ ] **Step 1: Regenerate**

Run: `npx supabase gen types typescript --local > src/lib/supabase/database.types.ts`

- [ ] **Step 2: Verify the new tables and columns landed**

```bash
grep -c "klc_seasons\|klc_matches\|klc_match_halves\|klc_match_sides\|klc_appearances\|klc_player_stats" src/lib/supabase/database.types.ts
grep -n "results_source" src/lib/supabase/database.types.ts
npx tsc --noEmit
```
Expected: the grep count is non-zero, `results_source` appears under `club_balance_sheets`, and `tsc` is clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/database.types.ts
git commit -m "chore(klcsra): regenerate Supabase types for KLCSRA tables + sheet source tags"
```

---

## Task 11: Full Phase 1 verification

- [ ] **Step 1: Run the whole KLCSRA suite**

Run: `npm run test -- src/lib/klcsra`
Expected: all Task 3–8 tests PASS — `stat-rates` (6), `sport-stats` (15), `standings-rules` (4), `payouts` (13), `round` (3), `standings` (10), `combined` (5).

- [ ] **Step 2: Run the full suite (no regressions elsewhere)**

Run: `npm run test`
Expected: green. Task 2 altered shipped balance-sheet tables, so `src/lib/klc/**` tests matter here.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no type errors; lint clean.

- [ ] **Step 4: Confirm both migrations apply from clean**

Run: `npx supabase db reset`
Expected: clean apply through `20260815120000_klcsra_core.sql` and `20260815120100_klc_sheet_source_tags.sql`.

- [ ] **Step 5: File the deferred-work beads**

```bash
bd create "KLCSRA Phase 5: reconcile KR vs share units on club_player_shares.amount" \
  -d "club_player_shares.amount is a share count multiplied by klc_rates.loaneePerShare (=10), but spec v0.4 says the recorder writes FINAL KR into the loanee amount. Writing KR straight into amount would 10x it in item 10. Decide before Phase 5 write-back: store KR/loaneePerShare, add a separate kr_amount column, or set loaneePerShare=1 for match-sourced rows. The source column already exists (migration 20260815120100)."
bd create "KLCSRA Phase 3: derive 'club registered players' from appearance history" \
  -d "Spec's slot picker shows 'the club's registered players first'. There is no club roster table by design — only the manager is assigned to a club for a season; all other players attach per-game via klc_appearances. Phase 3 must derive the suggested list from prior klc_appearances for that club (e.g. most recent / most frequent), with a 'Show all members' toggle."
```

- [ ] **Step 6: Update the bead**

```bash
bd update Helper-bsr --notes="Phase 1 done: schema (klc_seasons/matches/halves/sides/appearances/player_stats) + RLS + seeded app_config rules (stat rates 16, sport allow-list, standings rules) + Season 1 (upcoming); balance-sheet source tags migration; pure domain (stat-rates, sport-stats, standings-rules, payouts with friendly KR zeroing + allow-list filtering, round4, standings tiers+margin, combined two-half) with tests; server config loaders; regenerated Supabase types. Next: Phase 2 (repository + actions + season lifecycle + submit/lock)."
```

---

## Self-Review

**1. Spec coverage (Phase 1 scope only):**
- Data model for seasons/matches/halves/sides/appearances/stats → Task 1. ✓
- Seasons with one-active invariant + friendly/season exclusivity → Task 1. ✓
- Balance-sheet `source` tag schema (write-back prerequisite) → Task 2. ✓
- Per-stat KR+MMG payout table (16 stats incl. Fooba) + parse → Tasks 3, 6. ✓
- Sport allow-list config + `statsForSport` + payout filtering → Tasks 4, 6. ✓
- Friendlies pay MMG only → Task 6 (`includeKR: false`). Standings exclusion is a query-layer filter, correctly out of Phase 1. ✓
- Size-tiered standings (≥6 → 3/1/0, <6 → 0.2/0.05/0) + ≥20 margin ±1 → Tasks 5, 7. ✓
- Combined two-half scoring (0.2 half-win + 0.1 aggregate) with the worked example → Task 8. ✓
- Rules externalised in `app_config` + server loaders → Tasks 1, 9. ✓
- Types in sync → Task 10. ✓
- Out of Phase 1 scope (later phases): season lifecycle actions, recorder UI, stats popup, Submit/lock enforcement, report text, season aggregation across matches, balance-sheet write-back logic, KFANDRA-only reopen.

**2. Placeholder scan:** No TBD/TODO; every code step shows complete code; every test step shows real assertions with the agreed numbers. ✓

**3. Type consistency:** `StatKey`/`StatRates` (Task 3) are consumed unchanged by `sport-stats.ts` (Task 4), `payouts.ts` (Task 6) and `config.ts` (Task 9). `Sport`/`SportStats` (Task 4) are consumed by `config.ts`. `PointsTuple`/`StandingsRules` (Task 5) are consumed by `standings.ts` (Task 7), `combined.ts` (Task 8) and `config.ts`. `round4` (Task 7) is consumed by `standings.ts` and `combined.ts`. `computePlayerPayout(counts, rates, opts?)`, `computeStandingPoints(homeScore, awayScore, totalPlayers, rules)` and `computeCombinedPoints(halves, rules)` signatures match their tests. `HalfResult` fields are identical in `combined.ts` and its test. ✓

**4. Config/code key parity:** the 16 keys seeded in `klcsra_stat_rates` and the four arrays in `klcsra_sport_stats` (Task 1) are camelCase and match `StatKey` exactly. The spec writes them PascalCase for readability — do **not** transcribe the spec's casing. ✓

**5. Task ordering:** Task 1 before Task 2 (both migrations, timestamp order). Task 3 before Task 4 (sport-stats imports StatKey) and before Task 6. Task 5 before Tasks 7, 8. Task 7 before Task 8 (`round4`). Tasks 1–9 before Task 10 (types reflect migrations). ✓
