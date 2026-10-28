-- ============================================================================
-- 20261028120000 — KLC's Multi-Game Variations table
-- ----------------------------------------------------------------------------
-- KFANDRA (2026-10-28) asked for a separate table for Multi-Game Variations.
-- Until now they counted in "All" only. Same points scale; only the table
-- group list changes. Array order is display order (see table-groups.ts).
-- ============================================================================

insert into public.app_config (key, value, description) values (
  'klcsra_table_groups',
  '[
    {"key": "all",                   "sports": "*"},
    {"key": "football_fooba",        "sports": ["football","fooba"]},
    {"key": "rugby_sox",             "sports": ["rugby"]},
    {"key": "rugby_variations",      "sports": ["rugby_variation"]},
    {"key": "short_game_variations", "sports": ["short_game_variation"]},
    {"key": "multi_game_variations", "sports": ["multi_game_variation"]}
  ]'::jsonb,
  'KLC league tables: ordered array of {key, sports} ("*" = all match types). Array order is display order (an array because jsonb does not keep object key order).'
) on conflict (key) do update set value = excluded.value, description = excluded.description;
