-- ============================================================================
-- 20260607120005 — Row-Level Security
-- ----------------------------------------------------------------------------
-- Policy model:
--   * Players see/modify ONLY their own data (own row + own logs/entries).
--   * Staff (super_admin/coach/admin) may READ all data (read-only here;
--     privileged writes go through server actions on the service-role client).
--   * Reference/config tables are readable by any authenticated player and
--     writable only by staff.
--   * The service-role key BYPASSES RLS, so all server-side mutations (PIN
--     verification, provisioning, autosave via server actions) work regardless.
--
-- Ownership is resolved through app.current_player_id(), which reads the
-- `player_id` JWT claim minted by the auth bead (Helper-xnz). For plain anon
-- requests the claim is absent, so owner policies deny by default.
--
-- All policies target `to authenticated` — the role PostgREST assumes once the
-- custom JWT (role=authenticated + player_id claim) is presented.
-- ============================================================================

-- Enable RLS everywhere. Nothing is reachable until a policy permits it.
alter table public.players               enable row level security;
alter table public.app_config            enable row level security;
alter table public.audit_log             enable row level security;
alter table public.sessions              enable row level security;
alter table public.game_types            enable row level security;
alter table public.point_rules           enable row level security;
alter table public.mmg_entries           enable row level security;
alter table public.submission_games      enable row level security;
alter table public.submission_game_stats enable row level security;
alter table public.submission_others     enable row level security;
alter table public.gym_catalog           enable row level security;
alter table public.gym_logs              enable row level security;
alter table public.gym_log_exercises     enable row level security;
alter table public.meal_slots            enable row level security;
alter table public.food_catalog          enable row level security;
alter table public.diet_logs             enable row level security;
alter table public.diet_log_meals        enable row level security;
alter table public.diet_log_items        enable row level security;

-- ─── players ────────────────────────────────────────────────────────────────
-- A player reads their own row; staff read all.
create policy players_select_self_or_staff on public.players
  for select to authenticated
  using (id = app.current_player_id() or app.is_staff());

-- A player may update their own profile (e.g. display_name). Role/PIN changes
-- are performed server-side via the service-role client, not here.
create policy players_update_self on public.players
  for update to authenticated
  using (id = app.current_player_id())
  with check (id = app.current_player_id());

-- ─── app_config (read all authenticated, write staff) ───────────────────────
create policy app_config_select_all on public.app_config
  for select to authenticated using (true);
create policy app_config_write_staff on public.app_config
  for all to authenticated using (app.is_staff()) with check (app.is_staff());

-- ─── audit_log (staff read only; inserts via service role) ──────────────────
create policy audit_log_select_staff on public.audit_log
  for select to authenticated using (app.is_staff());

-- ─── Reference/config tables: read all authenticated, write staff ───────────
do $$
declare t text;
begin
  foreach t in array array[
    'sessions', 'game_types', 'point_rules',
    'gym_catalog', 'meal_slots', 'food_catalog'
  ]
  loop
    execute format(
      'create policy %1$s_select_all on public.%1$s
         for select to authenticated using (true);', t);
    execute format(
      'create policy %1$s_write_staff on public.%1$s
         for all to authenticated using (app.is_staff()) with check (app.is_staff());', t);
  end loop;
end $$;

-- ─── MMG: owner CRUD own entries; staff read all ────────────────────────────
create policy mmg_entries_rw_owner on public.mmg_entries
  for all to authenticated
  using (player_id = app.current_player_id())
  with check (player_id = app.current_player_id());
create policy mmg_entries_select_staff on public.mmg_entries
  for select to authenticated using (app.is_staff());

-- Child tables: ownership flows from the parent mmg_entry.
create policy submission_games_rw_owner on public.submission_games
  for all to authenticated
  using (exists (select 1 from public.mmg_entries e
                 where e.id = mmg_entry_id and e.player_id = app.current_player_id()))
  with check (exists (select 1 from public.mmg_entries e
                      where e.id = mmg_entry_id and e.player_id = app.current_player_id()));
create policy submission_games_select_staff on public.submission_games
  for select to authenticated using (app.is_staff());

create policy submission_game_stats_rw_owner on public.submission_game_stats
  for all to authenticated
  using (exists (select 1 from public.submission_games g
                 join public.mmg_entries e on e.id = g.mmg_entry_id
                 where g.id = submission_game_id and e.player_id = app.current_player_id()))
  with check (exists (select 1 from public.submission_games g
                      join public.mmg_entries e on e.id = g.mmg_entry_id
                      where g.id = submission_game_id and e.player_id = app.current_player_id()));
create policy submission_game_stats_select_staff on public.submission_game_stats
  for select to authenticated using (app.is_staff());

create policy submission_others_rw_owner on public.submission_others
  for all to authenticated
  using (exists (select 1 from public.mmg_entries e
                 where e.id = mmg_entry_id and e.player_id = app.current_player_id()))
  with check (exists (select 1 from public.mmg_entries e
                      where e.id = mmg_entry_id and e.player_id = app.current_player_id()));
create policy submission_others_select_staff on public.submission_others
  for select to authenticated using (app.is_staff());

-- ─── Gym: owner CRUD own; staff read all ────────────────────────────────────
create policy gym_logs_rw_owner on public.gym_logs
  for all to authenticated
  using (player_id = app.current_player_id())
  with check (player_id = app.current_player_id());
create policy gym_logs_select_staff on public.gym_logs
  for select to authenticated using (app.is_staff());

create policy gym_log_exercises_rw_owner on public.gym_log_exercises
  for all to authenticated
  using (exists (select 1 from public.gym_logs l
                 where l.id = gym_log_id and l.player_id = app.current_player_id()))
  with check (exists (select 1 from public.gym_logs l
                      where l.id = gym_log_id and l.player_id = app.current_player_id()));
create policy gym_log_exercises_select_staff on public.gym_log_exercises
  for select to authenticated using (app.is_staff());

-- ─── Diet: owner CRUD own; staff read all ───────────────────────────────────
create policy diet_logs_rw_owner on public.diet_logs
  for all to authenticated
  using (player_id = app.current_player_id())
  with check (player_id = app.current_player_id());
create policy diet_logs_select_staff on public.diet_logs
  for select to authenticated using (app.is_staff());

create policy diet_log_meals_rw_owner on public.diet_log_meals
  for all to authenticated
  using (exists (select 1 from public.diet_logs l
                 where l.id = diet_log_id and l.player_id = app.current_player_id()))
  with check (exists (select 1 from public.diet_logs l
                      where l.id = diet_log_id and l.player_id = app.current_player_id()));
create policy diet_log_meals_select_staff on public.diet_log_meals
  for select to authenticated using (app.is_staff());

create policy diet_log_items_rw_owner on public.diet_log_items
  for all to authenticated
  using (exists (select 1 from public.diet_log_meals m
                 join public.diet_logs l on l.id = m.diet_log_id
                 where m.id = diet_log_meal_id and l.player_id = app.current_player_id()))
  with check (exists (select 1 from public.diet_log_meals m
                      join public.diet_logs l on l.id = m.diet_log_id
                      where m.id = diet_log_meal_id and l.player_id = app.current_player_id()));
create policy diet_log_items_select_staff on public.diet_log_items
  for select to authenticated using (app.is_staff());
