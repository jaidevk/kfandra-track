-- KLC League Scoring (design: docs/superpowers/specs/2026-10-20-klc-league-scoring-design.md)
--
--  1. Six match types replace football|rugby|fooba|variation. Prod had no
--     `variation` rows when this was written (checked 2026-10-20).
--  2. klc_matches.created_by: who started the draft (club managers may edit
--     drafts they created).
--  3. app_config: standings rules v2, table groups, sport stats for new types.
--  4. Submit lock in the DB (Helper-0gr): child rows of a submitted match
--     cannot be written. The server actions check first; this is the backstop
--     now that non-staff managers can record.
--  5. Touch parent (Helper-r01): any child write bumps klc_matches.updated_at.

-- ─── 1. match types ─────────────────────────────────────────────────────────
alter table public.klc_matches drop constraint klc_matches_sport_chk;
alter table public.klc_matches add constraint klc_matches_sport_chk check (sport in (
  'football','fooba','rugby','rugby_variation','short_game_variation','multi_game_variation'
));

-- ─── 2. created_by ──────────────────────────────────────────────────────────
alter table public.klc_matches
  add column created_by uuid references public.players(id) on delete set null;
create index klc_matches_created_by_idx on public.klc_matches (created_by);
comment on column public.klc_matches.created_by is
  'Player who created the draft. Null for matches created before 2026-10-20.';

-- ─── 3. app_config ──────────────────────────────────────────────────────────
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
      "football":             {"7plus": 5, "4to6": 1, "2to3": 0.5},
      "fooba":                {"7plus": 5, "4to6": 1, "2to3": 0.5},
      "rugby":                {"7plus": 5, "4to6": 1, "2to3": 0.5},
      "rugby_variation":      {"7plus": 3, "4to6": 1, "2to3": 0.5},
      "short_game_variation": {"7plus": 3, "4to6": 1, "2to3": 0.5},
      "multi_game_variation": {"7plus": 3, "4to6": 1, "2to3": 0.5}
    },
    "draw": {"7plus": 1, "4to6": 0.2, "2to3": 0.1},
    "loss": 0
  }'::jsonb,
  'KLC league points v2: win points by match type x tier (total players across both sides), draw points by tier, loss. No session caps (ground rule only).'
) on conflict (key) do update set value = excluded.value, description = excluded.description;

insert into public.app_config (key, value, description) values (
  'klcsra_table_groups',
  '{
    "all": "*",
    "football_fooba": ["football","fooba"],
    "rugby_sox": ["rugby"],
    "rugby_variations": ["rugby_variation"],
    "short_game_variations": ["short_game_variation"]
  }'::jsonb,
  'KLC league tables: group key -> match types ("*" = all). Key order is display order. multi_game_variation is in All only.'
) on conflict (key) do update set value = excluded.value, description = excluded.description;

insert into public.app_config (key, value, description) values (
  'klcsra_sport_stats',
  '{
    "football":  ["goal","assist","preAssist","save","yellowCard","redCard","blueCard","lateChallenge","ownGoal","ownAssist","ownPreAssist"],
    "fooba":     ["mainGoal","reboundGoal","switchover","assist","preAssist","save","yellowCard","redCard","blueCard","lateChallenge","ownGoal","ownAssist","ownPreAssist"],
    "rugby":     ["try","tackle","assist","preAssist","yellowCard","redCard","blueCard","lateChallenge"],
    "rugby_variation":      ["goal","try","mainGoal","reboundGoal","assist","preAssist","switchover","tackle","save","yellowCard","redCard","blueCard","lateChallenge","ownGoal","ownAssist","ownPreAssist"],
    "short_game_variation": ["goal","try","mainGoal","reboundGoal","assist","preAssist","switchover","tackle","save","yellowCard","redCard","blueCard","lateChallenge","ownGoal","ownAssist","ownPreAssist"],
    "multi_game_variation": ["goal","try","mainGoal","reboundGoal","assist","preAssist","switchover","tackle","save","yellowCard","redCard","blueCard","lateChallenge","ownGoal","ownAssist","ownPreAssist"]
  }'::jsonb,
  'KLCSRA per-sport stat allow-list. The recorder filters the stats popup by sport; disallowed keys are ignored by the payout compute.'
) on conflict (key) do update set value = excluded.value, description = excluded.description;

-- ─── 4 + 5. lock + touch triggers ───────────────────────────────────────────
-- Resolve the parent match id of a child row. Returns null when the parent
-- is already gone (cascade delete of the match), which both triggers treat
-- as "nothing to do".
-- The row arrives as jsonb so one helper serves all four tables.
create or replace function app.klc_child_match_id(tbl text, r jsonb)
returns uuid language plpgsql stable as $$
declare mid uuid;
begin
  if tbl in ('klc_match_halves', 'klc_match_appearances') then
    return (r->>'match_id')::uuid;
  elsif tbl = 'klc_match_sides' then
    select h.match_id into mid from public.klc_match_halves h where h.id = (r->>'half_id')::uuid;
    return mid;
  elsif tbl = 'klc_player_stats' then
    select a.match_id into mid from public.klc_match_appearances a where a.id = (r->>'appearance_id')::uuid;
    return mid;
  end if;
  return null;
end $$;

create or replace function app.klc_enforce_submit_lock()
returns trigger language plpgsql as $$
declare
  mid uuid;
  st  text;
begin
  if tg_op = 'DELETE' then
    mid := app.klc_child_match_id(tg_table_name, to_jsonb(old));
  else
    mid := app.klc_child_match_id(tg_table_name, to_jsonb(new));
  end if;
  if mid is not null then
    select status into st from public.klc_matches where id = mid;
    if st = 'submitted' then
      raise exception 'match is submitted' using errcode = 'P0001';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create or replace function app.klc_touch_parent_match()
returns trigger language plpgsql as $$
declare mid uuid;
begin
  if tg_op = 'DELETE' then
    mid := app.klc_child_match_id(tg_table_name, to_jsonb(old));
  else
    mid := app.klc_child_match_id(tg_table_name, to_jsonb(new));
  end if;
  if mid is not null then
    update public.klc_matches set updated_at = now() where id = mid;
  end if;
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['klc_match_halves','klc_match_sides','klc_match_appearances','klc_player_stats'] loop
    execute format(
      'create trigger %I before insert or update or delete on public.%I
         for each row execute function app.klc_enforce_submit_lock()',
      t || '_submit_lock', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function app.klc_touch_parent_match()',
      t || '_touch_parent', t);
  end loop;
end $$;
