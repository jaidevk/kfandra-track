-- MMG: per-game result becomes W/D/L counts.
--
-- Previously each submission_games row carried a single result enum
-- (won/drew/lost). Players asked to log how many games of a type they won,
-- drew and lost on one card so the stats (goals, assists…) accumulate and the
-- result points multiply by the counts. We replace the enum column with three
-- non-negative integer counts, backfilling existing rows (one game each), then
-- drop the now-unused column and enum type.

alter table public.submission_games
  add column won_count  smallint not null default 0 check (won_count  >= 0),
  add column drew_count smallint not null default 0 check (drew_count >= 0),
  add column lost_count smallint not null default 0 check (lost_count >= 0);

-- Backfill: a legacy row represented exactly one game with one result.
update public.submission_games
  set won_count  = case when result = 'won'  then 1 else 0 end,
      drew_count = case when result = 'drew' then 1 else 0 end,
      lost_count = case when result = 'lost' then 1 else 0 end;

alter table public.submission_games drop column result;

-- The enum was only ever used by that column.
drop type if exists app.game_result;
