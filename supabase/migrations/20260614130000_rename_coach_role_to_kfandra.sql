-- Rename the 'coach' player role to 'kfandra' so internal references match how
-- the club is named everywhere else. RENAME VALUE updates existing rows in
-- place (it's a metadata change). is_staff() hardcodes the old label, so it is
-- recreated with the new one in the same migration.
--
-- Guarded so the migration is idempotent / replay-safe: the rename only runs
-- when 'coach' still exists. Re-running against a DB where the rename already
-- happened (dev drift, partial application) would otherwise fail with
-- 'coach is not an existing enum label' (SQLSTATE 22023) and stall the chain.
do $$
begin
  if exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'app' and t.typname = 'player_role' and e.enumlabel = 'coach'
  ) then
    alter type app.player_role rename value 'coach' to 'kfandra';
  end if;
end
$$;

create or replace function app.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.players p
    where p.id = app.current_player_id()
      and p.role in ('super_admin', 'kfandra', 'admin')
  );
$$;
