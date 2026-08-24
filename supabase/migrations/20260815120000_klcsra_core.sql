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
  -- matches are unaffected -- half 2 has its own half_id, so a club may still
  -- reappear in the other half. (The spec neither requires nor forbids that
  -- reuse; permitting it is the non-destructive direction.)
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
  -- Two notes for Phase 2:
  --   * a deferrable constraint cannot be an ON CONFLICT target, so upserts
  --     must conflict on (side_id, player_id), which is immediate;
  --   * deferral only helps INSIDE an explicit transaction. Two separate
  --     PostgREST calls each commit, so a slot reorder must run in a
  --     server-side transaction/RPC, or park at a high free slot (99) --
  --     parking at a negative slot is rejected by klc_appearances_slot_chk.
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
  -- tally would invert the payout -- stat_count = -1 on redCard would PAY the
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
