-- ============================================================================
-- 20260815120200 — KLCSRA: squads are match-level, stats are per-half
-- ----------------------------------------------------------------------------
-- Corrects the shape introduced in 20260815120000, before any data exists.
--
-- The domain rule (spec §Combined match, "Rosters"): the same six physical
-- players play BOTH halves for the same aggregate side. What changes at
-- half-time is the manager — and therefore the club — leading each team.
-- A player belongs to exactly ONE team for the whole match and can never
-- appear on both.
--
-- The original shape hung appearances off klc_match_sides, which is per-half.
-- That stored each squad twice with nothing tying the copies together, so the
-- two halves' rosters could silently diverge, and "a player is not on both
-- teams" was not expressible as a constraint.
--
-- Now: one appearance row per player per match, carrying the aggregate side.
-- `unique (match_id, player_id)` makes the rule a database invariant. Stats
-- move their half attribution onto klc_player_stats.half_no, which preserves
-- the spec's requirement (§Cross-half stats) that a player earns KR and MMG
-- independently in each half under whichever club they played for — that club
-- is derived from (half_no, side) via klc_match_sides.
--
-- klc_match_sides is unchanged and still holds the per-half club and score.
-- ============================================================================

-- Dropped, not altered: these tables are empty and unreleased, and the new
-- shape shares no useful column layout with the old one.
drop table if exists public.klc_player_stats;
drop table if exists public.klc_appearances;

-- ─── klc_match_appearances ──────────────────────────────────────────────────
create table public.klc_match_appearances (
  id        uuid primary key default gen_random_uuid(),
  match_id  uuid not null references public.klc_matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  side      text not null,                              -- home | away (aggregate team)
  slot      int  not null,                              -- 1..6 (grows later)
  -- The core invariant: one team per player per match. This is what makes
  -- "a player cannot be in both teams" impossible rather than merely discouraged.
  unique (match_id, player_id),
  -- Display order is unique within a team. Deferrable so the recorder can swap
  -- two players' slots in one transaction; see the note in 20260815120000 —
  -- a deferrable constraint cannot be an ON CONFLICT target, so upserts must
  -- conflict on (match_id, player_id), which is immediate.
  constraint klc_match_appearances_slot_uniq unique (match_id, side, slot)
    deferrable initially deferred,
  constraint klc_match_appearances_side_chk check (side in ('home','away')),
  constraint klc_match_appearances_slot_chk check (slot >= 1)
);
comment on table public.klc_match_appearances is
  'A player''s participation in a match, on one aggregate side, for the whole match. Teams are fixed across halves; only the manager/club changes, which lives on klc_match_sides. There is no club roster — club membership for a match IS this row.';
-- player_id is `on delete restrict`, and per-player season totals aggregate on it.
create index klc_match_appearances_player_idx on public.klc_match_appearances (player_id);

-- ─── klc_player_stats ───────────────────────────────────────────────────────
create table public.klc_player_stats (
  id            uuid primary key default gen_random_uuid(),
  appearance_id uuid not null references public.klc_match_appearances(id) on delete cascade,
  half_no       int  not null default 1,                -- 1 (single/first) or 2
  stat_key      text not null,                          -- goal, try, mainGoal, ...
  stat_count    int  not null default 0,
  unique (appearance_id, half_no, stat_key),
  constraint klc_player_stats_half_chk  check (half_no in (1, 2)),
  -- stat_count is an event TALLY; the +/- sign lives in the rates. A negative
  -- tally would invert the payout -- stat_count = -1 on redCard would PAY the
  -- player +20 KR for a sending-off.
  constraint klc_player_stats_count_chk check (stat_count >= 0)
);
comment on table public.klc_player_stats is
  'Per-appearance per-half stat tallies. half_no lets a player earn independently in each half (spec §Cross-half stats); the club they earned under is (half_no, side) on klc_match_sides. stat_key values validated in the app against app_config klcsra_stat_rates / klcsra_sport_stats.';

-- ─── RLS: staff only, matching the rest of the KLCSRA tables ────────────────
alter table public.klc_match_appearances enable row level security;
alter table public.klc_player_stats      enable row level security;

create policy klc_match_appearances_rw_staff on public.klc_match_appearances
  for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy klc_player_stats_rw_staff on public.klc_player_stats
  for all to authenticated using (app.is_staff()) with check (app.is_staff());
