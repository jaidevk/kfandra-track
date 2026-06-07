-- ============================================================================
-- 20260607120003 — Gym mode (no points; performance tracking only)
-- ----------------------------------------------------------------------------
--   * gym_catalog       — reference lists (body parts, equipment, scheme presets)
--   * gym_logs          — one continuous-log row per (player, log_date)
--   * gym_log_exercises — the exercise rows within a gym log
--
-- Gym logging is explicitly NOT tied to MMG points — it tracks player
-- performance only.
-- ============================================================================

-- ─── Reference catalogue (body parts / equipment / schemes) ─────────────────
create type app.gym_catalog_kind as enum ('body_part', 'equipment', 'scheme');

create table public.gym_catalog (
  id         uuid primary key default gen_random_uuid(),
  kind       app.gym_catalog_kind not null,
  value      text not null,
  icon       text,
  -- equipment only: whether a weight applies (resistance bands / none = false)
  supports_weight boolean not null default true,
  sort_order smallint not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (kind, value)
);

comment on table public.gym_catalog is
  'Reference data for gym entry dropdowns: body parts, equipment, preset schemes.';

-- ─── Gym logs (continuous: one per player/day) ──────────────────────────────
create type app.weight_unit as enum ('kg', 'lb');

create table public.gym_logs (
  id                uuid primary key default gen_random_uuid(),
  player_id         uuid not null references public.players(id) on delete cascade,
  log_date          date not null,
  body_weight       numeric(5,2),
  body_weight_unit  app.weight_unit not null default 'kg',
  narration         text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (player_id, log_date)
);

comment on table public.gym_logs is
  'Continuous-log gym session, one per (player, log_date). No points.';

create index gym_logs_player_idx on public.gym_logs (player_id, log_date);

create trigger gym_logs_set_updated_at
  before update on public.gym_logs
  for each row execute function app.set_updated_at();

-- ─── Gym exercise rows ──────────────────────────────────────────────────────
create table public.gym_log_exercises (
  id           uuid primary key default gen_random_uuid(),
  gym_log_id   uuid not null references public.gym_logs(id) on delete cascade,
  body_part    text not null,
  equipment    text,
  weight       numeric(6,2),       -- NULL/0 when equipment carries no weight
  weight_unit  app.weight_unit not null default 'kg',
  scheme       text,               -- preset or custom set/rep scheme string
  notes        text,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now()
);

create index gym_log_exercises_log_idx on public.gym_log_exercises (gym_log_id);
