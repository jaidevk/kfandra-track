# Gym: per-set reps & weight logging

**Date:** 2026-06-24
**Status:** Approved (brainstorm) — ready for implementation plan
**Area:** MMG → Gym section

## Problem

When logging a gym exercise, players today:

1. Enter body weight.
2. Pick a body part / movement.
3. Pick equipment.
4. Set a **single** weight via a +/− stepper.
5. Pick a **fixed scheme** from a dropdown (`6 sets, 8, 4×6, 8`, `6 sets, 12, 4×8, 12`, …).

The single weight is misleading: in real workouts the weight (and reps) change set to set —
plates go on and come off as the exercise progresses. A lone weight number says nothing useful,
so players dump the real detail into the free-text "notes" field. The fixed scheme dropdown is
also too rigid (always 6 sets, fixed rep patterns) and doesn't match what was actually done.

## Goal

Replace the single-weight stepper **and** the fixed-scheme dropdown with a **per-set list**
that captures the reps and weight actually performed on each set, with minimal tapping.

## Design

### Flow

The Gym entry flow is unchanged up to equipment selection:

1. Body weight (unchanged).
2. Body part / movement (unchanged).
3. Equipment (unchanged).
4. **NEW — Sets list** replaces the single weight stepper + scheme dropdown.
5. Notes (unchanged, optional).

### Sets list

- Shows `Set 1 … Set N` cards, where `N` is between **1 and 8**.
- Each set captures **reps** and (for weighted equipment) **weight**, each with a `−` / `+` stepper.
- **Carry-forward:** every new set inherits the previous set's reps and weight. The player only
  taps what changed. Untouched sets simply keep the inherited values.
- **Delta badges:** sets after Set 1 show how they differ from the set above (e.g. `+5`, `−6`).
  Set 1 shows no badge.
- **Add set / Remove set** buttons. Min 1 set, max 8 sets. "Add set" appends a set that inherits
  the last set's values. "Remove set" drops the last set (disabled at 1).
- **Steps:** weight uses the existing `weightStep` (5 lb / 2 kg); reps step is 1.
- The kg/lb unit toggle stays per-exercise (unchanged behaviour).

### No-weight movements

For equipment where `supports_weight` is false ("None", "Resistance bands") — press-ups, burpees,
baithaks, planks, etc. — the **weight stepper is hidden**. Each set captures **reps only**.

### Defaults & limits

- A brand-new exercise starts with **1 set**: reps default **10**, weight default **0**.
  (Players add sets as needed. Usage will be tracked before tuning this default upward.)
- Set count is clamped to `1 … 8`.
- Reps clamp at a sensible floor of 1; weight floor is 0.

### Notation (saved summary)

A human-readable summary string is generated for display and downstream sync:

- **Weighted:** `6 sets · 14×10 · 8×15 · 8×25 · 8×20 · 8×20 · 14×20` — `reps × weight`, unit labeled once (lb/kg).
- **No-weight:** `6 sets · 14 · 8 · 8 · 8 · 8 · 14 reps`.

## Data model

### Approach: JSONB `sets` column (chosen)

Add a `sets` JSONB column to `gym_log_exercises` holding the structured per-set data:

```json
[{ "reps": 14, "weight": 10 }, { "reps": 8, "weight": 15 }, ...]
```

For no-weight movements each entry is `{ "reps": 14 }` (weight omitted or 0).

The existing `scheme` (text) column is **reused** to store the generated human summary string
(see Notation). This keeps the admin session views and the Google-Sheets sync working with no
changes — they keep reading `scheme`.

The legacy per-exercise `weight` column is no longer written for new logs (left nullable for
back-compat; not dropped).

**Rejected — separate `gym_log_exercise_sets` table.** More relationally correct and better for
future per-set analytics, but adds a table, joins, and save/load plumbing. Not justified while
Google Sheets remains the source of truth and the save path is a wholesale delete-and-reinsert.

### TypeScript types (`src/lib/gym/types.ts`)

```ts
export interface ExerciseSet {
  reps: number;
  weight: number; // 0 for no-weight movements
}

export interface ExerciseRow {
  id: string;
  bodyPart: string;
  equipment: string | null;
  weightUnit: WeightUnit;
  sets: ExerciseSet[];   // NEW — replaces single `weight` + `scheme`
  notes: string;
}
```

`weight: number` and `scheme: string` are removed from `ExerciseRow` in the draft model; the
generated summary string is computed at save time, not stored in the client draft.

### Save / load

- **Save** (`repository.ts`): unchanged wholesale pattern — upsert `gym_logs`, delete child
  `gym_log_exercises`, reinsert. Each inserted row now writes `sets` (JSONB) and `scheme`
  (generated summary). Rows with an empty body part are still filtered out; a row with body part
  but zero sets is dropped (nothing performed).
- **Load:** map `sets` JSONB back into `ExerciseRow.sets`. For **legacy rows** that have no `sets`
  data (saved before this change), fall back to showing the stored `scheme`/`weight` text as the
  summary; editing such a row re-captures it via the new Sets UI.

## Summary helpers (`src/lib/gym/summary.ts`)

- `estimateSets` becomes exact: a row's set count is `row.sets.length`.
- `totalSets(draft)` sums `sets.length` across rows.
- `hasWeight(row)` stays driven by equipment `supports_weight`.
- New: a `buildSchemeSummary(row)` (or similarly named) that produces the notation strings above.

## Out of scope

- Per-set rest timers, RPE, tempo, or other metrics.
- Duration/seconds capture for holds (planks) — reps-only for now.
- Editing or migrating historical Sheets data.
- Changing the body-weight, body-part, equipment, or notes steps.
- Removing the `gym_catalog` `schemes` rows from the DB (they simply stop being used by the UI;
  cleanup can be a later chore).

## Testing (TDD)

Write tests before implementation:

- **Carry-forward / delta logic:** adding a set inherits previous reps+weight; delta computed
  correctly (`+5`, `−6`); Set 1 has no delta.
- **Add/remove limits:** cannot exceed 8 sets; cannot drop below 1.
- **Summary generation:** weighted and no-weight notation strings, single-set and multi-set cases,
  kg vs lb unit labeling.
- **No-weight movements:** weight stepper hidden; sets store reps only.
- **Repository round-trip:** save a draft with multi-set exercises, reload, get identical `sets`.
- **Legacy load:** a row with `scheme`/`weight` but no `sets` still renders its summary.
