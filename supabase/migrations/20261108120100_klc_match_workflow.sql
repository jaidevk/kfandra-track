-- KLC match workflow (Helper-bsr.16, spec docs/superpowers/specs/2026-11-08-klc-match-workflow-design.md).
-- Prod had no KLC matches when this was written (checked 2026-11-07).

-- 1. League: draft -> sent (both teams sent by their managers) -> submitted
--    (Official). Friendlies never use `sent`: they go draft -> submitted.
alter table public.klc_matches drop constraint klc_matches_status_chk;
alter table public.klc_matches add constraint klc_matches_status_chk
  check (status in ('draft', 'sent', 'submitted'));

alter table public.klc_matches
  add column home_sent_at timestamptz,
  add column away_sent_at timestamptz,
  add constraint klc_matches_sent_league_chk check (status <> 'sent' or not is_friendly);
comment on column public.klc_matches.home_sent_at is
  'When the home team''s manager tapped Send my team. Cleared by Send back.';
comment on column public.klc_matches.away_sent_at is
  'When the away team''s manager tapped Send my team. Cleared by Send back.';

-- 2. Goal/try times: whole minutes, one per event in entry order; a null
--    element is a time not entered yet.
alter table public.klc_player_stats
  add column minutes int[] not null default '{}',
  add constraint klc_player_stats_minutes_len_chk
    check (cardinality(minutes) <= stat_count),
  add constraint klc_player_stats_minutes_range_chk
    check (0 <= all (minutes) and 150 >= all (minutes));
comment on column public.klc_player_stats.minutes is
  'Goal/try minutes for this tally, in entry order (null = not entered). Only league Fooba goals and Rugby Sox tries use it.';

-- 3. The submit lock, with one exception: an UPDATE of klc_player_stats that
--    changes nothing but `minutes` is allowed on an official match, so KFANDRA
--    can add goal times later (spec D13). Body otherwise unchanged from
--    20261020120000_klc_league_scoring.sql.
create or replace function app.klc_enforce_submit_lock()
returns trigger language plpgsql
security definer set search_path = public, pg_temp as $$
declare
  mids uuid[] := array[]::uuid[];
  mid  uuid;
  st   text;
begin
  if tg_table_name = 'klc_player_stats' and tg_op = 'UPDATE'
     and (to_jsonb(new) - 'minutes') = (to_jsonb(old) - 'minutes') then
    return new;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    mids := mids || app.klc_child_match_id(tg_table_name, to_jsonb(old));
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    mids := mids || app.klc_child_match_id(tg_table_name, to_jsonb(new));
  end if;
  foreach mid in array mids loop
    continue when mid is null;
    select status into st from public.klc_matches where id = mid for no key update;
    if st = 'submitted' then
      raise exception 'match is submitted' using errcode = 'P0001';
    end if;
  end loop;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

revoke execute on function app.klc_enforce_submit_lock() from public;
