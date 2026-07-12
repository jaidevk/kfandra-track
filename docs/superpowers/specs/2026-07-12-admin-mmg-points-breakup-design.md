# Admin MMG points breakup — design

Date: 2026-07-12
Status: approved (pending spec review)

## Context

The admin submissions views collapse MMG scoring into a single number. In the
by-date table ([`src/app/admin/submissions/page.tsx`](../../../src/app/admin/submissions/page.tsx))
each player shows `Arrival · Confirm · Games · Total`, where the **Games**
column is a catch-all — its own caption reads *"Total = arrival + confirmation
+ games (games, stats, packing & other points)."* The by-player view shows
only counts (confirm #, arrival #, game count), no points at all.

The scoring engine already computes the buckets separately:
[`computeDraftPoints`](../../../src/lib/mmg/scoring.ts) returns
`{ participation, games, others, total }`, and the order ladder
([`order.ts`](../../../src/lib/mmg/order.ts)) gives `confirmationPoints` +
`arrivalPoints`. So the breakup is largely a display + repository-passthrough
change; the numbers exist.

### Production data (checked 2026-07-12, read-only via Management API)

16 sessions, 13 players, 77 submitted entries. Bucket usage:

| Bucket | Usage |
|---|---|
| Confirmation / Arrival | 75 / 77 entries each |
| Games | 68/77 have ≥1 game · 139 game rows · won 89 / drew 48 / lost 63 |
| Game stats | 193 rows across 8 stat types |
| Packing | weights 62, kit 57, unpacking 21, by-11am 24 |
| **Other** | **104 rows in 42/77 entries (55%)** · avg 7,224 pts · max 32,600 · total 303,400 |

Key finding: **"Other" is a first-class, high-magnitude, description-driven
bucket** (e.g. "Rugby Win as Manager +2000", "Passing drill 5 wins 1 tie
+7500") — not the rare afterthought the empty local seed implied. Every bucket
is populated in production, which justifies a full breakup and a drill-down.

## Goals

1. Replace the catch-all "Games" column with real category columns in **both**
   the by-date and by-player views.
2. Add a **tap-to-expand per-player drill-down** exposing the detail that the
   collapsed numbers lose (especially Other line descriptions and the game
   result/stat split).
3. Give the by-player history real point columns + a season total.

Non-goals: changing the scoring engine or any stored data; editing scoring
config (that already lives in `/admin/config`); charts/graphs.

## Design

### Category columns (both views)

Columns: `Confirm · Arrival · Games · Packing · Other · Total`.

- `Confirm`, `Arrival` — order ladder (unchanged source).
- `Games` — `computeDraftPoints().games` (game results + stats).
- `Packing` — `computeDraftPoints().participation` (the 4 flags).
- `Other` — `computeDraftPoints().others` (free-form rows).
- `Total` — unchanged grand total.

All five are **permanent** (no auto-hide) — production shows every bucket is
used. The mobile table gets tight at 7 columns; keep it scannable with
`tabular-nums`, right-aligned point columns, compact headers, and horizontal
scroll on the table wrapper rather than dropping columns.

### Drill-down (tap a player row)

An expandable detail region under the player row (by-date) / session row
(by-player), rendered on demand. Contents, each shown only if non-empty:

- **Games** — per game: type + result line (W/D/L counts × value) and each
  logged stat (`stat_key × stat_value`).
- **Packing** — which of unpacking / weights / kit / by-11am were earned.
- **Other** — each row's **description + points** (this is the point — a lumped
  "Other 7,500" is meaningless without "Passing drill 5 wins 1 tie").
- **Order ladder** — confirm #N → pts, arrival #N → pts.

The draft already carries all of this (`draft.games`, `draft.others`,
`draft.participation`); no new queries beyond what the repository already loads.

### By-player history

Today [`getPlayerSubmissions`](../../../src/lib/admin/submissions-repository.ts)
returns counts only. Extend it to compute per-session points (load each
session's draft + config, reuse `computeDraftPoints` + order points — the same
computation the by-date path already does), render the same category columns,
and append a **season total** row summing each column.

## Data / repository changes

No schema or migration changes. Extend the repository layer only:

- [`submission-rows.ts`](../../../src/lib/admin/submissions-rows.ts): widen
  `SessionRow` — replace the single `gamesPoints` with `gamesPoints`,
  `packingPoints`, `otherPoints` (keep `arrival`/`confirmation`/`total`), and
  carry an optional `detail` payload (games[], others[], packing flags, order)
  for the drill-down. Update `toSessionRows` and its unit tests accordingly.
- [`submissions-repository.ts`](../../../src/lib/admin/submissions-repository.ts):
  `getSessionSubmissions` already loads each draft to compute the self total —
  return the full `computeDraftPoints` breakdown + detail instead of just
  `.total`. `getPlayerSubmissions` gains the same per-session breakdown.
- Page component renders the new columns + an expandable row (client island
  for the toggle, or `<details>`), keeping the existing not-submitted styling
  and the submitted-first / total-desc ordering.

## Testing

- Unit: `toSessionRows` splits into the new columns and sums totals; a row with
  games + packing + other yields correct per-bucket values; non-submitters show
  0 across all columns.
- Repository: a fixture draft mixing games/stats/packing/other maps to the
  expected breakdown and detail (reuse existing scoring test fixtures).
- Manual: by-date table on a real session shows non-zero Other for the ~55% of
  entries that have it; expanding a row lists Other descriptions; by-player
  season row sums correctly.

## Rollout

Display + repository-only; additive and backward compatible. No data changes.
Independent of the S&C tests work
([`2026-07-12-strength-conditioning-tests-design.md`](2026-07-12-strength-conditioning-tests-design.md)).
