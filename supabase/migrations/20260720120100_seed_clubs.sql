-- ============================================================================
-- 20260720120100 — Seed the 13 KLCFERRSXVSG1 clubs
-- ----------------------------------------------------------------------------
-- manager_player_id is left NULL here; link it once manager accounts exist
-- using supabase/snippets/link-club-managers.sql. Logos live in
-- public/icons/clubs/<slug>.<ext>.
-- ============================================================================
insert into public.clubs (slug, name, manager_name, logo_path, sort_order) values
  ('boisterous-cicadas',   'Boisterous Cicadas',    'Abhay Mishra (Abe)',       '/icons/clubs/boisterous-cicadas.png',   1),
  ('simbas-oldie-goldies', 'Simba''s Oldie Goldies', 'Ajay Sanghvi (Ahjoo)',     '/icons/clubs/simbas-oldie-goldies.png', 2),
  ('defanged-piranhas',    'Defanged Piranhas',     'Niranjan Sarda (Goodman)', '/icons/clubs/defanged-piranhas.jpg',    3),
  ('paper-tigers',         'Paper Tigers',          'Mukul Inamdar (Mkul)',     '/icons/clubs/paper-tigers.png',         4),
  ('kraken-leviathans',    'Kraken Leviathans',     'Jaidev Karanth (Jake)',    '/icons/clubs/kraken-leviathans.png',    5),
  ('ninja-ballers',        'Ninja Ballers',         'Priyank Gurhani (Crank)',  '/icons/clubs/ninja-ballers.png',        6),
  ('resilient-rhinos',     'Resilient Rhinos',      'Sachin Kadam (Ahchin)',    '/icons/clubs/resilient-rhinos.png',     7),
  ('deep-waters',          'Deep Waters',           'Lavleen Sharma (Seito)',   '/icons/clubs/deep-waters.png',          8),
  ('shmoos-bling-babies',  'Shmoo''s Bling Babies',  'Sudarshan Sharma (Shmoo)', '/icons/clubs/shmoos-bling-babies.jpg',  9),
  ('rusty-rabonas',        'Rusty Rabonas',         'Anupam Sawant (Napalm)',   '/icons/clubs/rusty-rabonas.png',        10),
  ('dancing-dodos',        'Dancing Dodos',         'Shahbaz Khan (Baz)',       '/icons/clubs/dancing-dodos.png',        11),
  ('abs-babies',           'AB''s Babies',           'Aman Bansal (Caveman)',    '/icons/clubs/abs-babies.png',           12),
  ('angry-ant-aunties',    'Angry Ant Aunties',     'Prerna Shetty (Acid)',     '/icons/clubs/angry-ant-aunties.png',    13)
on conflict (slug) do nothing;
