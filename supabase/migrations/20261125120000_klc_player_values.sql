-- KLC player register and player values (Helper-bsr.18).
-- Spec: docs/superpowers/specs/2026-11-22-klc-player-register-values-design.md §2, §4.
--
-- Values are NOT stored: they are worked out on read from the base value,
-- the counted matches and KFANDRA's dated changes. These tables hold only the
-- inputs KFANDRA types in. Writes go through KFANDRA-only server actions with
-- the service role, so there are no insert/update/delete policies.

alter table public.players add column klc_name text;
comment on column public.players.klc_name is
  'Official KLC name, set by KFANDRA on the register. Boards show it when set.';

create table public.klc_player_base_values (
  season_id  uuid not null references public.klc_seasons(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  base_value numeric(10,2) not null check (base_value >= 0),
  updated_by uuid references public.players(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (season_id, player_id)
);
comment on table public.klc_player_base_values is
  'Each player''s starting value (Kroopies) for a season. Set by KFANDRA; edits are logged in audit_log.';

create table public.klc_player_value_changes (
  id             uuid primary key default gen_random_uuid(),
  season_id      uuid not null references public.klc_seasons(id) on delete cascade,
  player_id      uuid not null references public.players(id) on delete cascade,
  effective_date date not null,
  amount         numeric(10,2) not null check (amount <> 0),
  note           text not null check (length(trim(note)) > 0),
  created_by     uuid references public.players(id) on delete set null,
  created_at     timestamptz not null default now(),
  voided_at      timestamptz,
  voided_by      uuid references public.players(id) on delete set null,
  void_note      text,
  check ((voided_at is null) = (void_note is null))
);
comment on table public.klc_player_value_changes is
  'KFANDRA''s dated plus/minus value changes. Append-only: a mistake is voided with a note, never deleted.';
create index klc_player_value_changes_season_idx
  on public.klc_player_value_changes (season_id, player_id, effective_date);

alter table public.klc_player_base_values   enable row level security;
alter table public.klc_player_value_changes enable row level security;

-- Values are public to every signed-in player.
create policy klc_player_base_values_read on public.klc_player_base_values
  for select to authenticated using (true);
create policy klc_player_value_changes_read on public.klc_player_value_changes
  for select to authenticated using (true);

insert into public.app_config (key, value, description) values (
  'klc_value_rules',
  '{
    "version": 1,
    "result": {"win": 20, "draw": 5, "loss": -10},
    "stats": {
      "goal": 2, "mainGoal": 2, "reboundGoal": 2, "try": 2, "conversion": 2,
      "assist": 1, "preAssist": 0.5, "save": 2,
      "yellowCard": -10, "redCard": -20, "blueCard": -50
    },
    "floor": 0,
    "smallSided": {"enabled": true, "belowPlayers": 7, "freeMatches": 5}
  }'::jsonb,
  'KLC player value changes per counted match (league + official friendlies). A stat missing from "stats" is worth 0. smallSided: a player''s first freeMatches matches with fewer than belowPlayers players in total change nothing.'
)
on conflict (key) do update
  set value = excluded.value, description = excluded.description, updated_at = now();
