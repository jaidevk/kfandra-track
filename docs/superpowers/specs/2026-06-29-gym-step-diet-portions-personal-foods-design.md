# Gym 0.5 Stepper, Diet Half-Portions & Personal "My Foods" — Design

**Date:** 2026-06-29
**Status:** Approved (design phase)
**Source:** Feedback from KFANDRA (gym weight increment) + teammate input (diet portions & custom foods reuse)

## Summary

Three related changes across the Gym and Diet features:

1. **Gym** — change the weight stepper from `2 kg / 5 lb` per tap to `0.5 kg / 1 lb` per tap.
2. **Diet** — allow half portions: stepper moves by `0.5` with a minimum of `0.5` (today it is whole numbers, minimum `1`).
3. **Diet** — add a per-player **"My foods"** list: a custom food a player logs is automatically saved and reappears as a one-tap chip next time. Capped at 8 entries with automatic eviction. Does **not** touch the curated shared catalog.

## Motivation

- Players need finer weight control at GWW (gym work weight): a 2 kg step can't reach odd targets (e.g. 13 kg) and is too coarse for gradual progression. KFANDRA plans to introduce 0.5 kg plates in future. Multiple taps to reach a weight is acceptable and expected.
- Players sometimes eat half a portion and currently can't log under `1`.
- A teammate expected custom food entries to "get added to the lists" so they're reusable. Today custom items are one-off snapshots on a single day's log and never reappear.

---

## 1. Gym — 0.5 kg / 1 lb stepper

### Change
Single source of truth in `src/lib/gym/types.ts`:

```ts
/** Weight increment per tap for a unit (0.5 kg / 1 lb). */
export function weightStep(unit: WeightUnit): number {
  return unit === "kg" ? 0.5 : 1;
}
```

Everything downstream already derives from this:
- `stepSetWeight` in `src/lib/gym/sets.ts` (floors at 0).
- The `−` / `+` buttons in `src/app/gym/gym-entry.tsx`.
- Display `{set.weight}`.

### Correctness notes
- Weights are stored as numbers in the JSONB `sets` column — no schema change.
- `0.5` is exact in IEEE-754 binary; repeated `±0.5` additions accumulate without drift. `1` (lb step) is trivially exact.
- Numeric rendering shows `13` and `13.5` cleanly (no trailing `.0`).

### Tests
Update `src/lib/gym/sets.test.ts` to expect the new steps:
- `stepSetWeight(..., 1, "kg")` → `+0.5`
- `stepSetWeight(..., 1, "lb")` → `+1`
- floor-at-0 behavior unchanged.

---

## 2. Diet — half portions (0.5 step, min 0.5)

The database already supports this: `diet_log_items.count` is `numeric(6,2)` with a `count > 0` check. The restriction is purely UI.

### Changes (all in `src/app/diet/diet-entry.tsx`)
- **Logged-item steppers** (`adjustLogged` / expansion-panel ± buttons): step by `±0.5` instead of `±1`. Items still drop out when they reach `0` (existing `count > 0` filter).
- **Custom-item sheet quantity:** start at `1`; `−` → `Math.max(0.5, q - 0.5)`; `+` → `q + 0.5`.
- **Catalog tap** still starts a new item at `1` (a whole portion is the common case; half is reached by tapping `−` once).
- **Display:** counts render as `0.5`, `1`, `1.5`, … (tabular-nums already in place).

### Tests
Cover the pure stepping/clamping logic (in `src/lib/diet/summary.ts` or wherever the adjust helper lives — extract a pure helper if the logic is currently inline in the component) for: `1 → 0.5`, `0.5 → 0` (removed), `0.5 → 1.0`, half-portion totals.

---

## 3. Diet — personal "My foods" list

A per-player palette of their own custom foods, so anything added once is one tap away next time. Private per player. The curated shared `food_catalog` is untouched (no pollution, no moderation burden).

### Data model

New table `player_food_items`:

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `player_id` | uuid | fk → `players(id)`, on delete cascade |
| `name` | text not null | the custom food name |
| `unit` | text | unit label (e.g. "1 scoop"), nullable |
| `notes` | text | optional, nullable |
| `use_count` | int not null default 1 | for ordering + eviction |
| `last_used_at` | timestamptz not null default now() | tiebreak for eviction, recency |
| `created_at` | timestamptz not null default now() | |

Constraints / indexes:
- Unique `(player_id, lower(name), coalesce(lower(unit), ''))` — dedup so re-adding bumps the existing row instead of inserting.
- Index on `player_id` for lookups.

**RLS:** a player may select/insert/update/delete only rows where `player_id` matches their own player record — mirror the existing diet-log RLS pattern.

### Behavior

**Auto-save (on logging a custom item).** When a player saves a custom item in the existing custom-item sheet, upsert into `player_food_items`:
- If a row matching `(player_id, name, unit)` exists → bump `use_count` and set `last_used_at = now()`. **No eviction** (count unchanged).
- Else insert a new row (`use_count = 1`). Then enforce the cap (below).

**Cap = 8 with automatic eviction.** After inserting a *new* row, if the player now has more than 8 rows, delete the **least-used**: lowest `use_count`, ties broken by **oldest `last_used_at`**. This guarantees the just-inserted row (most recent `last_used_at`, count 1) is never the one evicted when other count-1 rows exist. Do the insert + eviction in one transaction (server action / RPC).

**The diet log stays a snapshot.** `diet_log_items` continues to store the custom `name`/`unit` inline (`food_item_id` NULL) exactly as today. `player_food_items` is only a reusable palette — old logs are never rewritten when a palette entry changes or is evicted.

### UI

- In the meal food-picker (`src/app/diet/diet-entry.tsx`), add a **"Your foods"** section at the top, above the catalog sections. Render the player's `player_food_items` as tappable chips styled like catalog items, ordered **most-used first** (`use_count` desc, then `last_used_at` desc).
- Hidden entirely when the player has no personal foods.
- Tapping a chip adds a logged item with that name/unit (foodKey null, custom fields populated), count starting at `1`, adjustable in 0.5 steps — identical to a catalog tap.
- **No manual remove** and **no save toggle** — saving is automatic, cleanup is automatic via eviction. This means zero management UI to build.

### Loading
`src/app/diet/page.tsx` (server) loads the player's `player_food_items` alongside the catalog and draft, and passes them into `diet-entry.tsx` as initial props. After an autosave that creates/bumps a personal food, the client updates its local copy (and/or the server action returns the refreshed list) so the "Your foods" section reflects the change without a full reload.

### Trade-offs accepted
- A once-popular food can stay "locked in" by a high `use_count` after the player stops eating it. At 8 slots with no remove, this is harmless — eviction only fires on the 9th insert, so it never crowds out genuinely new staples.
- Typo'd one-off customs (`use_count = 1`) are the first evicted as new foods arrive, so the list is self-cleaning.

### Out of scope (YAGNI, deferred)
- Surfacing recently-used **catalog** items in "Your foods" (v1 = the player's own customs only).
- Any admin/staff promotion of customs into the shared `food_catalog` (revisit if the club wants club-wide sharing).
- Per-player configurable cap, manual reorder, manual delete.

---

## Migration & files touched

**New migration:** `supabase/migrations/<ts>_player_food_items.sql` — table, unique index, `player_id` index, RLS policies.

**Code:**
- `src/lib/gym/types.ts` — `weightStep`.
- `src/lib/gym/sets.test.ts` — updated expectations.
- `src/lib/diet/types.ts` — `PlayerFoodItem` type; extend the page/entry props.
- `src/lib/diet/repository.ts` — load personal foods; upsert-with-eviction.
- `src/lib/diet/actions.ts` — server action wrapping the upsert/eviction, returning the refreshed list.
- `src/app/diet/page.tsx` — load + pass personal foods.
- `src/app/diet/diet-entry.tsx` — 0.5 portion stepping; "Your foods" section; auto-save call on custom add.
- Pure-logic tests for portion stepping and the eviction selection (lowest `use_count`, oldest `last_used_at`).

## Testing strategy (TDD)

1. **Gym step** — unit test `stepSetWeight` for 0.5 kg / 1 lb / floor.
2. **Portion step** — unit test the pure step/clamp helper (0.5 increments, min 0.5, removal at 0).
3. **Eviction** — unit test a pure `selectEvictee(items)` returning the lowest-`use_count` / oldest-`last_used_at` row; test that re-adding an existing item does not evict.
4. **Repository/RLS** — integration coverage that a player only sees their own personal foods and that the cap holds at 8.
