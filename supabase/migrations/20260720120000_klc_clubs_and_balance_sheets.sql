-- ============================================================================
-- 20260720120000 — KLCFERRSXVSG1 clubs & club balance sheets
-- ----------------------------------------------------------------------------
-- Adds the Club Balance Sheet feature:
--   * clubs                — 13 clubs (name, manager, logo). Each club has one
--                            Player Manager (manager_player_id → players).
--                            Identities (name/logo) are readable by all
--                            authenticated players so the landing shows crests.
--   * club_balance_sheets  — ONE running sheet per club (cumulative).
--   * club_player_shares   — dynamic per-loanee rows: (club, player, amount).
-- Item 8/9/10 totals are derived in the app, never stored. Rates live in
-- app_config (key 'klc_rates').
-- RLS: staff read/write all; a club's Manager reads/writes ONLY their club's
-- rows. Runtime writes still go through the service-role client in server
-- actions (which enforce the same check); RLS is defense in depth.
-- ============================================================================

-- ─── clubs ──────────────────────────────────────────────────────────────────
create table public.clubs (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  manager_name      text not null default '',
  manager_player_id uuid references public.players(id) on delete set null,
  logo_path         text not null,
  sort_order        int  not null default 0,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table public.clubs is
  'KLCFERRSXVSG1 clubs. manager_player_id is the app user who may edit the sheet. Names/logos readable by all; balance data is private.';
create index clubs_manager_idx on public.clubs (manager_player_id);

create trigger clubs_set_updated_at
  before update on public.clubs
  for each row execute function app.set_updated_at();

-- ─── club_balance_sheets (one row per club PER DATE) ─────────────────────────
-- Each match-day is its own dated entry; the app aggregates them into a running
-- overview. Any date's entry stays editable.
create table public.club_balance_sheets (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null references public.clubs(id) on delete cascade,
  entry_date     date not null,
  matches_played int not null default 0,
  matches_won    int not null default 0,
  matches_drawn  int not null default 0,
  matches_lost   int not null default 0,
  club_bonus     int not null default 0,  -- Kroopies (item 7)
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.players(id) on delete set null,
  unique (club_id, entry_date)
);
comment on table public.club_balance_sheets is 'One dated balance entry per club per date. Totals 8/9/10 are derived; the running overview aggregates all dates.';

create trigger club_balance_sheets_set_updated_at
  before update on public.club_balance_sheets
  for each row execute function app.set_updated_at();

-- ─── club_player_shares (item 4: dynamic loanee rows) ────────────────────────
create table public.club_player_shares (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  entry_date date not null,
  player_id  uuid not null references public.players(id) on delete cascade,
  amount     int  not null default 0,
  updated_at timestamptz not null default now(),
  unique (club_id, entry_date, player_id)
);
comment on table public.club_player_shares is 'Item-4 loanee rows per dated entry: amount*loaneePerShare feeds that date''s loanee distribution. One row per (club, date, loanee).';

create trigger club_player_shares_set_updated_at
  before update on public.club_player_shares
  for each row execute function app.set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.clubs               enable row level security;
alter table public.club_balance_sheets enable row level security;
alter table public.club_player_shares  enable row level security;

-- clubs: any authenticated player may read (crests/names are not secret); staff write.
create policy clubs_select_all on public.clubs
  for select to authenticated using (true);
create policy clubs_write_staff on public.clubs
  for all to authenticated using (app.is_staff()) with check (app.is_staff());

-- club_balance_sheets: the club's Manager has full CRUD; staff full CRUD.
-- The clubs subquery is allowed because clubs' own SELECT policy is `using(true)`.
create policy club_balance_sheets_rw_manager on public.club_balance_sheets
  for all to authenticated
  using (exists (select 1 from public.clubs c
                 where c.id = club_id and c.manager_player_id = app.current_player_id()))
  with check (exists (select 1 from public.clubs c
                      where c.id = club_id and c.manager_player_id = app.current_player_id()));
create policy club_balance_sheets_rw_staff on public.club_balance_sheets
  for all to authenticated
  using (app.is_staff()) with check (app.is_staff());

-- club_player_shares: same ownership via the parent club's manager.
create policy club_player_shares_rw_manager on public.club_player_shares
  for all to authenticated
  using (exists (select 1 from public.clubs c
                 where c.id = club_id and c.manager_player_id = app.current_player_id()))
  with check (exists (select 1 from public.clubs c
                      where c.id = club_id and c.manager_player_id = app.current_player_id()));
create policy club_player_shares_rw_staff on public.club_player_shares
  for all to authenticated
  using (app.is_staff()) with check (app.is_staff());

-- ─── Rates (externalised; edit here, not in code) ────────────────────────────
insert into public.app_config (key, value, description)
values (
  'klc_rates',
  '{"playedToKfandra": 10, "wonFromKfandra": 20, "loaneePerShare": 10}'::jsonb,
  'Club Balance Sheet Kroopies rates: matchesPlayed*playedToKfandra (item 8); matchesWon*wonFromKfandra + bonus (item 9); sum(loanee numbers)*loaneePerShare (item 10).'
)
on conflict (key) do nothing;
