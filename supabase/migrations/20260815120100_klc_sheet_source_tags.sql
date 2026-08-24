-- ============================================================================
-- 20260815120100 — Balance-sheet source tags (KLCSRA write-back prerequisite)
-- ----------------------------------------------------------------------------
-- Spec §Balance sheet: rows written by the match recorder carry
-- source = 'match:<match_id>'; Submit deletes rows for that tag and rewrites,
-- while manual entries (source is null) are kept intact.
--
-- The existing unique (club_id, entry_date, player_id) forced manual and
-- match-sourced rows to collide. Widening it with `source` under
-- NULLS NOT DISTINCT keeps "one manual row per (club, date, player)" while
-- letting one row per match id coexist.
--
-- Schema only. The write-back itself lands in Phase 5.
-- ============================================================================

alter table public.club_player_shares
  add column source text;
comment on column public.club_player_shares.source is
  'null = entered manually by the manager. ''match:<uuid>'' = written by the KLCSRA recorder for that match.';

alter table public.club_player_shares
  drop constraint club_player_shares_club_id_entry_date_player_id_key;

alter table public.club_player_shares
  add constraint club_player_shares_uniq
  unique nulls not distinct (club_id, entry_date, player_id, source);

alter table public.club_balance_sheets
  add column results_source text;
comment on column public.club_balance_sheets.results_source is
  'null = played/won/drawn/lost entered manually. ''match:<uuid>'' = derived from a submitted KLCSRA match; the UI renders those fields read-only.';
