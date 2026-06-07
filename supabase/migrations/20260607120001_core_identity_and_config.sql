-- ============================================================================
-- 20260607120001 — Core identity, config & shared helpers
-- ----------------------------------------------------------------------------
-- JACARANDA V1 foundation. Establishes:
--   * the `app` schema for helper functions (kept out of `public`)
--   * the player role hierarchy + players table (custom phone + 4-digit PIN auth)
--   * generic key/value app_config (all game rules externalised — never hardcode)
--   * audit_log for privileged mutations
--   * shared triggers/helpers reused by later migrations
--
-- AUTH NOTE: We use custom phone + PIN auth (NOT Supabase Auth email/OTP). The
-- server verifies PINs via the service-role admin client (which BYPASSES RLS).
-- RLS policies (migration ...000005) are written against a `player_id` JWT claim
-- so that, once the auth bead mints scoped sessions, browser/anon access is
-- correctly limited to the player's own rows. Until then, all reads/writes flow
-- through server actions on the service-role client, and RLS denies everything
-- else by default (defense in depth).
-- ============================================================================

create schema if not exists app;

-- ─── Shared: updated_at trigger ─────────────────────────────────────────────
create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── Identity ───────────────────────────────────────────────────────────────
-- Role hierarchy: super_admin > coach > admin > user
create type app.player_role as enum ('super_admin', 'coach', 'admin', 'user');

create table public.players (
  id           uuid primary key default gen_random_uuid(),
  phone        text not null unique,
  pin_hash     text not null,
  display_name text not null,
  role         app.player_role not null default 'user',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.players is
  'Members. Custom phone + 4-digit PIN auth; pin_hash is a server-side hash, never the raw PIN.';
comment on column public.players.phone is 'E.164-ish phone string; unique login identifier.';

create trigger players_set_updated_at
  before update on public.players
  for each row execute function app.set_updated_at();

-- ─── Identity helpers (read current player from JWT claim) ──────────────────
-- Returns the authenticated player's id from the `player_id` JWT claim, or NULL.
create or replace function app.current_player_id()
returns uuid
language sql
stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb ->> 'player_id',
    ''
  )::uuid;
$$;

-- True when the current player holds an elevated (staff) role.
-- SECURITY DEFINER so the internal players lookup BYPASSES RLS — without it the
-- players RLS policy (which calls is_staff()) would recurse into itself.
-- search_path is pinned to defeat search-path hijacking on a definer function.
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
      and p.role in ('super_admin', 'coach', 'admin')
  );
$$;

-- ─── Grants: let the API roles reach the helper schema/functions ────────────
-- RLS policy expressions execute as the querying role, so anon/authenticated
-- need USAGE on the `app` schema and EXECUTE on its helpers.
grant usage on schema app to anon, authenticated, service_role;
grant execute on function app.current_player_id() to anon, authenticated, service_role;
grant execute on function app.is_staff()          to anon, authenticated, service_role;

-- ─── Externalised config (every game rule lives here, not in code) ──────────
create table public.app_config (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.players(id) on delete set null
);

comment on table public.app_config is
  'Generic key/value store for configurable behaviour. RLS: readable by all, writable by staff.';

create trigger app_config_set_updated_at
  before update on public.app_config
  for each row execute function app.set_updated_at();

-- ─── Audit log (privileged mutations) ───────────────────────────────────────
create table public.audit_log (
  id              bigint generated always as identity primary key,
  actor_player_id uuid references public.players(id) on delete set null,
  action          text not null,
  entity_type     text not null,
  entity_id       text,
  diff            jsonb,
  created_at      timestamptz not null default now()
);

comment on table public.audit_log is 'Append-only record of privileged/admin actions.';

create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);
create index audit_log_actor_idx  on public.audit_log (actor_player_id);
