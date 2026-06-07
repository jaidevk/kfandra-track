-- ============================================================================
-- 20260607120006 — Seed game types & point rules (D1–D11)
-- ----------------------------------------------------------------------------
-- Seeds the APPROVED scoring config. Values come from the approved MMG mockup
-- (src/app/mockups/mmg-session), which realizes the locked D1–D11 decisions —
-- notably D2 "keep it consistent", which flattens the raw rule doc's per-context
-- reductions (e.g. rebound-wall goal) into uniform values.
--
-- All of this is admin-editable at runtime via the point_rules / game_types
-- tables; this migration only establishes the starting point.
--
-- point_rules.scope:
--   result        — won/drew/lost
--   stat          — per-game stat counts (keyed to mockup StatKey)
--   participation — packing + confirmation bonuses
--   order         — base unit for the N×100 order-of-arrival ladder
-- game_type_id NULL = default value; set = per-game-type override.
-- ============================================================================

-- ─── Game types (mockup GAME_LABEL, in display order) ───────────────────────
insert into public.game_types (key, name, emoji, sort_order) values
  ('football-short', 'Football short',   '⚽', 1),
  ('rugby-short',    'Rugby short',      '🏉', 2),
  ('rugby-full',     'Rugby full',       '🏉', 3),
  ('fooba-big-goal', 'Fooba (Big Goal)', '🥅', 4),
  ('fooba-rebound',  'Fooba (Rebound)',  '🧱', 5),
  ('three-and-in',   '3-and-in',         '🎯', 6),
  ('other',          'Other',            '✨', 7);

-- ─── Result points (D4 win 1000, draw 100; D11 lost 0) ──────────────────────
insert into public.point_rules (scope, rule_key, label, points) values
  ('result', 'won',  'Won',  1000),
  ('result', 'drew', 'Drew',  100),
  ('result', 'lost', 'Lost',    0);

-- ─── Default stat points (mockup STAT_DEFS) ─────────────────────────────────
-- D1 tries 500; D2 goal 500 / assist 200 / pre-assist 100 (consistent);
-- D6 saves & goal-line saves 500; D8 cards & penalties.
insert into public.point_rules (scope, rule_key, label, points) values
  ('stat', 'goals',          'Goals',           500),
  ('stat', 'tries',          'Tries',           500),
  ('stat', 'assists',        'Assists',         200),
  ('stat', 'preAssists',     'Pre-assists',     100),
  ('stat', 'saves',          'Saves',           500),
  ('stat', 'goalLineSaves',  'Goal-line saves', 500),
  ('stat', 'reboundWall',    'Rebound wall',    500),
  ('stat', 'tackles',        'Tackle',          200),
  ('stat', 'yellowCards',    'Yellow card',    -100),
  ('stat', 'redCards',       'Red card',       -500),
  ('stat', 'blueCards',      'Blue card',     -1000),
  ('stat', 'lateChallenges', 'Late challenge', -100),
  ('stat', 'fouls',          'Foul',           -200);

-- ─── Per-game-type stat override (mockup STAT_MULT_OVERRIDE) ─────────────────
-- Rugby tackle is worth 500 (Touch/Normal) instead of the default 200.
insert into public.point_rules (scope, rule_key, label, points, game_type_id)
select 'stat', 'tackles', 'Tackle (Touch/Normal)', 500, id
from public.game_types
where key in ('rugby-short', 'rugby-full');

-- ─── Goal conceded (D3): Big Goal only ──────────────────────────────────────
-- Scored ONLY on Fooba (Big Goal). Seeded as a per-game-type rule with no
-- default counterpart, so short games and other types never apply it.
insert into public.point_rules (scope, rule_key, label, points, game_type_id)
select 'stat', 'goalConceded', 'Goal conceded', -200, id
from public.game_types
where key = 'fooba-big-goal';

-- ─── Participation (D9 packing; D10 confirmation bonus) ──────────────────────
insert into public.point_rules (scope, rule_key, label, points) values
  ('participation', 'unpacking',         'GWW unpacking',                 500),
  ('participation', 'packing_weights',   'GWW packing',                   500),
  ('participation', 'packing_kit',       'Session packing (PTM)',         200),
  ('participation', 'confirmed_by_11am', 'Confirmed availability (bonus)', 500);

-- ─── Order ladder base unit ─────────────────────────────────────────────────
-- Confirmation & arrival both score N×100 down to 100 (1st of N → N×100).
-- The order engine (Helper-cve) multiplies rank position by this base.
insert into public.point_rules (scope, rule_key, label, points) values
  ('order', 'base_per_rank', 'Order ladder base (per rank step)', 100);
