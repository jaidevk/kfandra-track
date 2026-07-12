-- ============================================================================
-- 20260712120100 — S&C Tests: catalog columns + seed, test-entry columns
-- ----------------------------------------------------------------------------
-- Adds fitness tests (Bronco, Bleep, the 1-minute tests) to the gym flow.
-- "S and C Tests" is a new body-part option that flips the entry sheet into
-- test mode: the Equipment picker becomes a Test picker and the Sets section
-- becomes TIME TAKEN (time metric) or REPS (reps metric). Still unscored.
--
-- All test data lives in the admin-editable gym_catalog, so names/emojis can
-- be tuned later without a deploy.
-- ============================================================================

-- ─── Catalog: tests carry a metric + optional spelled-out name ───────────────
alter table public.gym_catalog
  add column if not exists metric text check (metric in ('time', 'reps')),
  add column if not exists full_name text;

comment on column public.gym_catalog.metric is
  'Tests only: time (mins/seconds, e.g. Bronco) or reps (count in 60s).';
comment on column public.gym_catalog.full_name is
  'Tests only: spelled-out name shown under the (often acronym) label.';

-- ─── gym_log_exercises: a row is an exercise (default) or an S&C test ─────────
alter table public.gym_log_exercises
  add column if not exists entry_type text not null default 'exercise'
    check (entry_type in ('exercise', 'test')),
  add column if not exists test_name text,
  add column if not exists test_metric text check (test_metric in ('time', 'reps'));

comment on column public.gym_log_exercises.entry_type is
  'exercise (body part + equipment + sets) or test (S&C test + attempts).';

-- ─── New body-part option that flips the sheet into test mode ────────────────
insert into public.gym_catalog (kind, value, icon, sort_order) values
  ('body_part', 'S and C Tests', '🎯', 24)
on conflict (kind, value) do nothing;

-- ─── Tests ───────────────────────────────────────────────────────────────────
-- metric=time → Bronco/Bleep (TIME TAKEN); metric=reps → 1-minute tests.
-- full_name is the option-C subtitle; where it repeats the label it is an
-- editable placeholder pending the real name from the coach's catalog sheet.
insert into public.gym_catalog (kind, value, metric, icon, full_name, sort_order) values
  ('test', 'Bronco Test',        'time', '🏃', null,               1),
  ('test', 'KFANDRA Bleep Test', 'time', '🔊', null,               2),
  ('test', 'Press ups',          'reps', '📐', null,               3),
  ('test', 'PUJ',                'reps', '💥', 'PUJ',              4),
  ('test', 'KSAV (Football)',    'reps', '⚽', 'KSAV (Football)',  5),
  ('test', 'KSAV (Normal)',      'reps', '🧱', 'KSAV (Normal)',    6),
  ('test', 'Calf jumps',         'reps', '🦵', null,               7),
  ('test', 'CJF',                'reps', '🦵', 'CJF',              8),
  ('test', 'CJR',                'reps', '🦵', 'CJR',              9),
  ('test', 'Free Squats',        'reps', '🪑', null,              10),
  ('test', 'Free Squat jumps',   'reps', '🪑', null,              11),
  ('test', 'FSJF',               'reps', '🪑', 'FSJF',            12),
  ('test', 'FSJR',               'reps', '🪑', 'FSJR',            13),
  ('test', 'Zor',                'reps', '🤸', null,              14),
  ('test', 'Rev. Zor',           'reps', '🤸', 'Reverse Zor',     15)
on conflict (kind, value) do nothing;
