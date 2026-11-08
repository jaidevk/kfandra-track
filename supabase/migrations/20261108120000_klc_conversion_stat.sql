-- KLC Rugby Sox conversion stat (Helper-bsr.16, spec 2026-11-08 §6).
--
-- Stat rates: MERGE, so any rate KFANDRA has edited is kept and only the new
-- key is added (excluded.value || existing: the existing keys win). The
-- literal below is the full default set, so config-contract.test.ts can
-- compare it with DEFAULT_STAT_RATES.
insert into public.app_config (key, value, description) values (
  'klcsra_stat_rates',
  '{
    "goal":         {"kr": 20,  "mmg": 500},
    "try":          {"kr": 25,  "mmg": 500},
    "conversion":   {"kr": 25,  "mmg": 500},
    "mainGoal":     {"kr": 20,  "mmg": 500},
    "reboundGoal":  {"kr": 10,  "mmg": 300},
    "assist":       {"kr": 10,  "mmg": 200},
    "preAssist":    {"kr": 5,   "mmg": 100},
    "switchover":   {"kr": 5,   "mmg": 100},
    "tackle":       {"kr": 5,   "mmg": 100},
    "save":         {"kr": 5,   "mmg": 200},
    "yellowCard":   {"kr": -10, "mmg": -200},
    "redCard":      {"kr": -20, "mmg": -500},
    "blueCard":     {"kr": -30, "mmg": -1000},
    "lateChallenge":{"kr": -5,  "mmg": -100},
    "ownGoal":      {"kr": -20, "mmg": -500},
    "ownAssist":    {"kr": -10, "mmg": -200},
    "ownPreAssist": {"kr": -5,  "mmg": -100}
  }'::jsonb,
  'KLCSRA per-stat payout: Kroopies (kr) + MMG points (mmg) per event. Admin-editable.'
) on conflict (key) do update set value = excluded.value || public.app_config.value;

-- Sport allow-lists: overwritten in full, as 20261020120000 did.
insert into public.app_config (key, value, description) values (
  'klcsra_sport_stats',
  '{
    "football":  ["goal","assist","preAssist","save","yellowCard","redCard","blueCard","lateChallenge","ownGoal","ownAssist","ownPreAssist"],
    "fooba":     ["mainGoal","reboundGoal","switchover","assist","preAssist","save","yellowCard","redCard","blueCard","lateChallenge","ownGoal","ownAssist","ownPreAssist"],
    "rugby":     ["try","conversion","tackle","assist","preAssist","yellowCard","redCard","blueCard","lateChallenge"],
    "rugby_variation":      ["goal","try","conversion","mainGoal","reboundGoal","assist","preAssist","switchover","tackle","save","yellowCard","redCard","blueCard","lateChallenge","ownGoal","ownAssist","ownPreAssist"],
    "short_game_variation": ["goal","try","conversion","mainGoal","reboundGoal","assist","preAssist","switchover","tackle","save","yellowCard","redCard","blueCard","lateChallenge","ownGoal","ownAssist","ownPreAssist"],
    "multi_game_variation": ["goal","try","conversion","mainGoal","reboundGoal","assist","preAssist","switchover","tackle","save","yellowCard","redCard","blueCard","lateChallenge","ownGoal","ownAssist","ownPreAssist"]
  }'::jsonb,
  'KLCSRA per-sport stat allow-list. The recorder filters the stats popup by sport; disallowed keys are ignored by the payout compute.'
) on conflict (key) do update set value = excluded.value, description = excluded.description;
