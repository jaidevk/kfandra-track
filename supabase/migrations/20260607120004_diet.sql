-- ============================================================================
-- 20260607120004 — Diet mode (continuous daily log)
-- ----------------------------------------------------------------------------
--   * meal_slots     — 8 time-windowed slots (Midnight Snack … Post-Supper)
--   * food_catalog   — bilingual seed catalogue (grains, dals, proteins…)
--   * diet_logs      — one continuous-log row per (player, log_date)
--   * diet_log_meals — per-slot status within a day (supports "skipped")
--   * diet_log_items — logged foods (catalogue item or custom free-form)
--
-- A skipped meal is a diet_log_meals row with skipped = true and no items,
-- which is distinct from a slot the player simply hasn't logged yet.
-- ============================================================================

-- ─── Meal slots ─────────────────────────────────────────────────────────────
create table public.meal_slots (
  id           uuid primary key default gen_random_uuid(),
  key          text not null unique,
  name         text not null,
  window_label text not null,      -- e.g. "6 am – 9 am"
  emoji        text,
  start_min    smallint not null check (start_min between 0 and 1439),
  end_min      smallint not null,  -- may exceed 1440 when wrapping past midnight
  sort_order   smallint not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

comment on table public.meal_slots is
  'Time-windowed meal slots. end_min may exceed 1440 to wrap past midnight.';

-- ─── Food catalogue (staff-editable; seeded by Helper-dwx) ──────────────────
create table public.food_catalog (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,
  name          text not null,
  emoji         text,
  unit          text not null,      -- e.g. "1 slice", "1 waati"
  unit_detail   text,               -- e.g. "200 ml", "150 g"
  section_label text not null,      -- e.g. "Grains & Bread"
  sort_order    smallint not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.food_catalog is
  'Seed food list grouped by section_label. Staff can prune/extend.';

create trigger food_catalog_set_updated_at
  before update on public.food_catalog
  for each row execute function app.set_updated_at();

-- ─── Diet logs (continuous: one per player/day) ─────────────────────────────
create table public.diet_logs (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  log_date   date not null,
  narration  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (player_id, log_date)
);

comment on table public.diet_logs is
  'Continuous-log diet day, one per (player, log_date).';

create index diet_logs_player_idx on public.diet_logs (player_id, log_date);

create trigger diet_logs_set_updated_at
  before update on public.diet_logs
  for each row execute function app.set_updated_at();

-- ─── Per-slot status (holds the "skipped" flag) ─────────────────────────────
create table public.diet_log_meals (
  id           uuid primary key default gen_random_uuid(),
  diet_log_id  uuid not null references public.diet_logs(id) on delete cascade,
  meal_slot_id uuid not null references public.meal_slots(id) on delete cascade,
  skipped      boolean not null default false,
  created_at   timestamptz not null default now(),
  unique (diet_log_id, meal_slot_id)
);

create index diet_log_meals_log_idx on public.diet_log_meals (diet_log_id);

-- ─── Logged food items ──────────────────────────────────────────────────────
create table public.diet_log_items (
  id                uuid primary key default gen_random_uuid(),
  diet_log_meal_id  uuid not null references public.diet_log_meals(id) on delete cascade,
  -- NULL food_item_id = custom free-form entry (use custom_* fields)
  food_item_id      uuid references public.food_catalog(id) on delete set null,
  custom_name       text,
  custom_unit       text,
  custom_notes      text,
  count             numeric(6,2) not null default 1 check (count > 0),
  sort_order        smallint not null default 0,
  created_at        timestamptz not null default now(),
  -- Either a catalogue item or a custom name must be present.
  check (food_item_id is not null or custom_name is not null)
);

create index diet_log_items_meal_idx on public.diet_log_items (diet_log_meal_id);
