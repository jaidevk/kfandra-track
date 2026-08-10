-- supabase/snippets/link-club-managers.sql
-- Link each club to its Player Manager's app account. Run this (NOT a migration).
-- Matches case-insensitively on display_name (prod has 'AhChin', not 'Ahchin').
-- Verified against prod players 2026-08-10:
--   * 11 of 13 match (incl. AhChin via lower()).
--   * shmoos-bling-babies → uses 'Bling Boy' (Sudarshan's app nickname), NOT 'Shmoo'.
--   * deep-waters → 'Seito' (Lavleen) not registered yet: that row simply won't
--     match until they register, leaving the club staff-editable. Re-run then.
-- If any manager's nickname differs, change that row's match to their phone:
--   join public.players p on p.phone = '9198XXXXXXXX'.
update public.clubs c
   set manager_player_id = p.id
  from (values
    ('boisterous-cicadas','Abe'), ('simbas-oldie-goldies','Ahjoo'),
    ('defanged-piranhas','Goodman'), ('paper-tigers','Mkul'),
    ('kraken-leviathans','Jake'), ('ninja-ballers','Crank'),
    ('resilient-rhinos','AhChin'), ('deep-waters','Seito'),
    ('shmoos-bling-babies','Bling Boy'), ('rusty-rabonas','Napalm'),
    ('dancing-dodos','Baz'), ('abs-babies','Caveman'),
    ('angry-ant-aunties','Acid')
  ) as m(slug, nick)
  join public.players p on lower(p.display_name) = lower(m.nick)
 where c.slug = m.slug;
-- Verify:
--   select c.name, c.manager_name, p.display_name
--     from public.clubs c left join public.players p on p.id = c.manager_player_id
--    order by c.sort_order;
