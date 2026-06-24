-- ============================================================================
-- 20260624120000 — Gym: per-set reps & weight
-- ----------------------------------------------------------------------------
-- Each exercise now records what was actually done per set. Stored as JSONB:
--   [{ "reps": 14, "weight": 10 }, { "reps": 8, "weight": 15 }, ...]
-- weight is 0 for no-weight movements. The existing `scheme` column is reused
-- to hold a generated human summary so admin/Sheets readers keep working; the
-- legacy `weight` column is left in place (nullable) but no longer written.
-- ============================================================================

alter table public.gym_log_exercises
  add column sets jsonb not null default '[]'::jsonb;

comment on column public.gym_log_exercises.sets is
  'Per-set reps & weight: [{"reps":14,"weight":10}, ...]. weight 0 for no-weight movements.';
