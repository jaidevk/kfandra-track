# Gym per-set reps & weight — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Gym exercise editor's single weight stepper + fixed-scheme dropdown with a carry-forward per-set list that captures reps and weight for each set (up to 8).

**Architecture:** Per-set data is held on each `ExerciseRow` as a `sets: ExerciseSet[]` array, persisted to a new `sets` JSONB column on `gym_log_exercises`. A generated human summary string (`6 sets · 14×10 · …`) is written into the existing `scheme` column so the admin activity view and any Sheets sync keep working unchanged. Pure set/summary logic lives in small tested modules (`sets.ts`, `summary.ts`); the React editor consumes them.

**Tech Stack:** Next.js (App Router) + TypeScript + Tailwind + Supabase (Postgres/JSONB) + Vitest. Spec: `docs/superpowers/specs/2026-06-24-gym-per-set-weight-reps-design.md`. Bead: `Helper-efi`.

---

## File structure

- **Create** `supabase/migrations/20260624120000_gym_exercise_sets.sql` — adds `sets` JSONB column.
- **Create** `src/lib/gym/sets.ts` — pure per-set helpers (add/remove/step/delta) + limits.
- **Create** `src/lib/gym/sets.test.ts` — unit tests for the above.
- **Modify** `src/lib/gym/types.ts` — add `ExerciseSet`, `DEFAULT_REPS`; reshape `ExerciseRow` (drop `weight`, add `sets`); update `newExercise`.
- **Modify** `src/lib/gym/summary.ts` — drop `estimateSets`; exact `totalSets`; new `buildSchemeSummary`; redefine `hasWeight` over sets.
- **Modify** `src/lib/gym/summary.test.ts` — rewrite for the new model.
- **Modify** `src/lib/gym/repository.ts` — load `sets`; save `sets` + generated `scheme`.
- **Modify** `src/lib/supabase/database.types.ts` — add `sets` to the `gym_log_exercises` Row/Insert/Update.
- **Modify** `src/app/gym/gym-entry.tsx` — `SetRow` subcomponent; rewrite `ExerciseSheet` sets section; list display; defaults.

---

## Task 1: DB migration — add `sets` JSONB column

**Files:**
- Create: `supabase/migrations/20260624120000_gym_exercise_sets.sql`

- [ ] **Step 1: Write the migration**

```sql
-- ============================================================================
-- 20260624120000 — Gym: per-set reps & weight
-- ----------------------------------------------------------------------------
-- Each exercise now records what was actually done per set. Stored as JSONB:
--   [{ "reps": 14, "weight": 10 }, { "reps": 8, "weight": 15 }, ...]
-- weight is 0 for no-weight movements. The existing `scheme` column is reused
-- to hold a generated human summary so admin/Sheets readers keep working; the
-- legacy `weight` column is left in place (nullable) but no longer written.
-- ============================================================================

alter table public.gym_log_exercises
  add column sets jsonb not null default '[]'::jsonb;

comment on column public.gym_log_exercises.sets is
  'Per-set reps & weight: [{"reps":14,"weight":10}, ...]. weight 0 for no-weight movements.';
```

- [ ] **Step 2: Apply locally and verify the column exists**

Run: `npx supabase db push`
Then: `npx supabase db diff` — expect no further diff for this column (it now exists).
Expected: command succeeds; `gym_log_exercises` has a `sets` column defaulting to `[]`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260624120000_gym_exercise_sets.sql
git commit -m "feat(gym): add sets JSONB column to gym_log_exercises (Helper-efi)"
```

---

## Task 2: Add `sets` to generated DB types

**Files:**
- Modify: `src/lib/supabase/database.types.ts:340-376` (the `gym_log_exercises` block)

- [ ] **Step 1: Add `sets` to Row, Insert, and Update**

In the `gym_log_exercises` block, add a `sets` field to each of the three shapes. The file already defines a `Json` type alias used elsewhere; reuse it.

In `Row` (after `scheme: string | null`):

```ts
          scheme: string | null
          sets: Json
```

In `Insert` (after `scheme?: string | null`):

```ts
          scheme?: string | null
          sets?: Json
```

In `Update` (after `scheme?: string | null`):

```ts
          scheme?: string | null
          sets?: Json
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (no errors introduced by the new field).

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/database.types.ts
git commit -m "feat(gym): type the gym_log_exercises.sets column"
```

---

## Task 3: Reshape `ExerciseRow` and add `ExerciseSet`

**Files:**
- Modify: `src/lib/gym/types.ts`

- [ ] **Step 1: Add the `ExerciseSet` type and `DEFAULT_REPS`, and reshape `ExerciseRow`**

Replace the `ExerciseRow` interface (lines 13-25) with the new shape and add `ExerciseSet` + `DEFAULT_REPS` just above it:

```ts
/** Reps & weight performed in one set. weight is 0 for no-weight movements. */
export interface ExerciseSet {
  reps: number;
  weight: number;
}

/** Default reps for the first set of a brand-new exercise. */
export const DEFAULT_REPS = 10;

export interface ExerciseRow {
  /** Client-stable id (also the gym_log_exercises id when round-tripped). */
  id: string;
  bodyPart: string;
  /** null when no equipment / bodyweight movement. */
  equipment: string | null;
  weightUnit: WeightUnit;
  /** Per-set reps & weight; always at least one set for a logged exercise. */
  sets: ExerciseSet[];
  /**
   * Display summary string. Regenerated from `sets` on save (see
   * summary.buildSchemeSummary). May hold a legacy scheme for old rows that
   * predate per-set logging and have not been re-saved.
   */
  scheme: string;
  notes: string;
}
```

- [ ] **Step 2: Update `newExercise` to seed one default set**

Replace `newExercise` (lines 44-57) with:

```ts
export function newExercise(
  id: string,
  defaults: { bodyPart: string },
): ExerciseRow {
  return {
    id,
    bodyPart: defaults.bodyPart,
    equipment: "None",
    weightUnit: "kg",
    sets: [{ reps: DEFAULT_REPS, weight: 0 }],
    scheme: "",
    notes: "",
  };
}
```

`emptyDraft` and `weightStep` are unchanged.

- [ ] **Step 3: Typecheck (expect downstream errors — that's fine)**

Run: `npx tsc --noEmit`
Expected: FAIL with errors in `summary.ts`, `repository.ts`, `gym-entry.tsx`, and the test files that still reference `row.weight` / the old `newExercise` signature. These are fixed in Tasks 4–7.

- [ ] **Step 4: Commit**

```bash
git add src/lib/gym/types.ts
git commit -m "feat(gym): add ExerciseSet, reshape ExerciseRow for per-set logging"
```

---

## Task 4: Pure per-set helpers (`sets.ts`)

**Files:**
- Create: `src/lib/gym/sets.ts`
- Test: `src/lib/gym/sets.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import {
  MIN_SETS,
  MAX_SETS,
  newSet,
  addSet,
  removeSet,
  stepReps,
  stepSetWeight,
  repsDelta,
  weightDelta,
} from "./sets";

describe("addSet", () => {
  it("appends a set inheriting the last set's reps & weight", () => {
    const out = addSet([{ reps: 8, weight: 15 }]);
    expect(out).toHaveLength(2);
    expect(out[1]).toEqual({ reps: 8, weight: 15 });
  });

  it("seeds a default set when the list is empty", () => {
    expect(addSet([])).toEqual([newSet()]);
  });

  it("never exceeds MAX_SETS", () => {
    const full = Array.from({ length: MAX_SETS }, () => newSet());
    expect(addSet(full)).toHaveLength(MAX_SETS);
  });
});

describe("removeSet", () => {
  it("drops the last set", () => {
    expect(removeSet([newSet(), { reps: 8, weight: 15 }])).toEqual([newSet()]);
  });

  it("never drops below MIN_SETS", () => {
    expect(removeSet([newSet()])).toHaveLength(MIN_SETS);
  });
});

describe("stepReps", () => {
  it("adjusts only the targeted set and floors reps at 1", () => {
    const sets = [{ reps: 1, weight: 0 }, { reps: 8, weight: 0 }];
    expect(stepReps(sets, 1, 1)[1].reps).toBe(9);
    expect(stepReps(sets, 0, -1)[0].reps).toBe(1); // floored
  });
});

describe("stepSetWeight", () => {
  it("steps weight by the unit step and floors at 0", () => {
    const sets = [{ reps: 8, weight: 0 }];
    expect(stepSetWeight(sets, 0, 1, "lb")[0].weight).toBe(5);
    expect(stepSetWeight(sets, 0, 1, "kg")[0].weight).toBe(2);
    expect(stepSetWeight(sets, 0, -1, "lb")[0].weight).toBe(0); // floored
  });
});

describe("deltas", () => {
  const sets = [{ reps: 14, weight: 10 }, { reps: 8, weight: 15 }];
  it("returns null for the first set", () => {
    expect(repsDelta(sets, 0)).toBeNull();
    expect(weightDelta(sets, 0)).toBeNull();
  });
  it("returns the signed change vs the previous set", () => {
    expect(repsDelta(sets, 1)).toBe(-6);
    expect(weightDelta(sets, 1)).toBe(5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/gym/sets.test.ts`
Expected: FAIL — `./sets` cannot be resolved / exports missing.

- [ ] **Step 3: Write the implementation**

```ts
import { weightStep, DEFAULT_REPS, type ExerciseSet, type WeightUnit } from "./types";

/**
 * Pure helpers for an exercise's per-set list. Sets carry forward: a new set
 * inherits the previous set's reps & weight, so the player only taps what
 * changed. All functions return new arrays (no mutation) for React state.
 */

export const MIN_SETS = 1;
export const MAX_SETS = 8;

export function newSet(reps: number = DEFAULT_REPS, weight = 0): ExerciseSet {
  return { reps, weight };
}

/** Append a set inheriting the last set's values (or a default). Capped at MAX_SETS. */
export function addSet(sets: ExerciseSet[]): ExerciseSet[] {
  if (sets.length >= MAX_SETS) return sets;
  const last = sets[sets.length - 1];
  return [...sets, last ? { ...last } : newSet()];
}

/** Drop the last set. Never below MIN_SETS. */
export function removeSet(sets: ExerciseSet[]): ExerciseSet[] {
  if (sets.length <= MIN_SETS) return sets;
  return sets.slice(0, -1);
}

/** Adjust reps on one set by ±1; reps floor at 1. */
export function stepReps(
  sets: ExerciseSet[],
  index: number,
  dir: 1 | -1,
): ExerciseSet[] {
  return sets.map((s, i) =>
    i === index ? { ...s, reps: Math.max(1, s.reps + dir) } : s,
  );
}

/** Adjust weight on one set by the unit step; weight floors at 0. */
export function stepSetWeight(
  sets: ExerciseSet[],
  index: number,
  dir: 1 | -1,
  unit: WeightUnit,
): ExerciseSet[] {
  const step = weightStep(unit);
  return sets.map((s, i) =>
    i === index ? { ...s, weight: Math.max(0, s.weight + dir * step) } : s,
  );
}

/** Signed reps change vs the previous set; null for the first set. */
export function repsDelta(sets: ExerciseSet[], index: number): number | null {
  if (index <= 0) return null;
  return sets[index].reps - sets[index - 1].reps;
}

/** Signed weight change vs the previous set; null for the first set. */
export function weightDelta(sets: ExerciseSet[], index: number): number | null {
  if (index <= 0) return null;
  return sets[index].weight - sets[index - 1].weight;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/gym/sets.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/gym/sets.ts src/lib/gym/sets.test.ts
git commit -m "feat(gym): pure per-set helpers (carry-forward, step, delta)"
```

---

## Task 5: Summary helpers — exact set count + summary string

**Files:**
- Modify: `src/lib/gym/summary.ts`
- Modify: `src/lib/gym/summary.test.ts`

- [ ] **Step 1: Rewrite the tests**

Replace the entire contents of `src/lib/gym/summary.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import { exerciseCount, totalSets, hasWeight, buildSchemeSummary } from "./summary";
import { emptyDraft, newExercise, type ExerciseRow, type GymDraft } from "./types";

const rowWithSets = (
  id: string,
  sets: ExerciseRow["sets"],
  extra: Partial<ExerciseRow> = {},
): ExerciseRow => ({ ...newExercise(id, { bodyPart: "Shoulders" }), sets, ...extra });

describe("exerciseCount / totalSets", () => {
  it("counts rows and sums actual set counts", () => {
    const draft: GymDraft = {
      ...emptyDraft(),
      rows: [
        rowWithSets("r1", [{ reps: 8, weight: 10 }, { reps: 8, weight: 10 }]), // 2
        rowWithSets("r2", [{ reps: 12, weight: 0 }]), // 1
      ],
    };
    expect(exerciseCount(draft)).toBe(2);
    expect(totalSets(draft)).toBe(3);
  });

  it("an empty draft has no exercises and zero sets", () => {
    expect(exerciseCount(emptyDraft())).toBe(0);
    expect(totalSets(emptyDraft())).toBe(0);
  });
});

describe("hasWeight", () => {
  it("is true when any set carries weight", () => {
    expect(hasWeight(rowWithSets("r", [{ reps: 8, weight: 0 }, { reps: 8, weight: 12 }]))).toBe(true);
  });
  it("is false when every set is weightless", () => {
    expect(hasWeight(rowWithSets("r", [{ reps: 14, weight: 0 }]))).toBe(false);
  });
});

describe("buildSchemeSummary", () => {
  it("formats weighted sets as reps×weight with the unit labeled once", () => {
    const row = rowWithSets(
      "r",
      [
        { reps: 14, weight: 10 },
        { reps: 8, weight: 15 },
        { reps: 8, weight: 25 },
        { reps: 8, weight: 20 },
        { reps: 8, weight: 20 },
        { reps: 14, weight: 20 },
      ],
      { weightUnit: "lb" },
    );
    expect(buildSchemeSummary(row)).toBe(
      "6 sets · 14×10 · 8×15 · 8×25 · 8×20 · 8×20 · 14×20 lb",
    );
  });

  it("formats no-weight sets as reps only", () => {
    const row = rowWithSets("r", [
      { reps: 14, weight: 0 },
      { reps: 8, weight: 0 },
      { reps: 8, weight: 0 },
    ]);
    expect(buildSchemeSummary(row)).toBe("3 sets · 14 · 8 · 8 reps");
  });

  it("uses the singular 'set' for a single set", () => {
    expect(buildSchemeSummary(rowWithSets("r", [{ reps: 10, weight: 0 }]))).toBe(
      "1 set · 10 reps",
    );
  });

  it("returns an empty string when there are no sets", () => {
    expect(buildSchemeSummary(rowWithSets("r", []))).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/gym/summary.test.ts`
Expected: FAIL — `buildSchemeSummary` is not exported; `hasWeight`/`totalSets` reference the old `weight`/`scheme` fields.

- [ ] **Step 3: Rewrite `summary.ts`**

Replace the entire contents of `src/lib/gym/summary.ts` with:

```ts
import type { ExerciseRow, GymDraft } from "./types";

/**
 * Pure summaries for the gym log. Gym is unscored, so these are simple counts
 * and display strings — but they live here (not in the component) so the
 * behaviour is unit-tested and the form stays declarative.
 */

/** Number of logged exercise rows. */
export function exerciseCount(draft: GymDraft): number {
  return draft.rows.length;
}

/** Exact total sets across all logged exercises. */
export function totalSets(draft: GymDraft): number {
  return draft.rows.reduce((sum, r) => sum + r.sets.length, 0);
}

/** Whether any set in the row carries weight (drives weighted vs reps-only display). */
export function hasWeight(row: ExerciseRow): boolean {
  return row.sets.some((s) => s.weight > 0);
}

/**
 * Human-readable summary of an exercise's sets, e.g.
 *   weighted : "6 sets · 14×10 · 8×15 · 8×25 · 8×20 · 8×20 · 14×20 lb"
 *   reps-only: "3 sets · 14 · 8 · 8 reps"
 * Returns "" for a row with no sets.
 */
export function buildSchemeSummary(row: ExerciseRow): string {
  const n = row.sets.length;
  if (n === 0) return "";
  const label = `${n} ${n === 1 ? "set" : "sets"}`;
  if (hasWeight(row)) {
    const parts = row.sets.map((s) => `${s.reps}×${s.weight}`);
    return `${label} · ${parts.join(" · ")} ${row.weightUnit}`;
  }
  const parts = row.sets.map((s) => `${s.reps}`);
  return `${label} · ${parts.join(" · ")} reps`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/gym/summary.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gym/summary.ts src/lib/gym/summary.test.ts
git commit -m "feat(gym): exact set totals + per-set summary string"
```

---

## Task 6: Repository — load & save per-set data

**Files:**
- Modify: `src/lib/gym/repository.ts`

- [ ] **Step 1: Update the load mapping to read `sets`**

In `loadGymLog`, change the select (line 31) to include `sets`:

```ts
    .select("id, body_part, equipment, weight, weight_unit, scheme, sets, notes, sort_order")
```

Replace the `rows` mapping (lines 35-43) with:

```ts
  const rows: ExerciseRow[] = (exRows ?? []).map((r) => ({
    id: r.id,
    bodyPart: r.body_part,
    equipment: r.equipment,
    weightUnit: (r.weight_unit as WeightUnit) ?? "kg",
    sets: Array.isArray(r.sets)
      ? (r.sets as Array<{ reps?: number; weight?: number }>).map((s) => ({
          reps: typeof s.reps === "number" ? s.reps : 0,
          weight: typeof s.weight === "number" ? s.weight : 0,
        }))
      : [],
    // Legacy rows (no sets yet) keep their old scheme text for display.
    scheme: r.scheme ?? "",
    notes: r.notes ?? "",
  }));
```

- [ ] **Step 2: Update the save mapping to write `sets` + generated `scheme`**

Add the summary import at the top of the file (after the existing `import { emptyDraft } from "./types";`):

```ts
import { buildSchemeSummary } from "./summary";
```

In `saveGymLog`, replace the `exerciseRows` mapping (lines 92-104) with:

```ts
  const exerciseRows = draft.rows
    .map((r, i) => ({
      gym_log_id: log.id,
      body_part: r.bodyPart,
      equipment: r.equipment,
      // Per-exercise weight is superseded by per-set weights; left null.
      weight: null,
      weight_unit: r.weightUnit,
      scheme: buildSchemeSummary(r) || null,
      sets: r.sets,
      notes: r.notes.trim() || null,
      sort_order: i,
    }))
    // Skip rows with no body part or no sets (nothing was performed).
    .filter((r) => r.body_part.length > 0 && r.sets.length > 0);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS for `repository.ts` (component errors may remain until Task 7).

- [ ] **Step 4: Commit**

```bash
git add src/lib/gym/repository.ts
git commit -m "feat(gym): persist per-set data and generated summary"
```

---

## Task 7: Editor UI — per-set list

**Files:**
- Modify: `src/app/gym/gym-entry.tsx`

- [ ] **Step 1: Update imports and the header**

Replace the gym imports block (lines 6-17) with:

```ts
import {
  emptyDraft,
  newExercise,
  weightStep,
  type ExerciseRow,
  type ExerciseSet,
  type GymDraft,
  type WeightUnit,
} from "@/lib/gym/types";
import {
  addSet,
  removeSet,
  stepReps,
  stepSetWeight,
  repsDelta,
  weightDelta,
  MIN_SETS,
  MAX_SETS,
} from "@/lib/gym/sets";
import { exerciseCount, totalSets, buildSchemeSummary } from "@/lib/gym/summary";
import { loadGymLogAction, saveGymLogAction } from "@/lib/gym/actions";
import { dateLabel, todayKey } from "@/lib/gym/dates";
import type { GymCatalog } from "@/lib/gym/config";
import { AnalyticsEvent, capture } from "@/lib/observability/analytics";
```

(Removes the now-unused `hasWeight` import.)

- [ ] **Step 2: Simplify `defaults` (scheme no longer exists)**

Replace the `defaults` memo (lines 45-51) with:

```ts
  const defaults = useMemo(
    () => ({ bodyPart: catalog.bodyParts[0]?.value ?? "Shoulders" }),
    [catalog.bodyParts],
  );
```

- [ ] **Step 3: Update the "est. sets" label and the logged-exercise list**

Change the sets stat label (line 166) from `est. sets` to `sets`:

```tsx
                <p className="text-[11px] text-emerald-200/60">sets</p>
```

Replace the logged-exercise card body (lines 201-218, the `<div className="flex flex-wrap …">` through the `{r.notes && …}` block) with:

```tsx
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg">{iconByBodyPart.get(r.bodyPart) ?? "🏋️"}</span>
                    <p className="text-sm font-bold text-gray-900">{r.bodyPart}</p>
                    {r.equipment && r.equipment !== "None" && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                        · {r.equipment}
                      </span>
                    )}
                  </div>
                  {(() => {
                    const summary = r.sets.length > 0 ? buildSchemeSummary(r) : r.scheme;
                    return summary ? (
                      <p className="mt-1 text-sm text-gray-700">{summary}</p>
                    ) : null;
                  })()}
                  {r.notes && (
                    <p className="mt-0.5 text-[11px] italic text-gray-600">{r.notes}</p>
                  )}
```

- [ ] **Step 4: Add a `SetRow` subcomponent**

Add this above `ExerciseSheet` (just before line 362, `function ExerciseSheet({`):

```tsx
function fmtDelta(d: number): string {
  return d > 0 ? `+${d}` : `−${Math.abs(d)}`;
}

function SetRow({
  index,
  set,
  unit,
  supportsWeight,
  repsD,
  weightD,
  onStepReps,
  onStepWeight,
}: {
  index: number;
  set: ExerciseSet;
  unit: WeightUnit;
  supportsWeight: boolean;
  repsD: number | null;
  weightD: number | null;
  onStepReps: (dir: 1 | -1) => void;
  onStepWeight: (dir: 1 | -1) => void;
}) {
  const stepBtn =
    "h-8 w-8 shrink-0 rounded-lg border border-gray-200 text-base font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-30";
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-2.5">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-600">
        Set {index + 1}
      </p>
      <div className="flex items-center gap-2">
        <span className="w-12 text-[11px] text-gray-600">Reps</span>
        <button onClick={() => onStepReps(-1)} disabled={set.reps <= 1} className={stepBtn}>
          −
        </button>
        <span className="flex-1 text-center text-lg font-bold tabular-nums text-gray-900">
          {set.reps}
        </span>
        <button onClick={() => onStepReps(1)} className={stepBtn}>
          +
        </button>
        {repsD !== null && repsD !== 0 && (
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
              repsD > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
            }`}
          >
            {fmtDelta(repsD)}
          </span>
        )}
      </div>
      {supportsWeight && (
        <div className="mt-1.5 flex items-center gap-2">
          <span className="w-12 text-[11px] text-gray-600">Weight</span>
          <button
            onClick={() => onStepWeight(-1)}
            disabled={set.weight <= 0}
            className={stepBtn}
          >
            −
          </button>
          <span className="flex-1 text-center text-lg font-bold tabular-nums text-gray-900">
            {set.weight} <span className="text-[11px] text-gray-600">{unit}</span>
          </span>
          <button onClick={() => onStepWeight(1)} className={stepBtn}>
            +
          </button>
          {weightD !== null && weightD !== 0 && (
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                weightD > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              {fmtDelta(weightD)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Rewrite the `ExerciseSheet` internals (equipment handler, sets state, sets section, save guard)**

In `ExerciseSheet`, replace `usingCustom` + `setEquipment` + `stepWeight` + the step-number consts (lines 382-403) with:

```ts
  function setEquipment(eq: string) {
    const meta = catalog.equipment.find((e) => e.value === eq);
    const eqSupportsWeight = meta ? meta.supportsWeight : false;
    setR((x) => ({
      ...x,
      equipment: eq,
      // No-weight equipment: zero every set's weight (reps-only).
      sets: eqSupportsWeight ? x.sets : x.sets.map((s) => ({ ...s, weight: 0 })),
    }));
  }

  const onAddSet = () => setR((x) => ({ ...x, sets: addSet(x.sets) }));
  const onRemoveSet = () => setR((x) => ({ ...x, sets: removeSet(x.sets) }));
  const onStepReps = (i: number, dir: 1 | -1) =>
    setR((x) => ({ ...x, sets: stepReps(x.sets, i, dir) }));
  const onStepWeight = (i: number, dir: 1 | -1) =>
    setR((x) => ({ ...x, sets: stepSetWeight(x.sets, i, dir, x.weightUnit) }));

  const livePreview = buildSchemeSummary(r);
```

Then replace the entire **Weight** block and **Scheme** block (lines 473-561, from `{/* Weight */}` through the `{!usingCustom && <div className="mb-4" />}` line) with a single **Sets** block:

```tsx
        {/* Sets */}
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
            3. Sets {supportsWeight && `(${weightStep(r.weightUnit)} ${r.weightUnit} weight steps)`}
          </p>
          {supportsWeight && (
            <div className="flex shrink-0 rounded-lg bg-gray-100 p-0.5">
              {(["kg", "lb"] as WeightUnit[]).map((u) => (
                <button
                  key={u}
                  onClick={() => setR((x) => ({ ...x, weightUnit: u }))}
                  className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                    r.weightUnit === u ? "bg-emerald-500 text-white" : "text-gray-600"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="mb-2 text-[11px] text-gray-600">
          Each set starts from the one above — just tap what changed.
        </p>
        <div className="mb-3 flex flex-col gap-2">
          {r.sets.map((s, i) => (
            <SetRow
              key={i}
              index={i}
              set={s}
              unit={r.weightUnit}
              supportsWeight={supportsWeight}
              repsD={repsDelta(r.sets, i)}
              weightD={weightDelta(r.sets, i)}
              onStepReps={(dir) => onStepReps(i, dir)}
              onStepWeight={(dir) => onStepWeight(i, dir)}
            />
          ))}
        </div>
        <div className="mb-3 flex gap-2">
          <button
            onClick={onAddSet}
            disabled={r.sets.length >= MAX_SETS}
            className="flex-1 rounded-xl border border-emerald-300 bg-emerald-50/40 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
          >
            + Add set
          </button>
          <button
            onClick={onRemoveSet}
            disabled={r.sets.length <= MIN_SETS}
            className="flex-1 rounded-xl border border-gray-200 bg-white py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            − Remove set
          </button>
        </div>
        {livePreview && (
          <div className="mb-4 rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
              Saves as
            </p>
            <p className="text-sm font-semibold text-gray-800">{livePreview}</p>
          </div>
        )}
```

Update the **Notes** step number (the `{notesNo} Notes (optional)` line, ~line 565) to a literal `4.`:

```tsx
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-600">
          4. Notes (optional)
        </p>
```

Update the **Save** button's disabled guard (line 593) from `!r.scheme.trim()` to a sets check:

```tsx
            disabled={!r.bodyPart || r.sets.length === 0}
```

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS. If `tsc` flags an unused `notesNo`/`schemeNo`/`weightSectionNo`, confirm those consts were fully removed in Step 5.

- [ ] **Step 7: Run the full unit suite**

Run: `npx vitest run src/lib/gym`
Expected: PASS (sets + summary suites green).

- [ ] **Step 8: Commit**

```bash
git add src/app/gym/gym-entry.tsx
git commit -m "feat(gym): per-set reps & weight editor with carry-forward (Helper-efi)"
```

---

## Task 8: Verify in the running app and close out

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server and open the Gym page**

Use the preview tooling (`preview_start`, then navigate to `/gym`). The page requires a signed-in player; if a session isn't available in preview, verify instead by reading the rendered component and confirming the unit suite + typecheck pass, and note that in the summary.

- [ ] **Step 2: Exercise the flow (when a session is available)**

Confirm, via `preview_snapshot` / `preview_click`:
1. Add exercise → pick body part → pick a **weighted** equipment (e.g. Lbb) → the Sets block shows Set 1 with reps + weight steppers.
2. Add set → new set inherits the previous reps & weight; a `+`/`−` delta badge appears only when you change a value.
3. Switch equipment to **None** → weight steppers disappear, "Saves as" shows reps-only.
4. Save → the logged card shows the summary string (e.g. `6 sets · 14×10 · …`).
5. Reload the date → the exercise reloads with the same sets (round-trip).

- [ ] **Step 3: Full quality gates**

Run: `npx tsc --noEmit && npm run lint && npm run test`
Expected: all PASS.

- [ ] **Step 4: Close the bead and push**

```bash
bd close Helper-efi
git pull --rebase
bd dolt push
git push
git status   # MUST show "up to date with origin"
```

---

## Self-review notes

- **Spec coverage:** per-set list (T7), carry-forward + deltas (T4/T7), 1–8 limits (T4/T7), no-weight reps-only (T5/T7), JSONB storage + reused `scheme` (T1/T6), reps default 10 / weight 0 / start at 1 set (T3), notation strings (T5), exact set totals (T5), legacy display fallback (T6/T7), tests-first (T4/T5). All mapped.
- **Out of scope (unchanged):** body-weight/body-part/equipment/notes/narration steps, Sheets historical migration, removal of `gym_catalog` scheme rows, plank seconds.
- **Type consistency:** `ExerciseSet {reps, weight}`, `ExerciseRow.sets`, and `buildSchemeSummary`/`addSet`/`removeSet`/`stepReps`/`stepSetWeight`/`repsDelta`/`weightDelta` names are used identically across tasks.
