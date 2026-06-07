-- ============================================================================
-- 20260607120007 — Seed gym catalog (body parts / equipment / set·rep schemes)
-- ----------------------------------------------------------------------------
-- Reference data for the Gym entry dropdowns. Source: Jaidev's GWW/GWtW
-- routines sheet, expanded with KFANDRA round-2 feedback (Back, Forearms,
-- Hamstrings, Glutes, Pecs, Stamina, Plank/Upper-body/Lower-body Variations) —
-- mirrors src/app/mockups/gym-session.
--
-- Gym logging carries NO points; this catalogue is purely descriptive and is
-- admin-editable at runtime via the gym_catalog table. This migration only
-- establishes the starting point.
--
-- gym_catalog.kind:
--   body_part — movement / muscle group (icon shown in the picker)
--   equipment — kit used; supports_weight=false means no weight field
--   scheme    — preset set/rep scheme string (player may also type a custom one)
-- ============================================================================

-- ─── Body parts / movements (icons mirror the mockup) ───────────────────────
insert into public.gym_catalog (kind, value, icon, sort_order) values
  ('body_part', 'Shoulders',              '💪',  1),
  ('body_part', 'Biceps',                 '💪',  2),
  ('body_part', 'Triceps',                '💪',  3),
  ('body_part', 'Chest/Pecs',             '🫀',  4),
  ('body_part', 'Back',                   '🧍',  5),
  ('body_part', 'Forearms',               '🤜',  6),
  ('body_part', 'Thighs',                 '🦵',  7),
  ('body_part', 'Hamstrings',             '🦵',  8),
  ('body_part', 'Glutes',                 '🍑',  9),
  ('body_part', 'Calves',                 '🦵', 10),
  ('body_part', 'Abs',                    '🧱', 11),
  ('body_part', 'Press Ups',              '📐', 12),
  ('body_part', 'Reverse Zor',            '↩️', 13),
  ('body_part', 'Zor',                    '↪️', 14),
  ('body_part', 'Baithaks',               '🪑', 15),
  ('body_part', 'Lunges',                 '🚶', 16),
  ('body_part', 'Full Burpees',           '🔥', 17),
  ('body_part', 'Half Burpees',           '🔥', 18),
  ('body_part', 'Sumo Walk',              '🦍', 19),
  ('body_part', 'Stamina',                '🏃', 20),
  ('body_part', 'Plank Variations',       '🪵', 21),
  ('body_part', 'Upper Body Variations',  '🙆', 22),
  ('body_part', 'Lower Body Variations',  '🦿', 23);

-- ─── Equipment (supports_weight=false → no weight field in the picker) ───────
insert into public.gym_catalog (kind, value, supports_weight, sort_order) values
  ('equipment', 'Lbb',              true,  1),
  ('equipment', 'Sbb',              true,  2),
  ('equipment', 'Z-bar',            true,  3),
  ('equipment', 'Dumbbells',        true,  4),
  ('equipment', 'T-Bar',            true,  5),
  ('equipment', 'Dead-Lift',        true,  6),
  ('equipment', 'Weight plates',    true,  7),
  ('equipment', 'Resistance bands', false, 8),
  ('equipment', 'None',             false, 9);

-- ─── Preset set/rep schemes (player may also enter a custom string) ──────────
insert into public.gym_catalog (kind, value, sort_order) values
  ('scheme', '6 sets, 8, 4×6, 8',    1),
  ('scheme', '6 sets, 12, 4×8, 12',  2),
  ('scheme', '6 sets, 14, 4×8, 12',  3),
  ('scheme', '6 sets, All 6',        4),
  ('scheme', '4 sets, super 4''s',   5),
  ('scheme', '4 sets, super 7''s',   6),
  ('scheme', 'Variation!',           7);
