# KLCSRA Phase 1 — Foundation (data model + domain logic) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the KLCSRA database schema (matches → halves → sides → appearances → stats, with RLS) plus the pure, fully-tested domain logic for per-player KR/MMG payouts, size-tiered + margin standings points, and combined two-half match points.

## Amendments for spec v0.4 (2026-08-23) — READ FIRST

The spec was updated from v0.3 to v0.4 after brainstorming. Before executing any
task below, apply these deltas — they touch the migration, the pure
stat-rates/payouts modules, and add one new `app_config` key:

### Task 1 (migration) — additions

Extend `20260815120000_klcsra_core.sql`:

1. **New table `klc_seasons`** with `season_no int unique not null`, `name text
   not null`, `start_date date not null`, `end_date date`, `status text not null
   default 'upcoming' check (status in ('upcoming','active','closed'))`,
   timestamps + `updated_at` trigger. Add a **partial unique index** to enforce
   at-most-one active season: `create unique index klc_seasons_one_active
   on public.klc_seasons ((true)) where status = 'active';`. RLS staff-only.
2. **`klc_matches`** gains two columns:
   - `season_id uuid references public.klc_seasons(id) on delete set null` —
     nullable (friendlies never carry a season).
   - `is_friendly boolean not null default false`.
   - Sport check constraint extended to include `'fooba'`:
     `check (sport in ('football','rugby','fooba','variation'))`.
3. **Extend the seeded `klcsra_stat_rates`** with Fooba's three keys:
   ```json
   "mainGoal":    {"kr": 20, "mmg": 500},
   "reboundGoal": {"kr": 10, "mmg": 300},
   "switchover":  {"kr": 5,  "mmg": 100}
   ```
4. **Seed a new `app_config` key `klcsra_sport_stats`** with the default
   allow-list per spec §Sport allow-list (four keys: football / rugby / fooba /
   variation).

### Task 2 (stat-rates.ts) — additions

- Extend `StatKey` union with `"mainGoal" | "reboundGoal" | "switchover"`.
- Extend `STAT_KEYS`, `STAT_LABELS`, `DEFAULT_STAT_RATES` accordingly (16 total).
- Update the "13 stats" test to `expect(STAT_KEYS).toHaveLength(16)` and add
  cases for the three new keys.
- **New sibling module `src/lib/klcsra/sport-stats.ts`** — pure parser for the
  new `app_config` key. Mirror the shape of `stat-rates.ts`: `Sport = "football"
  | "rugby" | "fooba" | "variation"`, `SportStats = Record<Sport, StatKey[]>`,
  `DEFAULT_SPORT_STATS`, `parseSportStats`. Add a `sport-stats.test.ts`.

### Task 4 (payouts.ts) — signature change

`computePlayerPayout(counts, rates, opts?)` where `opts?: { includeKR?: boolean
= true }`. When `includeKR = false` (friendlies), the returned `kr` is `0` but
`mmg` is computed as normal. Add a test:

```typescript
it("zeroes KR when includeKR is false (friendly matches)", () => {
  expect(computePlayerPayout({ goal: 1, assist: 1 }, DEFAULT_STAT_RATES, { includeKR: false }))
    .toEqual({ kr: 0, mmg: 700 });
});
```

### Task 7 (config.ts) — additions

Export a third loader `loadSportStats()` reading `klcsra_sport_stats` from
`app_config`, mirroring the existing loaders.

### Untouched by v0.4

Tasks 3 (standings-rules), 5 (standings compute) and 6 (combined) are unchanged.
Task 8 (verification) just needs to run against the amended migration + tests.

### Not in Phase 1 (deferred)

Season lifecycle server actions (`start`, `close`, `rename`), the recorder UI,
friendly-vs-league Submit gating, balance-sheet write-back with source tags,
and KFANDRA-only reopen — all live in Phase 2+ plans that will reference this
one.

---


**Architecture:** A new `src/lib/klcsra/` namespace kept separate from the existing balance-sheet `src/lib/klc/`. Domain modules are **pure** (no server/DB imports) so they unit-test with Vitest and are safe to import from Client Components, mirroring the existing `rates.ts` / `compute.ts` split; a `server-only` `config.ts` loads the editable rates from `app_config`. Rules (stat rates, standings tiers, combined bonuses) live in `app_config`, never hardcoded — matching the project convention.

**Tech Stack:** Next.js 14 (App Router) · TypeScript strict · Supabase Postgres + RLS · Vitest.

**Spec:** `docs/superpowers/specs/2026-08-10-klcsra-match-recorder-design.md`. This plan covers only Phase 1 (foundation). Phases 2–5 (repository/actions/submit-lock, recorder UI, outputs, balance-sheet link) are separate plans.

---

## File Structure

- `supabase/migrations/20260815120000_klcsra_core.sql` — **create** — the 5 KLCSRA tables + RLS + `updated_at` trigger + seed of the two `app_config` rule keys.
- `src/lib/klcsra/stat-rates.ts` — **create** — `StatKey`, `StatRate`, `StatRates`, `STAT_KEYS`, `STAT_LABELS`, `DEFAULT_STAT_RATES`, `parseStatRates`. Pure.
- `src/lib/klcsra/stat-rates.test.ts` — **create** — parse fallback tests.
- `src/lib/klcsra/standings-rules.ts` — **create** — `PointsTuple`, `StandingsRules`, `DEFAULT_STANDINGS_RULES`, `parseStandingsRules`. Pure.
- `src/lib/klcsra/standings-rules.test.ts` — **create** — parse fallback tests.
- `src/lib/klcsra/payouts.ts` — **create** — `PlayerStatCounts`, `Payout`, `computePlayerPayout`. Pure.
- `src/lib/klcsra/payouts.test.ts` — **create** — payout tests (uses the agreed rate table).
- `src/lib/klcsra/standings.ts` — **create** — `computeStandingPoints`. Pure.
- `src/lib/klcsra/standings.test.ts` — **create** — tier + margin tests.
- `src/lib/klcsra/combined.ts` — **create** — `HalfResult`, `computeCombinedPoints`. Pure.
- `src/lib/klcsra/combined.test.ts` — **create** — the KL/BOCI/SOG/DP worked example.
- `src/lib/klcsra/config.ts` — **create** — `server-only` loaders `loadStatRates`, `loadStandingsRules`.

Each pure module has **one** responsibility; `config.ts` is the only server-coupled file, matching `src/lib/klc/config.ts`.

---

## Task 1: Database migration — KLCSRA core tables + RLS + seed rules

**Files:**
- Create: `supabase/migrations/20260815120000_klcsra_core.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================================
-- 20260815120000 — KLCSRA (KLC Stats Recording App) core schema
-- ----------------------------------------------------------------------------
-- Admin-only match recorder. A match holds one or two halves (single vs
-- combined); each half has two sides (home/away) each tied to a club with a
-- role and a score; each side has up to N player appearances; each appearance
-- carries per-stat counts. Payout (KR/MMG) and standings rules live in
-- app_config and are computed in the app, never stored.
-- RLS: staff only (app.is_staff()) for all rows. Submit/lock is enforced in
-- server actions (Phase 2); RLS here is the staff gate + defence in depth.
-- ============================================================================

-- ─── klc_matches ────────────────────────────────────────────────────────────
create table public.klc_matches (
  id               uuid primary key default gen_random_uuid(),
  entry_date       date not null,
  sport            text not null default 'football',   -- football | rugby | variation
  duration_minutes int,
  is_combined      boolean not null default false,
  status           text not null default 'draft',      -- draft | submitted
  submitted_at     timestamptz,
  submitted_by     uuid references public.players(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint klc_matches_sport_chk  check (sport in ('football','rugby','variation')),
  constraint klc_matches_status_chk check (status in ('draft','submitted'))
);
comment on table public.klc_matches is
  'KLCSRA match header. One or two halves (is_combined). Locks when status=submitted.';
create index klc_matches_date_idx on public.klc_matches (entry_date);

create trigger klc_matches_set_updated_at
  before update on public.klc_matches
  for each row execute function app.set_updated_at();

-- ─── klc_match_halves ───────────────────────────────────────────────────────
create table public.klc_match_halves (
  id       uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.klc_matches(id) on delete cascade,
  half_no  int  not null,                                -- 1 (single/first) or 2
  unique (match_id, half_no),
  constraint klc_halves_no_chk check (half_no in (1, 2))
);
comment on table public.klc_match_halves is
  'A single match has one half (half_no=1); a combined match has half_no 1 and 2.';

-- ─── klc_match_sides ────────────────────────────────────────────────────────
create table public.klc_match_sides (
  id      uuid primary key default gen_random_uuid(),
  half_id uuid not null references public.klc_match_halves(id) on delete cascade,
  side    text not null,                                 -- home | away
  club_id uuid not null references public.clubs(id) on delete restrict,
  role    text not null default 'home',                  -- home | away | neutral
  score   int  not null default 0,
  unique (half_id, side),
  constraint klc_sides_side_chk check (side in ('home','away')),
  constraint klc_sides_role_chk check (role in ('home','away','neutral'))
);
comment on table public.klc_match_sides is
  'Two sides per half. The "home" sides across halves form one aggregate team, the "away" sides the other.';

-- ─── klc_appearances ────────────────────────────────────────────────────────
create table public.klc_appearances (
  id        uuid primary key default gen_random_uuid(),
  side_id   uuid not null references public.klc_match_sides(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  slot      int  not null,                               -- 1..6 (grows later)
  unique (side_id, player_id)
);
comment on table public.klc_appearances is
  'Players who turned out for a side in a half. slot is display order.';

-- ─── klc_player_stats ───────────────────────────────────────────────────────
create table public.klc_player_stats (
  id            uuid primary key default gen_random_uuid(),
  appearance_id uuid not null references public.klc_appearances(id) on delete cascade,
  stat_key      text not null,                           -- goal, try, assist, ...
  count         int  not null default 0,
  unique (appearance_id, stat_key)
);
comment on table public.klc_player_stats is
  'Per-appearance per-stat counts. stat_key values validated in the app against app_config klcsra_stat_rates.';

-- ─── RLS: staff only for all KLCSRA tables ──────────────────────────────────
alter table public.klc_matches       enable row level security;
alter table public.klc_match_halves  enable row level security;
alter table public.klc_match_sides   enable row level security;
alter table public.klc_appearances   enable row level security;
alter table public.klc_player_stats  enable row level security;

create policy klc_matches_rw_staff on public.klc_matches
  for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy klc_halves_rw_staff on public.klc_match_halves
  for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy klc_sides_rw_staff on public.klc_match_sides
  for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy klc_appearances_rw_staff on public.klc_appearances
  for all to authenticated using (app.is_staff()) with check (app.is_staff());
create policy klc_player_stats_rw_staff on public.klc_player_stats
  for all to authenticated using (app.is_staff()) with check (app.is_staff());

-- ─── Seed editable rules into app_config ────────────────────────────────────
insert into public.app_config (key, value, description) values (
  'klcsra_stat_rates',
  '{
    "goal":         {"kr": 20,  "mmg": 500},
    "try":          {"kr": 25,  "mmg": 500},
    "assist":       {"kr": 10,  "mmg": 200},
    "preAssist":    {"kr": 5,   "mmg": 100},
    "tackle":       {"kr": 5,   "mmg": 100},
    "save":         {"kr": 5,   "mmg": 200},
    "yellowCard":   {"kr": -10, "mmg": -200},
    "redCard":      {"kr": -20, "mmg": -500},
    "blueCard":     {"kr": -30, "mmg": -1000},
    "lateChallenge":{"kr": -5,  "mmg": -100},
    "ownGoal":      {"kr": -20, "mmg": -500},
    "ownAssist":    {"kr": -10, "mmg": -200},
    "ownPreAssist": {"kr": -5,  "mmg": -100}
  }'::jsonb,
  'KLCSRA per-stat payout: Kroopies (kr) + MMG points (mmg) per event. Admin-editable.'
) on conflict (key) do nothing;

insert into public.app_config (key, value, description) values (
  'klcsra_standings_rules',
  '{
    "playerThreshold": 6,
    "atOrAbove": {"win": 3,   "draw": 1,    "loss": 0},
    "below":     {"win": 0.2, "draw": 0.05, "loss": 0},
    "margin":    {"threshold": 20, "winnerBonus": 1, "loserPenalty": -1},
    "combined":  {"halfWin": 0.2, "aggregateBonus": 0.1}
  }'::jsonb,
  'KLCSRA standings: size-tiered W/D/L by total players in the match, ≥20-margin bonus, and combined two-half match points.'
) on conflict (key) do nothing;
```

- [ ] **Step 2: Apply the migration to local Supabase**

Run: `npx supabase db reset`
Expected: reset completes and applies all migrations including `20260815120000_klcsra_core.sql` with no errors.

- [ ] **Step 3: Verify the tables and seed exist**

Run:
```bash
npx supabase db execute --query "select count(*) as tables from information_schema.tables where table_name in ('klc_matches','klc_match_halves','klc_match_sides','klc_appearances','klc_player_stats');"
npx supabase db execute --query "select key from public.app_config where key in ('klcsra_stat_rates','klcsra_standings_rules') order by key;"
```
Expected: first query returns `tables = 5`; second returns the two rows `klcsra_stat_rates` and `klcsra_standings_rules`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260815120000_klcsra_core.sql
git commit -m "feat(klcsra): core schema (matches/halves/sides/appearances/stats) + RLS + seed rules"
```

---

## Task 2: Stat rates config (pure)

**Files:**
- Create: `src/lib/klcsra/stat-rates.ts`
- Test: `src/lib/klcsra/stat-rates.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import {
  DEFAULT_STAT_RATES,
  STAT_KEYS,
  parseStatRates,
} from "./stat-rates";

describe("DEFAULT_STAT_RATES", () => {
  it("has all 13 stats with the agreed KR/MMG values", () => {
    expect(STAT_KEYS).toHaveLength(13);
    expect(DEFAULT_STAT_RATES.goal).toEqual({ kr: 20, mmg: 500 });
    expect(DEFAULT_STAT_RATES.try).toEqual({ kr: 25, mmg: 500 });
    expect(DEFAULT_STAT_RATES.save).toEqual({ kr: 5, mmg: 200 });
    expect(DEFAULT_STAT_RATES.blueCard).toEqual({ kr: -30, mmg: -1000 });
    expect(DEFAULT_STAT_RATES.ownPreAssist).toEqual({ kr: -5, mmg: -100 });
  });
});

describe("parseStatRates", () => {
  it("returns defaults for null/garbage input", () => {
    expect(parseStatRates(null)).toEqual(DEFAULT_STAT_RATES);
    expect(parseStatRates("nope")).toEqual(DEFAULT_STAT_RATES);
  });

  it("overrides only the provided stats, keeping defaults for the rest", () => {
    const r = parseStatRates({ goal: { kr: 99, mmg: 1000 } });
    expect(r.goal).toEqual({ kr: 99, mmg: 1000 });
    expect(r.assist).toEqual({ kr: 10, mmg: 200 }); // untouched default
  });

  it("ignores non-numeric fields and falls back per field", () => {
    const r = parseStatRates({ goal: { kr: "x", mmg: 700 } });
    expect(r.goal).toEqual({ kr: 20, mmg: 700 }); // kr falls back, mmg kept
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/klcsra/stat-rates.test.ts`
Expected: FAIL — cannot resolve `./stat-rates`.

- [ ] **Step 3: Write minimal implementation**

```typescript
/**
 * Pure KLCSRA per-stat payout rates (no DB/server imports — safe for Client
 * Components and unit tests). DB loader lives in config.ts. Mirrors the
 * balance-sheet rates.ts pattern.
 */

export type StatKey =
  | "goal" | "try" | "assist" | "preAssist" | "tackle" | "save"
  | "yellowCard" | "redCard" | "blueCard" | "lateChallenge"
  | "ownGoal" | "ownAssist" | "ownPreAssist";

export interface StatRate {
  kr: number;
  mmg: number;
}

export type StatRates = Record<StatKey, StatRate>;

/** Canonical stat order (also the display order). */
export const STAT_KEYS: StatKey[] = [
  "goal", "try", "assist", "preAssist", "tackle", "save",
  "yellowCard", "redCard", "blueCard", "lateChallenge",
  "ownGoal", "ownAssist", "ownPreAssist",
];

/** Short human labels for UI. */
export const STAT_LABELS: Record<StatKey, string> = {
  goal: "Goal", try: "Try", assist: "Assist", preAssist: "Pre-Assist",
  tackle: "Tackle", save: "Save", yellowCard: "Yellow Card",
  redCard: "Red Card", blueCard: "Blue Card", lateChallenge: "Late Challenge",
  ownGoal: "Own Goal", ownAssist: "Own Assist", ownPreAssist: "Own Pre-Assist",
};

export const DEFAULT_STAT_RATES: StatRates = {
  goal: { kr: 20, mmg: 500 },
  try: { kr: 25, mmg: 500 },
  assist: { kr: 10, mmg: 200 },
  preAssist: { kr: 5, mmg: 100 },
  tackle: { kr: 5, mmg: 100 },
  save: { kr: 5, mmg: 200 },
  yellowCard: { kr: -10, mmg: -200 },
  redCard: { kr: -20, mmg: -500 },
  blueCard: { kr: -30, mmg: -1000 },
  lateChallenge: { kr: -5, mmg: -100 },
  ownGoal: { kr: -20, mmg: -500 },
  ownAssist: { kr: -10, mmg: -200 },
  ownPreAssist: { kr: -5, mmg: -100 },
};

/** Coerce a raw app_config JSON value into StatRates with per-field fallbacks. */
export function parseStatRates(value: unknown): StatRates {
  const v = (value ?? {}) as Record<string, unknown>;
  const num = (x: unknown, fallback: number) =>
    typeof x === "number" && Number.isFinite(x) ? x : fallback;
  const out = {} as StatRates;
  for (const key of STAT_KEYS) {
    const raw = (v[key] ?? {}) as Record<string, unknown>;
    const def = DEFAULT_STAT_RATES[key];
    out[key] = { kr: num(raw.kr, def.kr), mmg: num(raw.mmg, def.mmg) };
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/klcsra/stat-rates.test.ts`
Expected: PASS (3 tests in `parseStatRates`, 1 in `DEFAULT_STAT_RATES`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/klcsra/stat-rates.ts src/lib/klcsra/stat-rates.test.ts
git commit -m "feat(klcsra): pure stat-rates config (13 stats, KR/MMG, app_config parse)"
```

---

## Task 3: Standings rules config (pure)

**Files:**
- Create: `src/lib/klcsra/standings-rules.ts`
- Test: `src/lib/klcsra/standings-rules.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { DEFAULT_STANDINGS_RULES, parseStandingsRules } from "./standings-rules";

describe("DEFAULT_STANDINGS_RULES", () => {
  it("matches the agreed defaults", () => {
    expect(DEFAULT_STANDINGS_RULES).toEqual({
      playerThreshold: 6,
      atOrAbove: { win: 3, draw: 1, loss: 0 },
      below: { win: 0.2, draw: 0.05, loss: 0 },
      margin: { threshold: 20, winnerBonus: 1, loserPenalty: -1 },
      combined: { halfWin: 0.2, aggregateBonus: 0.1 },
    });
  });
});

describe("parseStandingsRules", () => {
  it("returns defaults for null input", () => {
    expect(parseStandingsRules(null)).toEqual(DEFAULT_STANDINGS_RULES);
  });

  it("overrides the threshold but keeps the rest", () => {
    const r = parseStandingsRules({ playerThreshold: 8 });
    expect(r.playerThreshold).toBe(8);
    expect(r.atOrAbove).toEqual({ win: 3, draw: 1, loss: 0 });
    expect(r.combined).toEqual({ halfWin: 0.2, aggregateBonus: 0.1 });
  });

  it("overrides a nested tuple field per-field", () => {
    const r = parseStandingsRules({ below: { win: 0.5 } });
    expect(r.below).toEqual({ win: 0.5, draw: 0.05, loss: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/klcsra/standings-rules.test.ts`
Expected: FAIL — cannot resolve `./standings-rules`.

- [ ] **Step 3: Write minimal implementation**

```typescript
/** Pure KLCSRA standings rules (no DB/server imports). DB loader in config.ts. */

export interface PointsTuple {
  win: number;
  draw: number;
  loss: number;
}

export interface StandingsRules {
  /** Matches with total players >= this use `atOrAbove`; below it use `below`. */
  playerThreshold: number;
  atOrAbove: PointsTuple;
  below: PointsTuple;
  margin: { threshold: number; winnerBonus: number; loserPenalty: number };
  combined: { halfWin: number; aggregateBonus: number };
}

export const DEFAULT_STANDINGS_RULES: StandingsRules = {
  playerThreshold: 6,
  atOrAbove: { win: 3, draw: 1, loss: 0 },
  below: { win: 0.2, draw: 0.05, loss: 0 },
  margin: { threshold: 20, winnerBonus: 1, loserPenalty: -1 },
  combined: { halfWin: 0.2, aggregateBonus: 0.1 },
};

function num(x: unknown, fallback: number): number {
  return typeof x === "number" && Number.isFinite(x) ? x : fallback;
}

function parseTuple(raw: unknown, def: PointsTuple): PointsTuple {
  const v = (raw ?? {}) as Record<string, unknown>;
  return { win: num(v.win, def.win), draw: num(v.draw, def.draw), loss: num(v.loss, def.loss) };
}

/** Coerce a raw app_config JSON value into StandingsRules with fallbacks. */
export function parseStandingsRules(value: unknown): StandingsRules {
  const v = (value ?? {}) as Record<string, unknown>;
  const d = DEFAULT_STANDINGS_RULES;
  const margin = (v.margin ?? {}) as Record<string, unknown>;
  const combined = (v.combined ?? {}) as Record<string, unknown>;
  return {
    playerThreshold: num(v.playerThreshold, d.playerThreshold),
    atOrAbove: parseTuple(v.atOrAbove, d.atOrAbove),
    below: parseTuple(v.below, d.below),
    margin: {
      threshold: num(margin.threshold, d.margin.threshold),
      winnerBonus: num(margin.winnerBonus, d.margin.winnerBonus),
      loserPenalty: num(margin.loserPenalty, d.margin.loserPenalty),
    },
    combined: {
      halfWin: num(combined.halfWin, d.combined.halfWin),
      aggregateBonus: num(combined.aggregateBonus, d.combined.aggregateBonus),
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/klcsra/standings-rules.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/klcsra/standings-rules.ts src/lib/klcsra/standings-rules.test.ts
git commit -m "feat(klcsra): pure standings-rules config (tiers, margin, combined)"
```

---

## Task 4: Player payout compute (pure)

**Files:**
- Create: `src/lib/klcsra/payouts.ts`
- Test: `src/lib/klcsra/payouts.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { computePlayerPayout } from "./payouts";
import { DEFAULT_STAT_RATES } from "./stat-rates";

describe("computePlayerPayout", () => {
  it("is zero for no stats", () => {
    expect(computePlayerPayout({}, DEFAULT_STAT_RATES)).toEqual({ kr: 0, mmg: 0 });
  });

  it("sums a goal + assist (the J. Karanth example)", () => {
    expect(computePlayerPayout({ goal: 1, assist: 1 }, DEFAULT_STAT_RATES))
      .toEqual({ kr: 30, mmg: 700 }); // 20+10 KR, 500+200 MMG
  });

  it("multiplies by the count (hat-trick)", () => {
    expect(computePlayerPayout({ goal: 3 }, DEFAULT_STAT_RATES))
      .toEqual({ kr: 60, mmg: 1500 });
  });

  it("applies negative stats (a yellow card deducts)", () => {
    expect(computePlayerPayout({ yellowCard: 1 }, DEFAULT_STAT_RATES))
      .toEqual({ kr: -10, mmg: -200 });
  });

  it("ignores unknown keys and zero counts", () => {
    expect(computePlayerPayout({ goal: 0, bogus: 5 } as never, DEFAULT_STAT_RATES))
      .toEqual({ kr: 0, mmg: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/klcsra/payouts.test.ts`
Expected: FAIL — cannot resolve `./payouts`.

- [ ] **Step 3: Write minimal implementation**

```typescript
import { STAT_KEYS, type StatKey, type StatRates } from "./stat-rates";

/** Per-stat event counts for one player (missing keys treated as 0). */
export type PlayerStatCounts = Partial<Record<StatKey, number>>;

/** A player's earned Kroopies (kr) and MMG points (mmg). */
export interface Payout {
  kr: number;
  mmg: number;
}

/** Pure. Sum count × rate across all known stats. Unknown keys ignored. */
export function computePlayerPayout(
  counts: PlayerStatCounts,
  rates: StatRates,
): Payout {
  let kr = 0;
  let mmg = 0;
  for (const key of STAT_KEYS) {
    const n = counts[key];
    if (!n) continue;
    kr += n * rates[key].kr;
    mmg += n * rates[key].mmg;
  }
  return { kr, mmg };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/klcsra/payouts.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/klcsra/payouts.ts src/lib/klcsra/payouts.test.ts
git commit -m "feat(klcsra): pure per-player KR/MMG payout compute"
```

---

## Task 5: Standings points compute (pure)

**Files:**
- Create: `src/lib/klcsra/standings.ts`
- Test: `src/lib/klcsra/standings.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { computeStandingPoints } from "./standings";
import { DEFAULT_STANDINGS_RULES as R } from "./standings-rules";

describe("computeStandingPoints", () => {
  it("6+ players, home win 2-1 → 3 / 0", () => {
    expect(computeStandingPoints(2, 1, 6, R)).toEqual({ home: 3, away: 0 });
  });

  it("6+ players, draw → 1 / 1", () => {
    expect(computeStandingPoints(1, 1, 6, R)).toEqual({ home: 1, away: 1 });
  });

  it("fewer than 6 players, home win → 0.2 / 0", () => {
    expect(computeStandingPoints(2, 1, 5, R)).toEqual({ home: 0.2, away: 0 });
  });

  it("fewer than 6 players, draw → 0.05 each", () => {
    expect(computeStandingPoints(0, 0, 4, R)).toEqual({ home: 0.05, away: 0.05 });
  });

  it("margin ≥20 in the big tier → +1 winner, -1 loser", () => {
    expect(computeStandingPoints(25, 3, 6, R)).toEqual({ home: 4, away: -1 });
  });

  it("margin ≥20 in the small tier stacks on the fraction", () => {
    expect(computeStandingPoints(25, 3, 4, R)).toEqual({ home: 1.2, away: -1 });
  });

  it("a 19-point win does not trigger the margin bonus", () => {
    expect(computeStandingPoints(20, 1, 6, R)).toEqual({ home: 3, away: 0 });
  });

  it("away win is symmetric", () => {
    expect(computeStandingPoints(1, 2, 6, R)).toEqual({ home: 0, away: 3 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/klcsra/standings.test.ts`
Expected: FAIL — cannot resolve `./standings`.

- [ ] **Step 3: Write minimal implementation**

```typescript
import type { PointsTuple, StandingsRules } from "./standings-rules";

const round = (n: number) => Math.round(n * 1e4) / 1e4;

/**
 * Pure. League points for both sides of ONE match result.
 * Base points come from the size tier (total players in the match); the ≥margin
 * bonus/penalty is then added to the winner/loser. A draw earns no margin.
 */
export function computeStandingPoints(
  homeScore: number,
  awayScore: number,
  totalPlayers: number,
  rules: StandingsRules,
): { home: number; away: number } {
  const tier: PointsTuple =
    totalPlayers >= rules.playerThreshold ? rules.atOrAbove : rules.below;

  let home: number;
  let away: number;
  if (homeScore > awayScore) {
    home = tier.win;
    away = tier.loss;
  } else if (homeScore < awayScore) {
    home = tier.loss;
    away = tier.win;
  } else {
    home = tier.draw;
    away = tier.draw;
  }

  const margin = Math.abs(homeScore - awayScore);
  if (homeScore !== awayScore && margin >= rules.margin.threshold) {
    if (homeScore > awayScore) {
      home += rules.margin.winnerBonus;
      away += rules.margin.loserPenalty;
    } else {
      away += rules.margin.winnerBonus;
      home += rules.margin.loserPenalty;
    }
  }

  return { home: round(home), away: round(away) };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/klcsra/standings.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/klcsra/standings.ts src/lib/klcsra/standings.test.ts
git commit -m "feat(klcsra): pure standings-points compute (size tiers + margin bonus)"
```

---

## Task 6: Combined two-half match points (pure)

**Files:**
- Create: `src/lib/klcsra/combined.ts`
- Test: `src/lib/klcsra/combined.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { computeCombinedPoints, type HalfResult } from "./combined";
import { DEFAULT_STANDINGS_RULES as R } from "./standings-rules";

describe("computeCombinedPoints", () => {
  it("matches the KFANDRA worked example (KL 0.3, BOCI 0.1, SOG 0.2, DP 0)", () => {
    // Home group across halves = KL + BOCI; away group = DP + SOG.
    // H1: KL(home) 3 - 1 DP(away)  → KL wins half.
    // H2: BOCI(home) 1 - 2 SOG(away) → SOG wins half.
    // Aggregate: home 3+1=4 vs away 1+2=3 → home group (KL+BOCI) win aggregate.
    const halves: HalfResult[] = [
      { homeClubId: "KL", awayClubId: "DP", homeScore: 3, awayScore: 1 },
      { homeClubId: "BOCI", awayClubId: "SOG", homeScore: 1, awayScore: 2 },
    ];
    expect(computeCombinedPoints(halves, R)).toEqual({
      KL: 0.3, BOCI: 0.1, SOG: 0.2, DP: 0,
    });
  });

  it("awards nothing extra on a drawn aggregate", () => {
    // H1: KL 1-0 DP (KL half win). H2: SOG 1-0 BOCI (SOG half win).
    // Aggregate home 1+0=1 vs away 0+1=1 → draw, no bonus.
    const halves: HalfResult[] = [
      { homeClubId: "KL", awayClubId: "DP", homeScore: 1, awayScore: 0 },
      { homeClubId: "BOCI", awayClubId: "SOG", homeScore: 0, awayScore: 1 },
    ];
    expect(computeCombinedPoints(halves, R)).toEqual({
      KL: 0.2, SOG: 0.2, BOCI: 0, DP: 0,
    });
  });

  it("a drawn half awards no half-win points", () => {
    const halves: HalfResult[] = [
      { homeClubId: "KL", awayClubId: "DP", homeScore: 2, awayScore: 2 },
      { homeClubId: "BOCI", awayClubId: "SOG", homeScore: 3, awayScore: 0 },
    ];
    // H1 draw → no half points. H2 BOCI win → BOCI 0.2.
    // Aggregate home 2+3=5 vs away 2+0=2 → home group win → KL+BOCI +0.1.
    expect(computeCombinedPoints(halves, R)).toEqual({
      BOCI: 0.3, KL: 0.1, DP: 0, SOG: 0,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/klcsra/combined.test.ts`
Expected: FAIL — cannot resolve `./combined`.

- [ ] **Step 3: Write minimal implementation**

```typescript
import type { StandingsRules } from "./standings-rules";

/** One half of a combined match: a normal 1-v-1 with its own clubs & scores. */
export interface HalfResult {
  homeClubId: string;
  awayClubId: string;
  homeScore: number;
  awayScore: number;
}

const round = (n: number) => Math.round(n * 1e4) / 1e4;

/**
 * Pure. League points per club for a combined (two-half) match.
 *  - Each half: the winning club gets `combined.halfWin` (draw → nothing).
 *  - Aggregate: sum of home scores vs sum of away scores across halves; the
 *    winning side's clubs (all "home" clubs, or all "away" clubs) each get
 *    `combined.aggregateBonus` (draw → nothing).
 * Returns a map of clubId → total points (every club that appears is present).
 */
export function computeCombinedPoints(
  halves: HalfResult[],
  rules: StandingsRules,
): Record<string, number> {
  const points: Record<string, number> = {};
  const add = (clubId: string, n: number) => {
    points[clubId] = (points[clubId] ?? 0) + n;
  };

  let homeAgg = 0;
  let awayAgg = 0;
  const homeClubs: string[] = [];
  const awayClubs: string[] = [];

  for (const h of halves) {
    add(h.homeClubId, 0); // ensure every club is present in the result
    add(h.awayClubId, 0);
    homeClubs.push(h.homeClubId);
    awayClubs.push(h.awayClubId);
    homeAgg += h.homeScore;
    awayAgg += h.awayScore;

    if (h.homeScore > h.awayScore) add(h.homeClubId, rules.combined.halfWin);
    else if (h.awayScore > h.homeScore) add(h.awayClubId, rules.combined.halfWin);
  }

  if (homeAgg > awayAgg) for (const c of homeClubs) add(c, rules.combined.aggregateBonus);
  else if (awayAgg > homeAgg) for (const c of awayClubs) add(c, rules.combined.aggregateBonus);

  for (const k of Object.keys(points)) points[k] = round(points[k]);
  return points;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/klcsra/combined.test.ts`
Expected: PASS (3 tests). Note the `round` call turns `0.2 + 0.1` into a clean `0.3`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/klcsra/combined.ts src/lib/klcsra/combined.test.ts
git commit -m "feat(klcsra): pure combined two-half match points compute"
```

---

## Task 7: Config loaders (server-only)

**Files:**
- Create: `src/lib/klcsra/config.ts`

*(No unit test: this is a thin `server-only` DB reader mirroring `src/lib/klc/config.ts`, which likewise has no unit test. It is exercised by the Phase 2 repository tests.)*

- [ ] **Step 1: Write the implementation**

```typescript
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseStatRates, type StatRates } from "./stat-rates";
import { parseStandingsRules, type StandingsRules } from "./standings-rules";

export type { StatRates } from "./stat-rates";
export type { StandingsRules } from "./standings-rules";
export { DEFAULT_STAT_RATES } from "./stat-rates";
export { DEFAULT_STANDINGS_RULES } from "./standings-rules";

/** Load per-stat KR/MMG rates from app_config (key 'klcsra_stat_rates'). */
export async function loadStatRates(): Promise<StatRates> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_config")
    .select("value")
    .eq("key", "klcsra_stat_rates")
    .maybeSingle();
  return parseStatRates(data?.value ?? null);
}

/** Load standings rules from app_config (key 'klcsra_standings_rules'). */
export async function loadStandingsRules(): Promise<StandingsRules> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_config")
    .select("value")
    .eq("key", "klcsra_standings_rules")
    .maybeSingle();
  return parseStandingsRules(data?.value ?? null);
}
```

- [ ] **Step 2: Verify it type-checks and the suite is green**

Run: `npm run test -- src/lib/klcsra` then `npx tsc --noEmit`
Expected: all KLCSRA tests PASS; `tsc` reports no errors. (Confirm `@/lib/supabase/admin` exports `createAdminClient` — it is the same import used by `src/lib/klc/config.ts`.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/klcsra/config.ts
git commit -m "feat(klcsra): server-only config loaders for stat rates + standings rules"
```

---

## Task 8: Full Phase 1 verification

- [ ] **Step 1: Run the whole KLCSRA suite**

Run: `npm run test -- src/lib/klcsra`
Expected: all Task 2–6 tests PASS (stat-rates, standings-rules, payouts, standings, combined).

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no type errors; lint clean for the new files.

- [ ] **Step 3: Confirm the migration still applies from clean**

Run: `npx supabase db reset`
Expected: clean apply through `20260815120000_klcsra_core.sql`.

- [ ] **Step 4: Update the bead**

Run:
```bash
bd update Helper-bsr --notes="Phase 1 done: schema (klc_matches/halves/sides/appearances/player_stats) + RLS + seeded app_config rules; pure domain (stat-rates, standings-rules, payouts, standings tiers+margin, combined two-half) with tests; server config loaders. Next: Phase 2 (repository + actions + submit/lock)."
```

---

## Self-Review

**1. Spec coverage (Phase 1 scope only):**
- Data model for matches/halves/sides/appearances/stats → Task 1. ✓
- Per-stat KR+MMG payout table + parse → Tasks 2, 4. ✓
- Size-tiered standings (≥6 → 3/1/0, <6 → 0.2/0.05/0) + ≥20 margin ±1 → Tasks 3, 5. ✓
- Combined two-half scoring (0.2 half-win + 0.1 aggregate) with the worked example → Task 6. ✓
- Rules externalised in `app_config` + server loaders → Tasks 1, 7. ✓
- Out of Phase 1 scope (later phases): recorder UI, stats popup, Submit/lock enforcement, report text, season aggregation across many matches, balance-sheet KR auto-fill. Noted in header.

**2. Placeholder scan:** No TBD/TODO; every code step shows complete code; every test step shows real assertions with the agreed numbers. ✓

**3. Type consistency:** `StatKey`/`StatRates` (Task 2) are consumed unchanged by `payouts.ts` (Task 4) and `config.ts` (Task 7). `PointsTuple`/`StandingsRules` (Task 3) are consumed by `standings.ts` (Task 5), `combined.ts` (Task 6) and `config.ts` (Task 7). `computeStandingPoints(homeScore, awayScore, totalPlayers, rules)` and `computeCombinedPoints(halves, rules)` signatures match their tests. `HalfResult` fields (`homeClubId/awayClubId/homeScore/awayScore`) are identical in `combined.ts` and its test. ✓
