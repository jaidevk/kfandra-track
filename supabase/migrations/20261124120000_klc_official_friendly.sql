-- KLC friendlies are marked Official or Unofficial (KFANDRA, 22 November 2026).
-- Official friendlies will change player values and sell tickets; they never
-- count for league points, the match fee/win bonus or scorers. A league match
-- is never marked: it is official once KFANDRA makes it so (status submitted).
-- Who may change the mark is enforced in the server action
-- (setFriendlyMarkAction), like every other KLC match rule.
alter table public.klc_matches
  add column is_official_friendly boolean not null default false;

alter table public.klc_matches
  add constraint klc_matches_official_friendly_chk
  check (is_friendly or not is_official_friendly);

comment on column public.klc_matches.is_official_friendly is
  'Friendly marked Official (true) or Unofficial (false, default). Always false for a league match.';
