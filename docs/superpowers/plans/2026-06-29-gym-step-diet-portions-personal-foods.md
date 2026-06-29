# Gym 0.5 Stepper, Diet Half-Portions & Personal "My Foods" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the gym weight stepper move by 0.5 kg / 1 lb, let diet portions go in 0.5 steps (min 0.5), and give each player a personal auto-saved "My foods" list (cap 8, least-used eviction) for one-tap re-logging of their customs.

**Architecture:** Three independent slices. (1) Gym: change one pure function. (2) Diet portions: extract the inline draft mutators to a tested `lib/diet/draft.ts` and switch the steppers to 0.5. (3) Personal foods: a new `player_food_items` table + RLS, a pure eviction helper, a repository (load + upsert-with-eviction), a server action, and a "Your foods" chip section wired into the existing diet page. Logged days still snapshot custom name/unit inline in `diet_log_items` — the personal table is purely a reusable palette.

**Tech Stack:** Next.js 14 App Router, TypeScript (strict), Supabase (Postgres + RLS, service-role admin client for server actions), Vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-06-29-gym-step-diet-portions-personal-foods-design.md`

---

## File Structure

**Modify:**
- `src/lib/gym/types.ts` — `weightStep` returns 0.5 / 1.
- `src/lib/gym/sets.test.ts` — updated expectations.
- `src/app/diet/diet-entry.tsx` — import mutators from new `draft.ts`; steppers use 0.5; custom-sheet quantity uses 0.5/min 0.5; new "Your foods" section; auto-save personal food on custom add / chip tap; thread `personalFoods` state.
- `src/lib/diet/types.ts` — new `PlayerFoodItem` type.
- `src/app/diet/page.tsx` — load + pass `initialPersonalFoods`.

**Create:**
- `src/lib/diet/draft.ts` — pure draft mutators (moved out of the component) + `stepCustomQuantity` + `tapPersonalFood`.
- `src/lib/diet/draft.test.ts` — tests for the mutators and 0.5 stepping.
- `src/lib/diet/personal-foods.ts` — `MAX_PERSONAL_FOODS`, pure `selectEvicteeId`.
- `src/lib/diet/personal-foods.test.ts` — eviction tests.
- `src/lib/diet/personal-foods-repository.ts` — `loadPlayerFoods`, `upsertPlayerFood`.
- `supabase/migrations/20260629120000_player_food_items.sql` — table, indexes, RLS.
- New server action in `src/lib/diet/actions.ts` — `savePlayerFoodAction`.

---

## Task 1: Gym — 0.5 kg / 1 lb weight step

**Files:**
- Modify: `src/lib/gym/types.ts:72-75`
- Test: `src/lib/gym/sets.test.ts:49-56`

- [ ] **Step 1: Update the failing test first**

In `src/lib/gym/sets.test.ts`, replace the `stepSetWeight` describe block (lines 49-56) with the new expected steps:

```ts
describe("stepSetWeight", () => {
  it("steps weight by the unit step (0.5 kg / 1 lb) and floors at 0", () => {
    const sets = [{ reps: 8, weight: 0 }];
    expect(stepSetWeight(sets, 0, 1, "lb")[0].weight).toBe(1);
    expect(stepSetWeight(sets, 0, 1, "kg")[0].weight).toBe(0.5);
    expect(stepSetWeight(sets, 0, -1, "lb")[0].weight).toBe(0); // floored
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- src/lib/gym/sets.test.ts`
Expected: FAIL — `expected 2 to be 0.5` (old step still returns 2 / 5).

- [ ] **Step 3: Change the step**

In `src/lib/gym/types.ts`, replace lines 72-75:

```ts
/** Weight increment per tap for a unit (0.5 kg / 1 lb). */
export function weightStep(unit: WeightUnit): number {
  return unit === "kg" ? 0.5 : 1;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/lib/gym/sets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gym/types.ts src/lib/gym/sets.test.ts
git commit -m "feat(gym): step weight by 0.5 kg / 1 lb per tap"
```

---

## Task 2: Diet — extract draft mutators to a tested lib module

This is a no-behaviour-change refactor that makes the diet draft logic unit-testable. Move the six pure mutators currently inline in `diet-entry.tsx` (lines 35-102) into `src/lib/diet/draft.ts`, export them, and import them back.

**Files:**
- Create: `src/lib/diet/draft.ts`
- Modify: `src/app/diet/diet-entry.tsx` (remove the inline mutators, import them)
- Test: `src/lib/diet/draft.test.ts`

- [ ] **Step 1: Create `src/lib/diet/draft.ts` with the moved mutators**

```ts
import type { DietDraft, LoggedItem, MealLog } from "./types";

/**
 * Pure mutators over the sparse, key-addressed diet draft. Extracted from the
 * client form so the behaviour (incl. 0.5 portion stepping) is unit-tested and
 * the component stays declarative. None of these touch the DB.
 */

export function setMealIn(
  draft: DietDraft,
  slotKey: string,
  meal: MealLog,
): DietDraft {
  return { ...draft, meals: { ...draft.meals, [slotKey]: meal } };
}

function emptyMeal(): MealLog {
  return { skipped: false, items: [] };
}

function getMeal(draft: DietDraft, slotKey: string): MealLog {
  return draft.meals[slotKey] ?? emptyMeal();
}

export function tapFood(
  draft: DietDraft,
  slotKey: string,
  foodKey: string,
): DietDraft {
  const meal = getMeal(draft, slotKey);
  const existing = meal.items.find((it) => it.foodKey === foodKey);
  const items = existing
    ? meal.items.map((it) =>
        it.foodKey === foodKey ? { ...it, count: it.count + 1 } : it,
      )
    : [
        ...meal.items,
        { id: `${foodKey}-${Date.now()}`, foodKey, count: 1 } as LoggedItem,
      ];
  return setMealIn(draft, slotKey, { skipped: false, items });
}

export function adjustLogged(
  draft: DietDraft,
  slotKey: string,
  loggedId: string,
  delta: number,
): DietDraft {
  const meal = getMeal(draft, slotKey);
  const items = meal.items
    .map((it) => (it.id === loggedId ? { ...it, count: it.count + delta } : it))
    .filter((it) => it.count > 0);
  return setMealIn(draft, slotKey, { ...meal, items });
}

export function removeLogged(
  draft: DietDraft,
  slotKey: string,
  loggedId: string,
): DietDraft {
  const meal = getMeal(draft, slotKey);
  return setMealIn(draft, slotKey, {
    ...meal,
    items: meal.items.filter((it) => it.id !== loggedId),
  });
}

export function addCustomItem(
  draft: DietDraft,
  slotKey: string,
  custom: { name: string; quantity: number; unit: string; notes?: string },
): DietDraft {
  const meal = getMeal(draft, slotKey);
  const item: LoggedItem = {
    id: `custom-${Date.now()}`,
    foodKey: null,
    customName: custom.name,
    customUnit: custom.unit,
    customNotes: custom.notes,
    count: custom.quantity,
  };
  return setMealIn(draft, slotKey, {
    skipped: false,
    items: [...meal.items, item],
  });
}

export function setSkipped(
  draft: DietDraft,
  slotKey: string,
  skipped: boolean,
): DietDraft {
  const meal = getMeal(draft, slotKey);
  return setMealIn(draft, slotKey, {
    ...meal,
    skipped,
    items: skipped ? [] : meal.items,
  });
}
```

- [ ] **Step 2: Remove the inline copies from `diet-entry.tsx`**

In `src/app/diet/diet-entry.tsx`, delete the whole block from the comment `/* ── Pure draft mutators ... */` through the end of `setSkipped` (lines 33-102), and add the import. The component already imports `getMeal`, `emptyDraft` from `./types` (keep those). Add at the top with the other imports:

```ts
import {
  tapFood,
  adjustLogged,
  removeLogged,
  addCustomItem,
  setSkipped,
} from "@/lib/diet/draft";
```

- [ ] **Step 3: Run the build/tests to confirm no behaviour change**

Run: `npm run test && npx tsc --noEmit`
Expected: PASS (existing diet `summary.test.ts` still green; no type errors).

- [ ] **Step 4: Add `src/lib/diet/draft.test.ts` for current behaviour**

```ts
import { describe, it, expect } from "vitest";
import { emptyDraft } from "./types";
import { tapFood, adjustLogged, addCustomItem } from "./draft";

describe("tapFood", () => {
  it("adds a catalogue item at count 1, then merges on re-tap", () => {
    let d = tapFood(emptyDraft(), "lunch", "roti");
    expect(d.meals.lunch.items).toHaveLength(1);
    expect(d.meals.lunch.items[0].count).toBe(1);
    d = tapFood(d, "lunch", "roti");
    expect(d.meals.lunch.items).toHaveLength(1);
    expect(d.meals.lunch.items[0].count).toBe(2);
  });
});

describe("adjustLogged", () => {
  it("removes an item once its count drops to 0", () => {
    const start = tapFood(emptyDraft(), "lunch", "roti");
    const id = start.meals.lunch.items[0].id;
    const out = adjustLogged(start, "lunch", id, -1);
    expect(out.meals.lunch.items).toHaveLength(0);
  });
});

describe("addCustomItem", () => {
  it("appends a custom item carrying name/unit/notes/quantity", () => {
    const out = addCustomItem(emptyDraft(), "lunch", {
      name: "Protein shake",
      quantity: 1,
      unit: "glass",
      notes: "post workout",
    });
    const item = out.meals.lunch.items[0];
    expect(item.foodKey).toBeNull();
    expect(item.customName).toBe("Protein shake");
    expect(item.count).toBe(1);
  });
});
```

- [ ] **Step 5: Run and commit**

Run: `npm run test -- src/lib/diet/draft.test.ts`
Expected: PASS.

```bash
git add src/lib/diet/draft.ts src/lib/diet/draft.test.ts src/app/diet/diet-entry.tsx
git commit -m "refactor(diet): extract draft mutators to lib/diet/draft with tests"
```

---

## Task 3: Diet — half portions (0.5 step, min 0.5)

**Files:**
- Modify: `src/lib/diet/draft.ts` (add `stepCustomQuantity`)
- Modify: `src/app/diet/diet-entry.tsx` (logged-row steppers → 0.5; custom-sheet quantity → 0.5/min 0.5)
- Test: `src/lib/diet/draft.test.ts`

- [ ] **Step 1: Write failing tests for 0.5 stepping**

Append to `src/lib/diet/draft.test.ts`:

```ts
import { stepCustomQuantity } from "./draft";

describe("adjustLogged — half portions", () => {
  it("steps a logged item by 0.5 and removes it at 0", () => {
    const start = addCustomItem(emptyDraft(), "lunch", {
      name: "Rice",
      quantity: 1,
      unit: "waati",
    });
    const id = start.meals.lunch.items[0].id;
    const half = adjustLogged(start, "lunch", id, -0.5);
    expect(half.meals.lunch.items[0].count).toBe(0.5);
    const gone = adjustLogged(half, "lunch", id, -0.5);
    expect(gone.meals.lunch.items).toHaveLength(0);
    const up = adjustLogged(start, "lunch", id, 0.5);
    expect(up.meals.lunch.items[0].count).toBe(1.5);
  });
});

describe("stepCustomQuantity", () => {
  it("steps by 0.5 with a floor of 0.5", () => {
    expect(stepCustomQuantity(1, 1)).toBe(1.5);
    expect(stepCustomQuantity(1, -1)).toBe(0.5);
    expect(stepCustomQuantity(0.5, -1)).toBe(0.5); // floored
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- src/lib/diet/draft.test.ts`
Expected: FAIL — `stepCustomQuantity` is not exported.

- [ ] **Step 3: Add `stepCustomQuantity` to `src/lib/diet/draft.ts`**

Append:

```ts
/** Step a custom-item quantity by ±0.5, floored at 0.5. dir is 1 or -1. */
export function stepCustomQuantity(q: number, dir: 1 | -1): number {
  return Math.max(0.5, q + dir * 0.5);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- src/lib/diet/draft.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the logged-row steppers to 0.5**

In `src/app/diet/diet-entry.tsx`, in the `MealDetail` JSX where `LoggedRow` is rendered (around line 516-518), change the adjust deltas from whole numbers to 0.5:

```tsx
<LoggedRow
  key={it.id}
  item={it}
  foodById={foodById}
  onPlus={() => onAdjust(it.id, 0.5)}
  onMinus={() => onAdjust(it.id, -0.5)}
  onRemove={() => onRemove(it.id)}
/>
```

- [ ] **Step 6: Wire the custom-sheet quantity to 0.5 / min 0.5**

In `CustomItemSheet` (around lines 800-814), use the helper. First add the import at the top of the file (extend the existing `@/lib/diet/draft` import from Task 2):

```ts
import {
  tapFood,
  adjustLogged,
  removeLogged,
  addCustomItem,
  setSkipped,
  stepCustomQuantity,
} from "@/lib/diet/draft";
```

Then replace the two quantity buttons' `onClick` handlers:

```tsx
<button
  onClick={() => setQuantity((q) => stepCustomQuantity(q, -1))}
  className="h-10 w-10 rounded-xl border border-gray-200 text-base font-bold text-gray-600 hover:bg-gray-50"
>
  −
</button>
<p className="flex-1 text-center font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums text-gray-900">
  {quantity}
</p>
<button
  onClick={() => setQuantity((q) => stepCustomQuantity(q, 1))}
  className="h-10 w-10 rounded-xl border border-gray-200 text-base font-bold text-gray-600 hover:bg-gray-50"
>
  +
</button>
```

(Tapping a catalogue food still starts a new item at count 1 — `tapFood` is unchanged. The half is reached with one `−` tap.)

- [ ] **Step 7: Verify build + tests**

Run: `npm run test && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/diet/draft.ts src/lib/diet/draft.test.ts src/app/diet/diet-entry.tsx
git commit -m "feat(diet): allow half portions (0.5 step, min 0.5)"
```

---

## Task 4: Personal foods — migration (`player_food_items`)

**Files:**
- Create: `supabase/migrations/20260629120000_player_food_items.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================================
-- 20260629120000 — Personal "My foods" list
-- ----------------------------------------------------------------------------
-- A per-player palette of their own custom foods so anything logged once is one
-- tap away next time. Capped at 8 rows per player in the repository (least-used
-- eviction). This is a reusable palette only: the diet log itself keeps storing
-- the custom name/unit inline in diet_log_items, so old logs stay immutable.
-- The curated shared food_catalog is untouched.
-- ============================================================================

create table public.player_food_items (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references public.players(id) on delete cascade,
  name         text not null,
  unit         text,
  notes        text,
  use_count    integer not null default 1,
  last_used_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

comment on table public.player_food_items is
  'Per-player palette of custom foods for one-tap re-logging. Capped at 8 per '
  'player via least-used eviction in the repository.';

create index player_food_items_player_idx
  on public.player_food_items (player_id);

-- Dedup: re-adding the same (case-insensitive) name+unit bumps the existing
-- row rather than inserting a duplicate. Integrity backstop for the
-- find-or-create logic in the repository.
create unique index player_food_items_dedup
  on public.player_food_items (player_id, lower(name), coalesce(lower(unit), ''));

-- ─── RLS: owner CRUD own; staff read all (mirrors diet_logs) ────────────────
alter table public.player_food_items enable row level security;

create policy player_food_items_rw_owner on public.player_food_items
  for all to authenticated
  using (player_id = app.current_player_id())
  with check (player_id = app.current_player_id());

create policy player_food_items_select_staff on public.player_food_items
  for select to authenticated using (app.is_staff());
```

- [ ] **Step 2: Apply and verify the migration**

Run: `npx supabase db push`
Expected: migration applies cleanly; `player_food_items` exists.

Verify (psql or Studio): the table, both indexes, and the two RLS policies are present.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260629120000_player_food_items.sql
git commit -m "feat(diet): add player_food_items table for personal foods"
```

---

## Task 5: Personal foods — type + pure eviction helper

**Files:**
- Modify: `src/lib/diet/types.ts` (add `PlayerFoodItem`)
- Create: `src/lib/diet/personal-foods.ts`
- Test: `src/lib/diet/personal-foods.test.ts`

- [ ] **Step 1: Add the `PlayerFoodItem` type**

Append to `src/lib/diet/types.ts`:

```ts
/** A player's saved custom food (the "My foods" palette). */
export interface PlayerFoodItem {
  id: string;
  name: string;
  unit: string | null;
  notes: string | null;
  useCount: number;
}
```

- [ ] **Step 2: Write the failing eviction test**

Create `src/lib/diet/personal-foods.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { selectEvicteeId, MAX_PERSONAL_FOODS } from "./personal-foods";

const row = (id: string, useCount: number, lastUsedAt: string) => ({
  id,
  useCount,
  lastUsedAt,
});

function nRows(n: number) {
  return Array.from({ length: n }, (_, i) =>
    row(`id${i}`, 5, "2026-06-29T00:00:00Z"),
  );
}

describe("selectEvicteeId", () => {
  it("returns null when at or under the cap", () => {
    expect(selectEvicteeId(nRows(MAX_PERSONAL_FOODS))).toBeNull();
  });

  it("evicts the lowest use_count when over the cap", () => {
    const rows = [...nRows(MAX_PERSONAL_FOODS), row("victim", 1, "2026-06-29T10:00:00Z")];
    expect(selectEvicteeId(rows)).toBe("victim");
  });

  it("breaks use_count ties by oldest last_used_at", () => {
    const rows = [
      ...nRows(MAX_PERSONAL_FOODS - 1),
      row("newer", 1, "2026-06-29T10:00:00Z"),
      row("older", 1, "2026-06-01T10:00:00Z"),
    ];
    expect(selectEvicteeId(rows)).toBe("older");
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm run test -- src/lib/diet/personal-foods.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `src/lib/diet/personal-foods.ts`**

```ts
/**
 * Pure rules for the per-player "My foods" palette. The repository loads the
 * player's rows and uses these to enforce the cap; kept here so the eviction
 * policy is unit-tested and DB-free.
 */

/** Maximum personal foods kept per player. Adding a 9th evicts the least-used. */
export const MAX_PERSONAL_FOODS = 8;

/**
 * Pick which row to evict, or null if the list is within the cap. Eviction
 * policy: lowest use_count, ties broken by oldest last_used_at. A just-inserted
 * row (most recent last_used_at, count 1) therefore survives when other count-1
 * rows exist.
 */
export function selectEvicteeId(
  rows: { id: string; useCount: number; lastUsedAt: string }[],
): string | null {
  if (rows.length <= MAX_PERSONAL_FOODS) return null;
  let worst = rows[0];
  for (const r of rows) {
    const lower = r.useCount < worst.useCount;
    const tie =
      r.useCount === worst.useCount &&
      Date.parse(r.lastUsedAt) < Date.parse(worst.lastUsedAt);
    if (lower || tie) worst = r;
  }
  return worst.id;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run test -- src/lib/diet/personal-foods.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/diet/types.ts src/lib/diet/personal-foods.ts src/lib/diet/personal-foods.test.ts
git commit -m "feat(diet): PlayerFoodItem type + pure eviction helper"
```

---

## Task 6: Personal foods — repository (load + upsert-with-eviction)

**Files:**
- Create: `src/lib/diet/personal-foods-repository.ts`

- [ ] **Step 1: Implement the repository**

```ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PlayerFoodItem } from "./types";
import { selectEvicteeId } from "./personal-foods";

/**
 * Persistence for a player's "My foods" palette. Uses the service-role admin
 * client (RLS bypassed) and always filters by player_id explicitly. The diet
 * log itself is unaffected — this table is only a reusable palette.
 */

const SELECT_COLS = "id, name, unit, notes, use_count, last_used_at";

type Row = {
  id: string;
  name: string;
  unit: string | null;
  notes: string | null;
  use_count: number;
  last_used_at: string;
};

function toItem(r: Row): PlayerFoodItem {
  return {
    id: r.id,
    name: r.name,
    unit: r.unit,
    notes: r.notes,
    useCount: r.use_count,
  };
}

/** Display order: most-used first, then most recently used. */
function byDisplayOrder(a: Row, b: Row): number {
  if (b.use_count !== a.use_count) return b.use_count - a.use_count;
  return Date.parse(b.last_used_at) - Date.parse(a.last_used_at);
}

/** Load a player's personal foods, most-used first. */
export async function loadPlayerFoods(
  playerId: string,
): Promise<PlayerFoodItem[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("player_food_items")
    .select(SELECT_COLS)
    .eq("player_id", playerId)
    .order("use_count", { ascending: false })
    .order("last_used_at", { ascending: false });
  return (data ?? []).map(toItem);
}

/**
 * Record that a player used a custom food: bump it if it already exists
 * (case-insensitive name+unit), else insert it. After an insert, enforce the
 * cap by evicting the least-used row. Returns the refreshed palette in display
 * order.
 */
export async function upsertPlayerFood(
  playerId: string,
  food: { name: string; unit: string | null; notes: string | null },
): Promise<PlayerFoodItem[]> {
  const admin = createAdminClient();
  const name = food.name.trim();
  const unit = food.unit?.trim() || null;
  const notes = food.notes?.trim() || null;
  if (!name) return loadPlayerFoods(playerId);

  // Find an existing match (case-insensitive name + unit).
  const { data: existing } = await admin
    .from("player_food_items")
    .select(SELECT_COLS)
    .eq("player_id", playerId)
    .ilike("name", name)
    .order("use_count", { ascending: false });

  const match = (existing ?? []).find(
    (r) => (r.unit?.toLowerCase() ?? "") === (unit?.toLowerCase() ?? ""),
  );

  const nowIso = new Date().toISOString();

  if (match) {
    await admin
      .from("player_food_items")
      .update({ use_count: match.use_count + 1, last_used_at: nowIso })
      .eq("id", match.id);
    return loadPlayerFoods(playerId);
  }

  await admin
    .from("player_food_items")
    .insert({ player_id: playerId, name, unit, notes, last_used_at: nowIso });

  // Enforce the cap: load all rows, evict the least-used if over.
  const { data: all } = await admin
    .from("player_food_items")
    .select(SELECT_COLS)
    .eq("player_id", playerId);

  const rows = (all ?? []) as Row[];
  const evicteeId = selectEvicteeId(
    rows.map((r) => ({
      id: r.id,
      useCount: r.use_count,
      lastUsedAt: r.last_used_at,
    })),
  );
  if (evicteeId) {
    await admin.from("player_food_items").delete().eq("id", evicteeId);
    return rows
      .filter((r) => r.id !== evicteeId)
      .sort(byDisplayOrder)
      .map(toItem);
  }
  return rows.sort(byDisplayOrder).map(toItem);
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/diet/personal-foods-repository.ts
git commit -m "feat(diet): repository to load + upsert personal foods with eviction"
```

---

## Task 7: Personal foods — server action

**Files:**
- Modify: `src/lib/diet/actions.ts`

- [ ] **Step 1: Add the action**

In `src/lib/diet/actions.ts`, extend the imports and add `savePlayerFoodAction`:

```ts
import { loadPlayerFoods, upsertPlayerFood } from "./personal-foods-repository";
import type { DietDraft, PlayerFoodItem } from "./types";
```

(Replace the existing `import type { DietDraft } from "./types";` line with the one above.)

Then append the action at the end of the file:

```ts
/** Record a used custom food in the player's palette; returns the refreshed list. */
export async function savePlayerFoodAction(food: {
  name: string;
  unit: string | null;
  notes: string | null;
}): Promise<ActionResult<{ foods: PlayerFoodItem[] }>> {
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };
  if (!food.name.trim()) {
    const foods = await loadPlayerFoods(player.id);
    return { ok: true, data: { foods } };
  }
  try {
    const foods = await upsertPlayerFood(player.id, food);
    return { ok: true, data: { foods } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/diet/actions.ts
git commit -m "feat(diet): savePlayerFoodAction server action"
```

---

## Task 8: Personal foods — "Your foods" UI + auto-save wiring

**Files:**
- Modify: `src/app/diet/page.tsx` (load + pass `initialPersonalFoods`)
- Modify: `src/app/diet/diet-entry.tsx` (state, props, `tapPersonalFood`, section, auto-save)
- Modify: `src/lib/diet/draft.ts` (add `tapPersonalFood`)
- Test: `src/lib/diet/draft.test.ts`

- [ ] **Step 1: Write a failing test for `tapPersonalFood`**

Append to `src/lib/diet/draft.test.ts`:

```ts
import { tapPersonalFood } from "./draft";

describe("tapPersonalFood", () => {
  const food = { name: "Protein shake", unit: "glass", notes: "post workout" };

  it("adds the saved custom food at count 1", () => {
    const out = tapPersonalFood(emptyDraft(), "lunch", food);
    const item = out.meals.lunch.items[0];
    expect(item.foodKey).toBeNull();
    expect(item.customName).toBe("Protein shake");
    expect(item.customUnit).toBe("glass");
    expect(item.count).toBe(1);
  });

  it("merges on re-tap of the same name+unit", () => {
    let out = tapPersonalFood(emptyDraft(), "lunch", food);
    out = tapPersonalFood(out, "lunch", food);
    expect(out.meals.lunch.items).toHaveLength(1);
    expect(out.meals.lunch.items[0].count).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test -- src/lib/diet/draft.test.ts`
Expected: FAIL — `tapPersonalFood` not exported.

- [ ] **Step 3: Implement `tapPersonalFood` in `src/lib/diet/draft.ts`**

Append:

```ts
/**
 * Add a saved personal food to a meal at count 1, merging on re-tap of the same
 * name+unit (mirrors tapFood's catalogue merge). Stores it as a custom item so
 * the diet log keeps its inline snapshot.
 */
export function tapPersonalFood(
  draft: DietDraft,
  slotKey: string,
  food: { name: string; unit: string | null; notes: string | null },
): DietDraft {
  const meal = getMeal(draft, slotKey);
  const unit = food.unit ?? undefined;
  const existing = meal.items.find(
    (it) =>
      it.foodKey === null &&
      it.customName === food.name &&
      (it.customUnit ?? undefined) === unit,
  );
  const items = existing
    ? meal.items.map((it) =>
        it === existing ? { ...it, count: it.count + 1 } : it,
      )
    : [
        ...meal.items,
        {
          id: `custom-${Date.now()}`,
          foodKey: null,
          customName: food.name,
          customUnit: unit,
          customNotes: food.notes ?? undefined,
          count: 1,
        } as LoggedItem,
      ];
  return setMealIn(draft, slotKey, { skipped: false, items });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test -- src/lib/diet/draft.test.ts`
Expected: PASS.

- [ ] **Step 5: Load personal foods in the page**

Replace `src/app/diet/page.tsx` body with (adds the personal-foods load and prop):

```tsx
import { redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/auth/current-user";
import { loadDietCatalog } from "@/lib/diet/config";
import { loadDietLog } from "@/lib/diet/repository";
import { loadPlayerFoods } from "@/lib/diet/personal-foods-repository";
import { todayKey } from "@/lib/diet/dates";
import DietEntry from "./diet-entry";

/**
 * Daily Diet log entry. Server component: resolves the player, today's date,
 * the admin-editable catalogue (meal slots + food list), the player's existing
 * draft for today, and their personal "My foods" palette, then hands everything
 * to the client form which autosaves. Unscored, per-day, current-day only.
 */
export default async function DietPage() {
  const player = await getCurrentPlayer();
  if (!player) redirect("/login?next=/diet");

  const dateKey = todayKey();
  const [catalog, draft, personalFoods] = await Promise.all([
    loadDietCatalog(),
    loadDietLog(player.id, dateKey),
    loadPlayerFoods(player.id),
  ]);

  return (
    <DietEntry
      playerName={player.displayName}
      initialDate={dateKey}
      initialDraft={draft}
      catalog={catalog}
      initialPersonalFoods={personalFoods}
    />
  );
}
```

- [ ] **Step 6: Thread personal-foods state through `DietEntry`**

In `src/app/diet/diet-entry.tsx`:

(a) Extend the type imports to add `PlayerFoodItem` and `tapPersonalFood`, and import the new action. Update the existing imports:

```ts
import {
  CUSTOM_UNIT_OPTIONS,
  emptyDraft,
  getMeal,
  indexFoods,
  type CustomUnit,
  type DietCatalog,
  type DietDraft,
  type FoodItemInfo,
  type LoggedItem,
  type MealLog,
  type MealSlotInfo,
  type PlayerFoodItem,
} from "@/lib/diet/types";
import {
  tapFood,
  adjustLogged,
  removeLogged,
  addCustomItem,
  setSkipped,
  stepCustomQuantity,
  tapPersonalFood,
} from "@/lib/diet/draft";
import {
  loadDietLogAction,
  saveDietLogAction,
  savePlayerFoodAction,
} from "@/lib/diet/actions";
```

(b) Add `initialPersonalFoods` to the component props and hold it in state. Change the signature:

```tsx
export default function DietEntry({
  playerName,
  initialDate,
  initialDraft,
  catalog,
  initialPersonalFoods,
}: {
  playerName: string;
  initialDate: string;
  initialDraft: DietDraft;
  catalog: DietCatalog;
  initialPersonalFoods: PlayerFoodItem[];
}) {
  const [dateKey, setDateKey] = useState<string>(initialDate);
  const [draft, setDraft] = useState<DietDraft>(initialDraft);
  const [personalFoods, setPersonalFoods] =
    useState<PlayerFoodItem[]>(initialPersonalFoods);
  // ...rest unchanged
```

(c) Add a single saver that records a used custom food and refreshes the palette. Place it next to `mutate` (after the `mutate` definition, ~line 160):

```tsx
/** Record a used custom food in the player's palette, then refresh chips. */
const rememberFood = useCallback(
  async (food: { name: string; unit: string | null; notes: string | null }) => {
    const res = await savePlayerFoodAction(food);
    if (res.ok) setPersonalFoods(res.data.foods);
  },
  [],
);
```

(d) In the `MealDetail` render, pass `personalFoods` and two handlers (tap a chip, and the existing custom add now also remembers). Replace the `onAddCustom` handler and add `personalFoods` + `onTapPersonal`:

```tsx
<MealDetail
  slot={openMeal}
  meal={getMeal(draft, openMeal.key)}
  sections={catalog.sections}
  foodById={foodById}
  personalFoods={personalFoods}
  status={status}
  onBack={() => setOpenSlot(null)}
  onTap={(foodKey) => {
    mutate((d) => tapFood(d, openMeal.key, foodKey));
    capture(AnalyticsEvent.DietMealLogged, { slot: openMeal.key, source: "catalog" });
  }}
  onTapPersonal={(food) => {
    mutate((d) => tapPersonalFood(d, openMeal.key, food));
    void rememberFood(food);
    capture(AnalyticsEvent.DietMealLogged, { slot: openMeal.key, source: "personal" });
  }}
  onAdjust={(id, delta) =>
    mutate((d) => adjustLogged(d, openMeal.key, id, delta))
  }
  onRemove={(id) => mutate((d) => removeLogged(d, openMeal.key, id))}
  onAddCustom={(c) => {
    mutate((d) => addCustomItem(d, openMeal.key, c));
    void rememberFood({ name: c.name, unit: c.unit, notes: c.notes ?? null });
    capture(AnalyticsEvent.DietMealLogged, { slot: openMeal.key, source: "custom" });
  }}
  onToggleSkip={() =>
    mutate((d) =>
      setSkipped(d, openMeal.key, !getMeal(d, openMeal.key).skipped),
    )
  }
/>
```

- [ ] **Step 7: Add `personalFoods` + `onTapPersonal` to `MealDetail` and render the section**

In `src/app/diet/diet-entry.tsx`, update the `MealDetail` prop type and signature to accept the new props:

```tsx
function MealDetail({
  slot,
  meal,
  sections,
  foodById,
  personalFoods,
  status,
  onBack,
  onTap,
  onTapPersonal,
  onAdjust,
  onRemove,
  onAddCustom,
  onToggleSkip,
}: {
  slot: MealSlotInfo;
  meal: MealLog;
  sections: DietCatalog["sections"];
  foodById: Record<string, FoodItemInfo>;
  personalFoods: PlayerFoodItem[];
  status: SyncStatus;
  onBack: () => void;
  onTap: (foodKey: string) => void;
  onTapPersonal: (food: { name: string; unit: string | null; notes: string | null }) => void;
  onAdjust: (loggedId: string, delta: number) => void;
  onRemove: (loggedId: string) => void;
  onAddCustom: (c: { name: string; quantity: number; unit: string; notes?: string }) => void;
  onToggleSkip: () => void;
}) {
```

Then add the "Your foods" section. Insert it **between** the "Add custom item" button block and the "Catalog" section (i.e. after the closing `)}` of the Add-custom block, ~line 542, before `{/* Catalog */}`):

```tsx
{/* Your foods — personal saved customs, one tap to re-log */}
{!meal.skipped && personalFoods.length > 0 && (
  <section>
    <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-600">
      Your foods
    </h2>
    <div className="grid grid-cols-2 gap-2">
      {personalFoods.map((food) => (
        <button
          key={food.id}
          onClick={() =>
            onTapPersonal({
              name: food.name,
              unit: food.unit,
              notes: food.notes,
            })
          }
          className="group flex items-center gap-2.5 rounded-xl border border-violet-200 bg-violet-50/40 p-2.5 text-left transition-all hover:border-violet-300 hover:bg-violet-50 active:scale-[0.98]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-lg">
            ✏️
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold leading-tight text-gray-900">
              {food.name}
            </p>
            <p className="truncate text-[10px] leading-tight text-gray-600">
              {food.unit ?? "custom"}
            </p>
          </div>
        </button>
      ))}
    </div>
  </section>
)}
```

- [ ] **Step 8: Verify build, types, lint, tests**

Run: `npm run test && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 9: Manual verification in the running app**

Run: `npm run dev`, sign in, open `/diet` → a meal. Then:
1. Add a custom item (e.g. "Sabudana khichadi", glass) → it appears under **Your foods** after save.
2. Re-open the meal / another meal → the chip is still there; tap it → adds at ×1.
3. Tap a logged row's chevron → `−` takes it to ×0.5, `−` again removes it; `+` goes to ×1.5.
4. Add 9 distinct customs → the least-used (a one-off, use_count 1) drops out; the list stays at 8.

- [ ] **Step 10: Commit**

```bash
git add src/app/diet/page.tsx src/app/diet/diet-entry.tsx src/lib/diet/draft.ts src/lib/diet/draft.test.ts
git commit -m "feat(diet): personal 'My foods' chips with auto-save + eviction"
```

---

## Self-Review

**Spec coverage:**
- Gym 0.5 kg / 1 lb step → Task 1. ✓
- Diet half portions (0.5 step, min 0.5; catalogue tap starts at 1) → Task 3 (+ Task 2 extraction). ✓
- `player_food_items` table + unique dedup index + `player_id` index + RLS → Task 4. ✓
- `PlayerFoodItem` type + eviction policy (lowest use_count, oldest last_used_at, cap 8) → Task 5. ✓
- Repository load + upsert/bump/evict, inline snapshot untouched → Task 6. ✓
- Server action → Task 7. ✓
- Page load, "Your foods" section, auto-save on custom add + chip tap, most-used-first order, hidden when empty, no manual remove/no toggle → Task 8. ✓
- Out-of-scope items (catalogue recents, admin promotion, configurable cap) → not implemented, as intended. ✓

**Type consistency:** `PlayerFoodItem` (`{id, name, unit: string|null, notes: string|null, useCount}`) is defined in Task 5 and used identically in Tasks 6–8. `selectEvicteeId` rows shape `{id, useCount, lastUsedAt}` matches between Task 5 (helper/test) and Task 6 (repository call). `savePlayerFoodAction` arg `{name, unit: string|null, notes: string|null}` matches `rememberFood`, `onTapPersonal`, and `upsertPlayerFood`. `MAX_PERSONAL_FOODS` single-sourced in `personal-foods.ts`.

**Placeholder scan:** none — every step shows full code or an exact command with expected output.

**Note on display:** with half portions the hub's "items logged" total and a row's `× {count}` may read e.g. `1.5` — intended and acceptable (no formatting change needed; `tabular-nums` already applied).
