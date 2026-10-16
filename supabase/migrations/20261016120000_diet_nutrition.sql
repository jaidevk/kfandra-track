-- ============================================================================
-- 20261016120000 — Diet nutrition (spec 2026-10-16-diet-nutrition-design.md)
-- ----------------------------------------------------------------------------
--   * food_catalog: per-100 g macros, grams per unit, verdict + KFANDRA note
--   * diet_logs.recap_seen_at: the once-only end-of-day recap (D11)
--   * app_config.diet_nutrition_start_date: nutrition counts from here (D12)
--   * the whole catalogue re-seeded from src/lib/diet/nutrition-seed.ts (D13)
-- ============================================================================

alter table public.food_catalog
  add column grams_per_unit       numeric(7,2) check (grams_per_unit > 0),
  add column kcal_per_100g        numeric(7,2) check (kcal_per_100g >= 0),
  add column protein_g_per_100g   numeric(6,2) check (protein_g_per_100g >= 0),
  add column carbs_g_per_100g     numeric(6,2) check (carbs_g_per_100g >= 0),
  add column fat_g_per_100g       numeric(6,2) check (fat_g_per_100g >= 0),
  add column sodium_mg_per_100g   numeric(7,1) check (sodium_mg_per_100g >= 0),
  add column verdict              text check (verdict in ('good', 'watch', 'avoid')),
  add column nutrition_note       text,
  add column nutrition_source     text check (nutrition_source in ('matrix_v2', 'email_2026_10_02', 'app_default', 'kfandra')),
  add column nutrition_updated_at timestamptz,
  add column nutrition_updated_by uuid references public.players(id) on delete set null;

-- A food is either fully counted or not counted at all: no half-counted rows.
alter table public.food_catalog
  add constraint food_catalog_nutrition_all_or_none check (
    num_nulls(grams_per_unit, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g) in (0, 5)
  );

comment on column public.food_catalog.grams_per_unit is
  'Weight in g (ml for drinks) of one `unit`. Null = not counted.';

alter table public.diet_logs add column recap_seen_at timestamptz;

comment on column public.diet_logs.recap_seen_at is
  'When the player dismissed the recap for this day. Null = not seen yet.';

-- Nutrition counts from the IST day this migration runs (D12). Edit the value
-- to move the start date; a missing/invalid value turns nutrition off.
insert into public.app_config (key, value, description)
values (
  'diet_nutrition_start_date',
  to_jsonb(to_char((now() at time zone 'Asia/Kolkata')::date, 'YYYY-MM-DD')),
  'Diet nutrition totals count diet logs on or after this IST date (YYYY-MM-DD).'
)
on conflict (key) do nothing;

-- BEGIN GENERATED: diet nutrition seed
-- Generated from src/lib/diet/nutrition-seed.ts. Do not edit by hand. Regenerate with:
--   WRITE_NUTRITION_SEED=1 npm run test -- src/lib/diet/nutrition-seed-sql.test.ts
insert into public.food_catalog (key, name, emoji, unit, unit_detail, section_label, sort_order, is_active, grams_per_unit, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, sodium_mg_per_100g, verdict, nutrition_note, nutrition_source, nutrition_updated_at)
values
  -- white-bread: 67 kcal, P 2, C 12, F 0.8 per 25 g (matrix_v2)
  ('white-bread', 'White bread', '🍞', '1 slice', '25 g', 'Grains & Bread', 1, true, 25, 268, 8, 48, 3.2, null, 'watch', 'High GI Processing, Low Dietary Fiber', 'matrix_v2', now()),
  -- brown-bread: 65 kcal, P 2.2, C 11.5, F 0.9 per 25 g (matrix_v2)
  ('brown-bread', 'Brown bread', '🍞', '1 slice', '25 g', 'Grains & Bread', 2, true, 25, 260, 8.8, 46, 3.6, null, 'good', 'B Vitamins, Intermediate Fiber Density', 'matrix_v2', now()),
  -- roti: 105 kcal, P 3.5, C 22, F 0.5 per 40 g (matrix_v2)
  ('roti', 'Roti, whole wheat', '🫓', '1 piece', '40 g', 'Grains & Bread', 3, true, 40, 262.5, 8.75, 55, 1.25, null, 'good', 'Complex Carbs, Magnesium, Core Fuel', 'matrix_v2', now()),
  -- roti-maida: 120 kcal, P 3, C 24.5, F 1.2 per 40 g (matrix_v2)
  ('roti-maida', 'Roti, maida', '🫓', '1 piece', '40 g', 'Grains & Bread', 4, true, 40, 300, 7.5, 61.25, 3, null, 'watch', 'Maida Base, Low Transit Velocity, High GI', 'matrix_v2', now()),
  -- roti-multigrain: 102 kcal, P 4, C 20.5, F 0.8 per 40 g (matrix_v2)
  ('roti-multigrain', 'Roti, multigrain', '🫓', '1 piece', '40 g', 'Grains & Bread', 5, true, 40, 255, 10, 51.25, 2, null, 'good', 'Maximum Fiber, Low Insulin Response Profile', 'matrix_v2', now()),
  ('paratha', 'Paratha', '🫓', '1 piece', null, 'Grains & Bread', 6, true, null, null, null, null, null, null, null, null, null, null),
  ('naan', 'Naan', '🫓', '1 piece', null, 'Grains & Bread', 7, true, null, null, null, null, null, null, null, null, null, null),
  ('bhakri', 'Bhakri', '🫓', '1 piece', null, 'Grains & Bread', 8, true, null, null, null, null, null, null, null, null, null, null),
  -- oats: 389 kcal, P 16.9, C 66.3, F 6.9 per 100 g (matrix_v2)
  ('oats', 'Oats (dry)', '🥣', '1 waati', '40 g dry', 'Grains & Bread', 9, true, 40, 389, 16.9, 66.3, 6.9, null, 'good', 'Beta-Glucan Fiber, Exceptional Heart Recovery', 'matrix_v2', now()),
  -- dal: 116 kcal, P 7, C 20, F 0.4 per 100 g (matrix_v2)
  ('dal', 'Dal / varan', '🥣', '1 waati', '150 g', 'Dals & Sabzi', 10, true, 150, 116, 7, 20, 0.4, null, 'good', 'Water Volume Dilution, Folate Heavy', 'matrix_v2', now()),
  -- dal-tadka: 190 kcal, P 6.8, C 19.5, F 9.2 per 100 g (matrix_v2)
  ('dal-tadka', 'Dal tadka', '🍲', '1 waati', '150 g', 'Dals & Sabzi', 11, true, 150, 190, 6.8, 19.5, 9.2, null, 'watch', 'Added Seed Oils, Lipid Density Increase', 'matrix_v2', now()),
  -- moong-dal: 105 kcal, P 7.3, C 19, F 0.3 per 100 g (matrix_v2)
  ('moong-dal', 'Moong dal', '🥣', '1 waati', '150 g', 'Dals & Sabzi', 12, true, 150, 105, 7.3, 19, 0.3, null, 'good', 'Optimal Athlete Low-Fat Recovery Carb', 'matrix_v2', now()),
  -- masoor-dal: 116 kcal, P 9, C 20, F 0.3 per 100 g (matrix_v2)
  ('masoor-dal', 'Masoor dal', '🥣', '1 waati', '150 g', 'Dals & Sabzi', 13, true, 150, 116, 9, 20, 0.3, null, 'good', 'Post-Training Amino/Glycogen Load', 'matrix_v2', now()),
  -- chana-dal: 164 kcal, P 8.9, C 27, F 2.6 per 100 g (matrix_v2)
  ('chana-dal', 'Chana dal', '🥣', '1 waati', '150 g', 'Dals & Sabzi', 14, true, 150, 164, 8.9, 27, 2.6, null, 'good', 'Low Glycemic Index, Steady Energy', 'matrix_v2', now()),
  -- soya-boiled: 35 kcal, P 5.2, C 3.3, F 0.1 per 10 g (matrix_v2)
  ('soya-boiled', 'Soya chunks, boiled', '🫘', '5 pieces', '~10 g', 'Dals & Sabzi', 15, true, 10, 350, 52, 33, 1, null, 'good', 'High Hydration Mass, Low Density', 'matrix_v2', now()),
  -- soya-fried: 115 kcal, P 5.1, C 4, F 9 per 10 g (matrix_v2)
  ('soya-fried', 'Soya chunks, fried', '🫘', '5 pieces', '~10 g', 'Dals & Sabzi', 16, true, 10, 1150, 51, 40, 90, null, 'avoid', 'Extreme Fat Spike, Oxidized Lipids', 'matrix_v2', now()),
  ('bhendi', 'Bhendi bhaji', '🥬', '1 waati', null, 'Dals & Sabzi', 17, true, null, null, null, null, null, null, null, null, null, null),
  ('mixed-sabzi', 'Mixed sabzi', '🥗', '1 waati', null, 'Dals & Sabzi', 18, true, null, null, null, null, null, null, null, null, null, null),
  ('aloo-bhaji', 'Aloo bhaji', '🥔', '1 waati', null, 'Dals & Sabzi', 19, true, null, null, null, null, null, null, null, null, null, null),
  ('paneer-sabzi', 'Paneer sabzi', '🧀', '1 waati', null, 'Dals & Sabzi', 20, true, null, null, null, null, null, null, null, null, null, null),
  ('chana', 'Chana / chole', '🫘', '1 waati', null, 'Dals & Sabzi', 21, true, null, null, null, null, null, null, null, null, null, null),
  -- potato-boiled: 87 kcal, P 2, C 20, F 0.1 per 100 g (matrix_v2)
  ('potato-boiled', 'Potato, boiled', '🥔', '1 waati', '150 g', 'Vegetables & Salad', 22, true, 150, 87, 2, 20, 0.1, null, 'good', 'Clean Resistant Starch, Cellular Energy', 'matrix_v2', now()),
  -- sweet-potato: 90 kcal, P 2, C 21, F 0.1 per 100 g (matrix_v2)
  ('sweet-potato', 'Sweet potato, boiled', '🍠', '1 waati', '150 g', 'Vegetables & Salad', 23, true, 150, 90, 2, 21, 0.1, null, 'good', 'Highly Bioavailable Vit A, Antioxidants', 'matrix_v2', now()),
  -- arbi-boiled: 116 kcal, P 1.6, C 27.5, F 0.1 per 100 g (matrix_v2)
  ('arbi-boiled', 'Arbi, boiled', '🥔', '1 waati', '150 g', 'Vegetables & Salad', 24, true, 150, 116, 1.6, 27.5, 0.1, null, 'good', 'Viscous Soluble Fiber, Gastro-Safe', 'matrix_v2', now()),
  -- potato-fried: 312 kcal, P 3.4, C 41, F 15 per 100 g (matrix_v2)
  ('potato-fried', 'Potato fried / chips', '🍟', '1 waati', '100 g', 'Vegetables & Salad', 25, true, 100, 312, 3.4, 41, 15, null, 'avoid', 'Extreme Glycemic Index, Trans Fat Hazard', 'matrix_v2', now()),
  -- arbi-fried: 280 kcal, P 2.1, C 38, F 13.5 per 100 g (matrix_v2)
  ('arbi-fried', 'Arbi, fried', '🍟', '1 waati', '100 g', 'Vegetables & Salad', 26, true, 100, 280, 2.1, 38, 13.5, null, 'avoid', 'Dense Caloric Trap, Stripped Micronutrients', 'matrix_v2', now()),
  -- cucumber: 15 kcal, P 0.7, C 3.6, F 0.1 per 100 g (matrix_v2)
  ('cucumber', 'Cucumber', '🥒', '1 waati', '100 g', 'Vegetables & Salad', 27, true, 100, 15, 0.7, 3.6, 0.1, null, 'good', 'Maximum Electrolyte Hydration, Silica', 'matrix_v2', now()),
  -- tomato: 18 kcal, P 0.9, C 3.9, F 0.2 per 100 g (matrix_v2)
  ('tomato', 'Tomato', '🍅', '1 waati', '100 g', 'Vegetables & Salad', 28, true, 100, 18, 0.9, 3.9, 0.2, null, 'good', 'Lycopene (Cardio and Prostate Support)', 'matrix_v2', now()),
  -- carrot: 41 kcal, P 0.9, C 9.6, F 0.2 per 100 g (matrix_v2)
  ('carrot', 'Carrot', '🥕', '1 waati', '100 g', 'Vegetables & Salad', 29, true, 100, 41, 0.9, 9.6, 0.2, null, 'good', 'Beta-Carotene, High Fiber Visual Catalyst', 'matrix_v2', now()),
  -- onion: 40 kcal, P 1.1, C 9.3, F 0.1 per 100 g (matrix_v2)
  ('onion', 'Onion', '🧅', '1 waati', '100 g', 'Vegetables & Salad', 30, true, 100, 40, 1.1, 9.3, 0.1, null, 'good', 'Quercetin, Chromium, Anti-Inflammatory', 'matrix_v2', now()),
  -- lettuce: 15 kcal, P 1.4, C 2.9, F 0.2 per 100 g (matrix_v2)
  ('lettuce', 'Lettuce', '🥬', '1 waati', '100 g', 'Vegetables & Salad', 31, true, 100, 15, 1.4, 2.9, 0.2, null, 'good', 'Hydration Matrix, Minimal Calorie Load', 'matrix_v2', now()),
  -- cabbage: 25 kcal, P 1.3, C 5.8, F 0.1 per 100 g (matrix_v2)
  ('cabbage', 'Cabbage', '🥬', '1 waati', '100 g', 'Vegetables & Salad', 32, true, 100, 25, 1.3, 5.8, 0.1, null, 'good', 'Glucosinolates, Cancer-Protective Minerals', 'matrix_v2', now()),
  -- spinach: 23 kcal, P 2.9, C 3.6, F 0.4 per 100 g (matrix_v2)
  ('spinach', 'Spinach', '🥬', '1 waati', '100 g', 'Vegetables & Salad', 33, true, 100, 23, 2.9, 3.6, 0.4, null, 'good', 'Non-Heme Iron, Nitrates for Endurance', 'matrix_v2', now()),
  -- beans-boiled: 35 kcal, P 1.9, C 7.9, F 0.3 per 100 g (matrix_v2)
  ('beans-boiled', 'Green beans, boiled', '🫛', '1 waati', '100 g', 'Vegetables & Salad', 34, true, 100, 35, 1.9, 7.9, 0.3, null, 'good', 'Low Calorie High Crunch Micronutrient', 'matrix_v2', now()),
  -- corn: 86 kcal, P 3.2, C 19, F 1.2 per 100 g (matrix_v2)
  ('corn', 'Sweet corn', '🌽', '1 waati', '100 g', 'Vegetables & Salad', 35, true, 100, 86, 3.2, 19, 1.2, null, 'good', 'Lutein, Zeaxanthin, Optic Pathway Fuel', 'matrix_v2', now()),
  -- bell-pepper: 20 kcal, P 0.9, C 4.6, F 0.2 per 100 g (matrix_v2)
  ('bell-pepper', 'Bell pepper', '🫑', '1 waati', '100 g', 'Vegetables & Salad', 36, true, 100, 20, 0.9, 4.6, 0.2, null, 'good', 'Extreme Vit C Catalyst, Immunity Base', 'matrix_v2', now()),
  -- pumpkin: 26 kcal, P 1, C 6.5, F 0.1 per 100 g (matrix_v2)
  ('pumpkin', 'Pumpkin', '🎃', '1 waati', '100 g', 'Vegetables & Salad', 37, true, 100, 26, 1, 6.5, 0.1, null, 'good', 'Alpha-Carotene, Low Calorie Bulking Food', 'matrix_v2', now()),
  -- cauliflower: 25 kcal, P 1.9, C 5, F 0.3 per 100 g (matrix_v2)
  ('cauliflower', 'Cauliflower', '🥦', '1 waati', '100 g', 'Vegetables & Salad', 38, true, 100, 25, 1.9, 5, 0.3, null, 'good', 'Choline, Indole-3-Carbinol, Recovery Acid', 'matrix_v2', now()),
  -- plain-rice: 130 kcal, P 2.7, C 28, F 0.3 per 100 g (matrix_v2)
  ('plain-rice', 'Plain rice', '🍚', '1 waati', '150 g', 'Rice', 39, true, 150, 130, 2.7, 28, 0.3, null, 'watch', 'High Glycemic Muscle Glycogen Replenisher', 'matrix_v2', now()),
  -- brown-rice: 112 kcal, P 2.3, C 23.5, F 0.8 per 100 g (matrix_v2)
  ('brown-rice', 'Brown rice', '🍚', '1 waati', '150 g', 'Rice', 40, true, 150, 112, 2.3, 23.5, 0.8, null, 'good', 'Sustained Low-GI Fuel Release Profile', 'matrix_v2', now()),
  ('khichadi', 'Khichadi', '🍚', '1 waati', null, 'Rice', 41, true, null, null, null, null, null, null, null, null, null, null),
  ('pulao', 'Pulao / biryani', '🍛', '1 plate', null, 'Rice', 42, true, null, null, null, null, null, null, null, null, null, null),
  ('curd-rice', 'Curd rice', '🍚', '1 waati', null, 'Rice', 43, true, null, null, null, null, null, null, null, null, null, null),
  -- milk: 62 kcal, P 3.2, C 4.8, F 3.3 per 100 g (matrix_v2)
  ('milk', 'Milk', '🥛', '1 glass', '200 ml', 'Dairy', 44, true, 200, 62, 3.2, 4.8, 3.3, null, 'good', 'Vit D, Calcium, Riboflavin', 'matrix_v2', now()),
  -- skimmed-milk: 35 kcal, P 3.4, C 5, F 0.1 per 100 g (matrix_v2)
  ('skimmed-milk', 'Milk, skimmed', '🥛', '1 glass', '200 ml', 'Dairy', 45, true, 200, 35, 3.4, 5, 0.1, null, 'good', 'Isolated Protein, Low Lipids', 'matrix_v2', now()),
  -- taak: 40 kcal, P 3.3, C 4.8, F 0.9 per 100 g (matrix_v2)
  ('taak', 'Buttermilk / taak', '🥛', '1 glass', '200 ml', 'Dairy', 46, true, 200, 40, 3.3, 4.8, 0.9, null, 'good', 'Hydration Matrix, Potassium, Calcium', 'matrix_v2', now()),
  -- curd: 61 kcal, P 3.5, C 4.7, F 3.3 per 100 g (matrix_v2)
  ('curd', 'Curd / dahi', '🍶', '1 waati', '150 g', 'Dairy', 47, true, 150, 61, 3.5, 4.7, 3.3, null, 'good', 'B12, Active Probiotics, Gut Health', 'matrix_v2', now()),
  -- greek-yoghurt: 97 kcal, P 9, C 4, F 5 per 100 g (matrix_v2)
  ('greek-yoghurt', 'Greek yoghurt', '🍶', '1 waati', '150 g', 'Dairy', 48, true, 150, 97, 9, 4, 5, null, 'good', 'Concentrated Amino Acids, Calcium', 'matrix_v2', now()),
  -- paneer: 260 kcal, P 18, C 3.2, F 19.5 per 100 g (matrix_v2)
  ('paneer', 'Paneer', '🧀', '100 g', null, 'Dairy', 49, true, 100, 260, 18, 3.2, 19.5, null, 'good', 'Moisture Retained, Sodium Leached', 'matrix_v2', now()),
  -- paneer-fried: 410 kcal, P 17.2, C 2.8, F 36 per 100 g (matrix_v2)
  ('paneer-fried', 'Paneer, fried', '🧀', '100 g', null, 'Dairy', 50, true, 100, 410, 17.2, 2.8, 36, null, 'watch', 'Conjugated Fat Spike, Saturated Content', 'matrix_v2', now()),
  -- ghee: 897 kcal, P 0, C 0, F 99.5 per 100 g (matrix_v2)
  ('ghee', 'Ghee', '🧈', '1 tsp', '5 g', 'Dairy', 51, true, 5, 897, 0, 0, 99.5, null, 'watch', 'Pure Butyric Acid, Vit A, Extreme Density', 'matrix_v2', now()),
  ('cheese-slice', 'Cheese slice', '🧀', '1 piece', null, 'Dairy', 52, true, null, null, null, null, null, null, null, null, null, null),
  -- almonds: 35 kcal, P 1.3, C 1.2, F 3 per 6 g (matrix_v2)
  ('almonds', 'Almonds', '🌰', '5 pieces', '~6 g', 'Nuts & Seeds', 53, true, 6, 583.33, 21.67, 20, 50, null, 'good', 'Vit E, Magnesium, High Satiety', 'matrix_v2', now()),
  -- pistachios: 20 kcal, P 0.7, C 1, F 1.6 per 4 g (matrix_v2)
  ('pistachios', 'Pistachios', '🌰', '5 pieces', '~4 g', 'Nuts & Seeds', 54, true, 4, 500, 17.5, 25, 40, null, 'good', 'Vit B6, Potassium, Low Calorie', 'matrix_v2', now()),
  -- cashews: 45 kcal, P 1.4, C 2.4, F 3.5 per 8 g (matrix_v2)
  ('cashews', 'Cashews', '🌰', '5 pieces', '~8 g', 'Nuts & Seeds', 55, true, 8, 562.5, 17.5, 30, 43.75, null, 'good', 'Zinc, Iron, Copper', 'matrix_v2', now()),
  -- peanuts: 30 kcal, P 1.3, C 0.8, F 2.5 per 5 g (matrix_v2)
  ('peanuts', 'Peanuts', '🥜', '5 pieces', '~5 g', 'Nuts & Seeds', 56, true, 5, 600, 26, 16, 50, null, 'good', 'Niacin, Biotin, Protein Dense', 'matrix_v2', now()),
  -- walnuts: 65 kcal, P 1.5, C 1.4, F 6.5 per 10 g (matrix_v2)
  ('walnuts', 'Walnuts', '🌰', '5 pieces', '~10 g', 'Nuts & Seeds', 57, true, 10, 650, 15, 14, 65, null, 'good', 'Omega-3 ALA, Brain Health, Copper', 'matrix_v2', now()),
  -- banana: 89 kcal, P 1.1, C 22.8, F 0.3 per 100 g (matrix_v2)
  ('banana', 'Banana', '🍌', '1 piece', '~100 g', 'Fruits', 58, true, 100, 89, 1.1, 22.8, 0.3, null, 'good', 'Potassium Energy Catalyst, Instant Glycogen', 'matrix_v2', now()),
  -- apple: 52 kcal, P 0.3, C 13.8, F 0.2 per 100 g (matrix_v2)
  ('apple', 'Apple', '🍎', '1 piece', '~100 g', 'Fruits', 59, true, 100, 52, 0.3, 13.8, 0.2, null, 'good', 'Pectin Soluble Fiber, Steady Blood Sugar', 'matrix_v2', now()),
  -- mango: 60 kcal, P 0.8, C 15, F 0.4 per 100 g (matrix_v2)
  ('mango', 'Mango', '🥭', '1 piece', '~100 g', 'Fruits', 60, true, 100, 60, 0.8, 15, 0.4, null, 'good', 'Vit C, Vit A, Fructose Spurt Energy', 'matrix_v2', now()),
  -- orange: 47 kcal, P 0.9, C 11.8, F 0.1 per 100 g (matrix_v2)
  ('orange', 'Orange', '🍊', '1 piece', '~100 g', 'Fruits', 61, true, 100, 47, 0.9, 11.8, 0.1, null, 'good', 'High Bioavailable Vit C, Electrolyte Balance', 'matrix_v2', now()),
  -- papaya: 43 kcal, P 0.5, C 10.8, F 0.3 per 100 g (matrix_v2)
  ('papaya', 'Papaya', '🍈', '1 waati', '150 g', 'Fruits', 62, true, 150, 43, 0.5, 10.8, 0.3, null, 'good', 'Papain Enzyme (Protein Digestion Optimizer)', 'matrix_v2', now()),
  -- watermelon: 30 kcal, P 0.6, C 7.6, F 0.2 per 100 g (matrix_v2)
  ('watermelon', 'Watermelon', '🍉', '1 waati', '150 g', 'Fruits', 63, true, 150, 30, 0.6, 7.6, 0.2, null, 'good', 'L-Citrulline (Nitric Oxide Vasodilation), Hydration', 'matrix_v2', now()),
  -- jackfruit: 95 kcal, P 1.7, C 23.2, F 0.6 per 100 g (matrix_v2)
  ('jackfruit', 'Jackfruit', '🍈', '1 waati', '150 g', 'Fruits', 64, true, 150, 95, 1.7, 23.2, 0.6, null, 'good', 'Vit B6, Potassium, Complex Plant Energy', 'matrix_v2', now()),
  -- grapes: 69 kcal, P 0.7, C 18.1, F 0.2 per 100 g (matrix_v2)
  ('grapes', 'Grapes', '🍇', '1 waati', '150 g', 'Fruits', 65, true, 150, 69, 0.7, 18.1, 0.2, null, 'good', 'Resveratrol, Quick Hydrating Muscle Sugar', 'matrix_v2', now()),
  -- pineapple: 50 kcal, P 0.5, C 13.1, F 0.1 per 100 g (matrix_v2)
  ('pineapple', 'Pineapple', '🍍', '1 waati', '150 g', 'Fruits', 66, true, 150, 50, 0.5, 13.1, 0.1, null, 'good', 'Bromelain Enzyme (Muscle Anti-Inflammatory)', 'matrix_v2', now()),
  ('mixed-fruit', 'Mixed fruit', '🍇', '1 waati', null, 'Fruits', 67, true, null, null, null, null, null, null, null, null, null, null),
  ('egg-boiled', 'Egg, boiled', '🥚', '1 piece', null, 'Non-Veg', 68, true, null, null, null, null, null, null, null, null, null, null),
  ('egg-omelette', 'Egg, omelette', '🍳', '1 piece', null, 'Non-Veg', 69, true, null, null, null, null, null, null, null, null, null, null),
  ('egg-scrambled', 'Egg, scrambled', '🍳', '1 waati', null, 'Non-Veg', 70, true, null, null, null, null, null, null, null, null, null, null),
  -- chicken-grilled: 165 kcal, P 31, C 0, F 3.6 per 100 g (matrix_v2)
  ('chicken-grilled', 'Chicken breast (skinless)', '🍗', '100 g', null, 'Non-Veg', 71, true, 100, 165, 31, 0, 3.6, null, 'good', 'Pure Lean Muscle Block, Selenium, B6', 'matrix_v2', now()),
  -- chicken-skin: 215 kcal, P 27, C 0, F 15 per 100 g (matrix_v2)
  ('chicken-skin', 'Chicken (with skin)', '🍗', '100 g', null, 'Non-Veg', 72, true, 100, 215, 27, 0, 15, null, 'watch', 'High Saturated Fat Density Payload', 'matrix_v2', now()),
  -- chicken-fried: 290 kcal, P 28.5, C 0, F 18.5 per 100 g (matrix_v2)
  ('chicken-fried', 'Chicken, fried', '🍗', '100 g', null, 'Non-Veg', 73, true, 100, 290, 28.5, 0, 18.5, null, 'avoid', 'Trans/Saturated Fat Matrix Infusion', 'matrix_v2', now()),
  ('chicken-curry', 'Chicken curry', '🍗', '1 waati', null, 'Non-Veg', 74, true, null, null, null, null, null, null, null, null, null, null),
  ('mutton-curry', 'Mutton curry', '🥩', '1 waati', null, 'Non-Veg', 75, true, null, null, null, null, null, null, null, null, null, null),
  ('fish-curry', 'Fish curry', '🐟', '1 waati', null, 'Non-Veg', 76, true, null, null, null, null, null, null, null, null, null, null),
  ('fish-fried', 'Fish grilled / fried', '🐟', '1 piece', null, 'Non-Veg', 77, true, null, null, null, null, null, null, null, null, null, null),
  ('prawns', 'Prawns', '🦐', '1 waati', null, 'Non-Veg', 78, true, null, null, null, null, null, null, null, null, null, null),
  ('tandoori', 'Tandoori chicken', '🍗', '1 piece', null, 'Non-Veg', 79, true, null, null, null, null, null, null, null, null, null, null),
  -- pork-lean: 145 kcal, P 21, C 0, F 6 per 100 g (matrix_v2)
  ('pork-lean', 'Pork, lean', '🥩', '100 g', null, 'Non-Veg', 80, true, 100, 145, 21, 0, 6, null, 'good', 'Thiamine (B1) Super Engine Catalyst', 'matrix_v2', now()),
  -- pork-fat: 295 kcal, P 17, C 0, F 25 per 100 g (matrix_v2)
  ('pork-fat', 'Pork, with fat', '🥩', '100 g', null, 'Non-Veg', 81, true, 100, 295, 17, 0, 25, null, 'watch', 'High Caloric Loading, Saturated Stress', 'matrix_v2', now()),
  -- beef-lean: 250 kcal, P 26, C 0, F 15 per 100 g (matrix_v2)
  ('beef-lean', 'Beef, lean', '🥩', '100 g', null, 'Non-Veg', 82, true, 100, 250, 26, 0, 15, null, 'watch', 'Heme Iron, Zinc, Highly Bioavailable Creatine', 'matrix_v2', now()),
  -- buff-lean: 130 kcal, P 22.4, C 0, F 2.4 per 100 g (matrix_v2)
  ('buff-lean', 'Buff, lean', '🥩', '100 g', null, 'Non-Veg', 83, true, 100, 130, 22.4, 0, 2.4, null, 'good', 'Ultra-Lean Competitor Beef, High Iron Base', 'matrix_v2', now()),
  -- water: 0 kcal, P 0, C 0, F 0 per 100 g (app_default)
  ('water', 'Water', '💧', '1 glass', '200 ml', 'Beverages', 84, true, 200, 0, 0, 0, 0, null, 'good', null, 'app_default', now()),
  -- tea: 50 kcal, P 1.6, C 8.5, F 1.8 per 100 g (matrix_v2)
  ('tea', 'Tea / chai', '🍵', '1 cup', '100 ml', 'Beverages', 85, true, 100, 50, 1.6, 8.5, 1.8, null, 'watch', 'Simple Sugar Spike Profile', 'matrix_v2', now()),
  -- black-tea: 1 kcal, P 0.1, C 0.2, F 0 per 100 g (matrix_v2)
  ('black-tea', 'Black tea', '🍵', '1 cup', '100 ml', 'Beverages', 86, true, 100, 1, 0.1, 0.2, 0, null, 'good', 'Theaflavins, L-Theanine Cognitive Focus', 'matrix_v2', now()),
  -- coffee: 45 kcal, P 1.5, C 7, F 1.5 per 100 g (matrix_v2)
  ('coffee', 'Coffee', '☕', '1 cup', '100 ml', 'Beverages', 87, true, 100, 45, 1.5, 7, 1.5, null, 'watch', 'Hidden Insulin Spiker Framework', 'matrix_v2', now()),
  -- black-coffee: 1 kcal, P 0.1, C 0, F 0 per 100 g (matrix_v2)
  ('black-coffee', 'Black coffee', '☕', '1 cup', '100 ml', 'Beverages', 88, true, 100, 1, 0.1, 0, 0, null, 'good', 'Caffeine Ergogenic Aid, Chlorogenic Acid', 'matrix_v2', now()),
  ('juice', 'Juice', '🧃', '1 glass', null, 'Beverages', 89, true, null, null, null, null, null, null, null, null, null, null),
  ('coconut-water', 'Coconut water', '🥥', '1 glass', null, 'Beverages', 90, true, null, null, null, null, null, null, null, null, null, null),
  ('lassi', 'Lassi', '🥛', '1 glass', null, 'Beverages', 91, true, null, null, null, null, null, null, null, null, null, null),
  -- soft-drink: 42 kcal, P 0, C 10.6, F 0 per 100 g (matrix_v2)
  ('soft-drink', 'Soft drink / cola', '🥤', '1 glass', '200 ml', 'Beverages', 92, true, 200, 42, 0, 10.6, 0, null, 'avoid', 'High Fructose Corn Syrup Damage, Acidity', 'matrix_v2', now()),
  -- diet-soda: 0 kcal, P 0, C 0, F 0 per 100 g (matrix_v2)
  ('diet-soda', 'Diet / zero soda', '🥤', '1 glass', '200 ml', 'Beverages', 93, true, 200, 0, 0, 0, 0, null, 'watch', 'Artificial Sweeteners (Non-Caloric Matrix)', 'matrix_v2', now()),
  ('sports-drink', 'Sports drink', '🍶', '1 bottle', '1 L', 'Beverages', 94, true, null, null, null, null, null, null, null, null, null, null),
  -- whey-shake: 120 kcal, P 24, C 2, F 1.5 per 30 g (matrix_v2)
  ('whey-shake', 'Whey shake', '🥤', '1 scoop', 'in water', 'Supplements', 95, true, 30, 400, 80, 6.67, 5, null, 'good', 'Immediate Leucine Recovery BCAA Spike', 'matrix_v2', now()),
  -- mass-gainer: 380 kcal, P 20, C 70, F 3 per 100 g (matrix_v2)
  ('mass-gainer', 'Mass gainer', '🥤', '1 scoop', 'in water', 'Supplements', 96, true, 100, 380, 20, 70, 3, null, 'watch', 'Maltodextrin Overload, Fast Glycemic Load', 'matrix_v2', now()),
  ('poha', 'Poha', '🍚', '1 waati', null, 'Snacks', 97, true, null, null, null, null, null, null, null, null, null, null),
  ('upma', 'Upma', '🥣', '1 waati', null, 'Snacks', 98, true, null, null, null, null, null, null, null, null, null, null),
  -- idli: 120 kcal, P 6, C 28, F 1 per 100 g (email_2026_10_02)
  ('idli', 'Idli', '🍙', '1 piece', '~40 g', 'Snacks', 99, true, 40, 120, 6, 28, 1, null, 'good', 'Excellent Choice. High bioavailability via fermentation.', 'email_2026_10_02', now()),
  -- dosa: 165 kcal, P 4, C 29, F 3.5 per 100 g (email_2026_10_02)
  ('dosa', 'Dosa, plain', '🥞', '1 piece', '~80 g', 'Snacks', 100, true, 80, 165, 4, 29, 3.5, null, 'good', 'Safe, clean complex carbs if prepared without excess butter/ghee.', 'email_2026_10_02', now()),
  -- masala-dosa: 250 kcal, P 5, C 40, F 8 per 100 g (email_2026_10_02)
  ('masala-dosa', 'Masala dosa', '🥞', '1 piece', '~150 g', 'Snacks', 101, true, 150, 250, 5, 40, 8, null, 'watch', 'Hidden Trap. Added oil and high-glycemic potato mash.', 'email_2026_10_02', now()),
  ('vada', 'Medu vada', '🍩', '1 piece', null, 'Snacks', 102, true, null, null, null, null, null, null, null, null, null, null),
  -- wada-pav: 300 kcal, P 6.7, C 30.7, F 16.7, Na 450 mg per 150 g (email_2026_10_02)
  ('wada-pav', 'Wada pav', '🍔', '1 piece', null, 'Snacks', 103, true, 150, 200, 4.47, 20.47, 11.13, 300, 'avoid', '~450mg Sodium. Massive trans-fat spike from deep frying.', 'email_2026_10_02', now()),
  ('samosa', 'Samosa', '🥟', '1 piece', null, 'Snacks', 104, true, null, null, null, null, null, null, null, null, null, null),
  ('sandwich', 'Sandwich', '🥪', '1 piece', null, 'Snacks', 105, true, null, null, null, null, null, null, null, null, null, null),
  -- biscuits: 450 kcal, P 6.5, C 77, F 12.5 per 100 g (email_2026_10_02)
  ('biscuits', 'Glucose biscuits', '🍪', '1 piece', '~6 g', 'Snacks', 106, true, 6, 450, 6.5, 77, 12.5, null, 'avoid', 'High in Refined Palm Oil and processed sugar syrups.', 'email_2026_10_02', now()),
  -- cream-biscuits: 480 kcal, P 5, C 70, F 20 per 100 g (email_2026_10_02)
  ('cream-biscuits', 'Cream biscuits', '🍪', '1 piece', '~12 g', 'Snacks', 107, true, 12, 480, 5, 70, 20, null, 'avoid', 'Pure hydrogenated fats. Causes instant insulin crashes.', 'email_2026_10_02', now()),
  ('maggi', 'Maggi / noodles', '🍜', '1 waati', null, 'Snacks', 108, true, null, null, null, null, null, null, null, null, null, null),
  -- chivda: 450 kcal, P 8, C 55, F 22 per 100 g (email_2026_10_02)
  ('chivda', 'Chivda / namkeen', '🥜', '1 waati', '50 g', 'Snacks', 109, true, 50, 450, 8, 55, 22, null, 'avoid', 'High glycemic spike combined with heavy processing lipids.', 'email_2026_10_02', now()),
  -- sev: 480 kcal, P 11.5, C 42, F 29.5, Na 500 mg per 100 g (email_2026_10_02)
  ('sev', 'Sev / shev', '🥨', '1 waati', '50 g', 'Snacks', 110, true, 50, 480, 11.5, 42, 29.5, 500, 'avoid', '~500mg+ Sodium. Fried chickpea flour; extreme caloric density.', 'email_2026_10_02', now()),
  -- sugar: 16 kcal, P 0, C 4.2, F 0 per 4 g (matrix_v2)
  ('sugar', 'Sugar', '🍬', '1 tsp', '4 g', 'Sweets', 111, true, 4, 400, 0, 105, 0, null, 'avoid', '100% Sucrose, Immediate Blood Glucose Shock', 'matrix_v2', now()),
  -- jaggery: 19 kcal, P 0, C 4.8, F 0 per 5 g (matrix_v2)
  ('jaggery', 'Jaggery / gul', '🍯', '1 tsp', '5 g', 'Sweets', 112, true, 5, 380, 0, 96, 0, null, 'watch', 'Trace Iron, Potassium, Slower Fructose Link', 'matrix_v2', now()),
  ('modak', 'Modak', '🍡', '1 piece', null, 'Sweets', 113, true, null, null, null, null, null, null, null, null, null, null),
  -- laddu: 185 kcal, P 2, C 28, F 8 per 50 g (matrix_v2)
  ('laddu', 'Laddu', '🍡', '1 piece', '~50 g', 'Sweets', 114, true, 50, 370, 4, 56, 16, null, 'avoid', 'Gram Flour Fried in Ghee, Extreme Fat/Carb', 'matrix_v2', now()),
  ('barfi', 'Barfi', '🍬', '1 piece', null, 'Sweets', 115, true, null, null, null, null, null, null, null, null, null, null),
  ('jalebi', 'Jalebi', '🥨', '1 piece', null, 'Sweets', 116, true, null, null, null, null, null, null, null, null, null, null),
  -- gulab-jamun: 175 kcal, P 2.5, C 26, F 7 per 50 g (matrix_v2)
  ('gulab-jamun', 'Gulab jamun', '🍡', '1 piece', '~50 g', 'Sweets', 117, true, 50, 350, 5, 52, 14, null, 'avoid', 'Deep Fried Dairy, Heavy Sugar Syrup Lock', 'matrix_v2', now()),
  ('kheer', 'Kheer', '🥣', '1 waati', null, 'Sweets', 118, true, null, null, null, null, null, null, null, null, null, null),
  ('shrikhand', 'Shrikhand', '🍶', '1 waati', null, 'Sweets', 119, true, null, null, null, null, null, null, null, null, null, null),
  ('ice-cream', 'Ice cream', '🍨', '1 scoop', null, 'Sweets', 120, true, null, null, null, null, null, null, null, null, null, null),
  ('chocolate', 'Chocolate', '🍫', '1 piece', null, 'Sweets', 121, true, null, null, null, null, null, null, null, null, null, null),
  -- chocolate-cake: 235 kcal, P 3.2, C 32, F 10.5 per 60 g (matrix_v2)
  ('chocolate-cake', 'Chocolate cake', '🍰', '1 slice', '~60 g', 'Sweets', 122, true, 60, 391.67, 5.33, 53.33, 17.5, null, 'avoid', 'Refined Flour, Trans-Fat Frosting Matrix', 'matrix_v2', now())
on conflict (key) do update set
  name = excluded.name,
  emoji = excluded.emoji,
  unit = excluded.unit,
  unit_detail = excluded.unit_detail,
  section_label = excluded.section_label,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  grams_per_unit = excluded.grams_per_unit,
  kcal_per_100g = excluded.kcal_per_100g,
  protein_g_per_100g = excluded.protein_g_per_100g,
  carbs_g_per_100g = excluded.carbs_g_per_100g,
  fat_g_per_100g = excluded.fat_g_per_100g,
  sodium_mg_per_100g = excluded.sodium_mg_per_100g,
  verdict = excluded.verdict,
  nutrition_note = excluded.nutrition_note,
  nutrition_source = excluded.nutrition_source,
  nutrition_updated_at = excluded.nutrition_updated_at;
-- END GENERATED: diet nutrition seed
