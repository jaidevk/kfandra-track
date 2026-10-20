# KLC League Scoring, Tables & Leaderboards — Handover

**Date:** 2026-10-16 · **Status:** Handover, input to brainstorm → spec → plan (superpowers flow)
**Source:** KFANDRA email of 2026-10-02 (`docs/KFANDRA-Jacaranda-updates-2026-10-02.pdf`)
**Priority:** 2nd, after Diet nutrition. The goal is to start the S2 (`KLCFERRSXVSG2`) league.
**Codebase baseline:** `main` @ `ae0fba3` (KLCSRA Phases 1–3 shipped in PR #3, 2026-08-24)
**Parent bead:** Helper-bsr (KLCSRA). This package replaces the old "Phase 4" in `2026-08-23-klcsra-release-roadmap.md`.
**Estimate:** ~1.5 weeks.

---

## 1. Requirements (as asked by KFANDRA)

| ID | Requirement | Notes |
|---|---|---|
| R1 | Add **Match Recorder, Seasons and Scoring** to the "common" list | Today these are admin-only (`/admin/klc/matches`, `/admin/klc/seasons`). See Q9. |
| R2 | **Automatic points** for every match played, in every format | Computed on submit/read, never typed in by hand. |
| R3 | New **points scale** by match type × players involved (table below) | Replaces the current `klcsra_standings_rules`. |
| R4 | **Session caps**: matches with 4–6 players allow at most 3 per session; matches with 2–3 players allow at most 2 per session | See Q4. |
| R5 | Table columns: **games played, W, D, L, goals for/against, tries for/against, goal/points difference, points** | Mirror the KFANDRA sheet "KLCFERRSXVSG1 session sheet". |
| R6 | **One combined table + 4 separate tables**: Fooba/Football, Rugby Sox, Rugby Variations, Football Short Game Variations | Tables are visible **in the app**, not on the website. |
| R7 | **Leaderboards**: highest scorers etc. | KFANDRA said "if not set up, please do". It isn't built yet. |
| R8 | Matches stay **re-editable** ("based on trust") | The existing Reopen flow already covers this. Tables must recompute after an edit. |

### Points scale (R3/R4)

| Match type | 7+ players | 4–6 players (≤3 matches/session) | 2–3 players (≤2 matches/session) |
|---|---|---|---|
| Football / Fooba | Win **5** | — (Q3) | — (Q3) |
| Rugby Sox | Win **5** | — (Q3) | — (Q3) |
| Rugby Variation | Win **3** | Win **1** | Win **0.5** |
| Short Game Variation | Win **3** | Win **1** | Win **0.5** |
| Multi-Game Variation | Win **3** | Win **1** | Win **0.5** |
| Draw (all types) | **1** | **0.2** | **0.1** |
| Loss | 0 (assumed, Q1) | 0 | 0 |

---

## 2. Current state (what exists in code)

| Area | Where | State |
|---|---|---|
| Per-match points calculation | `src/lib/klcsra/standings.ts` `computeStandingPoints()` | 2 tiers by **total players** (`playerThreshold: 6`): win 3 / draw 1, and below that win 0.2 / draw 0.05. Adds a ±1 bonus/penalty for margins ≥ 20. |
| Combined-match points | `src/lib/klcsra/combined.ts` `computeCombinedPoints()` | 0.2 per half won plus a 0.1 aggregate bonus. |
| Rules config | `app_config.klcsra_standings_rules` (migration `20260815120000`), parsed by `standings-rules.ts` | v1 shape. Must change to the v2 shape below. |
| Match types | `klc_matches.sport` check constraint `football \| rugby \| fooba \| variation` | One generic `variation`. KFANDRA now names 3 variation types. |
| Per-sport stat allow-list | `app_config.klcsra_sport_stats` | Includes `variation` (all stats). |
| Squad size | `klc_match_appearances.slot` 1..6 per side | So **a maximum of 12 players in total**. The 7+ tier is only reachable if counted across both sides (Q3). |
| Score | `klc_match_sides.score` per half per side | Used for W/D/L and for/against. |
| Player stats | `klc_player_stats(appearance_id, half_no, stat_key, stat_count)` | Source for leaderboards. |
| Standings / leaderboard UI | — | **Not built.** |
| Read access | RLS on all `klc_*` tables is `app.is_staff()` for SELECT | Blocks player-facing tables (Helper-h9i). |
| Home "common" blocks | `src/app/home-screen.tsx`: MMG, S&C, Diet, Balance Sheet; Admin link for staff | No KLC league block. |

---

## 3. Proposed spec

### 3.1 Match types (migration)
- Widen `klc_matches_sport_chk` to: `football`, `fooba`, `rugby` (UI label **Rugby Sox**), `rugby_variation`, `short_game_variation`, `multi_game_variation`.
- Existing `variation` rows: check prod first (`select sport, status, count(*) from klc_matches group by 1,2`). If there are none, drop `variation` from the constraint. Otherwise map them with KFANDRA's help (Q10).
- `klcsra_sport_stats`: add the three new keys and copy the current `variation` list into each (KFANDRA can narrow them later).
- Recorder header sport chips: show the 6 types with UI labels from `src/content/strings.ts`.
- Allow changing the match type while the match is still a **draft**. This extends `updateMatchMetaAction`, which also closes the known "Friendly/Combined fixed at creation" gap.

### 3.2 Rules config v2 (`app_config.klcsra_standings_rules`)
```json
{
  "version": 2,
  "playerCount": "total",
  "tiers": [
    { "key": "7plus", "min": 7,  "max": null, "sessionCap": null },
    { "key": "4to6",  "min": 4,  "max": 6,    "sessionCap": 3 },
    { "key": "2to3",  "min": 2,  "max": 3,    "sessionCap": 2 }
  ],
  "win": {
    "football":             { "7plus": 5 },
    "fooba":                { "7plus": 5 },
    "rugby":                { "7plus": 5 },
    "rugby_variation":      { "7plus": 3, "4to6": 1, "2to3": 0.5 },
    "short_game_variation": { "7plus": 3, "4to6": 1, "2to3": 0.5 },
    "multi_game_variation": { "7plus": 3, "4to6": 1, "2to3": 0.5 }
  },
  "draw": { "7plus": 1, "4to6": 0.2, "2to3": 0.1 },
  "loss": 0,
  "overCap": "zero_points"
}
```
- A type/tier pair with no `win` entry earns **0** but still counts as played (default for Q3).
- Drop `margin` and `combined` bonuses (default for Q1). Keep the parser tolerant of v1 so old rows don't crash, but compute with v2 only.
- All numbers stay in config, following the house rule that game rules are never hard-coded.

### 3.3 Points calculation (pure, TDD)
- New `computeMatchPoints({ sport, totalPlayers, homeScore, awayScore }, rules)` returns `{ tier, home, away }`.
- Result: higher score wins, equal scores draw.
- Session cap (R4, Q4): the recorder never blocks a match. After computing points per club per session (= `entry_date`, Q4), order that club's league matches in the capped tier by `submitted_at`. Matches past the cap score **0** and get an `overCap: true` flag shown in the table detail and the recorder.
- Combined matches (Q6, **answered by KFANDRA 2026-10-16**): a combined match is **one match between two club pairs** (AB vs CD), not two results. Each of the four clubs records **one** result against the other pair, with its home/away/neutral role (`klc_match_sides.role`). The result comes from the **aggregate score** (sum of both halves) — **confirmed (Jaidev, 2026-10-20)**. Defaults until confirmed: each club in the winning pair gets the full win points; GF/GA are the aggregate totals; it counts as one match played per club. H1/H2 recording and per-half player stats are unchanged.
- `round4()` is kept for the fractional points.

### 3.4 League tables (R5/R6)
- **Derived on read** (no stored table, so nothing can drift): one server function `getLeagueTable(seasonId, group)` over **submitted, non-friendly** matches in the season.
- Groups via config `app_config.klcsra_table_groups`:
  ```json
  { "all": "*",
    "football_fooba": ["football","fooba"],
    "rugby_sox": ["rugby"],
    "rugby_variations": ["rugby_variation"],
    "short_game_variations": ["short_game_variation"] }
  ```
  `multi_game_variation` appears in **All** only (default for Q2).
- Columns: P, W, D, L, GF, GA, TF, TA, Diff, Pts.
  - "Tries" sports are `rugby` and `rugby_variation`. Their side score goes to TF/TA. All others go to GF/GA.
  - Diff = (GF + TF) − (GA + TA) (default for Q7).
- Sort: Pts ↓, Diff ↓, (GF + TF) ↓, club name (default for Q5).
- Season switcher. Defaults to the active season, and S1 stays browsable.

### 3.5 Leaderboards (R7)
- Source: `klc_player_stats` on submitted league matches in the season.
- Boards:
  - Goals (`goal` + `mainGoal` + `reboundGoal`)
  - Tries
  - Assists
  - Pre-assists
  - Saves
  - Tackles
  - Discipline (YC/RC/BC/late)
  - Kroopies
  - MMG
- Top 10 each, with a filter by table group. Friendlies are excluded except on the MMG board (Q8).

### 3.6 Visibility and "common list" (R1, Helper-h9i)
- Add **read-only** SELECT policies for `authenticated` on `klc_seasons` plus the five match tables, restricted to `status = 'submitted'`. Writes stay staff-only. Drafts stay hidden.
- Fix **Helper-0gr** in the same migration: a trigger on the child tables rejects writes when the parent match is `submitted`. Reopen goes through a KFANDRA-only server action. Once tables are public, a locked match must really be locked.
- Fix **Helper-r01** (touch-parent trigger), so cache revalidation and "recent" ordering are correct after edits.
- New home block **"KLC League"** → `/klc/league`, with tabs **Table · Matches · Leaders · Seasons · Scoring**:
  - **Table**: the 5 tables via a group chip row, plus the season switcher.
  - **Matches**: read-only list of submitted matches, grouped by date (reuses the recorder list look), opening a read-only match report.
  - **Leaders**: §3.5.
  - **Seasons**: read-only list of seasons with status and dates.
  - **Scoring**: the points scale rendered **from config** (so it never goes stale).
- The Match Recorder (writing) stays at `/admin/klc/matches` for staff.

### 3.7 Recorder touches
- Show the tier ("7+ / 4–6 / 2–3") and the computed points in the submit preview.
- Show (do not block) an "over limit, 0 points" note when a match is over the session cap.

### 3.8 Tests
- Unit tests:
  - every type × tier × win/draw/loss
  - over-cap ordering
  - combined match: one aggregate result per club, all four clubs present
  - v2 parse and v1 tolerance
  - grouping
  - tie-break sort
  - TF/TA vs GF/GA split
- Config contract test for the new keys.
- e2e (local Supabase only, **never against prod**):
  - record and submit → the table updates
  - reopen, edit, resubmit → the table updates
  - a non-staff player sees the table but not drafts

---

## 4. Open questions for KFANDRA (defaults used until answered)

KFANDRA replied on 2026-10-16 to Q6 only (the others were not asked in that email). The rest keep their defaults; Q11 (the S1 sheet) is being asked again.

| # | Question | Default |
|---|---|---|
| Q1 | Do the new points **replace** the old winning-margin bonus/penalty and the combined-match half bonuses? Is a loss always 0? | **Decided (Jaidev, 2026-10-16): yes, replace both. Loss = 0.** |
| Q2 | Multi-Game Variation earns points but has no table of its own. Should it be in the combined table only? | Combined only |
| Q3 | **Player count**: both teams together, or per team? Do Football/Fooba and Rugby Sox with fewer than 7 players earn anything? | **Decided: total players across both teams.** Under-7 Football/Fooba/Rugby Sox: played, 0 points (default) |
| Q4 | **Session cap**: what happens to matches beyond 3 (4–6 players) or 2 (2–3 players) in a session? | **Decided: the app never blocks recording; what happened on the ground is the source.** Extra matches are recorded and flagged "over limit" with 0 points (default; ground time limits this in practice). Session = date, per club |
| Q5 | **Tie-breakers** when points are level | Difference, then scored, then name |
| Q6 | **Combined matches** (clubs swap at half time): is each half a separate result, or one result? | **Answered (KFANDRA, 2026-10-16): one result.** AB vs CD is one match; each of A, B, C, D records one result against the other pair (home/away/neutral). **Confirmed (Jaidev, 2026-10-20): the aggregate score over both halves decides the winner.** Still to confirm: full points to each club of the pair |
| Q7 | **Goals vs tries**: Fooba main and rebound goals both count as goals? Combined-table difference = goals and tries together? | Yes and yes |
| Q8 | Do **friendlies** appear in tables/leaderboards? | No (except the MMG board) |
| Q9 | What does the **"common list"** mean? Read-only views for all players? | Read-only for all players. Recording stays staff-only |
| Q10 | Is "Rugby Sox" today's `rugby`? How should any existing `variation` matches be re-labelled? | Yes. Re-label only if prod has any |
| Q11 | Please share the **KLCFERRSXVSG1 session sheet** (Drive), so the table layout and S1 results can be used as test fixtures | — |

---

## 5. Prerequisites and related beads
- **Helper-h9i** (decide public read path). Resolved by §3.6.
- **Helper-0gr** (enforce submit lock in the DB). Part of this package.
- **Helper-r01** (child edits bump `updated_at`). Part of this package.
- Helper-9ze (slot reorder in a transaction). Not blocking.
- Before shipping: confirm the prod KLCSRA migrations, the S2 status, and any recorded matches (Supabase dashboard). The cloud session couldn't check these.

## 6. Out of scope
- Balance-sheet write-back and anything financial (see `2026-10-16-klc-finance-stadium-handover.md`).
- Website publishing of tables.
- Growing squads beyond 6 per side.

## 7. KFANDRA checkpoint (acceptance)
- Replay 3–4 S1 matches from the sheet: points, W/D/L and for/against match the sheet.
- One 7+ football, one 4–6 rugby variation and one over-cap match produce the expected points.
- A player (non-staff) can open KLC League and see tables, leaders, seasons and scoring, but no drafts.
- Reopen and edit a match: the tables change accordingly.

## 8. Suggested beads (create under Helper-bsr)
1. Match types v2 migration + sport stats + draft type edit
2. Standings rules v2 config + `computeMatchPoints` + session cap (TDD)
3. League table aggregation + groups (TDD)
4. Leaderboards aggregation
5. RLS public read of submitted matches + submit-lock trigger + touch-parent trigger (closes h9i, 0gr, r01)
6. `/klc/league` UI (Table · Matches · Leaders · Seasons · Scoring) + home block
7. Recorder: tier and points preview + over-cap warning
8. e2e + KFANDRA checkpoint doc
