# KLC Player Register and Values Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** KFANDRA sets each manager's base value and official KLC name per season on an Admin › KLC › Register screen; every player's value then moves with each counted match and KFANDRA's dated changes, and everyone sees the values on a new KLC League › Values tab with a per-player history page.

**Architecture:** Values are never stored. They are worked out on every read by a pure module (`player-values.ts`) from four inputs: the register (base values), the counted matches (submitted league matches plus submitted official friendlies in the season window), KFANDRA's non-voided value changes, and the `klc_value_rules` config. Writes go through KFANDRA-only server actions (`value-actions.ts`) using the service role, each logged to `audit_log`. This follows the league table, which is also derived on read.

**Tech Stack:** Next.js App Router (server components + server actions), Supabase (Postgres, RLS, service-role admin client), Vitest, Playwright (local Supabase only).

**Spec:** `docs/superpowers/specs/2026-11-22-klc-player-register-values-design.md` (§2, §4–§8). The friendly mark (§3) shipped in PR #16.

**Bead:** Helper-bsr.18. Branch: `feat/klc-player-register` (from `main`). One squashed commit at the end: `feat(klc): player register and player values (Helper-bsr.18)`.

**Confidentiality:** the repo is public. Before the PR, run the confidentiality check from the bd memories (`bd memories confidential`) over `git diff main`.

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `supabase/migrations/20261125120000_klc_player_values.sql` | Create | `players.klc_name`, `klc_player_base_values`, `klc_player_value_changes`, RLS, `klc_value_rules` seed |
| `src/lib/supabase/database.types.ts` | Regenerate | Types for the new tables/column |
| `src/lib/klcsra/value-rules.ts` (+ test) | Create | `ValueRules`, `DEFAULT_VALUE_RULES`, `parseValueRules` (pure) |
| `src/lib/klcsra/config.ts` | Modify | `loadValueRules()` |
| `src/lib/klcsra/config-contract.test.ts` | Modify | Seed of `klc_value_rules` deep-equals the default |
| `src/lib/klcsra/league-table.ts` (+ test) | Modify | `sideOutcome(match, side)` |
| `src/lib/klcsra/player-values.ts` (+ test) | Create | Pure value calculation, ranking, KR formatting |
| `src/lib/klcsra/register.ts` (+ test) | Create | Pure `buildRegister` (managers of active clubs, flags) |
| `src/lib/klcsra/value-input.ts` (+ test) | Create | Pure input parsing for amounts, names, notes |
| `src/lib/klcsra/league-repository.ts` (+ test) | Modify | `listCountedMatches(season)` |
| `src/lib/klcsra/value-repository.ts` | Create | Server-only reads/writes for register, base values, changes; `loadSeasonValues` |
| `src/lib/klcsra/value-actions.ts` (+ test) | Create | KFANDRA-only server actions with audit |
| `src/lib/klcsra/types.ts`, `repository.ts`, `league-data.ts` (+ test) | Modify | `klcName` on appearances; boards prefer it |
| `src/lib/klcsra/league-params.ts` | Modify | `values` tab |
| `src/content/strings.ts` | Modify | Values tab, history, register strings |
| `src/app/klc/league/league-nav.tsx`, `page.tsx` | Modify | 6 tabs; render the Values tab |
| `src/app/klc/league/values-tab.tsx` | Create | Ranked values list |
| `src/app/klc/league/values/[playerId]/page.tsx` | Create | Player value history |
| `src/app/admin/klc/register/page.tsx`, `register-admin.tsx` | Create | Register screen |
| `src/app/admin/page.tsx` | Modify | Register card |
| `e2e/klc-player-values.spec.ts` | Create | End-to-end checks |
| `docs/klc-league-guide.md` (+ PDF), `docs/admin-guide.md` (+ PDF) | Modify | Guides |

---

### Task 1: Migration and types

**Files:**
- Create: `supabase/migrations/20261125120000_klc_player_values.sql`
- Regenerate: `src/lib/supabase/database.types.ts`

- [ ] **Step 1: Write the migration**

```sql
-- KLC player register and player values (Helper-bsr.18).
-- Spec: docs/superpowers/specs/2026-11-22-klc-player-register-values-design.md §2, §4.
--
-- Values are NOT stored: they are worked out on read from the base value,
-- the counted matches and KFANDRA's dated changes. These tables hold only the
-- inputs KFANDRA types in. Writes go through KFANDRA-only server actions with
-- the service role, so there are no insert/update/delete policies.

alter table public.players add column klc_name text;
comment on column public.players.klc_name is
  'Official KLC name, set by KFANDRA on the register. Boards show it when set.';

create table public.klc_player_base_values (
  season_id  uuid not null references public.klc_seasons(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  base_value numeric(10,2) not null check (base_value >= 0),
  updated_by uuid references public.players(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (season_id, player_id)
);
comment on table public.klc_player_base_values is
  'Each player''s starting value (Kroopies) for a season. Set by KFANDRA; edits are logged in audit_log.';

create table public.klc_player_value_changes (
  id             uuid primary key default gen_random_uuid(),
  season_id      uuid not null references public.klc_seasons(id) on delete cascade,
  player_id      uuid not null references public.players(id) on delete cascade,
  effective_date date not null,
  amount         numeric(10,2) not null check (amount <> 0),
  note           text not null check (length(trim(note)) > 0),
  created_by     uuid references public.players(id) on delete set null,
  created_at     timestamptz not null default now(),
  voided_at      timestamptz,
  voided_by      uuid references public.players(id) on delete set null,
  void_note      text,
  check ((voided_at is null) = (void_note is null))
);
comment on table public.klc_player_value_changes is
  'KFANDRA''s dated plus/minus value changes. Append-only: a mistake is voided with a note, never deleted.';
create index klc_player_value_changes_season_idx
  on public.klc_player_value_changes (season_id, player_id, effective_date);

alter table public.klc_player_base_values   enable row level security;
alter table public.klc_player_value_changes enable row level security;

-- Values are public to every signed-in player.
create policy klc_player_base_values_read on public.klc_player_base_values
  for select to authenticated using (true);
create policy klc_player_value_changes_read on public.klc_player_value_changes
  for select to authenticated using (true);

insert into public.app_config (key, value, description) values (
  'klc_value_rules',
  '{
    "version": 1,
    "result": {"win": 20, "draw": 5, "loss": -10},
    "stats": {
      "goal": 2, "mainGoal": 2, "reboundGoal": 2, "try": 2, "conversion": 2,
      "assist": 1, "preAssist": 0.5, "save": 2,
      "yellowCard": -10, "redCard": -20, "blueCard": -50
    },
    "floor": 0,
    "smallSided": {"enabled": true, "belowPlayers": 7, "freeMatches": 5}
  }'::jsonb,
  'KLC player value changes per counted match (league + official friendlies). A stat missing from "stats" is worth 0. smallSided: a player''s first freeMatches matches with fewer than belowPlayers players in total change nothing.'
)
on conflict (key) do update
  set value = excluded.value, description = excluded.description, updated_at = now();
```

- [ ] **Step 2: Apply locally and regenerate types**

Run:
```bash
npx supabase migration up
npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
grep -n "klc_player_value_changes\|klc_name" src/lib/supabase/database.types.ts | head
```
Expected: the migration applies; the grep shows both new tables and `klc_name`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

---

### Task 2: Value rules (config)

**Files:**
- Create: `src/lib/klcsra/value-rules.ts`, `src/lib/klcsra/value-rules.test.ts`
- Modify: `src/lib/klcsra/config.ts`, `src/lib/klcsra/config-contract.test.ts`

- [ ] **Step 1: Write the failing tests** (`value-rules.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { DEFAULT_VALUE_RULES, parseValueRules } from "./value-rules";

describe("parseValueRules", () => {
  it("returns a fresh copy of the defaults for null or garbage", () => {
    expect(parseValueRules(null)).toEqual(DEFAULT_VALUE_RULES);
    expect(parseValueRules("x")).toEqual(DEFAULT_VALUE_RULES);
    const a = parseValueRules(null);
    a.result.win = 99;
    expect(DEFAULT_VALUE_RULES.result.win).toBe(20);
  });

  it("keeps valid fields and falls back field by field", () => {
    const r = parseValueRules({
      version: 1,
      result: { win: 30, draw: "x" },
      floor: 10,
      smallSided: { enabled: false },
    });
    expect(r.result).toEqual({ win: 30, draw: 5, loss: -10 });
    expect(r.floor).toBe(10);
    expect(r.smallSided).toEqual({ enabled: false, belowPlayers: 7, freeMatches: 5 });
    expect(r.stats).toEqual(DEFAULT_VALUE_RULES.stats);
  });

  it("uses only the numeric stats given; a missing stat is worth 0", () => {
    const r = parseValueRules({ version: 1, stats: { goal: 3, tackle: 1, bogus: 9, assist: "x" } });
    expect(r.stats).toEqual({ goal: 3, tackle: 1 });
  });

  it("rejects negative or fractional small-sided counts", () => {
    const r = parseValueRules({ version: 1, smallSided: { enabled: true, belowPlayers: -1, freeMatches: 2.5 } });
    expect(r.smallSided).toEqual({ enabled: true, belowPlayers: 7, freeMatches: 5 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/klcsra/value-rules.test.ts`
Expected: FAIL, cannot find module `./value-rules`.

- [ ] **Step 3: Implement** (`value-rules.ts`)

```ts
/**
 * Pure KLC player value rules (spec 2026-11-22 §2). No DB/server imports.
 * DB loader: config.ts `loadValueRules`. Seed: migration 20261125120000.
 */
import { STAT_KEYS, type StatKey } from "./stat-rates";

export type ResultKey = "win" | "draw" | "loss";

export interface ValueRules {
  version: 1;
  result: Record<ResultKey, number>;
  /** Value change per stat. A stat missing here is worth 0. */
  stats: Partial<Record<StatKey, number>>;
  /** A value never drops below this, applied after each session day. */
  floor: number;
  smallSided: { enabled: boolean; belowPlayers: number; freeMatches: number };
}

export const DEFAULT_VALUE_RULES: ValueRules = {
  version: 1,
  result: { win: 20, draw: 5, loss: -10 },
  stats: {
    goal: 2, mainGoal: 2, reboundGoal: 2, try: 2, conversion: 2,
    assist: 1, preAssist: 0.5, save: 2,
    yellowCard: -10, redCard: -20, blueCard: -50,
  },
  floor: 0,
  smallSided: { enabled: true, belowPlayers: 7, freeMatches: 5 },
};

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isCount = (x: unknown): x is number => isNum(x) && Number.isInteger(x) && x >= 0;

/**
 * Coerce a raw app_config value into ValueRules, field by field. Never throws:
 * a bad config must not take the Values tab down.
 */
export function parseValueRules(value: unknown): ValueRules {
  const d = structuredClone(DEFAULT_VALUE_RULES);
  if (!isObj(value)) return d;

  const res = isObj(value.result) ? value.result : {};
  const result = {
    win: isNum(res.win) ? res.win : d.result.win,
    draw: isNum(res.draw) ? res.draw : d.result.draw,
    loss: isNum(res.loss) ? res.loss : d.result.loss,
  };

  let stats = d.stats;
  if (isObj(value.stats)) {
    stats = {};
    for (const k of STAT_KEYS) {
      const v = value.stats[k];
      if (isNum(v)) stats[k] = v;
    }
  }

  const ss = isObj(value.smallSided) ? value.smallSided : {};
  const smallSided = {
    enabled: typeof ss.enabled === "boolean" ? ss.enabled : d.smallSided.enabled,
    belowPlayers: isCount(ss.belowPlayers) ? ss.belowPlayers : d.smallSided.belowPlayers,
    freeMatches: isCount(ss.freeMatches) ? ss.freeMatches : d.smallSided.freeMatches,
  };

  return { version: 1, result, stats, floor: isNum(value.floor) ? value.floor : d.floor, smallSided };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/klcsra/value-rules.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Add the loader** to `src/lib/klcsra/config.ts`

Add the import next to the others and a type re-export, then the loader at the end:

```ts
import { parseValueRules, type ValueRules } from "./value-rules";
// ...
export type { ValueRules } from "./value-rules";
// ...
/** Load KLC player value rules from app_config (key 'klc_value_rules'). */
export async function loadValueRules(): Promise<ValueRules> {
  return parseValueRules(await loadConfigValue("klc_value_rules"));
}
```

- [ ] **Step 6: Extend the config contract test** (`config-contract.test.ts`)

Add after `POINTS_4TO6_SQL`:

```ts
/** Adds the KLC player value rules (Helper-bsr.18, 2026-11-25). */
const VALUES_SQL = readFileSync(
  resolve(REPO_ROOT, "supabase/migrations/20261125120000_klc_player_values.sql"),
  "utf8",
);
```

Add the import `import { DEFAULT_VALUE_RULES } from "./value-rules";`, then add `"klc_value_rules"` to `KEYS`, `klc_value_rules: VALUES_SQL` to `SQL_FOR`, `klc_value_rules: "object"` to `SHAPE`, rename the first test to `"finds every seeded rule set in the migrations"`, and add:

```ts
  it("klc_value_rules deep-equals DEFAULT_VALUE_RULES", () => {
    expect(seededValue("klc_value_rules")).toEqual(DEFAULT_VALUE_RULES);
  });
```

- [ ] **Step 7: Run**

Run: `npx vitest run src/lib/klcsra/config-contract.test.ts src/lib/klcsra/value-rules.test.ts`
Expected: PASS.

---

### Task 3: `sideOutcome`

**Files:**
- Modify: `src/lib/klcsra/league-table.ts`, `src/lib/klcsra/league-table.test.ts`

`sideOutcome` sits next to `matchResult` in `league-table.ts` (which wraps `computeMatchPoints`) because it needs `countedHalves` and `aggregateScores`; `points.ts` cannot import `league-table.ts` without a cycle.

- [ ] **Step 1: Write the failing tests** (append to `league-table.test.ts`)

```ts
import { sideOutcome } from "./league-table";

describe("sideOutcome", () => {
  const base = {
    id: "m", entryDate: "2026-12-01", sport: "football" as const,
    isCombined: false, isFriendly: false, totalPlayers: 14,
  };
  const half = (halfNo: number, h: number, a: number) => ({
    halfNo, home: { clubId: "a", score: h }, away: { clubId: "b", score: a },
  });

  it("scores a normal match from half 1 only", () => {
    const m = { ...base, halves: [half(1, 2, 1), half(2, 0, 5)] };
    expect(sideOutcome(m, "home")).toBe("win");
    expect(sideOutcome(m, "away")).toBe("loss");
  });

  it("scores a combined match over both halves", () => {
    const m = { ...base, isCombined: true, halves: [half(1, 2, 1), half(2, 0, 1)] };
    expect(sideOutcome(m, "home")).toBe("draw");
  });

  it("gives no result for an incomplete match or fewer than 2 players", () => {
    expect(sideOutcome({ ...base, halves: [] }, "home")).toBeNull();
    expect(sideOutcome({ ...base, isCombined: true, halves: [half(1, 1, 0)] }, "home")).toBeNull();
    expect(sideOutcome({ ...base, totalPlayers: 1, halves: [half(1, 1, 0)] }, "home")).toBeNull();
  });
});
```

(If `league-table.test.ts` already imports from `./league-table`, add `sideOutcome` to that import instead of a second import line.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/klcsra/league-table.test.ts`
Expected: FAIL, `sideOutcome` is not exported.

- [ ] **Step 3: Implement** (add after `matchResult` in `league-table.ts`)

```ts
export type SideOutcome = "win" | "draw" | "loss";

/**
 * One side's result, decided exactly like the league table: the higher
 * aggregate over the counted halves wins. Null when the table couldn't score
 * the match: no complete counted half, a combined match missing a half, or
 * fewer than 2 players. Used for player values (spec 2026-11-22 §5).
 */
export function sideOutcome(m: LeagueMatch, side: SideKey): SideOutcome | null {
  const halves = countedHalves(m);
  if (halves.length === 0 || m.totalPlayers < 2) return null;
  if (m.isCombined && halves.length < 2) return null;
  const agg = aggregateScores({ ...m, halves });
  const mine = side === "home" ? agg.home : agg.away;
  const theirs = side === "home" ? agg.away : agg.home;
  return mine > theirs ? "win" : mine < theirs ? "loss" : "draw";
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/klcsra/league-table.test.ts`
Expected: PASS.

---

### Task 4: The pure value calculation

**Files:**
- Create: `src/lib/klcsra/player-values.ts`, `src/lib/klcsra/player-values.test.ts`

- [ ] **Step 1: Write the failing tests** (`player-values.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import {
  computePlayerValues, formatChange, formatKr, isCountedForValues, rankValues,
  type RegisterPlayer, type ValueChange,
} from "./player-values";
import { DEFAULT_VALUE_RULES, type ValueRules } from "./value-rules";
import type { StatKey } from "./stat-rates";
import type { MatchDraft, MatchStatus, SideKey } from "./types";

const RULES = DEFAULT_VALUE_RULES;
const NO_SMALL: ValueRules = { ...RULES, smallSided: { ...RULES.smallSided, enabled: false } };

const P1: RegisterPlayer = {
  playerId: "p1", displayName: "Pat", klcName: "Patrick", clubId: "ca", clubName: "Club A",
  baseValue: 200, manyClubs: false,
};

let seq = 0;
interface Mk {
  id?: string; date: string;
  home?: number; away?: number;
  me?: SideKey;
  stats?: Partial<Record<StatKey, number>>;
  /** Other players in the match (default 13, so 14 in total: not small-sided). */
  others?: number;
  friendly?: boolean; official?: boolean;
  combined?: boolean; half2?: [number, number];
  noAway?: boolean;
  status?: MatchStatus; submittedAt?: string | null;
}
function mk(o: Mk): MatchDraft {
  const id = o.id ?? `m${++seq}`;
  const side = (s: SideKey, clubId: string | null, clubName: string | null, score: number) =>
    ({ id: `${id}-${s}`, side: s, clubId, clubName, score });
  const halves = [{
    id: `${id}-h1`, halfNo: 1,
    sides: [
      side("home", "ca", "Club A", o.home ?? 1),
      o.noAway ? side("away", null, null, 0) : side("away", "cb", "Club B", o.away ?? 0),
    ],
  }];
  if (o.half2) {
    halves.push({ id: `${id}-h2`, halfNo: 2, sides: [
      side("home", "ca", "Club A", o.half2[0]), side("away", "cb", "Club B", o.half2[1]),
    ] });
  }
  const me = {
    id: `${id}-me`, playerId: "p1", displayName: "Pat", side: o.me ?? "home", slot: 1,
    stats: o.stats ? { 1: o.stats } : {},
  };
  const others = Array.from({ length: o.others ?? 13 }, (_, i) => ({
    id: `${id}-o${i}`, playerId: `x${i}`, displayName: `X${i}`,
    side: (i % 2 ? "home" : "away") as SideKey, slot: i + 2, stats: {},
  }));
  return {
    id, entryDate: o.date, sport: "football",
    isFriendly: o.friendly ?? false, isCombined: o.combined ?? false,
    isOfficialFriendly: o.official ?? false, durationMinutes: null,
    status: o.status ?? "submitted",
    submittedAt: o.submittedAt === undefined ? `${o.date}T10:00:00Z` : o.submittedAt,
    homeSentAt: null, awaySentAt: null,
    seasonId: o.friendly ? null : "s2", seasonName: null, createdBy: null,
    halves, appearances: [me, ...others],
  };
}
const change = (c: Partial<ValueChange> & { effectiveDate: string; amount: number }): ValueChange => ({
  id: `c-${c.effectiveDate}-${c.amount}`, playerId: "p1", note: "note",
  createdAt: `${c.effectiveDate}T00:00:00Z`, voidedAt: null, voidNote: null, ...c,
});
const run = (matches: MatchDraft[], opts: { changes?: ValueChange[]; rules?: ValueRules; player?: RegisterPlayer } = {}) =>
  computePlayerValues({
    players: [opts.player ?? P1], matches, changes: opts.changes ?? [], rules: opts.rules ?? RULES,
  })[0];

describe("computePlayerValues", () => {
  it("Sir's worked example: 200 → 223 → 203", () => {
    const v = run([
      mk({ date: "2026-12-01", home: 2, away: 1, stats: { goal: 1, assist: 1 } }),
      mk({ date: "2026-12-03", home: 0, away: 1, friendly: true, official: true, stats: { yellowCard: 1 } }),
    ]);
    expect(v.sessions.map((s) => s.valueAfter)).toEqual([223, 203]);
    expect(v.current).toBe(203);
    expect(v.lastSession).toEqual({ date: "2026-12-03", change: -20 });
  });

  it("win, draw and loss", () => {
    expect(run([mk({ date: "2026-12-01", home: 1, away: 0 })]).current).toBe(220);
    expect(run([mk({ date: "2026-12-01", home: 1, away: 1 })]).current).toBe(205);
    expect(run([mk({ date: "2026-12-01", home: 0, away: 1 })]).current).toBe(190);
    expect(run([mk({ date: "2026-12-01", home: 0, away: 1, me: "away" })]).current).toBe(220);
  });

  it("every rated stat and card, summed over halves", () => {
    const v = run([mk({
      date: "2026-12-01", home: 1, away: 1,
      stats: {
        goal: 1, mainGoal: 1, reboundGoal: 1, try: 1, conversion: 1,
        assist: 1, preAssist: 1, save: 1, yellowCard: 1, redCard: 1, blueCard: 1,
      },
    })]);
    // draw +5; stats 2*5 + 1 + 0.5 + 2 - 10 - 20 - 50 = -66.5
    expect(v.sessions[0].total).toBe(-61.5);
    expect(v.current).toBe(138.5);
    expect(v.sessions[0].matches[0].stats.map((s) => s.statKey)).toEqual([
      "goal", "try", "conversion", "mainGoal", "reboundGoal", "assist", "preAssist", "save",
      "yellowCard", "redCard", "blueCard",
    ]);
  });

  it("an unrated stat (tackle) counts 0 and shows no line", () => {
    const v = run([mk({ date: "2026-12-01", home: 1, away: 1, stats: { tackle: 4, lateChallenge: 1 } })]);
    expect(v.current).toBe(205);
    expect(v.sessions[0].matches[0].stats).toEqual([]);
  });

  it("a combined match is one result over both halves", () => {
    const v = run([mk({ date: "2026-12-01", combined: true, home: 2, away: 0, half2: [0, 3] })]);
    expect(v.sessions[0].matches[0].result).toBe("loss");
    expect(v.current).toBe(190);
  });

  it("an incomplete match changes stats only", () => {
    const v = run([mk({ date: "2026-12-01", noAway: true, stats: { goal: 1 } })]);
    expect(v.sessions[0].matches[0].result).toBeNull();
    expect(v.current).toBe(202);
  });

  it("counts official friendlies, not unofficial ones or unsubmitted matches", () => {
    const v = run([
      mk({ date: "2026-12-01", friendly: true, official: true }),
      mk({ date: "2026-12-02", friendly: true, official: false }),
      mk({ date: "2026-12-03", status: "sent" }),
    ]);
    expect(v.sessions.map((s) => s.date)).toEqual(["2026-12-01"]);
    expect(v.sessions[0].matches[0].kind).toBe("official_friendly");
  });

  it("small-sided: the first 5 are free, the 6th counts, in date then submit order", () => {
    const small = [
      mk({ id: "s6", date: "2026-12-06", others: 3 }),
      mk({ id: "s5b", date: "2026-12-05", others: 3, submittedAt: "2026-12-05T11:00:00Z" }),
      mk({ id: "s5a", date: "2026-12-05", others: 3, submittedAt: "2026-12-05T09:00:00Z" }),
      mk({ id: "s3", date: "2026-12-03", others: 3 }),
      mk({ id: "s2", date: "2026-12-02", others: 3 }),
      mk({ id: "s1", date: "2026-12-01", others: 3 }),
    ];
    const v = run(small);
    const lines = v.sessions.flatMap((s) => s.matches);
    expect(lines.map((l) => [l.matchId, l.smallSidedFree])).toEqual([
      ["s1", 1], ["s2", 2], ["s3", 3], ["s5a", 4], ["s5b", 5], ["s6", null],
    ]);
    expect(lines.map((l) => l.total)).toEqual([0, 0, 0, 0, 0, 20]);
    expect(v.current).toBe(220);
  });

  it("small-sided: a 7-player match is never free, and the switch turns the rule off", () => {
    expect(run([mk({ date: "2026-12-01", others: 6 })]).current).toBe(220);
    expect(run([mk({ date: "2026-12-01", others: 3 })], { rules: NO_SMALL }).current).toBe(220);
  });

  it("the floor applies after each session day, not per match", () => {
    const low = { ...P1, baseValue: 15 };
    const v = run([
      mk({ date: "2026-12-01", home: 0, away: 1 }),            // -10
      mk({ date: "2026-12-01", home: 0, away: 1 }),            // -10 → 15 - 20 → 0
      mk({ date: "2026-12-02", home: 1, away: 0 }),            // +20 → 20
    ], { player: low });
    expect(v.sessions.map((s) => [s.total, s.valueAfter, s.hitFloor])).toEqual([
      [-20, 0, true], [20, 20, false],
    ]);
    expect(v.lastSession).toEqual({ date: "2026-12-02", change: 20 });
  });

  it("KFANDRA changes join their date's session, or make their own; voided ones are ignored", () => {
    const v = run([mk({ date: "2026-12-01", home: 1, away: 0 })], {
      changes: [
        change({ effectiveDate: "2026-12-01", amount: -50, note: "Ill" }),
        change({ effectiveDate: "2026-12-04", amount: 10 }),
        change({ effectiveDate: "2026-12-05", amount: 999, voidedAt: "2026-12-06T00:00:00Z", voidNote: "typo" }),
      ],
    });
    expect(v.sessions.map((s) => [s.date, s.total, s.valueAfter])).toEqual([
      ["2026-12-01", -30, 170], ["2026-12-04", 10, 180],
    ]);
    expect(v.sessions[0].changes).toEqual([{ id: "c-2026-12-01--50", amount: -50, note: "Ill" }]);
  });

  it("a player with no base value is not valued but is flagged once they play", () => {
    const v = run([mk({ date: "2026-12-01" })], { player: { ...P1, baseValue: null } });
    expect(v.current).toBeNull();
    expect(v.sessions).toEqual([]);
    expect(v.playedWithoutBase).toBe(true);
    expect(run([], { player: { ...P1, baseValue: null } }).playedWithoutBase).toBe(false);
  });

  it("with no counted matches the value is the base value", () => {
    const v = run([]);
    expect(v.current).toBe(200);
    expect(v.lastSession).toBeNull();
  });

  it("labels a match with its clubs", () => {
    const v = run([mk({ date: "2026-12-01" })]);
    expect(v.sessions[0].matches[0].label).toBe("Club A v Club B");
  });
});

describe("isCountedForValues", () => {
  it("is submitted league matches and submitted official friendlies", () => {
    expect(isCountedForValues(mk({ date: "2026-12-01" }))).toBe(true);
    expect(isCountedForValues(mk({ date: "2026-12-01", friendly: true, official: true }))).toBe(true);
    expect(isCountedForValues(mk({ date: "2026-12-01", friendly: true }))).toBe(false);
    expect(isCountedForValues(mk({ date: "2026-12-01", status: "draft" }))).toBe(false);
  });
});

describe("rankValues", () => {
  it("drops unvalued players and ranks by value, then name", () => {
    const vals = computePlayerValues({
      players: [
        { ...P1, playerId: "a", klcName: null, displayName: "Zed", baseValue: 100 },
        { ...P1, playerId: "b", klcName: "Amy", displayName: "x", baseValue: 100 },
        { ...P1, playerId: "c", baseValue: 300 },
        { ...P1, playerId: "d", baseValue: null },
      ],
      matches: [], changes: [], rules: RULES,
    });
    expect(rankValues(vals).map((v) => v.playerId)).toEqual(["c", "b", "a"]);
  });
});

describe("formatting", () => {
  it("formats Kroopies and signed changes", () => {
    expect(formatKr(1234.5)).toBe("1,234.5 KR");
    expect(formatChange(20)).toBe("+20 KR");
    expect(formatChange(-10)).toBe("−10 KR");
    expect(formatChange(0)).toBe("0 KR");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/klcsra/player-values.test.ts`
Expected: FAIL, cannot find module `./player-values`.

- [ ] **Step 3: Implement** (`player-values.ts`)

```ts
/**
 * Pure KLC player values (spec 2026-11-22 §5). No DB/server imports.
 *
 * Values are never stored: they are worked out on every read from the base
 * value, the counted matches and KFANDRA's non-voided changes, so reopening a
 * match, fixing a score, flipping a friendly's mark or voiding a change needs
 * no clean-up.
 */
import { sideClubLabel, toLeagueMatch } from "./league-data";
import { sideOutcome, type SideOutcome } from "./league-table";
import { round4 } from "./round";
import { STAT_KEYS, type StatKey } from "./stat-rates";
import type { MatchDraft } from "./types";
import type { ValueRules } from "./value-rules";

export interface RegisterPlayer {
  playerId: string;
  displayName: string;
  klcName: string | null;
  clubId: string;
  clubName: string;
  baseValue: number | null;
  /** Manages more than one active club (the lowest sort_order club is used). */
  manyClubs: boolean;
}

export interface ValueChange {
  id: string;
  playerId: string;
  effectiveDate: string;
  amount: number;
  note: string;
  createdAt: string;
  voidedAt: string | null;
  voidNote: string | null;
}

export interface MatchValueLine {
  matchId: string;
  date: string;
  /** "Club A v Club B" */
  label: string;
  kind: "league" | "official_friendly";
  /** Null for a match the league table can't score (incomplete, or 1 player). */
  result: SideOutcome | null;
  resultChange: number;
  stats: { statKey: StatKey; count: number; change: number }[];
  /** 1..freeMatches when this was one of the player's free small-sided matches. */
  smallSidedFree: number | null;
  /** 0 when smallSidedFree is set. */
  total: number;
}

export interface SessionValue {
  date: string;
  matches: MatchValueLine[];
  changes: { id: string; amount: number; note: string }[];
  /** Sum before the floor. */
  total: number;
  valueBefore: number;
  valueAfter: number;
  hitFloor: boolean;
}

export interface PlayerValue {
  playerId: string;
  /** Official KLC name, else the app name. */
  name: string;
  clubId: string;
  clubName: string;
  baseValue: number | null;
  /** Null when there is no base value. */
  current: number | null;
  lastSession: { date: string; change: number } | null;
  /** Oldest first. */
  sessions: SessionValue[];
  playedWithoutBase: boolean;
}

/** Submitted league matches, and submitted friendlies marked Official. */
export function isCountedForValues(m: MatchDraft): boolean {
  return m.status === "submitted" && (!m.isFriendly || m.isOfficialFriendly);
}

/** Oldest first: entry date, then submitted_at (nulls last), then id. */
function oldestFirst(a: MatchDraft, b: MatchDraft): number {
  const byDate = a.entryDate.localeCompare(b.entryDate);
  if (byDate !== 0) return byDate;
  if (a.submittedAt !== b.submittedAt) {
    if (a.submittedAt === null) return 1;
    if (b.submittedAt === null) return -1;
    return a.submittedAt.localeCompare(b.submittedAt);
  }
  return a.id.localeCompare(b.id);
}

const sum = (xs: number[]) => round4(xs.reduce((s, x) => s + x, 0));

function matchLines(playerId: string, matches: MatchDraft[], rules: ValueRules): MatchValueLine[] {
  const lines: MatchValueLine[] = [];
  let smallCount = 0;
  for (const m of matches) {
    const a = m.appearances.find((x) => x.playerId === playerId);
    if (!a) continue;
    const lm = toLeagueMatch(m);

    let free: number | null = null;
    if (rules.smallSided.enabled && lm.totalPlayers < rules.smallSided.belowPlayers) {
      smallCount += 1;
      if (smallCount <= rules.smallSided.freeMatches) free = smallCount;
    }

    const result = sideOutcome(lm, a.side);
    const resultChange = result ? rules.result[result] : 0;

    const counts = new Map<StatKey, number>();
    for (const half of Object.values(a.stats)) {
      for (const [k, n] of Object.entries(half) as [StatKey, number | undefined][]) {
        if (n) counts.set(k, (counts.get(k) ?? 0) + n);
      }
    }
    const stats = STAT_KEYS
      .filter((k) => counts.has(k) && (rules.stats[k] ?? 0) !== 0)
      .map((k) => {
        const count = counts.get(k)!;
        return { statKey: k, count, change: round4(count * rules.stats[k]!) };
      });

    const raw = round4(resultChange + sum(stats.map((s) => s.change)));
    lines.push({
      matchId: m.id,
      date: m.entryDate,
      label: `${sideClubLabel(m, "home", { counted: true })} v ${sideClubLabel(m, "away", { counted: true })}`,
      kind: m.isFriendly ? "official_friendly" : "league",
      result,
      resultChange,
      stats,
      smallSidedFree: free,
      total: free === null ? raw : 0,
    });
  }
  return lines;
}

function valueFor(
  p: RegisterPlayer,
  matches: MatchDraft[],
  changes: ValueChange[],
  rules: ValueRules,
): PlayerValue {
  const ident = {
    playerId: p.playerId,
    name: p.klcName ?? p.displayName,
    clubId: p.clubId,
    clubName: p.clubName,
    baseValue: p.baseValue,
  };
  const lines = matchLines(p.playerId, matches, rules);
  if (p.baseValue === null) {
    return { ...ident, current: null, lastSession: null, sessions: [], playedWithoutBase: lines.length > 0 };
  }

  const mine = changes
    .filter((c) => c.playerId === p.playerId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const dates = [...new Set([...lines.map((l) => l.date), ...mine.map((c) => c.effectiveDate)])].sort();

  let value = p.baseValue;
  const sessions: SessionValue[] = [];
  for (const date of dates) {
    const ms = lines.filter((l) => l.date === date);
    const cs = mine.filter((c) => c.effectiveDate === date);
    const total = sum([...ms.map((l) => l.total), ...cs.map((c) => c.amount)]);
    const raw = round4(value + total);
    const valueAfter = Math.max(rules.floor, raw);
    sessions.push({
      date,
      matches: ms,
      changes: cs.map((c) => ({ id: c.id, amount: c.amount, note: c.note })),
      total,
      valueBefore: value,
      valueAfter,
      hitFloor: raw < rules.floor,
    });
    value = valueAfter;
  }

  const last = sessions.at(-1);
  return {
    ...ident,
    current: value,
    lastSession: last ? { date: last.date, change: round4(last.valueAfter - last.valueBefore) } : null,
    sessions,
    playedWithoutBase: false,
  };
}

export function computePlayerValues(input: {
  players: RegisterPlayer[];
  matches: MatchDraft[];
  changes: ValueChange[];
  rules: ValueRules;
}): PlayerValue[] {
  const counted = input.matches.filter(isCountedForValues).sort(oldestFirst);
  const live = input.changes.filter((c) => c.voidedAt === null);
  return input.players.map((p) => valueFor(p, counted, live, input.rules));
}

/** Valued players only, highest value first, then by name. */
export function rankValues(values: PlayerValue[]): PlayerValue[] {
  return values
    .filter((v) => v.current !== null)
    .sort((a, b) => b.current! - a.current! || a.name.localeCompare(b.name, "en"));
}

export function formatKr(n: number): string {
  return `${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })} KR`;
}

/** "+20 KR", "−10 KR" (a true minus sign), "0 KR". */
export function formatChange(n: number): string {
  if (n > 0) return `+${formatKr(n)}`;
  if (n < 0) return `−${formatKr(-n)}`;
  return formatKr(0);
}
```

Note for the reviewer: `en-IN` groups 1234.5 as `1,234.5`; numbers of a lakh or more group as `1,00,000`, which is what KFANDRA's sheets use.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/klcsra/player-values.test.ts`
Expected: PASS (all tests). If the "every rated stat" total is off, re-add by hand: draw 5 + goal 2 + try 2 + conversion 2 + mainGoal 2 + reboundGoal 2 + assist 1 + preAssist 0.5 + save 2 − 10 − 20 − 50 = −61.5.

---

### Task 5: The register (pure)

**Files:**
- Create: `src/lib/klcsra/register.ts`, `src/lib/klcsra/register.test.ts`

- [ ] **Step 1: Write the failing tests** (`register.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { buildRegister } from "./register";

const clubs = [
  { id: "c2", name: "Bravo", sortOrder: 2, managerPlayerId: "p1" },
  { id: "c1", name: "Alpha", sortOrder: 1, managerPlayerId: "p2" },
  { id: "c3", name: "Charlie", sortOrder: 3, managerPlayerId: "p1" },
];
const players = [
  { id: "p1", displayName: "Pat", klcName: "Patrick" },
  { id: "p2", displayName: "Sam", klcName: null },
];

describe("buildRegister", () => {
  it("has one row per manager, in club order, with base values", () => {
    const r = buildRegister(clubs, players, [{ playerId: "p2", baseValue: 150 }]);
    expect(r.map((x) => [x.playerId, x.clubName, x.baseValue])).toEqual([
      ["p2", "Alpha", 150],
      ["p1", "Bravo", null],
    ]);
  });

  it("uses the lowest sort_order club for a manager of two clubs and flags it", () => {
    const r = buildRegister(clubs, players, []);
    const pat = r.find((x) => x.playerId === "p1")!;
    expect(pat.clubId).toBe("c2");
    expect(pat.manyClubs).toBe(true);
    expect(r.find((x) => x.playerId === "p2")!.manyClubs).toBe(false);
  });

  it("skips a club whose manager isn't a known player", () => {
    const r = buildRegister([{ id: "c9", name: "Ghost", sortOrder: 0, managerPlayerId: "zz" }], players, []);
    expect(r).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/klcsra/register.test.ts`
Expected: FAIL, cannot find module `./register`.

- [ ] **Step 3: Implement** (`register.ts`)

```ts
/**
 * Pure. Who is in the KLC register (spec 2026-11-22 §4): the managers of
 * active clubs. A player's club is the club they manage; if they manage more
 * than one, the lowest sort_order is used and the row is flagged.
 */
import type { RegisterPlayer } from "./player-values";

export interface RegisterClub { id: string; name: string; sortOrder: number; managerPlayerId: string }
export interface RegisterPerson { id: string; displayName: string; klcName: string | null }
export interface BaseValueRow { playerId: string; baseValue: number }

export function buildRegister(
  clubs: RegisterClub[],
  people: RegisterPerson[],
  bases: BaseValueRow[],
): RegisterPlayer[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const base = new Map(bases.map((b) => [b.playerId, b.baseValue]));
  const count = new Map<string, number>();
  for (const c of clubs) count.set(c.managerPlayerId, (count.get(c.managerPlayerId) ?? 0) + 1);

  const out: RegisterPlayer[] = [];
  const seen = new Set<string>();
  for (const c of [...clubs].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))) {
    const p = byId.get(c.managerPlayerId);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push({
      playerId: p.id,
      displayName: p.displayName,
      klcName: p.klcName,
      clubId: c.id,
      clubName: c.name,
      baseValue: base.get(p.id) ?? null,
      manyClubs: (count.get(p.id) ?? 0) > 1,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/klcsra/register.test.ts`
Expected: PASS (3 tests).

---

### Task 6: Input parsing (pure)

**Files:**
- Create: `src/lib/klcsra/value-input.ts`, `src/lib/klcsra/value-input.test.ts`

- [ ] **Step 1: Write the failing tests** (`value-input.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { parseAmount, parseKlcName, parseNote } from "./value-input";

describe("parseAmount", () => {
  it("accepts numbers with up to 2 decimals, commas allowed", () => {
    expect(parseAmount("1,250.5")).toBe(1250.5);
    expect(parseAmount(" -20 ")).toBe(-20);
    expect(parseAmount("0")).toBe(0);
  });
  it("rejects blanks, junk, 3 decimals and huge numbers", () => {
    for (const s of ["", "abc", "1.234", "1e5", "100000000"]) expect(parseAmount(s)).toBeNull();
  });
});

describe("parseKlcName", () => {
  it("trims, empties to null, and caps at 60 characters", () => {
    expect(parseKlcName("  Patrick O. ")).toEqual({ ok: true, value: "Patrick O." });
    expect(parseKlcName("   ")).toEqual({ ok: true, value: null });
    expect(parseKlcName("x".repeat(61)).ok).toBe(false);
  });
});

describe("parseNote", () => {
  it("requires 1–200 characters after trimming", () => {
    expect(parseNote(" ill ")).toBe("ill");
    expect(parseNote("  ")).toBeNull();
    expect(parseNote("x".repeat(201))).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/klcsra/value-input.test.ts`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement** (`value-input.ts`)

```ts
/** Pure parsing for the register's inputs. Columns are numeric(10,2). */

const AMOUNT_RE = /^-?\d+(\.\d{1,2})?$/;
const MAX = 99_999_999.99;

/** A Kroopies amount: up to 2 decimals, commas ignored. Null when invalid. */
export function parseAmount(raw: string): number | null {
  const s = (raw ?? "").replace(/,/g, "").trim();
  if (!AMOUNT_RE.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && Math.abs(n) <= MAX ? n : null;
}

export function parseKlcName(raw: string): { ok: true; value: string | null } | { ok: false } {
  const s = (raw ?? "").trim();
  if (s.length > 60) return { ok: false };
  return { ok: true, value: s === "" ? null : s };
}

export function parseNote(raw: string): string | null {
  const s = (raw ?? "").trim();
  return s.length >= 1 && s.length <= 200 ? s : null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/klcsra/value-input.test.ts`
Expected: PASS.

---

### Task 7: Counted matches and official names in the read model

**Files:**
- Modify: `src/lib/klcsra/league-repository.ts`, `src/lib/klcsra/league-repository.test.ts`
- Modify: `src/lib/klcsra/types.ts`, `src/lib/klcsra/repository.ts`, `src/lib/klcsra/league-data.ts`, `src/lib/klcsra/league-data.test.ts`

- [ ] **Step 1: Write the failing repository test** (append to `league-repository.test.ts`; add `listCountedMatches` to the existing import from `./league-repository`)

```ts
describe("listCountedMatches", () => {
  it("keeps league matches and official friendlies, still filtering status = submitted", async () => {
    respond = (q) => {
      if (isLeague(q)) return { data: [row("l1", "2026-09-01", "2026-09-01T10:00:00Z")], error: null };
      const official = { ...row("f1", "2026-09-02", "2026-09-02T10:00:00Z", true), is_official_friendly: true };
      const unofficial = row("f2", "2026-09-03", "2026-09-03T10:00:00Z", true);
      return { data: [official, unofficial], error: null };
    };
    const got = await listCountedMatches(season(null));
    expect(got.map((m) => m.id).sort()).toEqual(["f1", "l1"]);
    for (const q of queries) expect(hasCall(q, "eq", "status", "submitted")).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/klcsra/league-repository.test.ts`
Expected: FAIL, `listCountedMatches` is not exported.

- [ ] **Step 3: Implement** (append to `league-repository.ts`; add `import { isCountedForValues } from "./player-values";`)

```ts
/**
 * The matches that change player values (spec 2026-11-22 §5): the season's
 * submitted league matches and its submitted official friendlies. Filters
 * `listSubmittedMatchDrafts` rather than querying again, so the
 * `status = 'submitted'` guarantee holds here too.
 */
export async function listCountedMatches(season: Season): Promise<MatchDraft[]> {
  return (await listSubmittedMatchDrafts(season)).filter(isCountedForValues);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/klcsra/league-repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing official-name test** (append to `league-data.test.ts`; reuse that file's existing `MatchDraft` factory if it has one, otherwise use this literal)

```ts
import { toStatRows } from "./league-data";

describe("toStatRows official names", () => {
  it("prefers the player's KLC name", () => {
    const d = {
      id: "m", entryDate: "2026-12-01", sport: "football", isFriendly: false, isCombined: false,
      isOfficialFriendly: false, durationMinutes: null, status: "submitted", submittedAt: null,
      homeSentAt: null, awaySentAt: null, seasonId: "s", seasonName: null, createdBy: null,
      halves: [{ id: "h", halfNo: 1, sides: [] }],
      appearances: [
        { id: "a1", playerId: "p1", displayName: "Pat", klcName: "Patrick", side: "home", slot: 1, stats: { 1: { goal: 1 } } },
        { id: "a2", playerId: "p2", displayName: "Sam", klcName: null, side: "away", slot: 1, stats: { 1: { goal: 1 } } },
      ],
    } as const;
    expect(toStatRows(d as never).map((r) => r.displayName)).toEqual(["Patrick", "Sam"]);
  });
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/lib/klcsra/league-data.test.ts`
Expected: FAIL, first name is `"Pat"`.

- [ ] **Step 7: Implement**

`types.ts`, in `AppearanceDraft` after `displayName`:
```ts
  /** Official KLC name (players.klc_name); boards prefer it. Absent in older fixtures. */
  klcName?: string | null;
```

`repository.ts`:
- In `MATCH_DRAFT_COLS` change `players(display_name),` to `players(display_name, klc_name),`.
- In `AppearanceRow` change `players: ToOne<{ display_name: string }>;` to `players: ToOne<{ display_name: string; klc_name: string | null }>;`.
- In `toAppearanceDraft`, after `displayName: ...,` add `klcName: one(a.players)?.klc_name ?? null,`.

`league-data.ts`, in `toStatRows`, change `playerId: a.playerId, displayName: a.displayName, clubName,` to:
```ts
          playerId: a.playerId, displayName: a.klcName ?? a.displayName, clubName,
```

- [ ] **Step 8: Run the KLC unit suite**

Run: `npx vitest run src/lib/klcsra`
Expected: PASS. If a test compares a whole `AppearanceDraft` from `toMatchDraft` with `toEqual`, add `klcName: null` to its expected value.

---

### Task 8: Value repository (server-only)

**Files:**
- Create: `src/lib/klcsra/value-repository.ts`

No unit test of its own: it is thin Supabase glue over the pure modules tested above, and the e2e tests in Task 13 exercise every function against local Supabase.

- [ ] **Step 1: Implement** (`value-repository.ts`)

```ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadValueRules } from "./config";
import { listCountedMatches } from "./league-repository";
import { computePlayerValues, type PlayerValue, type RegisterPlayer, type ValueChange } from "./player-values";
import { buildRegister } from "./register";
import type { Season } from "./types";

/**
 * Reads and writes for the KLC register and value changes (spec 2026-11-22 §4).
 * Service role. Writes are called only from value-actions.ts, which checks
 * KFANDRA first. Every function throws on a DB error.
 */

export async function listRegister(seasonId: string): Promise<RegisterPlayer[]> {
  const admin = createAdminClient();
  const [clubs, bases] = await Promise.all([
    admin.from("clubs").select("id, name, sort_order, manager_player_id")
      .eq("is_active", true).not("manager_player_id", "is", null),
    admin.from("klc_player_base_values").select("player_id, base_value").eq("season_id", seasonId),
  ]);
  if (clubs.error) throw new Error(`Failed to load the clubs: ${clubs.error.message}`);
  if (bases.error) throw new Error(`Failed to load the base values: ${bases.error.message}`);

  const ids = [...new Set((clubs.data ?? []).map((c) => c.manager_player_id as string))];
  const people = ids.length === 0
    ? { data: [], error: null }
    : await admin.from("players").select("id, display_name, klc_name").in("id", ids);
  if (people.error) throw new Error(`Failed to load the players: ${people.error.message}`);

  return buildRegister(
    (clubs.data ?? []).map((c) => ({
      id: c.id, name: c.name, sortOrder: c.sort_order, managerPlayerId: c.manager_player_id as string,
    })),
    (people.data ?? []).map((p) => ({ id: p.id, displayName: p.display_name, klcName: p.klc_name })),
    (bases.data ?? []).map((b) => ({ playerId: b.player_id, baseValue: Number(b.base_value) })),
  );
}

/** Every change for the season, voided ones included, oldest first. */
export async function listValueChanges(seasonId: string): Promise<ValueChange[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("klc_player_value_changes")
    .select("id, player_id, effective_date, amount, note, created_at, voided_at, void_note")
    .eq("season_id", seasonId)
    .order("effective_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load the value changes: ${error.message}`);
  return (data ?? []).map((c) => ({
    id: c.id, playerId: c.player_id, effectiveDate: c.effective_date, amount: Number(c.amount),
    note: c.note, createdAt: c.created_at, voidedAt: c.voided_at, voidNote: c.void_note,
  }));
}

/** The register, the season's changes and everyone's values, from one place. */
export async function loadSeasonValues(season: Season): Promise<{
  register: RegisterPlayer[]; changes: ValueChange[]; values: PlayerValue[];
}> {
  const [register, changes, rules, matches] = await Promise.all([
    listRegister(season.id), listValueChanges(season.id), loadValueRules(), listCountedMatches(season),
  ]);
  return { register, changes, values: computePlayerValues({ players: register, matches, changes, rules }) };
}

export async function getBaseValue(seasonId: string, playerId: string): Promise<number | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("klc_player_base_values").select("base_value")
    .eq("season_id", seasonId).eq("player_id", playerId).maybeSingle();
  if (error) throw new Error(`Failed to load the base value: ${error.message}`);
  return data ? Number(data.base_value) : null;
}

export async function upsertBaseValue(
  seasonId: string, playerId: string, value: number, by: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("klc_player_base_values").upsert({
    season_id: seasonId, player_id: playerId, base_value: value,
    updated_by: by, updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Failed to save the base value: ${error.message}`);
}

export async function getKlcName(playerId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("players").select("klc_name").eq("id", playerId).maybeSingle();
  if (error) throw new Error(`Failed to load the player: ${error.message}`);
  return data?.klc_name ?? null;
}

export async function setKlcName(playerId: string, name: string | null): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("players").update({ klc_name: name }).eq("id", playerId);
  if (error) throw new Error(`Failed to save the name: ${error.message}`);
}

export async function insertValueChange(c: {
  seasonId: string; playerId: string; effectiveDate: string; amount: number; note: string; by: string;
}): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("klc_player_value_changes").insert({
    season_id: c.seasonId, player_id: c.playerId, effective_date: c.effectiveDate,
    amount: c.amount, note: c.note, created_by: c.by,
  }).select("id").single();
  if (error) throw new Error(`Failed to add the change: ${error.message}`);
  return data.id;
}

export async function getValueChange(id: string): Promise<{ id: string; voidedAt: string | null } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("klc_player_value_changes")
    .select("id, voided_at").eq("id", id).maybeSingle();
  if (error) throw new Error(`Failed to load the change: ${error.message}`);
  return data ? { id: data.id, voidedAt: data.voided_at } : null;
}

export async function voidValueChange(id: string, by: string, note: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("klc_player_value_changes")
    .update({ voided_at: new Date().toISOString(), voided_by: by, void_note: note })
    .eq("id", id).is("voided_at", null);
  if (error) throw new Error(`Failed to void the change: ${error.message}`);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (If the generated type for `amount`/`base_value` is `number`, the `Number(...)` calls are harmless.)

---

### Task 9: Server actions (KFANDRA only, audited)

**Files:**
- Create: `src/lib/klcsra/value-actions.ts`, `src/lib/klcsra/value-actions.test.ts`

- [ ] **Step 1: Write the failing tests** (`value-actions.test.ts`)

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentPlayer: vi.fn() }));
vi.mock("./repository", () => ({ listSeasons: vi.fn(), writeAudit: vi.fn() }));
vi.mock("./value-repository", () => ({
  getBaseValue: vi.fn(), upsertBaseValue: vi.fn(), getKlcName: vi.fn(), setKlcName: vi.fn(),
  insertValueChange: vi.fn(), getValueChange: vi.fn(), voidValueChange: vi.fn(),
}));

import { getCurrentPlayer, type CurrentPlayer } from "@/lib/auth/current-user";
import * as repo from "./repository";
import * as vrepo from "./value-repository";
import {
  addValueChangeAction, setBaseValueAction, setKlcNameAction, voidValueChangeAction,
} from "./value-actions";

const as = (role: string) =>
  vi.mocked(getCurrentPlayer).mockResolvedValue({ id: "me", role } as unknown as CurrentPlayer);
const SEASON = { id: "s2", seasonNo: 2, name: "S2", startDate: "2026-12-01", endDate: "2027-03-31", status: "active" as const };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(repo.listSeasons).mockResolvedValue([SEASON]);
  as("kfandra");
});

describe("value actions", () => {
  it("refuses anyone but KFANDRA or super_admin", async () => {
    as("admin");
    const r = await setBaseValueAction("s2", "p1", "200");
    expect(r).toEqual({ ok: false, error: "Only KFANDRA can change the register." });
    expect(vrepo.upsertBaseValue).not.toHaveBeenCalled();
  });

  it("saves a base value and logs from → to", async () => {
    vi.mocked(vrepo.getBaseValue).mockResolvedValue(150);
    expect(await setBaseValueAction("s2", "p1", "200")).toEqual({ ok: true, data: undefined });
    expect(vrepo.upsertBaseValue).toHaveBeenCalledWith("s2", "p1", 200, "me");
    expect(repo.writeAudit).toHaveBeenCalledWith({
      actorPlayerId: "me", action: "klc.base_value", entityType: "player", entityId: "p1",
      diff: { seasonId: "s2", from: 150, to: 200 },
    });
  });

  it("refuses a negative or invalid base value, and an unknown season", async () => {
    expect((await setBaseValueAction("s2", "p1", "-5")).ok).toBe(false);
    expect((await setBaseValueAction("s2", "p1", "abc")).ok).toBe(false);
    expect((await setBaseValueAction("nope", "p1", "5")).ok).toBe(false);
  });

  it("sets and clears the official name", async () => {
    vi.mocked(vrepo.getKlcName).mockResolvedValue(null);
    expect((await setKlcNameAction("p1", " Patrick ")).ok).toBe(true);
    expect(vrepo.setKlcName).toHaveBeenCalledWith("p1", "Patrick");
    expect((await setKlcNameAction("p1", "x".repeat(61))).ok).toBe(false);
  });

  it("adds a change only with a non-zero amount, a note and a date inside the season", async () => {
    vi.mocked(vrepo.insertValueChange).mockResolvedValue("c1");
    expect((await addValueChangeAction("s2", "p1", "2026-12-05", "0", "x")).ok).toBe(false);
    expect((await addValueChangeAction("s2", "p1", "2026-12-05", "-30", "  ")).ok).toBe(false);
    expect((await addValueChangeAction("s2", "p1", "2026-11-30", "-30", "Ill")).ok).toBe(false);
    expect(await addValueChangeAction("s2", "p1", "2026-12-05", "-30", "Ill")).toEqual({ ok: true, data: undefined });
    expect(vrepo.insertValueChange).toHaveBeenCalledWith({
      seasonId: "s2", playerId: "p1", effectiveDate: "2026-12-05", amount: -30, note: "Ill", by: "me",
    });
    expect(repo.writeAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "klc.value_change", entityType: "klc_player_value_change", entityId: "c1",
    }));
  });

  it("voids a change with a note, once", async () => {
    vi.mocked(vrepo.getValueChange).mockResolvedValue({ id: "c1", voidedAt: null });
    expect((await voidValueChangeAction("c1", "")).ok).toBe(false);
    expect((await voidValueChangeAction("c1", "typo")).ok).toBe(true);
    expect(vrepo.voidValueChange).toHaveBeenCalledWith("c1", "me", "typo");
    vi.mocked(vrepo.getValueChange).mockResolvedValue({ id: "c1", voidedAt: "2026-12-06T00:00:00Z" });
    expect(await voidValueChangeAction("c1", "again")).toEqual({ ok: false, error: "That change is already voided." });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/klcsra/value-actions.test.ts`
Expected: FAIL, cannot find module `./value-actions`.

- [ ] **Step 3: Implement** (`value-actions.ts`)

```ts
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentPlayer, type CurrentPlayer } from "@/lib/auth/current-user";
import { canReopenMatch } from "./access";
import type { ActionResult } from "./actions";
import * as repo from "./repository";
import * as vrepo from "./value-repository";
import { parseAmount, parseKlcName, parseNote } from "./value-input";
import type { Season } from "./types";

/**
 * KFANDRA-only writes for the KLC register (spec 2026-11-22 §4). Each one
 * re-resolves the caller, checks `canReopenMatch` (KFANDRA or super_admin),
 * writes with the service role and appends to audit_log.
 */

const NOT_SIGNED_IN = "You must be signed in.";
const NOT_KFANDRA = "Only KFANDRA can change the register.";
const NO_SEASON = "Season not found.";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const OK: ActionResult = { ok: true, data: undefined };

function failed(e: unknown, fallback: string): ActionResult<never> {
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

function revalidateValues(): void {
  revalidatePath("/admin/klc/register");
  revalidatePath("/klc/league");
  revalidatePath("/klc/league/values", "layout");
}

async function requireKfandra(): Promise<ActionResult<CurrentPlayer>> {
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };
  if (!canReopenMatch(player)) return { ok: false, error: NOT_KFANDRA };
  return { ok: true, data: player };
}

async function findSeason(seasonId: string): Promise<Season | null> {
  return (await repo.listSeasons()).find((s) => s.id === seasonId) ?? null;
}

export async function setBaseValueAction(
  seasonId: string, playerId: string, raw: string,
): Promise<ActionResult> {
  const auth = await requireKfandra();
  if (!auth.ok) return auth;
  const value = parseAmount(raw);
  if (value === null || value < 0) return { ok: false, error: "Enter a value of 0 or more, up to 2 decimals." };
  try {
    if (!(await findSeason(seasonId))) return { ok: false, error: NO_SEASON };
    const from = await vrepo.getBaseValue(seasonId, playerId);
    if (from === value) return OK;
    await vrepo.upsertBaseValue(seasonId, playerId, value, auth.data.id);
    await repo.writeAudit({
      actorPlayerId: auth.data.id, action: "klc.base_value", entityType: "player", entityId: playerId,
      diff: { seasonId, from, to: value },
    });
    revalidateValues();
    return OK;
  } catch (e) {
    return failed(e, "Failed to save the base value.");
  }
}

export async function setKlcNameAction(playerId: string, raw: string): Promise<ActionResult> {
  const auth = await requireKfandra();
  if (!auth.ok) return auth;
  const parsed = parseKlcName(raw);
  if (!parsed.ok) return { ok: false, error: "Keep the name to 60 characters." };
  try {
    const from = await vrepo.getKlcName(playerId);
    if (from === parsed.value) return OK;
    await vrepo.setKlcName(playerId, parsed.value);
    await repo.writeAudit({
      actorPlayerId: auth.data.id, action: "klc.klc_name", entityType: "player", entityId: playerId,
      diff: { from, to: parsed.value },
    });
    revalidateValues();
    return OK;
  } catch (e) {
    return failed(e, "Failed to save the name.");
  }
}

export async function addValueChangeAction(
  seasonId: string, playerId: string, effectiveDate: string, rawAmount: string, rawNote: string,
): Promise<ActionResult> {
  const auth = await requireKfandra();
  if (!auth.ok) return auth;
  const amount = parseAmount(rawAmount);
  if (amount === null || amount === 0) return { ok: false, error: "Enter a plus or minus amount, not 0." };
  const note = parseNote(rawNote);
  if (note === null) return { ok: false, error: "Add a short note (up to 200 characters)." };
  if (!DATE_RE.test(effectiveDate ?? "")) return { ok: false, error: "Pick a valid date." };
  try {
    const season = await findSeason(seasonId);
    if (!season) return { ok: false, error: NO_SEASON };
    if (effectiveDate < season.startDate || (season.endDate !== null && effectiveDate > season.endDate)) {
      return { ok: false, error: "Pick a date inside the season." };
    }
    const id = await vrepo.insertValueChange({
      seasonId, playerId, effectiveDate, amount, note, by: auth.data.id,
    });
    await repo.writeAudit({
      actorPlayerId: auth.data.id, action: "klc.value_change", entityType: "klc_player_value_change",
      entityId: id, diff: { seasonId, playerId, effectiveDate, amount, note },
    });
    revalidateValues();
    return OK;
  } catch (e) {
    return failed(e, "Failed to add the change.");
  }
}

export async function voidValueChangeAction(changeId: string, rawNote: string): Promise<ActionResult> {
  const auth = await requireKfandra();
  if (!auth.ok) return auth;
  const note = parseNote(rawNote);
  if (note === null) return { ok: false, error: "Say why you are voiding it." };
  try {
    const c = await vrepo.getValueChange(changeId);
    if (!c) return { ok: false, error: "Change not found." };
    if (c.voidedAt !== null) return { ok: false, error: "That change is already voided." };
    await vrepo.voidValueChange(changeId, auth.data.id, note);
    await repo.writeAudit({
      actorPlayerId: auth.data.id, action: "klc.value_change_void", entityType: "klc_player_value_change",
      entityId: changeId, diff: { note },
    });
    revalidateValues();
    return OK;
  } catch (e) {
    return failed(e, "Failed to void the change.");
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/klcsra/value-actions.test.ts`
Expected: PASS (6 tests).

---

### Task 10: Strings and the Values tab

**Files:**
- Modify: `src/lib/klcsra/league-params.ts`, `src/content/strings.ts`, `src/app/klc/league/league-nav.tsx`, `src/app/klc/league/page.tsx`
- Create: `src/app/klc/league/values-tab.tsx`

- [ ] **Step 1: Add the tab** in `league-params.ts`:

```ts
export const LEAGUE_TABS = ["table", "matches", "leaders", "values", "seasons", "scoring"] as const;
```

- [ ] **Step 2: Strings** in `src/content/strings.ts`, inside `league`:
  - change `tabs` to `{ table: "Table", matches: "Matches", leaders: "Leaders", values: "Values", seasons: "Seasons", scoring: "Scoring" }`
  - add:

```ts
    values: {
      empty: "Values appear once KFANDRA has entered the base values for this season.",
      caption: "Player values",
      base: "Base value",
      current: "Current value",
      noChange: "No sessions yet",
      sessionTotal: "Session total",
      valueAfter: "Value after",
      stoppedAtZero: "Stopped at 0",
      kfandraChange: "KFANDRA's change",
      officialFriendly: "Official friendly",
      league: "League",
      free: (n: number, of: number) => `Free small-sided match ${n} of ${of}`,
      result: { win: "Win", draw: "Draw", loss: "Loss" } as Record<string, string>,
      noResult: "No result",
      back: "← Values",
      notFound: "This player isn't in the register for this season.",
    },
```

  and inside `admin`, next to `klcSeasonsCard`:

```ts
    klcRegisterCard: { title: "Register", subtitle: "Player base values & official names" },
```

- [ ] **Step 3: Six tabs** in `league-nav.tsx`: change `grid-cols-5` to `grid-cols-6` in `TabBar`.

- [ ] **Step 4: Create `values-tab.tsx`**

```tsx
import Link from "next/link";
import { strings } from "@/content/strings";
import { formatChange, formatKr, rankValues, type PlayerValue } from "@/lib/klcsra/player-values";
import { Empty } from "./league-nav";

/** KLC League › Values (spec 2026-11-22 §6): everyone, ranked by current value. */
export function ValuesTab({ values, seasonId }: { values: PlayerValue[]; seasonId: string }) {
  const ranked = rankValues(values);
  const v = strings.league.values;
  if (ranked.length === 0) return <Empty text={v.empty} testId="values-empty" />;
  return (
    <ol aria-label={v.caption} className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
      {ranked.map((p, i) => (
        <li key={p.playerId}>
          <Link
            href={`/klc/league/values/${p.playerId}?season=${seasonId}`}
            data-testid="values-row"
            data-player-id={p.playerId}
            className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50"
          >
            <span className="w-5 shrink-0 text-right text-[12px] font-bold text-gray-500">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-gray-900">{p.name}</span>
              <span className="block truncate text-[11px] text-gray-600">{p.clubName}</span>
            </span>
            <span className="shrink-0 text-right">
              <span data-testid="values-current" className="block text-[13px] font-bold text-gray-900">
                {formatKr(p.current!)}
              </span>
              {p.lastSession && (
                <span
                  className={`block text-[11px] ${p.lastSession.change < 0 ? "text-red-700" : "text-green-700"}`}
                >
                  {p.lastSession.change < 0 ? "▼" : p.lastSession.change > 0 ? "▲" : "•"}{" "}
                  {formatChange(p.lastSession.change)} · {p.lastSession.date.slice(8)}/{p.lastSession.date.slice(5, 7)}
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 5: Render it** in `src/app/klc/league/page.tsx`. Add imports:

```ts
import { loadSeasonValues } from "@/lib/klcsra/value-repository";
import { ValuesTab } from "./values-tab";
```

In the `else` branch (inside `if (!season) … else {`), put the Values branch before `listSubmittedMatchDrafts` so the tab does not load the drafts twice. Replace

```ts
    const drafts = await listSubmittedMatchDrafts(season);
    if (params.tab === "matches") {
```

with

```ts
    if (params.tab === "values") {
      const { values } = await loadSeasonValues(season);
      body = <ValuesTab values={values} seasonId={season.id} />;
    } else {
    const drafts = await listSubmittedMatchDrafts(season);
    if (params.tab === "matches") {
```

and add one closing `}` after the existing table branch's closing `}`, so the old `matches / leaders / table` chain sits inside the new `else`. Indent that inner block one level deeper (the repo has no Prettier; lint must stay clean).

- [ ] **Step 6: Check**

Run: `npx tsc --noEmit && npx vitest run src/lib/klcsra/league-params.test.ts`
Expected: no type errors; PASS. (If a league-params test lists the tabs, add `"values"` in the same position.)

---

### Task 11: Player value history page

**Files:**
- Create: `src/app/klc/league/values/[playerId]/page.tsx`

- [ ] **Step 1: Implement**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { strings } from "@/content/strings";
import { getCurrentPlayer } from "@/lib/auth/current-user";
import { loadValueRules } from "@/lib/klcsra/config";
import { defaultSeasonId } from "@/lib/klcsra/league-params";
import { formatChange, formatKr } from "@/lib/klcsra/player-values";
import { listSeasons } from "@/lib/klcsra/repository";
import { STAT_LABELS } from "@/lib/klcsra/stat-rates";
import { loadSeasonValues } from "@/lib/klcsra/value-repository";

export const dynamic = "force-dynamic";

/** One player's value, session by session, newest first (spec 2026-11-22 §6). */
export default async function PlayerValuePage({
  params, searchParams,
}: {
  params: Promise<{ playerId: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { playerId } = await params;
  const { season: seasonParam } = await searchParams;
  const player = await getCurrentPlayer();
  if (!player) redirect(`/login?next=/klc/league/values/${playerId}`);

  const [seasons, rules] = await Promise.all([listSeasons(), loadValueRules()]);
  const seasonId = seasons.some((s) => s.id === seasonParam) ? seasonParam! : defaultSeasonId(seasons);
  const season = seasons.find((s) => s.id === seasonId) ?? null;
  const v = strings.league.values;
  const back = `/klc/league?tab=values${season ? `&season=${season.id}` : ""}`;

  const value = season ? (await loadSeasonValues(season)).values.find((x) => x.playerId === playerId) : undefined;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-5 pb-24">
      <Breadcrumb label={strings.league.breadcrumb} />
      <Link href={back} className="text-[12px] text-gray-600 hover:underline">{v.back}</Link>
      {!value || value.current === null ? (
        <p data-testid="value-not-found" className="text-sm text-gray-600">{v.notFound}</p>
      ) : (
        <>
          <header className="rounded-xl border border-gray-200 bg-white p-4">
            <h1 className="text-xl font-black text-gray-900">{value.name}</h1>
            <p className="text-[12px] text-gray-600">{value.clubName}</p>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
              <div><dt className="text-gray-500">{v.base}</dt><dd className="font-bold">{formatKr(value.baseValue!)}</dd></div>
              <div><dt className="text-gray-500">{v.current}</dt><dd data-testid="value-current" className="font-bold">{formatKr(value.current)}</dd></div>
            </dl>
          </header>
          {value.sessions.length === 0 && <p className="text-[12px] text-gray-600">{v.noChange}</p>}
          {[...value.sessions].reverse().map((s) => (
            <section key={s.date} data-testid="value-session" data-date={s.date} className="rounded-xl border border-gray-200 bg-white p-3 text-[12px]">
              <h2 className="font-bold text-gray-900">{s.date}</h2>
              <ul className="mt-1 space-y-1">
                {s.matches.map((m) => (
                  <li key={m.matchId}>
                    <p className="font-semibold">
                      {m.label} · {m.kind === "league" ? v.league : v.officialFriendly}
                    </p>
                    {m.smallSidedFree !== null ? (
                      <p className="text-gray-600">{v.free(m.smallSidedFree, rules.smallSided.freeMatches)}</p>
                    ) : (
                      <p className="text-gray-700">
                        {m.result ? `${v.result[m.result]} ${formatChange(m.resultChange)}` : v.noResult}
                        {m.stats.map((st) => ` · ${STAT_LABELS[st.statKey]} ×${st.count} ${formatChange(st.change)}`).join("")}
                      </p>
                    )}
                  </li>
                ))}
                {s.changes.map((c) => (
                  <li key={c.id} data-testid="value-change-line">
                    {v.kfandraChange}: {formatChange(c.amount)} · {c.note}
                  </li>
                ))}
              </ul>
              <p className="mt-2 flex justify-between border-t border-gray-100 pt-1">
                <span>{v.sessionTotal} {formatChange(s.total)}</span>
                <span className="font-bold">{v.valueAfter} {formatKr(s.valueAfter)}</span>
              </p>
              {s.hitFloor && <p className="text-red-700">{v.stoppedAtZero}</p>}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Check**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

---

### Task 12: Admin › KLC › Register

**Files:**
- Create: `src/app/admin/klc/register/page.tsx`, `src/app/admin/klc/register/register-admin.tsx`
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Admin card** in `src/app/admin/page.tsx`, after the seasons card:

```ts
    { href: "/admin/klc/register", ...admin.klcRegisterCard },
```

- [ ] **Step 2: Page** (`register/page.tsx`)

```tsx
import { getCurrentPlayer } from "@/lib/auth/current-user";
import { canReopenMatch } from "@/lib/klcsra/access";
import { listSeasons } from "@/lib/klcsra/repository";
import { loadSeasonValues } from "@/lib/klcsra/value-repository";
import type { Season } from "@/lib/klcsra/types";
import RegisterAdmin from "./register-admin";

export const dynamic = "force-dynamic";

/** The active season, else the earliest upcoming one, else the newest. */
function defaultRegisterSeason(seasons: Season[]): Season | null {
  return seasons.find((s) => s.status === "active")
    ?? [...seasons].filter((s) => s.status === "upcoming").sort((a, b) => a.seasonNo - b.seasonNo)[0]
    ?? [...seasons].sort((a, b) => b.seasonNo - a.seasonNo)[0]
    ?? null;
}

/**
 * Admin › KLC › Register (spec 2026-11-22 §4). KFANDRA and super_admin only;
 * the admin layout lets staff in, so the page checks again. The actions check
 * on every write regardless.
 */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const player = await getCurrentPlayer();
  if (!player || !canReopenMatch(player)) {
    return <p data-testid="register-refused" className="text-sm text-gray-600">Only KFANDRA can open the register.</p>;
  }
  const { season: seasonParam } = await searchParams;
  const seasons = await listSeasons();
  const season = seasons.find((s) => s.id === seasonParam) ?? defaultRegisterSeason(seasons);
  if (!season) return <p className="text-sm text-gray-600">Create a season first.</p>;
  const { register, changes, values } = await loadSeasonValues(season);
  return (
    <RegisterAdmin seasons={seasons} season={season} register={register} changes={changes} values={values} />
  );
}
```

- [ ] **Step 3: Client component** (`register/register-admin.tsx`)

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import type { ActionResult } from "@/lib/klcsra/actions";
import { formatChange, formatKr, type PlayerValue, type RegisterPlayer, type ValueChange } from "@/lib/klcsra/player-values";
import type { Season } from "@/lib/klcsra/types";
import {
  addValueChangeAction, setBaseValueAction, setKlcNameAction, voidValueChangeAction,
} from "@/lib/klcsra/value-actions";

/**
 * The KLC register: one row per manager of an active club. Plain forms in
 * the house style (see seasons-admin.tsx); every action error is shown
 * verbatim next to its row.
 */
export default function RegisterAdmin({
  seasons, season, register, changes, values,
}: {
  seasons: Season[]; season: Season; register: RegisterPlayer[];
  changes: ValueChange[]; values: PlayerValue[];
}) {
  const hydrated = useHydrated();
  const router = useRouter();
  const valueOf = new Map(values.map((v) => [v.playerId, v]));
  return (
    <div data-testid="register-admin" data-hydrated={hydrated} className="space-y-4">
      <Link href="/admin/klc" className="text-[12px] text-gray-600 hover:underline">← KLC admin</Link>
      <div className="flex items-end justify-between gap-2">
        <h2 className="text-lg font-bold text-gray-900">Register</h2>
        <select
          data-testid="register-season"
          value={season.id}
          onChange={(e) => router.push(`/admin/klc/register?season=${e.target.value}`)}
          className="rounded-lg border border-gray-300 px-2 py-1 text-[12px]"
        >
          {seasons.map((s) => <option key={s.id} value={s.id}>S{s.seasonNo} · {s.name} ({s.status})</option>)}
        </select>
      </div>
      <p className="text-[11px] text-gray-600">
        Each manager&apos;s base value and official name for this season. Values move with every
        league match and official friendly.
      </p>
      <ul className="space-y-3">
        {register.map((p) => (
          <RegisterRow
            key={p.playerId}
            season={season}
            player={p}
            value={valueOf.get(p.playerId)}
            changes={changes.filter((c) => c.playerId === p.playerId)}
          />
        ))}
      </ul>
    </div>
  );
}

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setError(null);
        after?.();
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  return { pending, error, run };
}

function RegisterRow({
  season, player, value, changes,
}: {
  season: Season; player: RegisterPlayer; value: PlayerValue | undefined; changes: ValueChange[];
}) {
  const { pending, error, run } = useAction();
  const [name, setName] = useState(player.klcName ?? "");
  const [base, setBase] = useState(player.baseValue === null ? "" : String(player.baseValue));
  const [open, setOpen] = useState(false);

  return (
    <li data-testid="register-row" data-player-id={player.playerId} className="rounded-xl border border-gray-200 bg-white p-3 text-[12px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-gray-900">{player.displayName} · {player.clubName}</p>
        <p className="text-gray-700">
          {value?.current != null ? (
            <>Now <span data-testid="register-current" className="font-bold">{formatKr(value.current)}</span>
              {value.lastSession && <> · last {formatChange(value.lastSession.change)}</>}</>
          ) : null}
        </p>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {player.baseValue === null && <Flag testId="register-flag-nobase" text="No base value yet" />}
        {value?.playedWithoutBase && <Flag testId="register-flag-played" text="Played without a base value" />}
        {player.manyClubs && <Flag testId="register-flag-clubs" text="Manages more than one club" />}
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
        <input data-testid="name-input" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Official KLC name" aria-label="Official KLC name"
          className="rounded-lg border border-gray-300 px-2 py-1" />
        <button data-testid="name-save" disabled={pending}
          onClick={() => run(() => setKlcNameAction(player.playerId, name))}
          className="rounded-lg bg-gray-900 px-3 py-1 font-semibold text-white disabled:opacity-50">Save name</button>
        <input data-testid="base-input" value={base} onChange={(e) => setBase(e.target.value)} inputMode="decimal"
          placeholder="Base value (KR)" aria-label="Base value"
          className="rounded-lg border border-gray-300 px-2 py-1" />
        <button data-testid="base-save" disabled={pending}
          onClick={() => run(() => setBaseValueAction(season.id, player.playerId, base))}
          className="rounded-lg bg-gray-900 px-3 py-1 font-semibold text-white disabled:opacity-50">Save value</button>
      </div>
      {error && <p data-testid="register-error" role="alert" className="mt-1 text-red-700">{error}</p>}
      <button data-testid="changes-toggle" onClick={() => setOpen(!open)} className="mt-2 text-blue-700 hover:underline">
        {open ? "Hide" : "Value changes"} ({changes.filter((c) => c.voidedAt === null).length})
      </button>
      {open && <Changes season={season} playerId={player.playerId} changes={changes} />}
    </li>
  );
}

function Flag({ testId, text }: { testId: string; text: string }) {
  return <span data-testid={testId} className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">{text}</span>;
}

function Changes({ season, playerId, changes }: { season: Season; playerId: string; changes: ValueChange[] }) {
  const { pending, error, run } = useAction();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [voiding, setVoiding] = useState<string | null>(null);
  const [voidNote, setVoidNote] = useState("");

  return (
    <div className="mt-2 space-y-2 border-t border-gray-100 pt-2">
      <ul className="space-y-1">
        {changes.map((c) => (
          <li key={c.id} data-testid="change-row" data-voided={c.voidedAt !== null}
            className={c.voidedAt ? "text-gray-400 line-through" : "text-gray-800"}>
            {c.effectiveDate} · {formatChange(c.amount)} · {c.note}
            {c.voidedAt && <span className="no-underline"> (voided: {c.voidNote})</span>}
            {!c.voidedAt && voiding !== c.id && (
              <button data-testid="change-void" onClick={() => setVoiding(c.id)} className="ml-2 text-red-700 hover:underline">Void</button>
            )}
            {voiding === c.id && (
              <span className="ml-2 inline-flex gap-1">
                <input data-testid="void-note" value={voidNote} onChange={(e) => setVoidNote(e.target.value)}
                  placeholder="Why?" className="rounded border border-gray-300 px-1" />
                <button data-testid="void-confirm" disabled={pending}
                  onClick={() => run(() => voidValueChangeAction(c.id, voidNote), () => { setVoiding(null); setVoidNote(""); })}
                  className="text-red-700">Confirm</button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2">
        <input data-testid="change-date" type="date" value={date} min={season.startDate} max={season.endDate ?? undefined}
          onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1" />
        <input data-testid="change-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal"
          placeholder="+/− amount" className="rounded-lg border border-gray-300 px-2 py-1" />
        <input data-testid="change-note" value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Note (required)" className="col-span-2 rounded-lg border border-gray-300 px-2 py-1" />
        <button data-testid="change-add" disabled={pending}
          onClick={() => run(() => addValueChangeAction(season.id, playerId, date, amount, note), () => { setAmount(""); setNote(""); })}
          className="col-span-2 rounded-lg bg-gray-900 px-3 py-1 font-semibold text-white disabled:opacity-50">Add change</button>
      </div>
      {error && <p data-testid="change-error" role="alert" className="text-red-700">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 4: Check**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

---

### Task 13: End-to-end tests

**Files:**
- Create: `e2e/klc-player-values.spec.ts`

Prerequisites: Docker running, `npx supabase start`, migrations applied (Task 1).

- [ ] **Step 1: Write the spec**

```ts
import { test, expect, type Page } from "./fixtures";
import { openAs, seedPlayer, signIn } from "./helpers/auth";
import * as db from "./helpers/db";
import * as rec from "./helpers/recorder";

/**
 * KLC player register and values (spec 2026-11-22 §8, Helper-bsr.18).
 * Local Supabase only. Every match here has 2 players, so the small-sided
 * rule is switched off for the suite and restored afterwards.
 */
const SEASON = "KLCFERRSXVSG2";
const DATE = "2026-08-23"; // inside Season 2's window (starts 2026-08-22)

let seasonsBefore: db.SeasonRow[];
let rulesBefore: unknown;

test.beforeEach(async () => {
  seasonsBefore = await db.snapshotSeasons();
  await db.resetKlcsraData();
  await db.activateSeason(SEASON);
  rulesBefore = (await db.sql<{ v: unknown }>(`select value as v from app_config where key = 'klc_value_rules'`))[0]?.v;
  await db.sql(`update app_config set value = jsonb_set(value, '{smallSided,enabled}', 'false') where key = 'klc_value_rules'`);
});

test.afterEach(async () => {
  await db.sql(`update app_config set value = $1::jsonb where key = 'klc_value_rules'`, [JSON.stringify(rulesBefore)]);
  await db.resetKlcsraData();
  await db.restoreSeasons(seasonsBefore);
});

async function seasonId(): Promise<string> {
  return (await db.findSeason(SEASON)).id;
}

async function setBase(playerId: string, value: number): Promise<void> {
  await db.sql(
    `insert into klc_player_base_values (season_id, player_id, base_value) values ($1, $2, $3)`,
    [await seasonId(), playerId, value]);
}

/** A submitted 2–1 football league win: `mgr` plays for home and scores 2. */
async function recordWin(page: Page, home: db.ClubRow, away: db.ClubRow, mgrId: string) {
  const other = await seedPlayer("user", "E2E V Other");
  const id = await rec.createMatch(page, { date: DATE, sport: "football" });
  await rec.pickClub(page, 1, "home", home.id);
  await rec.pickClub(page, 1, "away", away.id);
  await rec.setScore(page, 1, "home", 2);
  await rec.setScore(page, 1, "away", 1);
  await rec.addPlayer(page, "home", mgrId);
  await rec.addPlayer(page, "away", other.id);
  await rec.recordStats(page, "home", mgrId, { goal: 2 });
  await rec.submitMatch(page);
  return id;
}

test("KFANDRA enters a base value and name on the register; an admin is refused", async ({ browser }) => {
  const [a] = await db.listClubs(1);
  const mgr = await seedPlayer("user", "E2E V Mgr");
  await db.setClubManager(a.id, mgr.id);

  const k = await openAs(browser, "kfandra", "E2E V KFANDRA");
  try {
    await k.page.goto("/admin/klc/register");
    const row = k.page.locator(`[data-testid="register-row"][data-player-id="${mgr.id}"]`);
    await expect(k.page.getByTestId("register-admin")).toHaveAttribute("data-hydrated", "true");
    await expect(row.getByTestId("register-flag-nobase")).toBeVisible();

    await row.getByTestId("base-input").fill("250");
    await row.getByTestId("base-save").click();
    await expect(row.getByTestId("register-flag-nobase")).toHaveCount(0);
    await expect(row.getByTestId("register-current")).toHaveText("250 KR");

    await row.getByTestId("name-input").fill("E2E Official");
    await row.getByTestId("name-save").click();
    await expect.poll(async () =>
      (await db.sql<{ n: string | null }>(`select klc_name as n from players where id = $1`, [mgr.id]))[0]?.n,
    ).toBe("E2E Official");

    const log = await db.sql<{ n: number }>(
      `select count(*)::int as n from audit_log where action in ('klc.base_value','klc.klc_name') and entity_id = $1`, [mgr.id]);
    expect(log[0].n).toBe(2);
  } finally {
    await k.context.close();
  }

  const admin = await openAs(browser, "admin", "E2E V Admin");
  try {
    await admin.page.goto("/admin/klc/register");
    await expect(admin.page.getByTestId("register-refused")).toBeVisible();
  } finally {
    await admin.context.close();
  }
});

test("a submitted league match changes the values on the Values tab", async ({ browser }) => {
  const [a, b] = await db.listClubs(2);
  const mgr = await seedPlayer("user", "E2E V Scorer");
  await db.setClubManager(a.id, mgr.id);
  await setBase(mgr.id, 200);

  const k = await openAs(browser, "kfandra", "E2E V KFANDRA");
  try {
    await recordWin(k.page, a, b, mgr.id);
  } finally {
    await k.context.close();
  }

  const context = await browser.newContext();
  await signIn(context, await seedPlayer("user", "E2E V Viewer"));
  const page = await context.newPage();
  try {
    await page.goto(`/klc/league?tab=values&season=${await seasonId()}`);
    const row = page.locator(`[data-testid="values-row"][data-player-id="${mgr.id}"]`);
    // win +20, 2 goals +4
    await expect(row.getByTestId("values-current")).toHaveText("224 KR");
  } finally {
    await context.close();
  }
});

test("KFANDRA adds a dated change and the history shows it", async ({ browser }) => {
  const [a] = await db.listClubs(1);
  const mgr = await seedPlayer("user", "E2E V Changed");
  await db.setClubManager(a.id, mgr.id);
  await setBase(mgr.id, 300);

  const k = await openAs(browser, "kfandra", "E2E V KFANDRA");
  try {
    await k.page.goto("/admin/klc/register");
    await expect(k.page.getByTestId("register-admin")).toHaveAttribute("data-hydrated", "true");
    const row = k.page.locator(`[data-testid="register-row"][data-player-id="${mgr.id}"]`);
    await row.getByTestId("changes-toggle").click();
    await row.getByTestId("change-date").fill(DATE);
    await row.getByTestId("change-amount").fill("-40");
    await row.getByTestId("change-note").fill("Ill for two weeks");
    await row.getByTestId("change-add").click();
    await expect(row.getByTestId("change-row")).toHaveCount(1);
    await expect(row.getByTestId("register-current")).toHaveText("260 KR");

    await k.page.goto(`/klc/league/values/${mgr.id}?season=${await seasonId()}`);
    await expect(k.page.getByTestId("value-current")).toHaveText("260 KR");
    await expect(k.page.getByTestId("value-change-line")).toContainText("Ill for two weeks");
  } finally {
    await k.context.close();
  }
});
```

- [ ] **Step 2: Run**

Run: `npx playwright test e2e/klc-player-values.spec.ts`
Expected: 3 passed. If `resetKlcsraData` does not delete value changes for seeded players, check: both tables cascade on `players` delete, and `resetKlcsraData` deletes seeded players, so rows go with them.

- [ ] **Step 3: Re-run the neighbouring suites**

Run: `npx playwright test e2e/klc-league.spec.ts e2e/klc-friendly-mark.spec.ts e2e/klc-match-workflow.spec.ts`
Expected: all pass. The league tab bar now has 6 tabs; if a test counts tabs, update it.

---

### Task 14: Guides

**Files:**
- Modify: `docs/klc-league-guide.md`, `docs/admin-guide.md`
- Rebuild: `docs/klc-league-guide.pdf`, `docs/admin-guide.pdf`

- [ ] **Step 1: League guide.** Add a `## Player values` section after the "Official and unofficial friendlies" section, in the guide's existing plain style. Content (keep it in KFANDRA's terms, "KFANDRA", never "Coach"):
  - What counts: league matches once official, and official friendlies. Unofficial friendlies don't.
  - The table: win +20, draw +5, loss −10; goal/try/conversion (main or rebound goals included) +2; assist +1; pre-assist +0.5; save +2; yellow −10, red −20, blue −50; tackles and late challenges no change.
  - The session total applies at the end of the day; a value never drops below 0.
  - Small-sided matches (fewer than 7 players in total): a player's first 5 in a season change nothing.
  - Where to see it: KLC League › Values, tap a player for their history.
  - Sir's example: 200 → 223 → 203.

- [ ] **Step 2: Admin guide.** Add a `## KLC register` section: who can open it (KFANDRA), the season picker, base value and official name per manager, the three flags, adding a dated change with a note, voiding with a note (nothing is deleted).

- [ ] **Step 3: Rebuild the PDFs**

Run: `npm run docs:pdf:league && npm run docs:pdf:admin`
Expected: both PDFs regenerate without errors.

---

### Task 15: Gates, commit and PR

- [ ] **Step 1: Quality gates**

Run:
```bash
npm run lint && npx tsc --noEmit && npm run test
npx playwright test e2e/klc-player-values.spec.ts e2e/klc-league.spec.ts e2e/klc-friendly-mark.spec.ts e2e/klc-match-workflow.spec.ts e2e/klcsra-recorder.spec.ts
```
Expected: all clean and passing.

- [ ] **Step 2: Confidentiality check**

Run the check from the bd memories (`bd memories confidential`) over `git diff main`.
Expected: no hits beyond HTML tags.

- [ ] **Step 3: One squashed commit**

```bash
git add -A
git commit -m "feat(klc): player register and player values (Helper-bsr.18)

KFANDRA sets each manager's base value and official KLC name per season
(Admin > KLC > Register) and can add or void dated value changes. Values
are worked out on read from league matches and official friendlies, and
everyone sees them on KLC League > Values with a per-player history.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014HoLJwYYKJ74Cxhx7k5fZq"
```

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin feat/klc-player-register
gh pr create --base main --title "KLC: player register and player values (Helper-bsr.18)" --body "..."
```
The body lists what ships, the migration (`20261125120000_klc_player_values.sql`), the test results, and the post-merge steps: **run `npx supabase db push` on prod straight after merging** (the deployed code reads the new tables), then give KFANDRA a heads-up. End it with the generated-with footer.

- [ ] **Step 5: bd**

```bash
bd update Helper-bsr.18 --notes "PR open; after merge: prod db push, heads-up to KFANDRA, then enter base values"
bd dolt push
```
