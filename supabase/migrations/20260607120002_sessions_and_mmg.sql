-- ============================================================================
-- 20260607120002 — Sessions, game/point config & MMG entries
-- ----------------------------------------------------------------------------
-- The MMG (Monthly Multi-Games) domain:
--   * sessions     — pre-defined Tue/Thu/Sat dates (carry month + year)
--   * game_types   — admin-editable catalogue (football short, rugby, fooba…)
--   * point_rules  — admin-editable point values (seeded later by Helper-pr9)
--   * mmg_entries  — ONE continuous-log row per (player, session). Autosaved,
--                    no submit/approval/status columns by design.
--   * submission_games + submission_game_stats (EAV) — per-game performance
--   * submission_others — free-form "other" point rows
--
-- Order-of-arrival / confirmation points are computed by the engine (Helper-cve)
-- from confirmation_order + arrival_order; we store the self-reported ranks here.
-- ============================================================================

-- ─── Sessions ───────────────────────────────────────────────────────────────
create type app.weekday as enum ('Tue', 'Thu', 'Sat');

create table public.sessions (
  id           uuid primary key default gen_random_uuid(),
  session_date date not null unique,
  day_of_week  app.weekday not null,
  month        smallint not null check (month between 1 and 12),
  year         smallint not null check (year between 2000 and 2100),
  label        text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

comment on table public.sessions is
  'Pre-defined training sessions (Tue/Thu/Sat). month+year denormalised for fast period rollups.';

create index sessions_period_idx on public.sessions (year, month);

-- ─── Game types (admin-editable catalogue) ──────────────────────────────────
create table public.game_types (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique,
  name       text not null,
  emoji      text,
  sort_order smallint not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.game_types is
  'Game variants (football-short, rugby-full, fooba-big-goal…). Editable by staff.';

create trigger game_types_set_updated_at
  before update on public.game_types
  for each row execute function app.set_updated_at();

-- ─── Point rules (admin-editable; seeded by Helper-pr9) ─────────────────────
-- scope classifies what the rule governs so the engine can look it up:
--   'participation' (packing, confirm-by-11am…), 'result' (won/drew/lost),
--   'stat' (goals, tries, cards…), 'order' (per-rank base), 'other'.
create type app.point_scope as enum ('participation', 'result', 'stat', 'order', 'other');

create table public.point_rules (
  id           uuid primary key default gen_random_uuid(),
  scope        app.point_scope not null,
  rule_key     text not null,
  label        text not null,
  points       integer not null,
  -- Optional override: when set, the rule applies only to this game type.
  game_type_id uuid references public.game_types(id) on delete cascade,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- One value per (scope, rule_key, game_type). NULL game_type = the default.
  unique nulls not distinct (scope, rule_key, game_type_id)
);

comment on table public.point_rules is
  'Configurable point values. game_type_id NULL = default; set = per-game override.';

create trigger point_rules_set_updated_at
  before update on public.point_rules
  for each row execute function app.set_updated_at();

-- ─── MMG entries (continuous log: one per player/session) ───────────────────
create table public.mmg_entries (
  id                 uuid primary key default gen_random_uuid(),
  player_id          uuid not null references public.players(id) on delete cascade,
  session_id         uuid not null references public.sessions(id) on delete cascade,
  -- Participation (self-reported ranks; points derived by the order engine)
  confirmation_order smallint check (confirmation_order >= 1),
  arrival_order      smallint check (arrival_order >= 1),
  unpacking          boolean,
  packing_weights    boolean,
  packing_kit        boolean,        -- training material / PTM
  confirmed_by_11am  boolean,
  -- Narration
  narration          text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (player_id, session_id)
);

comment on table public.mmg_entries is
  'Continuous-log MMG entry, one per (player, session). Autosaved; no submit/status columns.';

create index mmg_entries_session_idx on public.mmg_entries (session_id);

create trigger mmg_entries_set_updated_at
  before update on public.mmg_entries
  for each row execute function app.set_updated_at();

-- ─── Submission games (per game played within an MMG entry) ─────────────────
create type app.game_result as enum ('won', 'drew', 'lost');

create table public.submission_games (
  id           uuid primary key default gen_random_uuid(),
  mmg_entry_id uuid not null references public.mmg_entries(id) on delete cascade,
  game_type_id uuid references public.game_types(id) on delete set null,
  result       app.game_result,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now()
);

create index submission_games_entry_idx on public.submission_games (mmg_entry_id);

-- ─── Game stats (EAV — goals, tries, assists, cards…) ───────────────────────
create table public.submission_game_stats (
  id                 uuid primary key default gen_random_uuid(),
  submission_game_id uuid not null references public.submission_games(id) on delete cascade,
  stat_key           text not null,       -- matches mockup StatKey (goals, tries, yellowCards…)
  stat_value         integer not null default 0,
  unique (submission_game_id, stat_key)
);

comment on table public.submission_game_stats is
  'EAV per-game stat counts keyed by stat_key; point value resolved via point_rules.';

-- ─── Other point rows (free-form) ───────────────────────────────────────────
create table public.submission_others (
  id           uuid primary key default gen_random_uuid(),
  mmg_entry_id uuid not null references public.mmg_entries(id) on delete cascade,
  description  text not null,
  points       integer not null default 0,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now()
);

create index submission_others_entry_idx on public.submission_others (mmg_entry_id);
