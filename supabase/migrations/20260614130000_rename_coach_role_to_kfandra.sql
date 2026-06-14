-- Rename the 'coach' player role to 'kfandra' so internal references match how
-- the club is named everywhere else. RENAME VALUE updates existing rows in
-- place (it's a metadata change). is_staff() hardcodes the old label, so it is
-- recreated with the new one in the same migration.
alter type app.player_role rename value 'coach' to 'kfandra';

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
