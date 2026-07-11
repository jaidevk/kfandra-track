# Strength & Conditioning tests + breadcrumbs — design

Date: 2026-07-12
Status: approved (pending spec review)

## Context

The "Gym" mode logs unscored strength/conditioning work per (player, day).
The entry sheet ([`src/app/gym/gym-entry.tsx`](../../../src/app/gym/gym-entry.tsx))
has four numbered sections: **1. Body part / movement → 2. Equipment →
3. Sets (reps + weight) → 4. Notes**. All reference lists (body parts,
equipment, schemes) live in the admin-editable `gym_catalog` table
([seed](../../../supabase/migrations/20260607120007_seed_gym_catalog.sql)).
Per-exercise sets are stored as a `jsonb` array of `{reps, weight}` on
`gym_log_exercises`.

KFANDRA wants to add fitness **tests** (Bronco, Bleep, and a set of
"1-minute" tests) to this flow, rename the mode, and fix a navigation trap:
iPhone standalone-PWA users have no browser back button and get stuck on the
mode pages.

## Goals

1. Rename "Gym" → "Strength and Conditioning" everywhere user-facing (route,
   internal keys, and analytics stay `gym` — no data migration).
2. Add an "S and C Tests" option to section 1 that reshapes the sheet into a
   **test-entry mode**.
3. Record **TIME TAKEN** (mins + seconds) for timed tests and **REPS** for
   1-minute tests, with multiple attempts per test.
4. Add a **tests** tally to the header card.
5. Add breadcrumbs to the mode pages so PWA users can navigate home.

Non-goals: scoring tests (gym stays unscored); an admin UI for editing the
test catalog (direct-DB / existing catalog editing is sufficient); importing
data from the Google Sheet.

## Design

### 1. Rename (user-facing only)

Change display strings; leave the `/gym` route, `gym_*` tables, `gym:` draft
keys, and `AnalyticsEvent`/`mode: "gym"` untouched.

- `src/content/strings.ts` → `home.gym.title` = "Strength and Conditioning";
  `admin.gymCard` labels.
- `gym-entry.tsx` header eyebrow "Gym log · {name}" → "S&C log · {name}";
  footer note "Gym tracking is not scored…" → "S&C tracking is not scored…".

The card is narrow (3-across grid); "Strength and Conditioning" wraps to
multiple lines, which is acceptable — verify it renders without clipping.

### 2. Catalog model — tests as a new `gym_catalog` kind

New migration(s):

- `ALTER TYPE app.gym_catalog_kind ADD VALUE 'test';`
- `gym_catalog` gains two nullable columns:
  - `metric text` with `CHECK (metric IN ('time','reps'))` — set for test
    rows only.
  - `full_name text` — the spelled-out subtitle for a chip (option C
    display). Null → no subtitle shown.
- The existing `icon` column carries the chip emoji.
- The picker **group** is derived from `metric` (`time` → "Timed tests",
  `reps` → "1-minute tests") — no extra column.

`loadGymCatalog` ([`src/lib/gym/config.ts`](../../../src/lib/gym/config.ts))
gains a `tests: TestOption[]` field, where
`TestOption = { value, fullName: string | null, icon: string | null, metric: "time" | "reps" }`.

#### Seed data

Body-part addition (`kind = 'body_part'`), placed last:

| value | icon |
|---|---|
| S and C Tests | 🎯 |

Tests (`kind = 'test'`). `full_name` is the option-C subtitle; where it
equals the acronym it is an explicit placeholder to be edited later in the
catalog.

| value | metric | icon | full_name |
|---|---|---|---|
| Bronco Test | time | 🏃 | *(null)* |
| KFANDRA Bleep Test | time | 🔊 | *(null)* |
| Press ups | reps | 📐 | *(null)* |
| PUJ | reps | 💥 | PUJ *(placeholder)* |
| KSAV (Football) | reps | ⚽ | KSAV (Football) *(placeholder)* |
| KSAV (Normal) | reps | 🧱 | KSAV (Normal) *(placeholder)* |
| Calf jumps | reps | 🦵 | *(null)* |
| CJF | reps | 🦵 | CJF *(placeholder)* |
| CJR | reps | 🦵 | CJR *(placeholder)* |
| Free Squats | reps | 🪑 | *(null)* |
| Free Squat jumps | reps | 🪑 | *(null)* |
| FSJF | reps | 🪑 | FSJF *(placeholder)* |
| FSJR | reps | 🪑 | FSJR *(placeholder)* |
| Zor | reps | 🤸 | Hindu push-up |
| Rev. Zor | reps | 🤸 | Reverse Zor |

`sort_order` follows the table order (timed first, then the 1-minute list in
the order KFANDRA listed them). All emojis/names are catalog data and editable
later without a deploy.

### 3. Entry-sheet test mode

A logged item is either an **exercise** or a **test**. Introduce an
`entryType: "exercise" | "test"` discriminator on the draft row model in
[`src/lib/gym/types.ts`](../../../src/lib/gym/types.ts). Test rows additionally
carry `testName: string`, `testMetric: "time" | "reps"`, and an **attempts**
list; exercise rows keep `equipment`, `weightUnit`, and `sets` as today.
Implement as a discriminated union (preferred, prevents nonsense states like a
test with weight) — exact TypeScript shapes are an implementation choice for
the plan.

Attempt shapes:
- time: `{ mins: number; seconds: number }`
- reps: `{ reps: number }`

The `ExerciseSheet` picks its mode from the selected body part. When
`bodyPart === "S and C Tests"`:

- **Section 2** renders the **Test** picker instead of Equipment.
- **Section 3** renders **TIME TAKEN** (mins + seconds steppers) when the
  selected test's metric is `time`, or **REPS** (single count stepper) when
  `reps`. Both reuse the existing +Add / −Remove attempt pattern (mirrors
  Sets; carries forward the previous attempt's values; same MIN/MAX bounds as
  sets). "Did the test twice" → two attempts. A per-attempt delta vs the prior
  attempt is shown (as Sets already do).
- **Section 4** Notes is unchanged.

Selecting a normal body part restores the Equipment / Sets layout.

Pure attempt helpers (add/remove/step/delta) live beside the existing set
helpers in [`src/lib/gym/sets.ts`](../../../src/lib/gym/sets.ts) (or a sibling
`attempts.ts`), unit-tested like the set helpers.

#### Summary string

`buildSchemeSummary` ([`src/lib/gym/summary.ts`](../../../src/lib/gym/summary.ts))
branches on `entryType`:
- time: `"5m 12s / 5m 05s"` (attempts joined by " / ")
- reps: `"42 reps"` (or `"42 / 39 reps"` for multiple)

Displayed on the logged-item card and in the "Saves as" preview.

### 4. Header tally

`gym-entry.tsx` currently shows **exercises** (row count) and **sets** (sum of
sets). Split by `entryType`:
- exercises = count of exercise rows
- sets = sum of sets across exercise rows only
- tests = count of test rows

Render the **tests** stat (styled distinct, e.g. amber) only when `tests > 0`,
so players who never log tests see the unchanged two-stat header.

### 5. Persistence

`gym_log_exercises` gains:
- `entry_type text NOT NULL DEFAULT 'exercise'` (`CHECK (entry_type IN ('exercise','test'))`)
- `test_name text` (nullable)
- `test_metric text` (nullable, `CHECK (test_metric IN ('time','reps'))`)

The existing `sets` jsonb holds attempts for test rows (`{mins,seconds}` or
`{reps}`). Existing exercise rows are unaffected (`entry_type` defaults to
`'exercise'`).

`loadGymLog` / `saveGymLog`
([`src/lib/gym/repository.ts`](../../../src/lib/gym/repository.ts)) branch on
`entry_type` when mapping rows ↔ draft. The wholesale delete-and-reinsert save
strategy is unchanged; the skip-empty filter treats a test row as loggable
when it has a `testName` and ≥1 attempt.

### 6. Breadcrumbs

A small reusable client component (e.g. `src/components/breadcrumb.tsx`)
rendering `‹ KFANDRA  ›  <current>` where "KFANDRA" is a `next/link` to `/`.
Rendered at the top of `/gym`, `/diet`, and `/mmg` (in each page's output,
above the entry form). Labels: Strength & Conditioning, Diet, MMG. This is a
top-level home affordance for standalone-PWA users; existing in-sheet "Back"
controls (e.g. diet meal slots) are unaffected.

## Testing

- Unit: attempt helpers (add/remove/step carry-forward, min/max, delta);
  `buildSchemeSummary` for time and reps (single + multiple attempts);
  header tally split by entry type.
- Repository round-trip: save a draft mixing an exercise and a timed test and
  a reps test → reload → identical draft (via existing repo test patterns).
- E2E (Playwright, if in scope): pick S and C Tests → Bronco → log two timed
  attempts → save → reload shows "5m 12s / 5m 05s"; tests tally = 1.
- Manual: "Strength and Conditioning" card renders without clipping;
  breadcrumb returns home from standalone PWA.

## Rollout

Additive and backward-compatible: new nullable columns with safe defaults, a
new enum value, and new seed rows. No migration of existing gym logs. Route,
keys, and analytics unchanged.
