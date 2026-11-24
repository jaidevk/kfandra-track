-- KLC league points, 4–6 player tier (total players across both sides).
-- KFANDRA, 22 November 2026: win 1 -> 3 for every match type, draw 0.2 -> 0.5.
-- 7+ and 2–3 are unchanged. Points are worked out from the recorded score on
-- every read, so this applies to all matches; production had no official
-- league matches when this was written.
--
-- Full value (not jsonb_set) so config-contract.test.ts can compare it with
-- DEFAULT_STANDINGS_RULES. This migration now owns the key's current value.
insert into public.app_config (key, value, description) values (
  'klcsra_standings_rules',
  '{
    "version": 2,
    "playerCount": "total",
    "tiers": [
      {"key": "7plus", "min": 7, "max": null},
      {"key": "4to6",  "min": 4, "max": 6},
      {"key": "2to3",  "min": 2, "max": 3}
    ],
    "win": {
      "football":             {"7plus": 5, "4to6": 3, "2to3": 0.5},
      "fooba":                {"7plus": 5, "4to6": 3, "2to3": 0.5},
      "rugby":                {"7plus": 5, "4to6": 3, "2to3": 0.5},
      "rugby_variation":      {"7plus": 3, "4to6": 3, "2to3": 0.5},
      "short_game_variation": {"7plus": 3, "4to6": 3, "2to3": 0.5},
      "multi_game_variation": {"7plus": 3, "4to6": 3, "2to3": 0.5}
    },
    "draw": {"7plus": 1, "4to6": 0.5, "2to3": 0.1},
    "loss": 0
  }'::jsonb,
  'KLC league points v2: win points by match type x tier (total players across both sides), draw points by tier, loss. 4–6 tier changed by KFANDRA 2026-11-22. No session caps (ground rule only).'
) on conflict (key) do update set value = excluded.value, description = excluded.description, updated_at = now();
