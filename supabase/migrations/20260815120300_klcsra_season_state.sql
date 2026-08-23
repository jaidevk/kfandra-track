-- ============================================================================
-- 20260815120300 — KLCSRA: real season state
-- ----------------------------------------------------------------------------
-- 20260815120000 seeded Season 1 as 'upcoming' as a placeholder. KFANDRA has
-- since confirmed the actual state:
--
--   Season 1 (KLCFERRSXVSG1) — COMPLETE, closed 2026-08-15.
--   Season 2 (KLCFERRSXVSG2) — targeted to start 2026-08-22, not yet started.
--
-- Season 2 is left 'upcoming' deliberately: KFANDRA starts it from the Seasons
-- page, which is the intended first action in the app and exercises the
-- one-active-season rule. Until then, league Submit is correctly blocked.
--
-- Season 1's start_date is a placeholder (the clubs migration date) — the real
-- one is not recorded anywhere. It is editable on the Seasons page.
-- ============================================================================

update public.klc_seasons
   set status   = 'closed',
       end_date = date '2026-08-15'
 where season_no = 1;

insert into public.klc_seasons (season_no, name, start_date, status)
values (2, 'KLCFERRSXVSG2', date '2026-08-22', 'upcoming')
on conflict (season_no) do nothing;
