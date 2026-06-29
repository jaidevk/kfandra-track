-- ============================================================================
-- 20260629120000 — Personal "My foods" list
-- ----------------------------------------------------------------------------
-- A per-player palette of their own custom foods so anything logged once is one
-- tap away next time. Capped at 8 rows per player in the repository (least-used
-- eviction). This is a reusable palette only: the diet log itself keeps storing
-- the custom name/unit inline in diet_log_items, so old logs stay immutable.
-- The curated shared food_catalog is untouched.
-- ============================================================================

create table public.player_food_items (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.players(id) on delete cascade,
  name         text not null,
  unit         text,
  notes        text,
  use_count    integer not null default 1,
  last_used_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

comment on table public.player_food_items is
  'Per-player palette of custom foods for one-tap re-logging. Capped at 8 per '
  'player via least-used eviction in the repository.';

create index player_food_items_player_idx
  on public.player_food_items (player_id);

-- Dedup: re-adding the same (case-insensitive) name+unit bumps the existing
-- row rather than inserting a duplicate. Integrity backstop for the
-- find-or-create logic in the repository.
create unique index player_food_items_dedup
  on public.player_food_items (player_id, lower(name), coalesce(lower(unit), ''));

-- ─── RLS: owner CRUD own; staff read all (mirrors diet_logs) ────────────────
alter table public.player_food_items enable row level security;

create policy player_food_items_rw_owner on public.player_food_items
  for all to authenticated
  using (player_id = app.current_player_id())
  with check (player_id = app.current_player_id());

create policy player_food_items_select_staff on public.player_food_items
  for select to authenticated using (app.is_staff());
