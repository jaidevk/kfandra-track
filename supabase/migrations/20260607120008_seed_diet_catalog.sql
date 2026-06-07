-- ============================================================================
-- 20260607120008 — Seed Diet catalogue (meal slots + food list)
-- ----------------------------------------------------------------------------
-- Seeds the eight time-windowed meal_slots and the V1 bilingual food_catalog
-- (9 sections, ~60 items) from docs/diet-feature-design-2026-05-09.md.
-- Idempotent: keyed upserts so re-running tops up without duplicating. Staff
-- can prune/extend later via the (future) admin screen; is_active gates display.
-- ============================================================================

-- ─── Meal slots (sort_order follows the day, Midnight Snack first) ───────────
insert into public.meal_slots (key, name, window_label, emoji, start_min, end_min, sort_order)
values
  ('midnight',    'Midnight Snack',       '10 pm – 2 am', '🌙', 1320, 1560, 1),
  ('breakfast',   'Breakfast',            '6 am – 9 am',  '🌅',  360,  540, 2),
  ('mid-morning', 'Mid-Morning Snack',    '9 am – 12 pm', '☕',  540,  720, 3),
  ('lunch',       'Lunch',                '12 pm – 2 pm', '🍱',  720,  840, 4),
  ('midday',      'Midday Snack',         '2 pm – 4 pm',  '🍪',  840,  960, 5),
  ('evening-tea', 'Evening Tea & Snacks', '4 pm – 6 pm',  '🍵',  960, 1080, 6),
  ('supper',      'Supper',               '6 pm – 8 pm',  '🍽️', 1080, 1200, 7),
  ('post-supper', 'Post-Supper Snack',    '8 pm – 10 pm', '🌃', 1200, 1320, 8)
on conflict (key) do update set
  name         = excluded.name,
  window_label = excluded.window_label,
  emoji        = excluded.emoji,
  start_min    = excluded.start_min,
  end_min      = excluded.end_min,
  sort_order   = excluded.sort_order,
  is_active    = true;

-- ─── Food catalogue (sort_order increasing: sections in order, items in order) ─
insert into public.food_catalog (key, name, emoji, unit, unit_detail, section_label, sort_order)
values
  -- Grains & Bread
  ('white-bread',     'White bread',          '🍞', '1 slice',  null,    'Grains & Bread',  1),
  ('brown-bread',     'Brown bread',          '🍞', '1 slice',  null,    'Grains & Bread',  2),
  ('roti',            'Roti / phulka',        '🫓', '1 piece',  null,    'Grains & Bread',  3),
  ('paratha',         'Paratha',              '🫓', '1 piece',  null,    'Grains & Bread',  4),
  ('naan',            'Naan',                 '🫓', '1 piece',  null,    'Grains & Bread',  5),
  ('bhakri',          'Bhakri',               '🫓', '1 piece',  null,    'Grains & Bread',  6),
  -- Dals & Sabzi
  ('dal',             'Dal / varan',          '🥣', '1 waati',  '150 g', 'Dals & Sabzi',    7),
  ('bhendi',          'Bhendi bhaji',         '🥬', '1 waati',  null,    'Dals & Sabzi',    8),
  ('mixed-sabzi',     'Mixed sabzi',          '🥗', '1 waati',  null,    'Dals & Sabzi',    9),
  ('aloo-bhaji',      'Aloo bhaji',           '🥔', '1 waati',  null,    'Dals & Sabzi',    10),
  ('paneer-sabzi',    'Paneer sabzi',         '🧀', '1 waati',  null,    'Dals & Sabzi',    11),
  ('chana',           'Chana / chole',        '🫘', '1 waati',  null,    'Dals & Sabzi',    12),
  -- Rice
  ('plain-rice',      'Plain rice',           '🍚', '1 waati',  null,    'Rice',            13),
  ('khichadi',        'Khichadi',             '🍚', '1 waati',  null,    'Rice',            14),
  ('pulao',           'Pulao / biryani',      '🍛', '1 plate',  null,    'Rice',            15),
  ('curd-rice',       'Curd rice',            '🍚', '1 waati',  null,    'Rice',            16),
  -- Dairy
  ('milk',            'Milk',                 '🥛', '1 glass',  '200 ml','Dairy',           17),
  ('taak',            'Buttermilk / taak',    '🥛', '1 glass',  '200 ml','Dairy',           18),
  ('curd',            'Curd / dahi',          '🍶', '1 waati',  null,    'Dairy',           19),
  ('cheese-slice',    'Cheese slice',         '🧀', '1 piece',  null,    'Dairy',           20),
  -- Fruits
  ('banana',          'Banana',               '🍌', '1 piece',  null,    'Fruits',          21),
  ('apple',           'Apple',                '🍎', '1 piece',  null,    'Fruits',          22),
  ('mango',           'Mango',                '🥭', '1 piece',  null,    'Fruits',          23),
  ('papaya',          'Papaya',               '🍈', '1 waati',  null,    'Fruits',          24),
  ('watermelon',      'Watermelon',           '🍉', '1 waati',  null,    'Fruits',          25),
  ('mixed-fruit',     'Mixed fruit',          '🍇', '1 waati',  null,    'Fruits',          26),
  -- Non-Veg
  ('egg-boiled',      'Egg, boiled',          '🥚', '1 piece',  null,    'Non-Veg',         27),
  ('egg-omelette',    'Egg, omelette',        '🍳', '1 piece',  null,    'Non-Veg',         28),
  ('egg-scrambled',   'Egg, scrambled',       '🍳', '1 waati',  null,    'Non-Veg',         29),
  ('chicken-curry',   'Chicken curry',        '🍗', '1 waati',  null,    'Non-Veg',         30),
  ('chicken-grilled', 'Chicken grilled',      '🍗', '1 piece',  '~100 g','Non-Veg',         31),
  ('mutton-curry',    'Mutton curry',         '🥩', '1 waati',  null,    'Non-Veg',         32),
  ('fish-curry',      'Fish curry',           '🐟', '1 waati',  null,    'Non-Veg',         33),
  ('fish-fried',      'Fish grilled / fried', '🐟', '1 piece',  null,    'Non-Veg',         34),
  ('prawns',          'Prawns',               '🦐', '1 waati',  null,    'Non-Veg',         35),
  ('tandoori',        'Tandoori chicken',     '🍗', '1 piece',  null,    'Non-Veg',         36),
  -- Beverages
  ('water',           'Water',                '💧', '1 glass',  '200 ml','Beverages',       37),
  ('tea',             'Tea / chai',           '🍵', '1 cup',    null,    'Beverages',       38),
  ('coffee',          'Coffee',               '☕', '1 cup',    null,    'Beverages',       39),
  ('juice',           'Juice',                '🧃', '1 glass',  null,    'Beverages',       40),
  ('coconut-water',   'Coconut water',        '🥥', '1 glass',  null,    'Beverages',       41),
  ('lassi',           'Lassi',                '🥛', '1 glass',  null,    'Beverages',       42),
  ('soft-drink',      'Soft drink / cola',    '🥤', '1 glass',  null,    'Beverages',       43),
  ('sports-drink',    'Sports drink',         '🍶', '1 bottle', '1 L',   'Beverages',       44),
  -- Snacks
  ('poha',            'Poha',                 '🍚', '1 waati',  null,    'Snacks',          45),
  ('upma',            'Upma',                 '🥣', '1 waati',  null,    'Snacks',          46),
  ('idli',            'Idli',                 '🍙', '1 piece',  null,    'Snacks',          47),
  ('dosa',            'Dosa',                 '🥞', '1 piece',  null,    'Snacks',          48),
  ('vada',            'Vada',                 '🍩', '1 piece',  null,    'Snacks',          49),
  ('samosa',          'Samosa',               '🥟', '1 piece',  null,    'Snacks',          50),
  ('sandwich',        'Sandwich',             '🥪', '1 piece',  null,    'Snacks',          51),
  ('biscuits',        'Biscuits',             '🍪', '1 piece',  null,    'Snacks',          52),
  ('maggi',           'Maggi / noodles',      '🍜', '1 waati',  null,    'Snacks',          53),
  ('chivda',          'Chivda / namkeen',     '🥜', '1 waati',  null,    'Snacks',          54),
  -- Sweets
  ('modak',           'Modak',                '🍡', '1 piece',  null,    'Sweets',          55),
  ('laddu',           'Laddu',                '🍡', '1 piece',  null,    'Sweets',          56),
  ('barfi',           'Barfi',                '🍬', '1 piece',  null,    'Sweets',          57),
  ('jalebi',          'Jalebi',               '🥨', '1 piece',  null,    'Sweets',          58),
  ('gulab-jamun',     'Gulab jamun',          '🍡', '1 piece',  null,    'Sweets',          59),
  ('kheer',           'Kheer',                '🥣', '1 waati',  null,    'Sweets',          60),
  ('shrikhand',       'Shrikhand',            '🍶', '1 waati',  null,    'Sweets',          61),
  ('ice-cream',       'Ice cream',            '🍨', '1 scoop',  null,    'Sweets',          62),
  ('chocolate',       'Chocolate',            '🍫', '1 piece',  null,    'Sweets',          63)
on conflict (key) do update set
  name          = excluded.name,
  emoji         = excluded.emoji,
  unit          = excluded.unit,
  unit_detail   = excluded.unit_detail,
  section_label = excluded.section_label,
  sort_order    = excluded.sort_order,
  is_active     = true;
