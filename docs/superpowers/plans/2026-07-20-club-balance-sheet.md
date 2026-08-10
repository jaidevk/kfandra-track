# Club Balance Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a player-facing **Club Balance Sheet** feature: a home block → a flat page of 13 club crests (title "KLCFERRSXVSG1") → each club's private, auto-calculating balance sheet in Kroopies, editable only by that club's **Player Manager** (or KFANDRA/Admin), with a KFANDRA/Admin review surface.

**Architecture:** Mirror the existing MMG feature end-to-end. A Supabase migration adds `clubs` (each with a `manager_player_id`), `club_balance_sheets`, and `club_player_shares`, all under RLS. Pure logic (`compute`, `config`, draft mapping) lives in `src/lib/klc/*` and is unit-tested; DB I/O runs through the service-role admin client in server actions that re-resolve the player and enforce "staff, or this club's Manager only". The client form autosaves to localStorage immediately and flushes to the server on a debounce (identical to `mmg-entry.tsx`). Item 8/9/10 totals are **derived on read**, never stored.

**Tech Stack:** Next.js 16 App Router (server components + `"use server"` actions), TypeScript strict, Tailwind, Supabase (Postgres + RLS), Vitest.

---

## Design reference

Product-facing UX is in [docs/club-balance-sheet-ux.md](../../club-balance-sheet-ux.md) (rendered PDF alongside). Confirmed decisions:

- **One club → one Player Manager** (an app user, `clubs.manager_player_id`). The Manager is responsible for the club's sheet.
- **Only the Manager (or staff) may open/edit** a club's sheet. Everyone else sees the crest but it is locked (no numbers).
- **Item 4 is a dynamic loanee list**, not a fixed roster: the Manager adds members who were loaned/attended, each with a number. Members are app users, picked from the active-members list. Sum(numbers) × rate = item 10.
- **One running balance sheet per club** (cumulative). "Date" (item 1) is the as-of date. Autosaves; no submit button.
- Landing page shows a **flat grid of all 13 crests**, title exactly **KLCFERRSXVSG1**.
- Calculations (Kroopies), rates externalised in `app_config` under key `klc_rates` = `{ playedToKfandra: 10, wonFromKfandra: 20, loaneePerShare: 10 }`:
  - **(8) Paid to KFANDRA** = `matchesPlayed * playedToKfandra`
  - **(9) Received from KFANDRA** = `matchesWon * wonFromKfandra + clubBonus`
  - **(10) Distributed to loanees** = `sum(loanee numbers) * loaneePerShare`
- Player-manager display name is seed text per club; `manager_player_id` is linked to the app account later (by nickname/phone).

**Out of scope (noted for later):** per-player differing loan rates; per-session sheet history (current design is one running sheet per club).

### The 13 clubs (seed data)

| # | slug | name | manager (display) | manager nickname | logo source file (kfandra.com/assets/images/) |
|---|------|------|-------------------|------------------|-----------------------------------------------|
| 1 | `boisterous-cicadas` | Boisterous Cicadas | Abhay Mishra (Abe) | Abe | `abhay-mishras-boisterous-cicadas-logo-small-512x512.png` |
| 2 | `simbas-oldie-goldies` | Simba's Oldie Goldies | Ajay Sanghvi (Ahjoo) | Ahjoo | `simbas-oldie-goldies-802x1068.png` |
| 3 | `defanged-piranhas` | Defanged Piranhas | Niranjan Sarda (Goodman) | Goodman | `defangedpiranhaslogo-small-896x896.jpg` |
| 4 | `paper-tigers` | Paper Tigers | Mukul Inamdar (Mkul) | Mkul | `paper-tigers-official-logo-small-896x896.png` |
| 5 | `kraken-leviathans` | Kraken Leviathans | Jaidev Karanth (Jake) | Jake | `klcfe1-kraken-leviathans-logo-696x782.png` |
| 6 | `ninja-ballers` | Ninja Ballers | Priyank Gurhani (Crank) | Crank | `priyank-gurhanis-ninja-ballers-500x500.png` |
| 7 | `resilient-rhinos` | Resilient Rhinos | Sachin Kadam (Ahchin) | Ahchin | `resilient-rhinos-small-845x563.png` |
| 8 | `deep-waters` | Deep Waters | Lavleen Sharma (Seito) | Seito | `deep-waters-3-853x981.png` |
| 9 | `shmoos-bling-babies` | Shmoo's Bling Babies | Sudarshan Sharma (Shmoo) | Shmoo | `sbbs-small-819x827.jpg` |
| 10 | `rusty-rabonas` | Rusty Rabonas | Anupam Sawant (Napalm) | Napalm | `anupam-sawants-rusty-rabonas-small-819x819.png` |
| 11 | `dancing-dodos` | Dancing Dodos | Shahbaz Khan (Baz) | Baz | `dancing-dodo-small-edited-756x756.png` |
| 12 | `abs-babies` | AB's Babies | Aman Bansal (Caveman) | Caveman | `a-mans-abs-babies-small-819x819.png` |
| 13 | `angry-ant-aunties` | Angry Ant Aunties | Prerna Shetty (Acid) | Acid | `angry-ant-aunties-kfandra-design-dept-final-logo-small-787x754.png` |

Logos are stored at `public/icons/clubs/<slug>.<ext>` (ext = png except `defanged-piranhas` and `shmoos-bling-babies` which are jpg).

## File structure

**Create**
- `supabase/migrations/20260720120000_klc_clubs_and_balance_sheets.sql` — tables, RLS, `klc_rates`.
- `supabase/migrations/20260720120100_seed_clubs.sql` — the 13 real clubs.
- `supabase/snippets/link-club-managers.sql` — link `manager_player_id` by nickname (run when manager accounts exist).
- `public/icons/clubs/<slug>.<ext>` — the 13 downloaded crests.
- `src/lib/klc/{types,config,compute,repository,actions}.ts` (+ `.test.ts` for types, config, compute, repository).
- `src/lib/admin/klc-repository.ts`.
- `src/app/klc/page.tsx`, `src/app/klc/[clubId]/page.tsx`, `src/app/klc/[clubId]/club-balance-entry.tsx`.
- `src/app/admin/klc/page.tsx`, `src/app/admin/klc/copy-button.tsx`.

**Modify**
- `src/content/strings.ts` — home block, klc labels, admin card.
- `src/app/home-screen.tsx` — add the Club Balance Sheet block.
- `src/app/admin/page.tsx` — add the admin card.
- `src/lib/supabase/database.types.ts` — regenerated after the migration.

---

## Task 1: Database migration — tables, RLS, rates

**Files:**
- Create: `supabase/migrations/20260720120000_klc_clubs_and_balance_sheets.sql`

- [ ] **Step 1: Write the migration**

```sql
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

-- ─── club_balance_sheets (one running row per club) ──────────────────────────
create table public.club_balance_sheets (
  id             uuid primary key default gen_random_uuid(),
  club_id        uuid not null unique references public.clubs(id) on delete cascade,
  as_of_date     date,
  matches_played int not null default 0,
  matches_won    int not null default 0,
  matches_drawn  int not null default 0,
  matches_lost   int not null default 0,
  club_bonus     int not null default 0,  -- Kroopies (item 7)
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.players(id) on delete set null
);
comment on table public.club_balance_sheets is 'One cumulative balance sheet per club. Totals 8/9/10 are derived, not stored.';

create trigger club_balance_sheets_set_updated_at
  before update on public.club_balance_sheets
  for each row execute function app.set_updated_at();

-- ─── club_player_shares (item 4: dynamic loanee rows) ────────────────────────
create table public.club_player_shares (
  id         uuid primary key default gen_random_uuid(),
  club_id    uuid not null references public.clubs(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  amount     int  not null default 0,
  updated_at timestamptz not null default now(),
  unique (club_id, player_id)
);
comment on table public.club_player_shares is 'Item-4 loanee rows: amount*loaneePerShare feeds the loanee distribution. One row per (club, loanee).';

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
```

- [ ] **Step 2: Apply locally and verify it succeeds**

Run:
```bash
npx supabase start
npx supabase db reset
```
Expected: reset completes and lists `20260720120000_klc_clubs_and_balance_sheets.sql` among applied migrations.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260720120000_klc_clubs_and_balance_sheets.sql
git commit -m "feat(klc): clubs, balance sheets, loanee shares + RLS"
```

---

## Task 2: Download logos + seed the 13 clubs + manager-link snippet

**Files:**
- Create: `public/icons/clubs/<slug>.<ext>` (13 files)
- Create: `supabase/migrations/20260720120100_seed_clubs.sql`
- Create: `supabase/snippets/link-club-managers.sql`

- [ ] **Step 1: Download the 13 crests from kfandra.com**

Run:
```bash
mkdir -p public/icons/clubs
base="https://kfandra.com/assets/images"
download() { curl -fsSL "$base/$2" -o "public/icons/clubs/$1"; echo "saved $1"; }
download boisterous-cicadas.png   "abhay-mishras-boisterous-cicadas-logo-small-512x512.png"
download simbas-oldie-goldies.png "simbas-oldie-goldies-802x1068.png"
download defanged-piranhas.jpg    "defangedpiranhaslogo-small-896x896.jpg"
download paper-tigers.png         "paper-tigers-official-logo-small-896x896.png"
download kraken-leviathans.png    "klcfe1-kraken-leviathans-logo-696x782.png"
download ninja-ballers.png        "priyank-gurhanis-ninja-ballers-500x500.png"
download resilient-rhinos.png     "resilient-rhinos-small-845x563.png"
download deep-waters.png          "deep-waters-3-853x981.png"
download shmoos-bling-babies.jpg  "sbbs-small-819x827.jpg"
download rusty-rabonas.png        "anupam-sawants-rusty-rabonas-small-819x819.png"
download dancing-dodos.png        "dancing-dodo-small-edited-756x756.png"
download abs-babies.png           "a-mans-abs-babies-small-819x819.png"
download angry-ant-aunties.png    "angry-ant-aunties-kfandra-design-dept-final-logo-small-787x754.png"
ls -1 public/icons/clubs
```
Expected: 13 files listed.

- [ ] **Step 2: Write the seed migration**

```sql
-- ============================================================================
-- 20260720120100 — Seed the 13 KLCFERRSXVSG1 clubs
-- ----------------------------------------------------------------------------
-- manager_player_id is left NULL here; link it once manager accounts exist
-- using supabase/snippets/link-club-managers.sql. Logos live in
-- public/icons/clubs/<slug>.<ext>.
-- ============================================================================
insert into public.clubs (slug, name, manager_name, logo_path, sort_order) values
  ('boisterous-cicadas',   'Boisterous Cicadas',   'Abhay Mishra (Abe)',       '/icons/clubs/boisterous-cicadas.png',   1),
  ('simbas-oldie-goldies', 'Simba''s Oldie Goldies','Ajay Sanghvi (Ahjoo)',    '/icons/clubs/simbas-oldie-goldies.png', 2),
  ('defanged-piranhas',    'Defanged Piranhas',    'Niranjan Sarda (Goodman)', '/icons/clubs/defanged-piranhas.jpg',    3),
  ('paper-tigers',         'Paper Tigers',         'Mukul Inamdar (Mkul)',     '/icons/clubs/paper-tigers.png',         4),
  ('kraken-leviathans',    'Kraken Leviathans',    'Jaidev Karanth (Jake)',    '/icons/clubs/kraken-leviathans.png',    5),
  ('ninja-ballers',        'Ninja Ballers',        'Priyank Gurhani (Crank)',  '/icons/clubs/ninja-ballers.png',        6),
  ('resilient-rhinos',     'Resilient Rhinos',     'Sachin Kadam (Ahchin)',    '/icons/clubs/resilient-rhinos.png',     7),
  ('deep-waters',          'Deep Waters',          'Lavleen Sharma (Seito)',   '/icons/clubs/deep-waters.png',          8),
  ('shmoos-bling-babies',  'Shmoo''s Bling Babies','Sudarshan Sharma (Shmoo)', '/icons/clubs/shmoos-bling-babies.jpg',  9),
  ('rusty-rabonas',        'Rusty Rabonas',        'Anupam Sawant (Napalm)',   '/icons/clubs/rusty-rabonas.png',        10),
  ('dancing-dodos',        'Dancing Dodos',        'Shahbaz Khan (Baz)',       '/icons/clubs/dancing-dodos.png',        11),
  ('abs-babies',           'AB''s Babies',         'Aman Bansal (Caveman)',    '/icons/clubs/abs-babies.png',           12),
  ('angry-ant-aunties',    'Angry Ant Aunties',    'Prerna Shetty (Acid)',     '/icons/clubs/angry-ant-aunties.png',    13)
on conflict (slug) do nothing;
```

- [ ] **Step 3: Write the manager-link snippet (run later, when accounts exist)**

```sql
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
```

- [ ] **Step 4: Apply and verify the seed**

Run:
```bash
npx supabase db reset
```
Expected: reset succeeds (13 clubs seeded; verified in Task 3 once types exist).

- [ ] **Step 5: Commit**

```bash
git add public/icons/clubs supabase/migrations/20260720120100_seed_clubs.sql supabase/snippets/link-club-managers.sql
git commit -m "feat(klc): seed 13 clubs + logos + manager-link snippet"
```

---

## Task 3: Regenerate Supabase types

**Files:**
- Modify: `src/lib/supabase/database.types.ts`

- [ ] **Step 1: Regenerate types from the local DB**

Run:
```bash
npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
grep -E "clubs:|club_balance_sheets:|club_player_shares:" src/lib/supabase/database.types.ts
```
Expected: all three table names appear.

- [ ] **Step 2: Confirm the project still type-checks**

Run:
```bash
npm run build
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/database.types.ts
git commit -m "chore(klc): regenerate Supabase types for club tables"
```

---

## Task 4: `klc/types.ts` — draft shapes

**Files:**
- Create: `src/lib/klc/types.ts`
- Test: `src/lib/klc/types.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/klc/types.test.ts
import { describe, it, expect } from "vitest";
import { emptyBalanceDraft } from "./types";

describe("emptyBalanceDraft", () => {
  it("zeroes all fields and starts with no loanee rows", () => {
    expect(emptyBalanceDraft()).toEqual({
      asOfDate: null,
      matchesPlayed: 0,
      matchesWon: 0,
      matchesDrawn: 0,
      matchesLost: 0,
      clubBonus: 0,
      shares: [],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/klc/types.test.ts`
Expected: FAIL — cannot find module `./types`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/klc/types.ts
/**
 * Canonical Club Balance Sheet draft — shared by the client form, the compute
 * engine, the repository, and the admin view. Mirrors the DB:
 *   sheet fields → club_balance_sheets columns
 *   shares       → club_player_shares (dynamic loanee rows the Manager adds)
 * Totals (items 8/9/10) are NOT stored here; they are computed in compute.ts.
 */

export interface ClubSummary {
  id: string;
  slug: string;
  name: string;
  managerName: string;
  managerPlayerId: string | null;
  logoPath: string;
}

/** A member available to be added as a loanee (picker option). */
export interface MemberOption {
  id: string;
  displayName: string;
}

/** One loanee row: which member, and their item-4 number. */
export interface ClubPlayerShare {
  playerId: string;
  playerName: string;
  amount: number;
}

export interface ClubBalanceDraft {
  asOfDate: string | null; // item 1 — 'YYYY-MM-DD' or null
  matchesPlayed: number; // item 2
  matchesWon: number; // item 3
  matchesDrawn: number; // item 5
  matchesLost: number; // item 6
  clubBonus: number; // item 7 (Kroopies)
  shares: ClubPlayerShare[]; // item 4 — dynamic loanee rows
}

/** A blank running sheet (no loanees yet). */
export function emptyBalanceDraft(): ClubBalanceDraft {
  return {
    asOfDate: null,
    matchesPlayed: 0,
    matchesWon: 0,
    matchesDrawn: 0,
    matchesLost: 0,
    clubBonus: 0,
    shares: [],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/klc/types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/klc/types.ts src/lib/klc/types.test.ts
git commit -m "feat(klc): balance sheet draft types"
```

---

## Task 5: `klc/config.ts` — rates loader

**Files:**
- Create: `src/lib/klc/config.ts`
- Test: `src/lib/klc/config.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/klc/config.test.ts
import { describe, it, expect } from "vitest";
import { parseKlcRates, DEFAULT_KLC_RATES } from "./config";

describe("parseKlcRates", () => {
  it("reads valid values", () => {
    expect(parseKlcRates({ playedToKfandra: 10, wonFromKfandra: 20, loaneePerShare: 10 }))
      .toEqual({ playedToKfandra: 10, wonFromKfandra: 20, loaneePerShare: 10 });
  });

  it("falls back to defaults for missing or non-numeric fields", () => {
    expect(parseKlcRates(null)).toEqual(DEFAULT_KLC_RATES);
    expect(parseKlcRates({ playedToKfandra: "x", wonFromKfandra: 5 }))
      .toEqual({ ...DEFAULT_KLC_RATES, wonFromKfandra: 5 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/klc/config.test.ts`
Expected: FAIL — cannot find module `./config`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/klc/config.ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Kroopies rates for the balance-sheet calculations (item 8/9/10). */
export interface KlcRates {
  playedToKfandra: number; // item 8 multiplier
  wonFromKfandra: number; // item 9 multiplier
  loaneePerShare: number; // item 10 multiplier
}

export const DEFAULT_KLC_RATES: KlcRates = {
  playedToKfandra: 10,
  wonFromKfandra: 20,
  loaneePerShare: 10,
};

/** Pure: coerce a raw app_config JSON value into KlcRates with safe fallbacks. */
export function parseKlcRates(value: unknown): KlcRates {
  const v = (value ?? {}) as Record<string, unknown>;
  const num = (x: unknown, fallback: number) =>
    typeof x === "number" && Number.isFinite(x) ? x : fallback;
  return {
    playedToKfandra: num(v.playedToKfandra, DEFAULT_KLC_RATES.playedToKfandra),
    wonFromKfandra: num(v.wonFromKfandra, DEFAULT_KLC_RATES.wonFromKfandra),
    loaneePerShare: num(v.loaneePerShare, DEFAULT_KLC_RATES.loaneePerShare),
  };
}

/** Load rates from app_config (key 'klc_rates'); defaults if absent. */
export async function loadKlcRates(): Promise<KlcRates> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_config")
    .select("value")
    .eq("key", "klc_rates")
    .maybeSingle();
  return parseKlcRates(data?.value ?? null);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/klc/config.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/klc/config.ts src/lib/klc/config.test.ts
git commit -m "feat(klc): rates config loader"
```

---

## Task 6: `klc/compute.ts` — item 8/9/10 totals

**Files:**
- Create: `src/lib/klc/compute.ts`
- Test: `src/lib/klc/compute.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/klc/compute.test.ts
import { describe, it, expect } from "vitest";
import { computeClubTotals } from "./compute";
import { DEFAULT_KLC_RATES } from "./config";
import type { ClubBalanceDraft } from "./types";

const base: ClubBalanceDraft = {
  asOfDate: "2026-07-20",
  matchesPlayed: 6,
  matchesWon: 4,
  matchesDrawn: 1,
  matchesLost: 1,
  clubBonus: 50,
  shares: [
    { playerId: "a", playerName: "A", amount: 5 },
    { playerId: "b", playerName: "B", amount: 4 },
  ],
};

describe("computeClubTotals", () => {
  it("matches the worked example (played 6, won 4, bonus 50, loanees 5+4)", () => {
    expect(computeClubTotals(base, DEFAULT_KLC_RATES)).toEqual({
      paidToKfandra: 60, // 6 * 10
      receivedFromKfandra: 130, // 4 * 20 + 50
      distributedToLoanees: 90, // (5 + 4) * 10
    });
  });

  it("is all zero for an empty sheet", () => {
    const empty: ClubBalanceDraft = {
      asOfDate: null, matchesPlayed: 0, matchesWon: 0, matchesDrawn: 0,
      matchesLost: 0, clubBonus: 0, shares: [],
    };
    expect(computeClubTotals(empty, DEFAULT_KLC_RATES)).toEqual({
      paidToKfandra: 0, receivedFromKfandra: 0, distributedToLoanees: 0,
    });
  });

  it("adds the club bonus even with zero wins", () => {
    expect(computeClubTotals({ ...base, matchesWon: 0 }, DEFAULT_KLC_RATES).receivedFromKfandra)
      .toBe(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/klc/compute.test.ts`
Expected: FAIL — cannot find module `./compute`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/klc/compute.ts
import type { KlcRates } from "./config";
import type { ClubBalanceDraft } from "./types";

/** The three derived Kroopies totals (items 8, 9, 10). */
export interface ClubTotals {
  paidToKfandra: number; // item 8
  receivedFromKfandra: number; // item 9
  distributedToLoanees: number; // item 10
}

/** Pure. Derives items 8/9/10 from the draft + rates. Never stored. */
export function computeClubTotals(
  draft: ClubBalanceDraft,
  rates: KlcRates,
): ClubTotals {
  const shareTotal = draft.shares.reduce((sum, s) => sum + (s.amount || 0), 0);
  return {
    paidToKfandra: draft.matchesPlayed * rates.playedToKfandra,
    receivedFromKfandra: draft.matchesWon * rates.wonFromKfandra + draft.clubBonus,
    distributedToLoanees: shareTotal * rates.loaneePerShare,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/klc/compute.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/klc/compute.ts src/lib/klc/compute.test.ts
git commit -m "feat(klc): derive item 8/9/10 totals"
```

---

## Task 7: `klc/repository.ts` — clubs, members, sheet persistence

**Files:**
- Create: `src/lib/klc/repository.ts`
- Test: `src/lib/klc/repository.test.ts`

The DB I/O uses the service-role client (exercised via the app). The **pure** `buildBalanceDraft` mapper is unit-tested.

- [ ] **Step 1: Write the failing test for the pure mapper**

```typescript
// src/lib/klc/repository.test.ts
import { describe, it, expect } from "vitest";
import { buildBalanceDraft } from "./repository";

describe("buildBalanceDraft", () => {
  it("maps a stored sheet + loanee rows into a draft", () => {
    const sheet = {
      as_of_date: "2026-07-20",
      matches_played: 6, matches_won: 4, matches_drawn: 1, matches_lost: 1,
      club_bonus: 50,
    };
    const shares = [
      { player_id: "p1", amount: 5, display_name: "Asha" },
      { player_id: "p2", amount: 4, display_name: "Ben" },
    ];
    expect(buildBalanceDraft(sheet, shares)).toEqual({
      asOfDate: "2026-07-20",
      matchesPlayed: 6, matchesWon: 4, matchesDrawn: 1, matchesLost: 1,
      clubBonus: 50,
      shares: [
        { playerId: "p1", playerName: "Asha", amount: 5 },
        { playerId: "p2", playerName: "Ben", amount: 4 },
      ],
    });
  });

  it("returns a zeroed draft with no loanees when no sheet exists", () => {
    expect(buildBalanceDraft(null, [])).toEqual({
      asOfDate: null,
      matchesPlayed: 0, matchesWon: 0, matchesDrawn: 0, matchesLost: 0,
      clubBonus: 0, shares: [],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/klc/repository.test.ts`
Expected: FAIL — cannot find module `./repository`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/klc/repository.ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ClubBalanceDraft, ClubSummary, MemberOption } from "./types";

export interface SheetRow {
  as_of_date: string | null;
  matches_played: number;
  matches_won: number;
  matches_drawn: number;
  matches_lost: number;
  club_bonus: number;
}
export interface ShareRowWithName {
  player_id: string;
  amount: number;
  display_name: string;
}

/** Pure: merge stored sheet + loanee rows into a draft. */
export function buildBalanceDraft(
  sheet: SheetRow | null,
  shares: ShareRowWithName[],
): ClubBalanceDraft {
  return {
    asOfDate: sheet?.as_of_date ?? null,
    matchesPlayed: sheet?.matches_played ?? 0,
    matchesWon: sheet?.matches_won ?? 0,
    matchesDrawn: sheet?.matches_drawn ?? 0,
    matchesLost: sheet?.matches_lost ?? 0,
    clubBonus: sheet?.club_bonus ?? 0,
    shares: shares.map((s) => ({
      playerId: s.player_id,
      playerName: s.display_name,
      amount: s.amount,
    })),
  };
}

function toSummary(c: {
  id: string; slug: string; name: string; manager_name: string;
  manager_player_id: string | null; logo_path: string;
}): ClubSummary {
  return {
    id: c.id, slug: c.slug, name: c.name,
    managerName: c.manager_name, managerPlayerId: c.manager_player_id,
    logoPath: c.logo_path,
  };
}

/** All active clubs, ordered for the landing grid. */
export async function listClubs(): Promise<ClubSummary[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("clubs")
    .select("id, slug, name, manager_name, manager_player_id, logo_path, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []).map(toSummary);
}

/** One club by id, or null. */
export async function getClub(clubId: string): Promise<ClubSummary | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("clubs")
    .select("id, slug, name, manager_name, manager_player_id, logo_path")
    .eq("id", clubId)
    .maybeSingle();
  return data ? toSummary(data) : null;
}

/** Active members available as loanee-picker options. */
export async function listActiveMembers(): Promise<MemberOption[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("players")
    .select("id, display_name")
    .eq("is_active", true)
    .order("display_name", { ascending: true });
  return (data ?? []).map((p) => ({ id: p.id, displayName: p.display_name }));
}

/** The club's current running draft (sheet + loanee rows with names). */
export async function loadClubBalance(clubId: string): Promise<ClubBalanceDraft> {
  const admin = createAdminClient();
  const [sheetRes, sharesRes] = await Promise.all([
    admin
      .from("club_balance_sheets")
      .select("as_of_date, matches_played, matches_won, matches_drawn, matches_lost, club_bonus")
      .eq("club_id", clubId)
      .maybeSingle(),
    admin
      .from("club_player_shares")
      .select("player_id, amount, players(display_name)")
      .eq("club_id", clubId),
  ]);

  const shares: ShareRowWithName[] = (sharesRes.data ?? []).map((r) => {
    // players(display_name) comes back as an object (to-one relation).
    const rel = r.players as unknown as { display_name: string } | null;
    return {
      player_id: r.player_id,
      amount: r.amount,
      display_name: rel?.display_name ?? "Unknown",
    };
  });
  return buildBalanceDraft((sheetRes.data as SheetRow | null) ?? null, shares);
}

/** Upsert the club's sheet and REPLACE its loanee rows wholesale. */
export async function saveClubBalance(
  clubId: string,
  draft: ClubBalanceDraft,
  updatedBy: string,
): Promise<void> {
  const admin = createAdminClient();

  const { error: sheetErr } = await admin.from("club_balance_sheets").upsert(
    {
      club_id: clubId,
      as_of_date: draft.asOfDate,
      matches_played: draft.matchesPlayed,
      matches_won: draft.matchesWon,
      matches_drawn: draft.matchesDrawn,
      matches_lost: draft.matchesLost,
      club_bonus: draft.clubBonus,
      updated_by: updatedBy,
    },
    { onConflict: "club_id" },
  );
  if (sheetErr) throw new Error(`Failed to save balance sheet: ${sheetErr.message}`);

  // Replace loanee rows: delete all, then insert current (deduped by player).
  await admin.from("club_player_shares").delete().eq("club_id", clubId);

  const byPlayer = new Map<string, number>();
  for (const s of draft.shares) {
    if (s.playerId) byPlayer.set(s.playerId, s.amount || 0);
  }
  const rows = [...byPlayer.entries()].map(([player_id, amount]) => ({
    club_id: clubId,
    player_id,
    amount,
  }));
  if (rows.length > 0) {
    const { error: shareErr } = await admin.from("club_player_shares").insert(rows);
    if (shareErr) throw new Error(`Failed to save loanee rows: ${shareErr.message}`);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/klc/repository.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/klc/repository.ts src/lib/klc/repository.test.ts
git commit -m "feat(klc): club/member/sheet repository + pure draft mapper"
```

---

## Task 8: `klc/actions.ts` — manager-guarded save

**Files:**
- Create: `src/lib/klc/actions.ts`

- [ ] **Step 1: Write the server action**

```typescript
// src/lib/klc/actions.ts
"use server";

import { getCurrentPlayer } from "@/lib/auth/current-user";
import { isStaffRole } from "@/lib/auth/roles";
import { getClub, saveClubBalance } from "./repository";
import type { ClubBalanceDraft } from "./types";

/**
 * Save action for the Club Balance Sheet. Re-resolves the signed-in player and
 * enforces: staff may edit any club; otherwise the player MUST be this club's
 * Player Manager (clubs.manager_player_id). Saving is the record (no approval
 * gate), mirroring MMG.
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const NOT_SIGNED_IN = "You must be signed in.";
const NOT_MANAGER = "Only this club's Player Manager can edit its balance sheet.";
const NO_CLUB = "Club not found.";

/** Sanitise a client draft: coerce to non-negative integers, drop empty rows. */
function sanitize(draft: ClubBalanceDraft): ClubBalanceDraft {
  const n = (x: unknown) => {
    const v = Math.trunc(Number(x));
    return Number.isFinite(v) && v > 0 ? v : 0;
  };
  return {
    asOfDate: draft.asOfDate || null,
    matchesPlayed: n(draft.matchesPlayed),
    matchesWon: n(draft.matchesWon),
    matchesDrawn: n(draft.matchesDrawn),
    matchesLost: n(draft.matchesLost),
    clubBonus: n(draft.clubBonus),
    shares: (draft.shares ?? [])
      .filter((s) => s.playerId)
      .map((s) => ({ playerId: s.playerId, playerName: s.playerName, amount: n(s.amount) })),
  };
}

export async function saveClubBalanceAction(
  clubId: string,
  draft: ClubBalanceDraft,
): Promise<ActionResult> {
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };

  const club = await getClub(clubId);
  if (!club) return { ok: false, error: NO_CLUB };

  const allowed = isStaffRole(player.role) || club.managerPlayerId === player.id;
  if (!allowed) return { ok: false, error: NOT_MANAGER };

  try {
    await saveClubBalance(clubId, sanitize(draft), player.id);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/lib/klc/actions.ts
git commit -m "feat(klc): manager-guarded save action"
```

---

## Task 9: Strings — home block, klc labels, admin card

**Files:**
- Modify: `src/content/strings.ts`

- [ ] **Step 1: Add a `balanceSheet` entry to `home`** (after the `diet` entry):

```typescript
    balanceSheet: {
      title: "Club Balance Sheet",
      subtitle: "Bal. Sheet · Managers",
    },
```

- [ ] **Step 2: Add a top-level `klc` section** (after the `home:` object, before `login:`):

```typescript
  /** Club Balance Sheet (KLCFERRSXVSG1) screens. */
  klc: {
    landingTitle: "KLCFERRSXVSG1",
    landingSubtitle: "Tap your club’s crest to open its balance sheet.",
    lockedNote: "Only your own club’s sheet is open to you.",
    noClubNote: "You don’t manage a club, so no sheet is editable.",
    sheetHeading: "Club Balance Sheet",
    managerLabel: "Player Manager",
    breadcrumb: "Balance Sheet",
    addLoanee: "+ Add loanee",
    pickPlayer: "Select player…",
    fields: {
      asOfDate: "Date",
      matchesPlayed: "Matches played",
      matchesWon: "Matches won",
      players: "Players (loanees)",
      matchesDrawn: "Matches drawn",
      matchesLost: "Matches lost",
      clubBonus: "Club Bonus from KFANDRA",
      paidToKfandra: "Total to be paid to KFANDRA",
      receivedFromKfandra: "Total to be received from KFANDRA",
      distributedToLoanees: "Total to be distributed to loanees",
    },
    currency: "Kroopies",
  },
```

- [ ] **Step 3: Add the admin card** (in the `admin:` object, after `dietCard`):

```typescript
    klcCard: { title: "Club Balance Sheet", subtitle: "Review each club’s sheet" },
```

- [ ] **Step 4: Verify + commit**

Run: `npm run build`
Expected: build succeeds.
```bash
git add src/content/strings.ts
git commit -m "feat(klc): display strings for balance sheet"
```

---

## Task 10: Home screen — add the Club Balance Sheet block

**Files:**
- Modify: `src/app/home-screen.tsx`

- [ ] **Step 1: Add a full-width block** immediately after the closing `</motion.div>` of the 3-card "Floating Feature Cards" grid (right before the `{isStaff && (` block):

```tsx
        {/* Club Balance Sheet — full-width block */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="w-full"
          whileHover={{ y: -3, scale: 1.01 }}
        >
          <Link
            href="/klc"
            onClick={() => capture(AnalyticsEvent.ModeOpened, { mode: "klc" })}
            className="flex items-center gap-3 rounded-2xl border border-white/30 bg-white/20 p-4 text-left backdrop-blur"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-400/30 border border-purple-300/40">
              <svg className="h-4 w-4 text-purple-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white">{home.balanceSheet.title}</h2>
              <p className="text-[10.5px] text-blue-100/70 leading-snug">
                {home.balanceSheet.subtitle}
              </p>
            </div>
          </Link>
        </motion.div>
```

- [ ] **Step 2: Allow the new analytics mode value**

Run:
```bash
grep -n "ModeOpened\|mode" src/lib/observability/analytics.ts
```
If the `mode` property is a typed union that excludes `"klc"`, add `"klc"`. If it's `string`, no change.

- [ ] **Step 3: Verify + commit**

Run: `npm run build`
Expected: build succeeds.
```bash
git add src/app/home-screen.tsx src/lib/observability/analytics.ts
git commit -m "feat(klc): add Club Balance Sheet block to home"
```

---

## Task 11: `/klc` landing — flat grid of 13 crests

**Files:**
- Create: `src/app/klc/page.tsx`

- [ ] **Step 1: Write the landing page**

```tsx
// src/app/klc/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/auth/current-user";
import { isStaffRole } from "@/lib/auth/roles";
import { listClubs } from "@/lib/klc/repository";
import { strings } from "@/content/strings";
import { Breadcrumb } from "@/components/breadcrumb";

export const dynamic = "force-dynamic";

export default async function KlcLandingPage() {
  const player = await getCurrentPlayer();
  if (!player) redirect("/login?next=/klc");

  const clubs = await listClubs();
  const staff = isStaffRole(player.role);
  const managesAny = clubs.some((c) => c.managerPlayerId === player.id);
  const { klc } = strings;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 p-5 pb-24">
      <Breadcrumb label={klc.breadcrumb} />
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-black tracking-tight text-gray-900">
          {klc.landingTitle}
        </h1>
        <p className="mt-1 text-[12px] text-gray-600">
          {staff || managesAny ? klc.landingSubtitle : klc.noClubNote}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {clubs.map((c) => {
          const openable = staff || c.managerPlayerId === player.id;
          const tile = (
            <div
              className={`flex flex-col items-center gap-2 rounded-2xl border p-3 ${
                openable
                  ? "border-gray-200 bg-white active:scale-[0.98]"
                  : "border-gray-100 bg-gray-50 opacity-60"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.logoPath} alt={c.name} className="h-14 w-14 object-contain" />
              <span className="truncate text-center text-[11px] font-semibold text-gray-800">
                {c.name}
              </span>
              {!openable && <span aria-hidden className="text-[11px] text-gray-400">🔒</span>}
            </div>
          );
          return openable ? (
            <Link key={c.id} href={`/klc/${c.id}`} className="block">
              {tile}
            </Link>
          ) : (
            <div key={c.id} title={klc.lockedNote}>
              {tile}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run build`
Expected: build succeeds.
```bash
git add src/app/klc/page.tsx
git commit -m "feat(klc): landing page with flat grid of 13 crests"
```

---

## Task 12: `/klc/[clubId]` — club page + autosaving form with loanee rows

**Files:**
- Create: `src/app/klc/[clubId]/page.tsx`
- Create: `src/app/klc/[clubId]/club-balance-entry.tsx`

- [ ] **Step 1: Write the server page (guard + data load)**

```tsx
// src/app/klc/[clubId]/page.tsx
import { redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/auth/current-user";
import { isStaffRole } from "@/lib/auth/roles";
import { getClub, loadClubBalance, listActiveMembers } from "@/lib/klc/repository";
import { loadKlcRates } from "@/lib/klc/config";
import ClubBalanceEntry from "./club-balance-entry";

export const dynamic = "force-dynamic";

export default async function ClubPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  const player = await getCurrentPlayer();
  if (!player) redirect(`/login?next=/klc/${clubId}`);

  const club = await getClub(clubId);
  if (!club) redirect("/klc");

  const staff = isStaffRole(player.role);
  if (!staff && club.managerPlayerId !== player.id) redirect("/klc");

  const [draft, rates, members] = await Promise.all([
    loadClubBalance(clubId),
    loadKlcRates(),
    listActiveMembers(),
  ]);

  return (
    <ClubBalanceEntry
      clubId={clubId}
      club={club}
      initialDraft={draft}
      rates={rates}
      members={members}
    />
  );
}
```

- [ ] **Step 2: Write the client form**

```tsx
// src/app/klc/[clubId]/club-balance-entry.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveDraft as saveLocalDraft } from "@/lib/drafts/storage";
import { saveClubBalanceAction } from "@/lib/klc/actions";
import { computeClubTotals } from "@/lib/klc/compute";
import type { KlcRates } from "@/lib/klc/config";
import type { ClubBalanceDraft, ClubSummary, MemberOption } from "@/lib/klc/types";
import { strings } from "@/content/strings";
import { Breadcrumb } from "@/components/breadcrumb";

type SyncStatus = "idle" | "saving" | "saved" | "error";

export default function ClubBalanceEntry({
  clubId,
  club,
  initialDraft,
  rates,
  members,
}: {
  clubId: string;
  club: ClubSummary;
  initialDraft: ClubBalanceDraft;
  rates: KlcRates;
  members: MemberOption[];
}) {
  const { klc } = strings;
  const f = klc.fields;
  const [draft, setDraft] = useState<ClubBalanceDraft>(initialDraft);
  const [status, setStatus] = useState<SyncStatus>("idle");

  const totals = useMemo(() => computeClubTotals(draft, rates), [draft, rates]);
  const nameById = useMemo(
    () => new Map(members.map((m) => [m.id, m.displayName])),
    [members],
  );

  // Autosave: local immediately + server on a debounce (mirrors MMG).
  const serverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSave = useRef(true);
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    saveLocalDraft(`klc:${clubId}`, draft);
    if (serverTimer.current) clearTimeout(serverTimer.current);
    serverTimer.current = setTimeout(async () => {
      const res = await saveClubBalanceAction(clubId, draftRef.current);
      setStatus(res.ok ? "saved" : "error");
    }, 1000);
    return () => {
      if (serverTimer.current) clearTimeout(serverTimer.current);
    };
  }, [draft, clubId]);

  const mutate = useCallback((updater: (d: ClubBalanceDraft) => ClubBalanceDraft) => {
    setStatus("saving");
    setDraft(updater);
  }, []);

  const setNum = (key: keyof ClubBalanceDraft, raw: string) => {
    const cleaned = raw.replace(/\D/g, "");
    mutate((d) => ({ ...d, [key]: cleaned === "" ? 0 : Number(cleaned) }));
  };

  // Loanee rows (item 4)
  const addLoanee = () =>
    mutate((d) => ({ ...d, shares: [...d.shares, { playerId: "", playerName: "", amount: 0 }] }));
  const setLoaneePlayer = (index: number, playerId: string) =>
    mutate((d) => ({
      ...d,
      shares: d.shares.map((s, i) =>
        i === index ? { ...s, playerId, playerName: nameById.get(playerId) ?? "" } : s,
      ),
    }));
  const setLoaneeAmount = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, "");
    mutate((d) => ({
      ...d,
      shares: d.shares.map((s, i) =>
        i === index ? { ...s, amount: cleaned === "" ? 0 : Number(cleaned) } : s,
      ),
    }));
  };
  const removeLoanee = (index: number) =>
    mutate((d) => ({ ...d, shares: d.shares.filter((_, i) => i !== index) }));

  // Members not already chosen (so each loanee appears once).
  const chosen = new Set(draft.shares.map((s) => s.playerId).filter(Boolean));

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-5 pb-32">
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={club.logoPath} alt={club.name} className="h-12 w-12 object-contain" />
            <div>
              <h1 className="text-lg font-black text-gray-900">{club.name}</h1>
              <p className="text-[11px] text-gray-600">
                {klc.managerLabel} — {club.managerName || "—"}
              </p>
            </div>
          </div>
          <SyncBadge status={status} />
        </div>
        <p className="mt-3 text-[10px] uppercase tracking-widest text-gray-600 font-semibold">
          {klc.sheetHeading}
        </p>
      </div>

      <Breadcrumb label={klc.breadcrumb} />

      <Row n={1} label={f.asOfDate}>
        <input
          type="date"
          value={draft.asOfDate ?? ""}
          onChange={(e) => mutate((d) => ({ ...d, asOfDate: e.target.value || null }))}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </Row>
      <Row n={2} label={f.matchesPlayed}>
        <NumBox value={draft.matchesPlayed} onChange={(v) => setNum("matchesPlayed", v)} />
      </Row>
      <Row n={3} label={f.matchesWon}>
        <NumBox value={draft.matchesWon} onChange={(v) => setNum("matchesWon", v)} />
      </Row>

      {/* 4. Loanees */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900">
          <Num n={4} /> {f.players}
        </p>
        <div className="flex flex-col gap-2">
          {draft.shares.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={s.playerId}
                onChange={(e) => setLoaneePlayer(i, e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-2 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">{klc.pickPlayer}</option>
                {members
                  .filter((m) => m.id === s.playerId || !chosen.has(m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>{m.displayName}</option>
                  ))}
              </select>
              <input
                value={s.amount === 0 ? "" : String(s.amount)}
                onChange={(e) => setLoaneeAmount(i, e.target.value)}
                inputMode="numeric"
                placeholder="0"
                className="w-16 rounded-xl border border-gray-200 bg-white px-3 py-2 text-center text-sm tabular-nums focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                onClick={() => removeLoanee(i)}
                className="px-2 text-gray-600 hover:text-red-500"
                aria-label="Remove loanee"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={addLoanee}
            className="self-start rounded-lg px-1 text-[12px] font-semibold text-blue-600 hover:text-blue-700"
          >
            {klc.addLoanee}
          </button>
        </div>
      </div>

      <Row n={5} label={f.matchesDrawn}>
        <NumBox value={draft.matchesDrawn} onChange={(v) => setNum("matchesDrawn", v)} />
      </Row>
      <Row n={6} label={f.matchesLost}>
        <NumBox value={draft.matchesLost} onChange={(v) => setNum("matchesLost", v)} />
      </Row>
      <Row n={7} label={f.clubBonus}>
        <NumBox value={draft.clubBonus} onChange={(v) => setNum("clubBonus", v)} />
      </Row>

      <TotalRow n={8} label={f.paidToKfandra} value={totals.paidToKfandra} currency={klc.currency} />
      <TotalRow n={9} label={f.receivedFromKfandra} value={totals.receivedFromKfandra} currency={klc.currency} />
      <TotalRow n={10} label={f.distributedToLoanees} value={totals.distributedToLoanees} currency={klc.currency} />
    </div>
  );
}

function Num({ n }: { n: number }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
      {n}
    </span>
  );
}
function Row({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4">
      <span className="flex items-center gap-2 text-sm font-medium text-gray-800">
        <Num n={n} /> {label}
      </span>
      {children}
    </div>
  );
}
function NumBox({ value, onChange }: { value: number; onChange: (v: string) => void }) {
  return (
    <input
      value={value === 0 ? "" : String(value)}
      onChange={(e) => onChange(e.target.value)}
      inputMode="numeric"
      placeholder="0"
      className="w-24 rounded-xl border border-gray-200 bg-white px-3 py-2 text-center text-sm tabular-nums focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
    />
  );
}
function TotalRow({
  n, label, value, currency,
}: { n: number; label: string; value: number; currency: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <span className="flex items-center gap-2 text-sm font-semibold text-blue-900">
        <Num n={n} /> {label}
      </span>
      <span className="tabular-nums text-sm font-bold text-blue-900">
        {value.toLocaleString()} <span className="text-[11px] font-medium text-blue-700">{currency}</span>
      </span>
    </div>
  );
}
function SyncBadge({ status }: { status: SyncStatus }) {
  const label =
    status === "saving" ? "Saving…"
    : status === "saved" ? "Saved ✓"
    : status === "error" ? "Offline — saved locally"
    : "";
  const color =
    status === "error" ? "text-amber-600"
    : status === "saved" ? "text-green-600"
    : "text-gray-600";
  return <span className={`text-[11px] font-semibold ${color}`}>{label}</span>;
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manually verify (dev server, as staff or the club's Manager)**

Open `/klc` → confirm a flat grid of 13; only your managed club (or all, if staff) is tappable. Open one, set Matches played 6, Matches won 4, Club Bonus 50, add two loanees with 5 and 4. Confirm items 8/9/10 show **60 / 130 / 90 Kroopies** and "Saved ✓". Reload; values persist.

- [ ] **Step 5: Commit**

```bash
git add src/app/klc/[clubId]/page.tsx src/app/klc/[clubId]/club-balance-entry.tsx
git commit -m "feat(klc): club page with autosaving loanee balance sheet"
```

---

## Task 13: Admin review surface

**Files:**
- Create: `src/lib/admin/klc-repository.ts`
- Create: `src/app/admin/klc/page.tsx`
- Create: `src/app/admin/klc/copy-button.tsx`
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Write the admin repository**

```typescript
// src/lib/admin/klc-repository.ts
import "server-only";
import { loadKlcRates } from "@/lib/klc/config";
import { computeClubTotals, type ClubTotals } from "@/lib/klc/compute";
import { getClub, listClubs, loadClubBalance } from "@/lib/klc/repository";
import type { ClubBalanceDraft, ClubSummary } from "@/lib/klc/types";

export interface AdminClubRow {
  club: ClubSummary;
  loaneeCount: number;
  hasData: boolean;
}

/** All clubs with a quick "does it have entries yet?" flag. */
export async function listClubsWithStatus(): Promise<AdminClubRow[]> {
  const clubs = await listClubs();
  return Promise.all(
    clubs.map(async (club) => {
      const draft = await loadClubBalance(club.id);
      const hasData =
        draft.matchesPlayed > 0 || draft.matchesWon > 0 || draft.matchesDrawn > 0 ||
        draft.matchesLost > 0 || draft.clubBonus > 0 || draft.shares.length > 0;
      return { club, loaneeCount: draft.shares.length, hasData };
    }),
  );
}

export interface AdminClubSheet {
  club: ClubSummary;
  draft: ClubBalanceDraft;
  totals: ClubTotals;
}

/** Full sheet + totals for one club (read-only admin view). */
export async function getClubSheetForAdmin(clubId: string): Promise<AdminClubSheet | null> {
  const club = await getClub(clubId);
  if (!club) return null;
  const [draft, rates] = await Promise.all([loadClubBalance(clubId), loadKlcRates()]);
  return { club, draft, totals: computeClubTotals(draft, rates) };
}
```

- [ ] **Step 2: Write the copy button (client)**

```tsx
// src/app/admin/klc/copy-button.tsx
"use client";

import { useState } from "react";

export function CopySheetButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50"
    >
      {copied ? "Copied ✓" : "Copy sheet as text"}
    </button>
  );
}
```

- [ ] **Step 3: Write the admin page**

```tsx
// src/app/admin/klc/page.tsx
import Link from "next/link";
import { listClubsWithStatus, getClubSheetForAdmin } from "@/lib/admin/klc-repository";
import { strings } from "@/content/strings";
import { CopySheetButton } from "./copy-button";

export const dynamic = "force-dynamic";

export default async function AdminKlcPage({
  searchParams,
}: {
  searchParams: Promise<{ club?: string }>;
}) {
  const { club } = await searchParams;
  if (club) return <OneClub clubId={club} />;
  return <Index />;
}

async function Index() {
  const rows = await listClubsWithStatus();
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold text-gray-900">Clubs</h2>
      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
        {rows.map((r) => (
          <li key={r.club.id}>
            <Link
              href={`/admin/klc?club=${r.club.id}`}
              className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50"
            >
              <span className="font-medium text-gray-900">{r.club.name}</span>
              <span className="text-[11px] text-gray-600">
                {r.loaneeCount} loanees · {r.hasData ? "has entries" : "empty"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function OneClub({ clubId }: { clubId: string }) {
  const sheet = await getClubSheetForAdmin(clubId);
  const { klc } = strings;
  const f = klc.fields;
  if (!sheet) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-gray-600">Club not found.</p>
      </div>
    );
  }
  const { club, draft, totals } = sheet;

  const lines = [
    `${club.name} — ${klc.sheetHeading}`,
    `${klc.managerLabel}: ${club.managerName || "—"}`,
    `${f.asOfDate}: ${draft.asOfDate ?? "—"}`,
    `${f.matchesPlayed}: ${draft.matchesPlayed}`,
    `${f.matchesWon}: ${draft.matchesWon}`,
    `${f.players}:`,
    ...draft.shares.map((s) => `  ${s.playerName}: ${s.amount}`),
    `${f.matchesDrawn}: ${draft.matchesDrawn}`,
    `${f.matchesLost}: ${draft.matchesLost}`,
    `${f.clubBonus}: ${draft.clubBonus} ${klc.currency}`,
    `${f.paidToKfandra}: ${totals.paidToKfandra} ${klc.currency}`,
    `${f.receivedFromKfandra}: ${totals.receivedFromKfandra} ${klc.currency}`,
    `${f.distributedToLoanees}: ${totals.distributedToLoanees} ${klc.currency}`,
  ];
  const copyText = lines.join("\n");

  return (
    <div className="space-y-4">
      <BackLink />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{club.name}</h2>
          <p className="text-[11px] text-gray-600">
            {klc.managerLabel} — {club.managerName || "—"}
          </p>
        </div>
        <CopySheetButton text={copyText} />
      </div>

      <dl className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white text-sm">
        <Line label={f.asOfDate} value={draft.asOfDate ?? "—"} />
        <Line label={f.matchesPlayed} value={String(draft.matchesPlayed)} />
        <Line label={f.matchesWon} value={String(draft.matchesWon)} />
        <div className="px-4 py-2.5">
          <p className="mb-1 font-semibold text-gray-900">{f.players}</p>
          {draft.shares.length === 0 ? (
            <p className="text-[12px] text-gray-600">No loanees recorded.</p>
          ) : (
            <ul className="space-y-0.5">
              {draft.shares.map((s) => (
                <li key={s.playerId} className="flex justify-between">
                  <span className="text-gray-700">{s.playerName}</span>
                  <span className="tabular-nums text-gray-900">{s.amount}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Line label={f.matchesDrawn} value={String(draft.matchesDrawn)} />
        <Line label={f.matchesLost} value={String(draft.matchesLost)} />
        <Line label={f.clubBonus} value={`${draft.clubBonus} ${klc.currency}`} />
        <Line label={f.paidToKfandra} value={`${totals.paidToKfandra} ${klc.currency}`} strong />
        <Line label={f.receivedFromKfandra} value={`${totals.receivedFromKfandra} ${klc.currency}`} strong />
        <Line label={f.distributedToLoanees} value={`${totals.distributedToLoanees} ${klc.currency}`} strong />
      </dl>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between px-4 py-2.5">
      <dt className="text-gray-700">{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-bold text-blue-900" : "text-gray-900"}`}>{value}</dd>
    </div>
  );
}
function BackLink() {
  return (
    <Link href="/admin/klc" className="text-[12px] text-gray-600 hover:underline">
      ← All clubs
    </Link>
  );
}
```

- [ ] **Step 4: Add the admin dashboard card**

In `src/app/admin/page.tsx`, add to the `cards` array (after the diet card):

```tsx
    { href: "/admin/klc", ...admin.klcCard },
```

- [ ] **Step 5: Verify + commit**

Run: `npm run build`
Expected: build succeeds.
```bash
git add src/lib/admin/klc-repository.ts src/app/admin/klc/page.tsx src/app/admin/klc/copy-button.tsx src/app/admin/page.tsx
git commit -m "feat(klc): admin review surface with copy-as-text"
```

---

## Task 14: Full verification + docs

**Files:**
- Modify: `docs/admin-guide.md`

- [ ] **Step 1: Run the whole suite, lint, and build**

Run:
```bash
npm run test && npm run lint && npm run build
```
Expected: all pass. Fix any failures before continuing.

- [ ] **Step 2: Add an admin-guide note**

Append to `docs/admin-guide.md`:

```markdown
## Club Balance Sheets (KLCFERRSXVSG1)

Each club has one running balance sheet, edited only by its Player Manager (and
KFANDRA). Managers open **Club Balance Sheet** from the home screen, tap their
crest, and record matches plus a loanee list (add member + number); the app
computes the Kroopies totals. Review every club under **Admin → Club Balance
Sheet**, and use **Copy sheet as text** to paste a club's figures to them. Rates
live in `app_config` under `klc_rates`. Link managers to their accounts with
`supabase/snippets/link-club-managers.sql`.
```

- [ ] **Step 3: Commit**

```bash
git add docs/admin-guide.md
git commit -m "docs(klc): admin-guide note for balance sheets"
```

---

## Self-review notes (already applied)

- **Spec coverage:** home block (T10), KLCFERRSXVSG1 flat 13-crest page with own-club-only lock (T11), club page with name/manager/heading (T12), items 1–10 with the exact 8/9/10 formulas (T6, T12), dynamic loanee list picked from members (T7/T12), manager-only edit guard (T1 RLS + T8 action + T11/T12 pages), Kroopies (T12), autosave (T12), admin view + copy (T13), rates externalised (T1), real clubs/managers/logos seeded (T2). ✔
- **Type consistency:** `ClubBalanceDraft`/`ClubPlayerShare`/`ClubSummary`/`MemberOption` defined in T4 and used unchanged through T6/T7/T8/T12/T13; `computeClubTotals(draft, rates)` identical everywhere; `saveClubBalanceAction(clubId, draft)` matches its caller in T12; `managerPlayerId` used consistently in T7/T8/T11/T12. ✔
- **No placeholders:** every code/SQL step is complete. The only intentionally data-dependent file is `link-club-managers.sql` (real runnable SQL awaiting manager account registration). ✔

## Data check result (prod players, 2026-08-10) & remaining gaps

The build is **not blocked**. `link-club-managers.sql` was reconciled against live prod:

- **11 of 13 managers link cleanly** (case-insensitive; prod stores `AhChin`).
- **Deep Waters (Seito / Lavleen Sharma): not registered** in prod. That row won't match until they create an account; the club stays staff-editable until the snippet is re-run. Optionally provide their phone to link immediately.
- **Shmoo's Bling Babies:** prod has no `Shmoo`; the snippet uses **`Bling Boy`** as Sudarshan's app nickname — **confirm this is correct** before running (else supply the right nickname/phone).

Everything else (clubs, logos, rates, UI) is fully specified with no open questions.
