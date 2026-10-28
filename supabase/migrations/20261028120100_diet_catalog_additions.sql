-- ============================================================================
-- 20261028120100 — Diet catalogue: players' additions (2026-10-28)
-- ----------------------------------------------------------------------------
--   * ~35 new foods asked for by players (Caveman, Pam, Acid, Mkul)
--   * nutrition for every food that had none (eggs, bhakri, chana, ...)
--   * 1 waati = 100 g everywhere (dry oats keep 40 g)
--   * new nutrition_source 'reference': standard food-table values, with no
--     verdict or note until KFANDRA sets them in the food editor
-- Re-seeds the whole catalogue from src/lib/diet/nutrition-seed.ts, but skips
-- any food KFANDRA has saved in the food editor (nutrition_source 'kfandra').
-- ============================================================================

alter table public.food_catalog drop constraint food_catalog_nutrition_source_check;
alter table public.food_catalog add constraint food_catalog_nutrition_source_check
  check (nutrition_source in ('matrix_v2', 'email_2026_10_02', 'app_default', 'kfandra', 'reference'));

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
  -- paratha: 300 kcal, P 6.5, C 45, F 11 per 100 g (reference)
  ('paratha', 'Paratha', '🫓', '1 piece', '~60 g', 'Grains & Bread', 6, true, 60, 300, 6.5, 45, 11, null, null, null, 'reference', now()),
  -- naan: 290 kcal, P 9, C 50, F 5.5 per 100 g (reference)
  ('naan', 'Naan', '🫓', '1 piece', '~90 g', 'Grains & Bread', 7, true, 90, 290, 9, 50, 5.5, null, null, null, 'reference', now()),
  -- bhakri: 245 kcal, P 7, C 50, F 2 per 100 g (reference)
  ('bhakri', 'Bhakri', '🫓', '1 piece', '~60 g', 'Grains & Bread', 8, true, 60, 245, 7, 50, 2, null, null, null, 'reference', now()),
  -- bhakri-jowar: 245 kcal, P 7, C 50, F 2 per 100 g (reference)
  ('bhakri-jowar', 'Bhakri, jowar', '🫓', '1 piece', '~60 g', 'Grains & Bread', 9, true, 60, 245, 7, 50, 2, null, null, null, 'reference', now()),
  -- bhakri-bajra: 255 kcal, P 8, C 48, F 3.5 per 100 g (reference)
  ('bhakri-bajra', 'Bhakri, bajra', '🫓', '1 piece', '~60 g', 'Grains & Bread', 10, true, 60, 255, 8, 48, 3.5, null, null, null, 'reference', now()),
  -- pav: 275 kcal, P 8.5, C 52, F 3.5 per 100 g (reference)
  ('pav', 'Pav', '🍞', '1 piece', '~40 g', 'Grains & Bread', 11, true, 40, 275, 8.5, 52, 3.5, null, null, null, 'reference', now()),
  -- oats: 389 kcal, P 16.9, C 66.3, F 6.9 per 100 g (matrix_v2)
  ('oats', 'Oats (dry)', '🥣', '1 waati', '40 g dry', 'Grains & Bread', 12, true, 40, 389, 16.9, 66.3, 6.9, null, 'good', 'Beta-Glucan Fiber, Exceptional Heart Recovery', 'matrix_v2', now()),
  -- dal: 116 kcal, P 7, C 20, F 0.4 per 100 g (matrix_v2)
  ('dal', 'Dal / varan', '🥣', '1 waati', '100 g', 'Dals & Sabzi', 13, true, 100, 116, 7, 20, 0.4, null, 'good', 'Water Volume Dilution, Folate Heavy', 'matrix_v2', now()),
  -- dal-tadka: 190 kcal, P 6.8, C 19.5, F 9.2 per 100 g (matrix_v2)
  ('dal-tadka', 'Dal tadka', '🍲', '1 waati', '100 g', 'Dals & Sabzi', 14, true, 100, 190, 6.8, 19.5, 9.2, null, 'watch', 'Added Seed Oils, Lipid Density Increase', 'matrix_v2', now()),
  -- moong-dal: 105 kcal, P 7.3, C 19, F 0.3 per 100 g (matrix_v2)
  ('moong-dal', 'Moong dal', '🥣', '1 waati', '100 g', 'Dals & Sabzi', 15, true, 100, 105, 7.3, 19, 0.3, null, 'good', 'Optimal Athlete Low-Fat Recovery Carb', 'matrix_v2', now()),
  -- masoor-dal: 116 kcal, P 9, C 20, F 0.3 per 100 g (matrix_v2)
  ('masoor-dal', 'Masoor dal', '🥣', '1 waati', '100 g', 'Dals & Sabzi', 16, true, 100, 116, 9, 20, 0.3, null, 'good', 'Post-Training Amino/Glycogen Load', 'matrix_v2', now()),
  -- chana-dal: 164 kcal, P 8.9, C 27, F 2.6 per 100 g (matrix_v2)
  ('chana-dal', 'Chana dal', '🥣', '1 waati', '100 g', 'Dals & Sabzi', 17, true, 100, 164, 8.9, 27, 2.6, null, 'good', 'Low Glycemic Index, Steady Energy', 'matrix_v2', now()),
  -- soya-boiled: 35 kcal, P 5.2, C 3.3, F 0.1 per 10 g (matrix_v2)
  ('soya-boiled', 'Soya chunks, boiled', '🫘', '5 pieces', '~10 g', 'Dals & Sabzi', 18, true, 10, 350, 52, 33, 1, null, 'good', 'High Hydration Mass, Low Density', 'matrix_v2', now()),
  -- soya-fried: 115 kcal, P 5.1, C 4, F 9 per 10 g (matrix_v2)
  ('soya-fried', 'Soya chunks, fried', '🫘', '5 pieces', '~10 g', 'Dals & Sabzi', 19, true, 10, 1150, 51, 40, 90, null, 'avoid', 'Extreme Fat Spike, Oxidized Lipids', 'matrix_v2', now()),
  -- bhendi: 100 kcal, P 2.2, C 8, F 7 per 100 g (reference)
  ('bhendi', 'Bhendi bhaji', '🥬', '1 waati', '100 g', 'Dals & Sabzi', 20, true, 100, 100, 2.2, 8, 7, null, null, null, 'reference', now()),
  -- mixed-sabzi: 90 kcal, P 2.5, C 9, F 5 per 100 g (reference)
  ('mixed-sabzi', 'Mixed sabzi', '🥗', '1 waati', '100 g', 'Dals & Sabzi', 21, true, 100, 90, 2.5, 9, 5, null, null, null, 'reference', now()),
  -- aloo-bhaji: 130 kcal, P 2, C 17, F 6 per 100 g (reference)
  ('aloo-bhaji', 'Aloo bhaji', '🥔', '1 waati', '100 g', 'Dals & Sabzi', 22, true, 100, 130, 2, 17, 6, null, null, null, 'reference', now()),
  -- paneer-sabzi: 200 kcal, P 9, C 7, F 15 per 100 g (reference)
  ('paneer-sabzi', 'Paneer sabzi', '🧀', '1 waati', '100 g', 'Dals & Sabzi', 23, true, 100, 200, 9, 7, 15, null, null, null, 'reference', now()),
  -- chana: 150 kcal, P 7, C 20, F 5 per 100 g (reference)
  ('chana', 'Chana / chole', '🫘', '1 waati', '100 g', 'Dals & Sabzi', 24, true, 100, 150, 7, 20, 5, null, null, null, 'reference', now()),
  -- sambar: 65 kcal, P 3, C 9, F 2 per 100 g (reference)
  ('sambar', 'Sambar', '🍲', '1 waati', '100 g', 'Dals & Sabzi', 25, true, 100, 65, 3, 9, 2, null, null, null, 'reference', now()),
  -- sprouts-salad: 30 kcal, P 3, C 5.9, F 0.2 per 100 g (reference)
  ('sprouts-salad', 'Sprouts, raw salad', '🌱', '1 waati', '100 g', 'Dals & Sabzi', 26, true, 100, 30, 3, 5.9, 0.2, null, null, null, 'reference', now()),
  -- sprouts-usal: 120 kcal, P 7, C 15, F 4 per 100 g (reference)
  ('sprouts-usal', 'Sprouts usal / bhaji (matki, moong, val, masoor)', '🌱', '1 waati', '100 g', 'Dals & Sabzi', 27, true, 100, 120, 7, 15, 4, null, null, null, 'reference', now()),
  -- soup: 35 kcal, P 1.5, C 6, F 0.8 per 100 g (reference)
  ('soup', 'Soup, veg', '🍲', '1 waati', '100 g', 'Dals & Sabzi', 28, true, 100, 35, 1.5, 6, 0.8, null, null, null, 'reference', now()),
  -- potato-boiled: 87 kcal, P 2, C 20, F 0.1 per 100 g (matrix_v2)
  ('potato-boiled', 'Potato, boiled', '🥔', '1 waati', '100 g', 'Vegetables & Salad', 29, true, 100, 87, 2, 20, 0.1, null, 'good', 'Clean Resistant Starch, Cellular Energy', 'matrix_v2', now()),
  -- sweet-potato: 90 kcal, P 2, C 21, F 0.1 per 100 g (matrix_v2)
  ('sweet-potato', 'Sweet potato, boiled', '🍠', '1 waati', '100 g', 'Vegetables & Salad', 30, true, 100, 90, 2, 21, 0.1, null, 'good', 'Highly Bioavailable Vit A, Antioxidants', 'matrix_v2', now()),
  -- arbi-boiled: 116 kcal, P 1.6, C 27.5, F 0.1 per 100 g (matrix_v2)
  ('arbi-boiled', 'Arbi, boiled', '🥔', '1 waati', '100 g', 'Vegetables & Salad', 31, true, 100, 116, 1.6, 27.5, 0.1, null, 'good', 'Viscous Soluble Fiber, Gastro-Safe', 'matrix_v2', now()),
  -- potato-fried: 312 kcal, P 3.4, C 41, F 15 per 100 g (matrix_v2)
  ('potato-fried', 'Potato fried / chips', '🍟', '1 waati', '100 g', 'Vegetables & Salad', 32, true, 100, 312, 3.4, 41, 15, null, 'avoid', 'Extreme Glycemic Index, Trans Fat Hazard', 'matrix_v2', now()),
  -- arbi-fried: 280 kcal, P 2.1, C 38, F 13.5 per 100 g (matrix_v2)
  ('arbi-fried', 'Arbi, fried', '🍟', '1 waati', '100 g', 'Vegetables & Salad', 33, true, 100, 280, 2.1, 38, 13.5, null, 'avoid', 'Dense Caloric Trap, Stripped Micronutrients', 'matrix_v2', now()),
  -- cucumber: 15 kcal, P 0.7, C 3.6, F 0.1 per 100 g (matrix_v2)
  ('cucumber', 'Cucumber', '🥒', '1 waati', '100 g', 'Vegetables & Salad', 34, true, 100, 15, 0.7, 3.6, 0.1, null, 'good', 'Maximum Electrolyte Hydration, Silica', 'matrix_v2', now()),
  -- tomato: 18 kcal, P 0.9, C 3.9, F 0.2 per 100 g (matrix_v2)
  ('tomato', 'Tomato', '🍅', '1 waati', '100 g', 'Vegetables & Salad', 35, true, 100, 18, 0.9, 3.9, 0.2, null, 'good', 'Lycopene (Cardio and Prostate Support)', 'matrix_v2', now()),
  -- carrot: 41 kcal, P 0.9, C 9.6, F 0.2 per 100 g (matrix_v2)
  ('carrot', 'Carrot', '🥕', '1 waati', '100 g', 'Vegetables & Salad', 36, true, 100, 41, 0.9, 9.6, 0.2, null, 'good', 'Beta-Carotene, High Fiber Visual Catalyst', 'matrix_v2', now()),
  -- onion: 40 kcal, P 1.1, C 9.3, F 0.1 per 100 g (matrix_v2)
  ('onion', 'Onion', '🧅', '1 waati', '100 g', 'Vegetables & Salad', 37, true, 100, 40, 1.1, 9.3, 0.1, null, 'good', 'Quercetin, Chromium, Anti-Inflammatory', 'matrix_v2', now()),
  -- lettuce: 15 kcal, P 1.4, C 2.9, F 0.2 per 100 g (matrix_v2)
  ('lettuce', 'Lettuce', '🥬', '1 waati', '100 g', 'Vegetables & Salad', 38, true, 100, 15, 1.4, 2.9, 0.2, null, 'good', 'Hydration Matrix, Minimal Calorie Load', 'matrix_v2', now()),
  -- cabbage: 25 kcal, P 1.3, C 5.8, F 0.1 per 100 g (matrix_v2)
  ('cabbage', 'Cabbage', '🥬', '1 waati', '100 g', 'Vegetables & Salad', 39, true, 100, 25, 1.3, 5.8, 0.1, null, 'good', 'Glucosinolates, Cancer-Protective Minerals', 'matrix_v2', now()),
  -- spinach: 23 kcal, P 2.9, C 3.6, F 0.4 per 100 g (matrix_v2)
  ('spinach', 'Spinach', '🥬', '1 waati', '100 g', 'Vegetables & Salad', 40, true, 100, 23, 2.9, 3.6, 0.4, null, 'good', 'Non-Heme Iron, Nitrates for Endurance', 'matrix_v2', now()),
  -- beans-boiled: 35 kcal, P 1.9, C 7.9, F 0.3 per 100 g (matrix_v2)
  ('beans-boiled', 'Green beans, boiled', '🫛', '1 waati', '100 g', 'Vegetables & Salad', 41, true, 100, 35, 1.9, 7.9, 0.3, null, 'good', 'Low Calorie High Crunch Micronutrient', 'matrix_v2', now()),
  -- corn: 86 kcal, P 3.2, C 19, F 1.2 per 100 g (matrix_v2)
  ('corn', 'Sweet corn', '🌽', '1 waati', '100 g', 'Vegetables & Salad', 42, true, 100, 86, 3.2, 19, 1.2, null, 'good', 'Lutein, Zeaxanthin, Optic Pathway Fuel', 'matrix_v2', now()),
  -- bell-pepper: 20 kcal, P 0.9, C 4.6, F 0.2 per 100 g (matrix_v2)
  ('bell-pepper', 'Bell pepper', '🫑', '1 waati', '100 g', 'Vegetables & Salad', 43, true, 100, 20, 0.9, 4.6, 0.2, null, 'good', 'Extreme Vit C Catalyst, Immunity Base', 'matrix_v2', now()),
  -- pumpkin: 26 kcal, P 1, C 6.5, F 0.1 per 100 g (matrix_v2)
  ('pumpkin', 'Pumpkin', '🎃', '1 waati', '100 g', 'Vegetables & Salad', 44, true, 100, 26, 1, 6.5, 0.1, null, 'good', 'Alpha-Carotene, Low Calorie Bulking Food', 'matrix_v2', now()),
  -- cauliflower: 25 kcal, P 1.9, C 5, F 0.3 per 100 g (matrix_v2)
  ('cauliflower', 'Cauliflower', '🥦', '1 waati', '100 g', 'Vegetables & Salad', 45, true, 100, 25, 1.9, 5, 0.3, null, 'good', 'Choline, Indole-3-Carbinol, Recovery Acid', 'matrix_v2', now()),
  -- doodhi: 15 kcal, P 0.6, C 3.7, F 0 per 100 g (reference)
  ('doodhi', 'Doodhi (bottle gourd), cooked', '🥒', '1 waati', '100 g', 'Vegetables & Salad', 46, true, 100, 15, 0.6, 3.7, 0, null, null, null, 'reference', now()),
  -- sponge-gourd: 20 kcal, P 1, C 4.4, F 0.1 per 100 g (reference)
  ('sponge-gourd', 'Sponge gourd (turai), cooked', '🥒', '1 waati', '100 g', 'Vegetables & Salad', 47, true, 100, 20, 1, 4.4, 0.1, null, null, null, 'reference', now()),
  -- bitter-gourd: 19 kcal, P 0.8, C 4.3, F 0.2 per 100 g (reference)
  ('bitter-gourd', 'Bitter gourd (karela), cooked', '🥒', '1 waati', '100 g', 'Vegetables & Salad', 48, true, 100, 19, 0.8, 4.3, 0.2, null, null, null, 'reference', now()),
  -- grilled-veggies: 55 kcal, P 2.5, C 9, F 1.5 per 100 g (reference)
  ('grilled-veggies', 'Mixed veggies, grilled / boiled', '🥗', '1 waati', '100 g', 'Vegetables & Salad', 49, true, 100, 55, 2.5, 9, 1.5, null, null, null, 'reference', now()),
  -- plain-rice: 130 kcal, P 2.7, C 28, F 0.3 per 100 g (matrix_v2)
  ('plain-rice', 'Plain rice', '🍚', '1 waati', '100 g', 'Rice', 50, true, 100, 130, 2.7, 28, 0.3, null, 'watch', 'High Glycemic Muscle Glycogen Replenisher', 'matrix_v2', now()),
  -- brown-rice: 112 kcal, P 2.3, C 23.5, F 0.8 per 100 g (matrix_v2)
  ('brown-rice', 'Brown rice', '🍚', '1 waati', '100 g', 'Rice', 51, true, 100, 112, 2.3, 23.5, 0.8, null, 'good', 'Sustained Low-GI Fuel Release Profile', 'matrix_v2', now()),
  -- khichadi: 120 kcal, P 4.5, C 20, F 2.5 per 100 g (reference)
  ('khichadi', 'Khichadi', '🍚', '1 waati', '100 g', 'Rice', 52, true, 100, 120, 4.5, 20, 2.5, null, null, null, 'reference', now()),
  -- pulao: 150 kcal, P 3, C 25, F 4 per 100 g (reference)
  ('pulao', 'Pulao', '🍛', '1 plate', '~200 g', 'Rice', 53, true, 200, 150, 3, 25, 4, null, null, null, 'reference', now()),
  -- curd-rice: 110 kcal, P 3, C 17, F 3 per 100 g (reference)
  ('curd-rice', 'Curd rice', '🍚', '1 waati', '100 g', 'Rice', 54, true, 100, 110, 3, 17, 3, null, null, null, 'reference', now()),
  -- chicken-biryani: 170 kcal, P 8, C 20, F 6.5 per 100 g (reference)
  ('chicken-biryani', 'Chicken biryani', '🍛', '1 plate', '~250 g', 'Rice', 55, true, 250, 170, 8, 20, 6.5, null, null, null, 'reference', now()),
  -- porridge-oats: 110 kcal, P 4.5, C 15, F 3.5 per 100 g (reference)
  ('porridge-oats', 'Oatmeal porridge', '🥣', '1 waati', '100 g', 'Porridge (in milk)', 56, true, 100, 110, 4.5, 15, 3.5, null, null, null, 'reference', now()),
  -- porridge-ragi: 95 kcal, P 3.5, C 14, F 3 per 100 g (reference)
  ('porridge-ragi', 'Ragi porridge', '🥣', '1 waati', '100 g', 'Porridge (in milk)', 57, true, 100, 95, 3.5, 14, 3, null, null, null, 'reference', now()),
  -- porridge-dalia: 105 kcal, P 4, C 16, F 3 per 100 g (reference)
  ('porridge-dalia', 'Broken wheat (dalia) porridge', '🥣', '1 waati', '100 g', 'Porridge (in milk)', 58, true, 100, 105, 4, 16, 3, null, null, null, 'reference', now()),
  -- porridge-jowar: 100 kcal, P 3.8, C 15, F 3 per 100 g (reference)
  ('porridge-jowar', 'Jowar porridge', '🥣', '1 waati', '100 g', 'Porridge (in milk)', 59, true, 100, 100, 3.8, 15, 3, null, null, null, 'reference', now()),
  -- porridge-cornmeal: 100 kcal, P 3.5, C 16, F 2.8 per 100 g (reference)
  ('porridge-cornmeal', 'Corn meal porridge', '🥣', '1 waati', '100 g', 'Porridge (in milk)', 60, true, 100, 100, 3.5, 16, 2.8, null, null, null, 'reference', now()),
  -- milk: 62 kcal, P 3.2, C 4.8, F 3.3 per 100 g (matrix_v2)
  ('milk', 'Milk', '🥛', '1 glass', '200 ml', 'Dairy', 61, true, 200, 62, 3.2, 4.8, 3.3, null, 'good', 'Vit D, Calcium, Riboflavin', 'matrix_v2', now()),
  -- skimmed-milk: 35 kcal, P 3.4, C 5, F 0.1 per 100 g (matrix_v2)
  ('skimmed-milk', 'Milk, skimmed', '🥛', '1 glass', '200 ml', 'Dairy', 62, true, 200, 35, 3.4, 5, 0.1, null, 'good', 'Isolated Protein, Low Lipids', 'matrix_v2', now()),
  -- taak: 40 kcal, P 3.3, C 4.8, F 0.9 per 100 g (matrix_v2)
  ('taak', 'Buttermilk / taak', '🥛', '1 glass', '200 ml', 'Dairy', 63, true, 200, 40, 3.3, 4.8, 0.9, null, 'good', 'Hydration Matrix, Potassium, Calcium', 'matrix_v2', now()),
  -- curd: 61 kcal, P 3.5, C 4.7, F 3.3 per 100 g (matrix_v2)
  ('curd', 'Curd / dahi', '🍶', '1 waati', '100 g', 'Dairy', 64, true, 100, 61, 3.5, 4.7, 3.3, null, 'good', 'B12, Active Probiotics, Gut Health', 'matrix_v2', now()),
  -- greek-yoghurt: 97 kcal, P 9, C 4, F 5 per 100 g (matrix_v2)
  ('greek-yoghurt', 'Greek yoghurt', '🍶', '1 waati', '100 g', 'Dairy', 65, true, 100, 97, 9, 4, 5, null, 'good', 'Concentrated Amino Acids, Calcium', 'matrix_v2', now()),
  -- paneer: 260 kcal, P 18, C 3.2, F 19.5 per 100 g (matrix_v2)
  ('paneer', 'Paneer', '🧀', '100 g', null, 'Dairy', 66, true, 100, 260, 18, 3.2, 19.5, null, 'good', 'Moisture Retained, Sodium Leached', 'matrix_v2', now()),
  -- paneer-fried: 410 kcal, P 17.2, C 2.8, F 36 per 100 g (matrix_v2)
  ('paneer-fried', 'Paneer, fried', '🧀', '100 g', null, 'Dairy', 67, true, 100, 410, 17.2, 2.8, 36, null, 'watch', 'Conjugated Fat Spike, Saturated Content', 'matrix_v2', now()),
  -- ghee: 897 kcal, P 0, C 0, F 99.5 per 100 g (matrix_v2)
  ('ghee', 'Ghee', '🧈', '1 tsp', '5 g', 'Dairy', 68, true, 5, 897, 0, 0, 99.5, null, 'watch', 'Pure Butyric Acid, Vit A, Extreme Density', 'matrix_v2', now()),
  -- cheese-slice: 310 kcal, P 18, C 6, F 24 per 100 g (reference)
  ('cheese-slice', 'Cheese slice', '🧀', '1 piece', '~20 g', 'Dairy', 69, true, 20, 310, 18, 6, 24, null, null, null, 'reference', now()),
  -- almonds: 35 kcal, P 1.3, C 1.2, F 3 per 6 g (matrix_v2)
  ('almonds', 'Almonds', '🌰', '5 pieces', '~6 g', 'Nuts & Seeds', 70, true, 6, 583.33, 21.67, 20, 50, null, 'good', 'Vit E, Magnesium, High Satiety', 'matrix_v2', now()),
  -- pistachios: 20 kcal, P 0.7, C 1, F 1.6 per 4 g (matrix_v2)
  ('pistachios', 'Pistachios', '🌰', '5 pieces', '~4 g', 'Nuts & Seeds', 71, true, 4, 500, 17.5, 25, 40, null, 'good', 'Vit B6, Potassium, Low Calorie', 'matrix_v2', now()),
  -- cashews: 45 kcal, P 1.4, C 2.4, F 3.5 per 8 g (matrix_v2)
  ('cashews', 'Cashews', '🌰', '5 pieces', '~8 g', 'Nuts & Seeds', 72, true, 8, 562.5, 17.5, 30, 43.75, null, 'good', 'Zinc, Iron, Copper', 'matrix_v2', now()),
  -- peanuts: 30 kcal, P 1.3, C 0.8, F 2.5 per 5 g (matrix_v2)
  ('peanuts', 'Peanuts', '🥜', '5 pieces', '~5 g', 'Nuts & Seeds', 73, true, 5, 600, 26, 16, 50, null, 'good', 'Niacin, Biotin, Protein Dense', 'matrix_v2', now()),
  -- walnuts: 65 kcal, P 1.5, C 1.4, F 6.5 per 10 g (matrix_v2)
  ('walnuts', 'Walnuts', '🌰', '5 pieces', '~10 g', 'Nuts & Seeds', 74, true, 10, 650, 15, 14, 65, null, 'good', 'Omega-3 ALA, Brain Health, Copper', 'matrix_v2', now()),
  -- futana: 369 kcal, P 22.5, C 58, F 5.2 per 100 g (reference)
  ('futana', 'Futana (roasted chana)', '🫘', '1 tbsp', '10 g', 'Nuts & Seeds', 75, true, 10, 369, 22.5, 58, 5.2, null, null, null, 'reference', now()),
  -- pumpkin-seeds: 559 kcal, P 30, C 10.7, F 49 per 100 g (reference)
  ('pumpkin-seeds', 'Pumpkin seeds', '🎃', '1 tbsp', '10 g', 'Nuts & Seeds', 76, true, 10, 559, 30, 10.7, 49, null, null, null, 'reference', now()),
  -- sunflower-seeds: 584 kcal, P 21, C 20, F 51 per 100 g (reference)
  ('sunflower-seeds', 'Sunflower seeds', '🌻', '1 tbsp', '10 g', 'Nuts & Seeds', 77, true, 10, 584, 21, 20, 51, null, null, null, 'reference', now()),
  -- flax-seeds: 534 kcal, P 18.3, C 28.9, F 42.2 per 100 g (reference)
  ('flax-seeds', 'Flax seeds', '🌾', '1 tbsp', '10 g', 'Nuts & Seeds', 78, true, 10, 534, 18.3, 28.9, 42.2, null, null, null, 'reference', now()),
  -- chia-seeds: 486 kcal, P 16.5, C 42.1, F 30.7 per 100 g (reference)
  ('chia-seeds', 'Chia seeds', '🌱', '1 tbsp', '10 g', 'Nuts & Seeds', 79, true, 10, 486, 16.5, 42.1, 30.7, null, null, null, 'reference', now()),
  -- sabja-seeds: 440 kcal, P 14.8, C 64, F 13.8 per 100 g (reference)
  ('sabja-seeds', 'Sabja (basil) seeds', '🌱', '1 tbsp', '10 g', 'Nuts & Seeds', 80, true, 10, 440, 14.8, 64, 13.8, null, null, null, 'reference', now()),
  -- pine-nuts: 673 kcal, P 13.7, C 13.1, F 68.4 per 100 g (reference)
  ('pine-nuts', 'Pine nuts', '🌲', '1 tbsp', '10 g', 'Nuts & Seeds', 81, true, 10, 673, 13.7, 13.1, 68.4, null, null, null, 'reference', now()),
  -- banana: 89 kcal, P 1.1, C 22.8, F 0.3 per 100 g (matrix_v2)
  ('banana', 'Banana', '🍌', '1 piece', '~100 g', 'Fruits', 82, true, 100, 89, 1.1, 22.8, 0.3, null, 'good', 'Potassium Energy Catalyst, Instant Glycogen', 'matrix_v2', now()),
  -- apple: 52 kcal, P 0.3, C 13.8, F 0.2 per 100 g (matrix_v2)
  ('apple', 'Apple', '🍎', '1 piece', '~100 g', 'Fruits', 83, true, 100, 52, 0.3, 13.8, 0.2, null, 'good', 'Pectin Soluble Fiber, Steady Blood Sugar', 'matrix_v2', now()),
  -- mango: 60 kcal, P 0.8, C 15, F 0.4 per 100 g (matrix_v2)
  ('mango', 'Mango', '🥭', '1 piece', '~100 g', 'Fruits', 84, true, 100, 60, 0.8, 15, 0.4, null, 'good', 'Vit C, Vit A, Fructose Spurt Energy', 'matrix_v2', now()),
  -- orange: 47 kcal, P 0.9, C 11.8, F 0.1 per 100 g (matrix_v2)
  ('orange', 'Orange', '🍊', '1 piece', '~100 g', 'Fruits', 85, true, 100, 47, 0.9, 11.8, 0.1, null, 'good', 'High Bioavailable Vit C, Electrolyte Balance', 'matrix_v2', now()),
  -- papaya: 43 kcal, P 0.5, C 10.8, F 0.3 per 100 g (matrix_v2)
  ('papaya', 'Papaya', '🍈', '1 waati', '100 g', 'Fruits', 86, true, 100, 43, 0.5, 10.8, 0.3, null, 'good', 'Papain Enzyme (Protein Digestion Optimizer)', 'matrix_v2', now()),
  -- watermelon: 30 kcal, P 0.6, C 7.6, F 0.2 per 100 g (matrix_v2)
  ('watermelon', 'Watermelon', '🍉', '1 waati', '100 g', 'Fruits', 87, true, 100, 30, 0.6, 7.6, 0.2, null, 'good', 'L-Citrulline (Nitric Oxide Vasodilation), Hydration', 'matrix_v2', now()),
  -- jackfruit: 95 kcal, P 1.7, C 23.2, F 0.6 per 100 g (matrix_v2)
  ('jackfruit', 'Jackfruit', '🍈', '1 waati', '100 g', 'Fruits', 88, true, 100, 95, 1.7, 23.2, 0.6, null, 'good', 'Vit B6, Potassium, Complex Plant Energy', 'matrix_v2', now()),
  -- grapes: 69 kcal, P 0.7, C 18.1, F 0.2 per 100 g (matrix_v2)
  ('grapes', 'Grapes', '🍇', '1 waati', '100 g', 'Fruits', 89, true, 100, 69, 0.7, 18.1, 0.2, null, 'good', 'Resveratrol, Quick Hydrating Muscle Sugar', 'matrix_v2', now()),
  -- pineapple: 50 kcal, P 0.5, C 13.1, F 0.1 per 100 g (matrix_v2)
  ('pineapple', 'Pineapple', '🍍', '1 waati', '100 g', 'Fruits', 90, true, 100, 50, 0.5, 13.1, 0.1, null, 'good', 'Bromelain Enzyme (Muscle Anti-Inflammatory)', 'matrix_v2', now()),
  -- mixed-fruit: 55 kcal, P 0.7, C 14, F 0.2 per 100 g (reference)
  ('mixed-fruit', 'Mixed fruit', '🍇', '1 waati', '100 g', 'Fruits', 91, true, 100, 55, 0.7, 14, 0.2, null, null, null, 'reference', now()),
  -- pear: 57 kcal, P 0.4, C 15.2, F 0.1 per 100 g (reference)
  ('pear', 'Pear', '🍐', '1 piece', '~150 g', 'Fruits', 92, true, 150, 57, 0.4, 15.2, 0.1, null, null, null, 'reference', now()),
  -- pomegranate: 83 kcal, P 1.7, C 18.7, F 1.2 per 100 g (reference)
  ('pomegranate', 'Pomegranate', '🍎', '1 waati', '100 g', 'Fruits', 93, true, 100, 83, 1.7, 18.7, 1.2, null, null, null, 'reference', now()),
  -- avocado: 160 kcal, P 2, C 8.5, F 14.7 per 100 g (reference)
  ('avocado', 'Avocado', '🥑', '1 waati', '100 g', 'Fruits', 94, true, 100, 160, 2, 8.5, 14.7, null, null, null, 'reference', now()),
  -- dates: 282 kcal, P 2.5, C 75, F 0.4 per 100 g (reference)
  ('dates', 'Dates', '🌴', '1 piece', '~8 g', 'Fruits', 95, true, 8, 282, 2.5, 75, 0.4, null, null, null, 'reference', now()),
  -- khareek: 317 kcal, P 2.4, C 75.8, F 0.4 per 100 g (reference)
  ('khareek', 'Khareek (dry dates)', '🌴', '1 piece', '~6 g', 'Fruits', 96, true, 6, 317, 2.4, 75.8, 0.4, null, null, null, 'reference', now()),
  -- raisins: 299 kcal, P 3.1, C 79.2, F 0.5 per 100 g (reference)
  ('raisins', 'Raisins', '🍇', '1 tbsp', '10 g', 'Fruits', 97, true, 10, 299, 3.1, 79.2, 0.5, null, null, null, 'reference', now()),
  -- black-raisins: 290 kcal, P 3, C 76, F 0.4 per 100 g (reference)
  ('black-raisins', 'Black raisins / blackcurrant', '🍇', '1 tbsp', '10 g', 'Fruits', 98, true, 10, 290, 3, 76, 0.4, null, null, null, 'reference', now()),
  -- egg-boiled: 155 kcal, P 12.6, C 1.1, F 10.6 per 100 g (reference)
  ('egg-boiled', 'Egg, boiled', '🥚', '1 piece', '~50 g', 'Non-Veg', 99, true, 50, 155, 12.6, 1.1, 10.6, null, null, null, 'reference', now()),
  -- egg-omelette: 185 kcal, P 11, C 1, F 15 per 100 g (reference)
  ('egg-omelette', 'Egg, omelette', '🍳', '1 piece', '1 egg · ~60 g', 'Non-Veg', 100, true, 60, 185, 11, 1, 15, null, null, null, 'reference', now()),
  -- egg-scrambled: 170 kcal, P 11, C 1.5, F 13 per 100 g (reference)
  ('egg-scrambled', 'Egg, scrambled', '🍳', '1 waati', '100 g', 'Non-Veg', 101, true, 100, 170, 11, 1.5, 13, null, null, null, 'reference', now()),
  -- egg-bhurji: 190 kcal, P 11, C 3, F 15 per 100 g (reference)
  ('egg-bhurji', 'Egg bhurji', '🍳', '1 waati', '100 g', 'Non-Veg', 102, true, 100, 190, 11, 3, 15, null, null, null, 'reference', now()),
  -- chicken-grilled: 165 kcal, P 31, C 0, F 3.6 per 100 g (matrix_v2)
  ('chicken-grilled', 'Chicken breast (skinless)', '🍗', '100 g', null, 'Non-Veg', 103, true, 100, 165, 31, 0, 3.6, null, 'good', 'Pure Lean Muscle Block, Selenium, B6', 'matrix_v2', now()),
  -- chicken-skin: 215 kcal, P 27, C 0, F 15 per 100 g (matrix_v2)
  ('chicken-skin', 'Chicken (with skin)', '🍗', '100 g', null, 'Non-Veg', 104, true, 100, 215, 27, 0, 15, null, 'watch', 'High Saturated Fat Density Payload', 'matrix_v2', now()),
  -- chicken-fried: 290 kcal, P 28.5, C 0, F 18.5 per 100 g (matrix_v2)
  ('chicken-fried', 'Chicken, fried', '🍗', '100 g', null, 'Non-Veg', 105, true, 100, 290, 28.5, 0, 18.5, null, 'avoid', 'Trans/Saturated Fat Matrix Infusion', 'matrix_v2', now()),
  -- chicken-curry: 150 kcal, P 13, C 5, F 9 per 100 g (reference)
  ('chicken-curry', 'Chicken curry', '🍗', '1 waati', '100 g', 'Non-Veg', 106, true, 100, 150, 13, 5, 9, null, null, null, 'reference', now()),
  -- mutton-curry: 190 kcal, P 14, C 5, F 13 per 100 g (reference)
  ('mutton-curry', 'Mutton curry', '🥩', '1 waati', '100 g', 'Non-Veg', 107, true, 100, 190, 14, 5, 13, null, null, null, 'reference', now()),
  -- fish-curry: 130 kcal, P 13, C 4, F 7 per 100 g (reference)
  ('fish-curry', 'Fish curry', '🐟', '1 waati', '100 g', 'Non-Veg', 108, true, 100, 130, 13, 4, 7, null, null, null, 'reference', now()),
  -- fish-fried: 200 kcal, P 20, C 6, F 11 per 100 g (reference)
  ('fish-fried', 'Fish grilled / fried', '🐟', '1 piece', '~100 g', 'Non-Veg', 109, true, 100, 200, 20, 6, 11, null, null, null, 'reference', now()),
  -- prawns: 130 kcal, P 18, C 4, F 5 per 100 g (reference)
  ('prawns', 'Prawns', '🦐', '1 waati', '100 g', 'Non-Veg', 110, true, 100, 130, 18, 4, 5, null, null, null, 'reference', now()),
  -- tandoori: 150 kcal, P 25, C 2, F 5 per 100 g (reference)
  ('tandoori', 'Tandoori chicken', '🍗', '1 piece', '~100 g', 'Non-Veg', 111, true, 100, 150, 25, 2, 5, null, null, null, 'reference', now()),
  -- pork-lean: 145 kcal, P 21, C 0, F 6 per 100 g (matrix_v2)
  ('pork-lean', 'Pork, lean', '🥩', '100 g', null, 'Non-Veg', 112, true, 100, 145, 21, 0, 6, null, 'good', 'Thiamine (B1) Super Engine Catalyst', 'matrix_v2', now()),
  -- pork-fat: 295 kcal, P 17, C 0, F 25 per 100 g (matrix_v2)
  ('pork-fat', 'Pork, with fat', '🥩', '100 g', null, 'Non-Veg', 113, true, 100, 295, 17, 0, 25, null, 'watch', 'High Caloric Loading, Saturated Stress', 'matrix_v2', now()),
  -- beef-lean: 250 kcal, P 26, C 0, F 15 per 100 g (matrix_v2)
  ('beef-lean', 'Beef, lean', '🥩', '100 g', null, 'Non-Veg', 114, true, 100, 250, 26, 0, 15, null, 'watch', 'Heme Iron, Zinc, Highly Bioavailable Creatine', 'matrix_v2', now()),
  -- buff-lean: 130 kcal, P 22.4, C 0, F 2.4 per 100 g (matrix_v2)
  ('buff-lean', 'Buff, lean', '🥩', '100 g', null, 'Non-Veg', 115, true, 100, 130, 22.4, 0, 2.4, null, 'good', 'Ultra-Lean Competitor Beef, High Iron Base', 'matrix_v2', now()),
  -- water: 0 kcal, P 0, C 0, F 0 per 100 g (app_default)
  ('water', 'Water', '💧', '1 glass', '200 ml', 'Beverages', 116, true, 200, 0, 0, 0, 0, null, 'good', null, 'app_default', now()),
  -- tea: 50 kcal, P 1.6, C 8.5, F 1.8 per 100 g (matrix_v2)
  ('tea', 'Tea / chai', '🍵', '1 cup', '100 ml', 'Beverages', 117, true, 100, 50, 1.6, 8.5, 1.8, null, 'watch', 'Simple Sugar Spike Profile', 'matrix_v2', now()),
  -- black-tea: 1 kcal, P 0.1, C 0.2, F 0 per 100 g (matrix_v2)
  ('black-tea', 'Black tea', '🍵', '1 cup', '100 ml', 'Beverages', 118, true, 100, 1, 0.1, 0.2, 0, null, 'good', 'Theaflavins, L-Theanine Cognitive Focus', 'matrix_v2', now()),
  -- coffee: 45 kcal, P 1.5, C 7, F 1.5 per 100 g (matrix_v2)
  ('coffee', 'Coffee', '☕', '1 cup', '100 ml', 'Beverages', 119, true, 100, 45, 1.5, 7, 1.5, null, 'watch', 'Hidden Insulin Spiker Framework', 'matrix_v2', now()),
  -- black-coffee: 1 kcal, P 0.1, C 0, F 0 per 100 g (matrix_v2)
  ('black-coffee', 'Black coffee', '☕', '1 cup', '100 ml', 'Beverages', 120, true, 100, 1, 0.1, 0, 0, null, 'good', 'Caffeine Ergogenic Aid, Chlorogenic Acid', 'matrix_v2', now()),
  -- juice: 45 kcal, P 0.5, C 11, F 0.1 per 100 g (reference)
  ('juice', 'Juice', '🧃', '1 glass', '200 ml', 'Beverages', 121, true, 200, 45, 0.5, 11, 0.1, null, null, null, 'reference', now()),
  -- coconut-water: 19 kcal, P 0.7, C 3.7, F 0.2 per 100 g (reference)
  ('coconut-water', 'Coconut water', '🥥', '1 glass', '200 ml', 'Beverages', 122, true, 200, 19, 0.7, 3.7, 0.2, null, null, null, 'reference', now()),
  -- lassi: 90 kcal, P 3, C 14, F 2.5 per 100 g (reference)
  ('lassi', 'Lassi', '🥛', '1 glass', '200 ml', 'Beverages', 123, true, 200, 90, 3, 14, 2.5, null, null, null, 'reference', now()),
  -- soft-drink: 42 kcal, P 0, C 10.6, F 0 per 100 g (matrix_v2)
  ('soft-drink', 'Soft drink / cola', '🥤', '1 glass', '200 ml', 'Beverages', 124, true, 200, 42, 0, 10.6, 0, null, 'avoid', 'High Fructose Corn Syrup Damage, Acidity', 'matrix_v2', now()),
  -- diet-soda: 0 kcal, P 0, C 0, F 0 per 100 g (matrix_v2)
  ('diet-soda', 'Diet / zero soda', '🥤', '1 glass', '200 ml', 'Beverages', 125, true, 200, 0, 0, 0, 0, null, 'watch', 'Artificial Sweeteners (Non-Caloric Matrix)', 'matrix_v2', now()),
  -- sports-drink: 26 kcal, P 0, C 6.4, F 0 per 100 g (reference)
  ('sports-drink', 'Sports drink', '🍶', '1 bottle', '1 L', 'Beverages', 126, true, 1000, 26, 0, 6.4, 0, null, null, null, 'reference', now()),
  -- whey-shake: 120 kcal, P 24, C 2, F 1.5 per 30 g (matrix_v2)
  ('whey-shake', 'Whey shake', '🥤', '1 scoop', 'in water', 'Supplements', 127, true, 30, 400, 80, 6.67, 5, null, 'good', 'Immediate Leucine Recovery BCAA Spike', 'matrix_v2', now()),
  -- mass-gainer: 380 kcal, P 20, C 70, F 3 per 100 g (matrix_v2)
  ('mass-gainer', 'Mass gainer', '🥤', '1 scoop', 'in water', 'Supplements', 128, true, 100, 380, 20, 70, 3, null, 'watch', 'Maltodextrin Overload, Fast Glycemic Load', 'matrix_v2', now()),
  -- poha: 130 kcal, P 2.5, C 23, F 3.5 per 100 g (reference)
  ('poha', 'Poha', '🍚', '1 waati', '100 g', 'Snacks', 129, true, 100, 130, 2.5, 23, 3.5, null, null, null, 'reference', now()),
  -- upma: 140 kcal, P 3.5, C 21, F 4.5 per 100 g (reference)
  ('upma', 'Upma', '🥣', '1 waati', '100 g', 'Snacks', 130, true, 100, 140, 3.5, 21, 4.5, null, null, null, 'reference', now()),
  -- idli: 120 kcal, P 6, C 28, F 1 per 100 g (email_2026_10_02)
  ('idli', 'Idli', '🍙', '1 piece', '~40 g', 'Snacks', 131, true, 40, 120, 6, 28, 1, null, 'good', 'Excellent Choice. High bioavailability via fermentation.', 'email_2026_10_02', now()),
  -- dosa: 165 kcal, P 4, C 29, F 3.5 per 100 g (email_2026_10_02)
  ('dosa', 'Dosa, plain', '🥞', '1 piece', '~80 g', 'Snacks', 132, true, 80, 165, 4, 29, 3.5, null, 'good', 'Safe, clean complex carbs if prepared without excess butter/ghee.', 'email_2026_10_02', now()),
  -- masala-dosa: 250 kcal, P 5, C 40, F 8 per 100 g (email_2026_10_02)
  ('masala-dosa', 'Masala dosa', '🥞', '1 piece', '~150 g', 'Snacks', 133, true, 150, 250, 5, 40, 8, null, 'watch', 'Hidden Trap. Added oil and high-glycemic potato mash.', 'email_2026_10_02', now()),
  -- vada: 300 kcal, P 9, C 30, F 16 per 100 g (reference)
  ('vada', 'Medu vada', '🍩', '1 piece', '~50 g', 'Snacks', 134, true, 50, 300, 9, 30, 16, null, null, null, 'reference', now()),
  -- wada-pav: 300 kcal, P 6.7, C 30.7, F 16.7, Na 450 mg per 150 g (email_2026_10_02)
  ('wada-pav', 'Wada pav', '🍔', '1 piece', null, 'Snacks', 135, true, 150, 200, 4.47, 20.47, 11.13, 300, 'avoid', '~450mg Sodium. Massive trans-fat spike from deep frying.', 'email_2026_10_02', now()),
  -- samosa: 310 kcal, P 5, C 32, F 18 per 100 g (reference)
  ('samosa', 'Samosa', '🥟', '1 piece', '~70 g', 'Snacks', 136, true, 70, 310, 5, 32, 18, null, null, null, 'reference', now()),
  -- sandwich: 210 kcal, P 7, C 30, F 7 per 100 g (reference)
  ('sandwich', 'Sandwich', '🥪', '1 piece', 'veg · ~120 g', 'Snacks', 137, true, 120, 210, 7, 30, 7, null, null, null, 'reference', now()),
  -- biscuits: 450 kcal, P 6.5, C 77, F 12.5 per 100 g (email_2026_10_02)
  ('biscuits', 'Glucose biscuits', '🍪', '1 piece', '~6 g', 'Snacks', 138, true, 6, 450, 6.5, 77, 12.5, null, 'avoid', 'High in Refined Palm Oil and processed sugar syrups.', 'email_2026_10_02', now()),
  -- cream-biscuits: 480 kcal, P 5, C 70, F 20 per 100 g (email_2026_10_02)
  ('cream-biscuits', 'Cream biscuits', '🍪', '1 piece', '~12 g', 'Snacks', 139, true, 12, 480, 5, 70, 20, null, 'avoid', 'Pure hydrogenated fats. Causes instant insulin crashes.', 'email_2026_10_02', now()),
  -- maggi: 140 kcal, P 3, C 19, F 6 per 100 g (reference)
  ('maggi', 'Maggi / noodles', '🍜', '1 waati', '100 g', 'Snacks', 140, true, 100, 140, 3, 19, 6, null, null, null, 'reference', now()),
  -- chivda: 450 kcal, P 8, C 55, F 22 per 100 g (email_2026_10_02)
  ('chivda', 'Chivda / namkeen', '🥜', '1 waati', '100 g', 'Snacks', 141, true, 100, 450, 8, 55, 22, null, 'avoid', 'High glycemic spike combined with heavy processing lipids.', 'email_2026_10_02', now()),
  -- sev: 480 kcal, P 11.5, C 42, F 29.5, Na 500 mg per 100 g (email_2026_10_02)
  ('sev', 'Sev / shev', '🥨', '1 waati', '100 g', 'Snacks', 142, true, 100, 480, 11.5, 42, 29.5, 500, 'avoid', '~500mg+ Sodium. Fried chickpea flour; extreme caloric density.', 'email_2026_10_02', now()),
  -- peanut-butter: 588 kcal, P 25, C 20, F 50 per 100 g (reference)
  ('peanut-butter', 'Peanut butter', '🥜', '1 tbsp', '16 g', 'Snacks', 143, true, 16, 588, 25, 20, 50, null, null, null, 'reference', now()),
  -- hummus: 166 kcal, P 7.9, C 14.3, F 9.6 per 100 g (reference)
  ('hummus', 'Hummus', '🫘', '1 tbsp', '15 g', 'Snacks', 144, true, 15, 166, 7.9, 14.3, 9.6, null, null, null, 'reference', now()),
  -- coconut-chutney: 180 kcal, P 2.5, C 7, F 16 per 100 g (reference)
  ('coconut-chutney', 'Coconut chutney', '🥥', '1 tbsp', '15 g', 'Snacks', 145, true, 15, 180, 2.5, 7, 16, null, null, null, 'reference', now()),
  -- sugar: 16 kcal, P 0, C 4.2, F 0 per 4 g (matrix_v2)
  ('sugar', 'Sugar', '🍬', '1 tsp', '4 g', 'Sweets', 146, true, 4, 400, 0, 105, 0, null, 'avoid', '100% Sucrose, Immediate Blood Glucose Shock', 'matrix_v2', now()),
  -- jaggery: 19 kcal, P 0, C 4.8, F 0 per 5 g (matrix_v2)
  ('jaggery', 'Jaggery / gul', '🍯', '1 tsp', '5 g', 'Sweets', 147, true, 5, 380, 0, 96, 0, null, 'watch', 'Trace Iron, Potassium, Slower Fructose Link', 'matrix_v2', now()),
  -- modak: 230 kcal, P 3, C 40, F 7 per 100 g (reference)
  ('modak', 'Modak', '🍡', '1 piece', '~40 g', 'Sweets', 148, true, 40, 230, 3, 40, 7, null, null, null, 'reference', now()),
  -- laddu: 185 kcal, P 2, C 28, F 8 per 50 g (matrix_v2)
  ('laddu', 'Laddu', '🍡', '1 piece', '~50 g', 'Sweets', 149, true, 50, 370, 4, 56, 16, null, 'avoid', 'Gram Flour Fried in Ghee, Extreme Fat/Carb', 'matrix_v2', now()),
  -- barfi: 420 kcal, P 9, C 55, F 18 per 100 g (reference)
  ('barfi', 'Barfi', '🍬', '1 piece', '~30 g', 'Sweets', 150, true, 30, 420, 9, 55, 18, null, null, null, 'reference', now()),
  -- jalebi: 400 kcal, P 2, C 60, F 17 per 100 g (reference)
  ('jalebi', 'Jalebi', '🥨', '1 piece', '~30 g', 'Sweets', 151, true, 30, 400, 2, 60, 17, null, null, null, 'reference', now()),
  -- gulab-jamun: 175 kcal, P 2.5, C 26, F 7 per 50 g (matrix_v2)
  ('gulab-jamun', 'Gulab jamun', '🍡', '1 piece', '~50 g', 'Sweets', 152, true, 50, 350, 5, 52, 14, null, 'avoid', 'Deep Fried Dairy, Heavy Sugar Syrup Lock', 'matrix_v2', now()),
  -- kheer: 140 kcal, P 4, C 20, F 5 per 100 g (reference)
  ('kheer', 'Kheer', '🥣', '1 waati', '100 g', 'Sweets', 153, true, 100, 140, 4, 20, 5, null, null, null, 'reference', now()),
  -- shrikhand: 250 kcal, P 6, C 40, F 7 per 100 g (reference)
  ('shrikhand', 'Shrikhand', '🍶', '1 waati', '100 g', 'Sweets', 154, true, 100, 250, 6, 40, 7, null, null, null, 'reference', now()),
  -- ice-cream: 207 kcal, P 3.5, C 24, F 11 per 100 g (reference)
  ('ice-cream', 'Ice cream', '🍨', '1 scoop', '~60 g', 'Sweets', 155, true, 60, 207, 3.5, 24, 11, null, null, null, 'reference', now()),
  -- chocolate: 535 kcal, P 7.6, C 59, F 30 per 100 g (reference)
  ('chocolate', 'Chocolate', '🍫', '1 piece', '~10 g', 'Sweets', 156, true, 10, 535, 7.6, 59, 30, null, null, null, 'reference', now()),
  -- chocolate-cake: 235 kcal, P 3.2, C 32, F 10.5 per 60 g (matrix_v2)
  ('chocolate-cake', 'Chocolate cake', '🍰', '1 slice', '~60 g', 'Sweets', 157, true, 60, 391.67, 5.33, 53.33, 17.5, null, 'avoid', 'Refined Flour, Trans-Fat Frosting Matrix', 'matrix_v2', now())
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
  nutrition_updated_at = excluded.nutrition_updated_at
where public.food_catalog.nutrition_source is distinct from 'kfandra';
-- END GENERATED: diet nutrition seed
