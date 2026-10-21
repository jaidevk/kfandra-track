# KLC League Scoring, Tables & Leaderboards — Design

**Date:** 2026-10-20 · **Status:** Design, approved section by section in the brainstorm; awaiting written review
**Input:** `2026-10-16-klc-league-scoring-handover.md` (requirements R1–R8, decisions Q1–Q10 in its §4)
**Parent bead:** Helper-bsr · **Closes:** Helper-0gr, Helper-r01, Helper-h9i
**Mockup:** `.superpowers/brainstorm/19684-1792516280/content/league-table-v2.html` (local only)

The rules are settled in the handover spec. This document only decides **how** to build them.

---

## 1. Approach

**Everything in TypeScript; auth in server actions; no RLS changes.**

- `src/lib/klcsra/repository.ts` uses the service-role client, so RLS is bypassed today. All access control already lives in `actions.ts`. We keep that model.
- Points, tables and leaderboards are **pure functions computed on read** over submitted matches. Nothing is stored, so nothing can drift. A season holds a few dozen matches, so this is cheap.
- Rejected:
  - **SQL views + RLS.** These would duplicate the JSON rules parsing in SQL and add a second auth model.
  - **Points stored at submit.** These drift when the config changes, and the handover asks for "derived on read".

## 2. Data (one migration: `…_klc_league_scoring.sql`)

**Before applying it,** run these read-only prod checks (via `querying-production-data`):
- `select sport, status, count(*) from klc_matches group by 1,2`
- S2 status
- applied KLCSRA migrations
- `select name, manager_player_id from clubs`

| Change | Detail |
|---|---|
| Match types | `klc_matches_sport_chk` → `football, fooba, rugby, rugby_variation, short_game_variation, multi_game_variation`. `variation` is dropped if prod has none; otherwise remap first (Q10). |
| `klc_matches.created_by` | `uuid null references players(id) on delete set null`. Null on existing rows. |
| `app_config.klcsra_standings_rules` | Replaced with the v2 JSON from handover §3.2, unchanged. |
| `app_config.klcsra_table_groups` | New: an ordered array `[{ "key": "all", "sports": "*" }, { "key": "football_fooba", "sports": ["football","fooba"] }, { "key": "rugby_sox", "sports": ["rugby"] }, { "key": "rugby_variations", "sports": ["rugby_variation"] }, { "key": "short_game_variations", "sports": ["short_game_variation"] }]`. Array order is display order. An array, not an object, because jsonb re-sorts object keys (by length, then bytes). |
| `app_config.klcsra_sport_stats` | Add the 3 new variation keys, each copying the current `variation` list. Remove `variation` if it was dropped. |
| Submit-lock trigger (Helper-0gr) | `BEFORE INSERT OR UPDATE OR DELETE` on `klc_match_halves`, `klc_match_sides`, `klc_match_appearances` and `klc_player_stats`. It resolves the parent match (directly, or via `half_id` / `appearance_id`) and raises `match is submitted` when `status = 'submitted'`. A cascade delete of the match passes (the parent row is already gone when the child triggers fire), which the e2e reset relies on. |
| Touch-parent trigger (Helper-r01) | `AFTER INSERT OR UPDATE OR DELETE` on the same four tables sets `klc_matches.updated_at = now()` on the parent. It skips the update if the parent row is gone (cascade). |

No RLS policy changes. Public reads go through a server-only repository that hard-filters to submitted rows (§4).

## 3. Domain (pure, `src/lib/klcsra/`, TDD)

### 3.1 `sport-stats.ts`
- `SPORTS` = the 6 types.
- `SPORT_LABELS` come from `src/content/strings.ts`: Football, Fooba, **Rugby Sox** (`rugby`), Rugby Variation, Short Game Variation, Multi-Game Variation.
- The recorder's sport chip grid goes from 4 across to 3 across × 2 rows.
- `DEFAULT_SPORT_STATS` is updated to match.

### 3.2 `standings-rules.ts` (rewritten)
- `parseStandingsRules(value): StandingsRulesV2`.
- Any value that isn't a valid v2 object (v1, malformed, missing keys) falls back to `DEFAULT_STANDINGS_RULES_V2`, which mirrors the migration JSON. It never throws.
- `tierFor(totalPlayers, rules)` returns `"7plus" | "4to6" | "2to3" | null`.

### 3.3 `points.ts` (new)
`computeMatchPoints({ sport, totalPlayers, homeScore, awayScore }, rules)` returns `{ tier, outcome: "home" | "away" | "draw", home, away }`.
- Higher score wins; equal scores draw.
- A win gets `rules.win[sport][tier]`, a draw gets `rules.draw[tier]` each, and a loss gets `rules.loss`.
- `tier === null` (fewer than 2 players) gives 0 / 0, but the match still counts as played.
- Results pass through `round4()`.

### 3.4 `league-table.ts` (new)
Input types:
- `LeagueMatch { id, sport, isCombined, isFriendly, totalPlayers, halves: { halfNo, home: { clubId, score }, away: { clubId, score } }[] }`
- `ClubRef { id, name }`

`buildLeagueTable(matches, groupKey, clubs, rules, groups)` returns `TableRow[]`, where a row is `{ clubId, clubName, P, W, D, L, GF, GA, TF, TA, Diff, Pts }`.

How a match turns into rows:
- **Filters:** friendlies are skipped. Only matches whose sport is in the group count (`"*"` = all).
- **Normal match:** one result from half 1, home club vs away club.
- **Combined match:**
  - `homeScore` = the sum of the home sides over both halves; likewise for away.
  - **Every distinct club** that appears on the `home` side in either half gets the home result, and likewise for away.
  - A club on the same side in both halves is counted **once**.
  - Each club gets P+1, the full points, and the aggregate for/against (Q6).
- **For/against:** `rugby` and `rugby_variation` scores go to TF/TA; all other sports go to GF/GA.
- **Diff** = (GF + TF) − (GA + TA).
- **Sort:** Pts desc, then Diff desc, then (GF + TF) desc, then club name asc.
- Clubs with P = 0 in the group are omitted.

`home`/`away` here is the **aggregate-team slot** (`klc_match_sides.side`), not the venue (`role`).

### 3.5 `leaderboards.ts` (new)
- **Input:** `StatRow { playerId, displayName, clubName, sport, isFriendly, statKey, count }[]`.
- **Club label:** `clubName` is the club of the player's side in the half the stat was recorded in. When a player has rows under several clubs, the board shows the club from their most recent match.
- `buildLeaderboards(rows, groupKey, groups, rates)` returns `Board[]`. A board is `{ key, label, entries: { rank, playerId, name, club, value }[] }`, with the top 10.
- **Ties:** a tied value shares a rank (1, 2, 2, 4). The list cuts off at 10 entries.

| Board | Value | Friendlies |
|---|---|---|
| Goals | `goal + mainGoal + reboundGoal` (own goals excluded) | excluded |
| Tries | `try` | excluded |
| Assists | `assist` | excluded |
| Pre-assists | `preAssist` | excluded |
| Saves | `save` | excluded |
| Tackles | `tackle` | excluded |
| Discipline | `yellowCard + redCard + blueCard + lateChallenge` | excluded |
| Kroopies | Σ count × `rates[stat].kr`, only for stats allowed for the sport (same rule as `computePlayerPayout`) | excluded |
| MMG | Σ count × `rates[stat].mmg`, same allow-list rule | **included** (Q8) |

- Boards whose entries are all 0 are omitted.
- The group filter applies to every board.

### 3.6 Deleted
`standings.ts`, `combined.ts` and their tests. These are the v1 rules (margin ±1, half bonuses), and nothing outside their tests uses them. Two lessons carry over into §3.4: the side-slot meaning, and de-duplicating clubs.

## 4. Read model: `src/lib/klcsra/league-repository.ts` (server-only, service role)

One function feeds the whole page: `listSubmittedMatchDrafts(season)` returns `MatchDraft[]` (the recorder's own shape, via `toMatchDraft`), newest first (entry date, then `submitted_at`, then id).

- League matches: `status = 'submitted'` and `season_id = season.id`.
- Friendlies: `status = 'submitted'`, `is_friendly`, and `entry_date` inside the season's window (open-ended while `end_date` is null). They carry no season and only feed the MMG board.
- Pure adapters in `league-data.ts` derive everything else on read: `toLeagueMatch` (`totalPlayers` = distinct `player_id` in appearances), `toStatRows`, `sideClubLabel` (with `{ counted: true }` for the halves that count), and `clubNamesFromDrafts` (club names for the table come from the matches, so a club deactivated since still shows by name).
- Seasons come from `repository.listSeasons()`. `league-params.ts` holds `newestFirstSeasons`, `defaultSeasonId` (active, else newest closed, else null) and the URL state.

**Every query includes `.eq("status", "submitted")`.** A unit test with a mocked client asserts the filter on each query. This is the public-read guarantee, and it closes Helper-h9i.

## 5. Access and manager recording

### 5.1 Matrix

| Action | Staff | Club manager | Player |
|---|---|---|---|
| View `/klc/league` (all tabs) | ✓ | ✓ | ✓ |
| View a submitted match read-only at `/klc/matches/[id]` | ✓ | ✓ | ✓ |
| Create a draft | ✓ | ✓, must set a club they manage as half-1 home | – |
| Edit / delete / submit a draft | ✓ any | ✓ if `created_by = me` **or** any side's club is managed by me | – |
| Reopen | KFANDRA / super_admin only (unchanged) | – | – |
| Seasons admin | ✓ | – | – |

- **Manager** = `clubs.manager_player_id = me`. A player may manage several clubs.
- **Anyone involved can edit** (Jaidev, 2026-10-20). This includes the opposing club's manager.

### 5.2 `actions.ts`
- `requireStaff()` is kept for the season actions.
- New `requireMatchEditor(matchId)` returns `{ player, match }`. It requires the caller to be signed in and the match to exist, then requires staff, `match.createdBy === player.id`, or `match` clubs ∩ `managedClubIds(player.id)` ≠ ∅.
  - `requireEditableMatch` and `submitMatchAction` call it.
  - An unauthorised caller gets `NOT_STAFF` ("You do not have permission to do that.").
- `createMatchAction(fields & { homeClubId?: string })` behaves as follows:
  - **Non-staff:** `homeClubId` is required and must be in `managedClubIds`. Otherwise the action returns `NOT_STAFF`.
  - **Everyone:** it sets `created_by` and, when `homeClubId` is given, creates the half-1 home side in the same action. `repo.createMatch` gains `createdBy` and `homeClubId`. On a side-insert failure, the match is deleted, as with the halves.
- `updateMatchMetaAction` also accepts `isFriendly` on a draft. `isCombined` stays fixed.
- Reads used by the recorder pages are gated in the page component, not in actions.

### 5.3 Routes
- The recorder moves from `src/app/admin/klc/matches/**` to `src/app/klc/matches/**`, with its components unchanged.
  - `/admin/klc/matches` and `/admin/klc/matches/[id]` become `redirect()`s.
  - `MATCHES_PATH` in `actions.ts` is updated.
- **`/klc/matches`** (list):
  - Staff see everything.
  - A manager sees their drafts (created by them or involving their clubs) plus all submitted matches.
  - A player is redirected to `/klc/league?tab=matches`.
  - "＋ New match" is shown to staff and managers. For a manager, the form adds a required "Your club" select limited to the clubs they manage.
- **`/klc/matches/[id]`:**
  - A draft the caller can't edit gives `notFound()`.
  - A submitted match renders read-only for everyone.
  - The Reopen button shows only for KFANDRA / super_admin.
- Seasons stays at `/admin/klc/seasons`.
- `/klc/league` and `/klc/matches` are static segments, so they take precedence over `/klc/[clubId]`.

## 6. UI

Same design system as the recorder and `/klc`:
- DM Sans body text with a Playfair `font-black` heading, and a gray scale
- white `rounded-xl border-gray-200` cards
- `bg-gray-900 text-white` selected chips
- uppercase `text-[11px] font-bold text-gray-600` labels
- blue-50/gray-100 pill tags
- `max-w-md` mobile column

See the mockup.

### 6.1 Home
- New common block **"KLC League"** → `/klc/league`.
- Staff and managers also get a "Record a match" link → `/klc/matches`.

### 6.2 `/klc/league`
- Server component.
- URL state: `?tab=table|matches|leaders|seasons|scoring&season=<id>&group=<key>`. Defaults: `table`, `defaultSeasonId`, `all`. Unknown values fall back to the default.
- **Header:**
  - breadcrumb, then the "KLC League" title
  - a season pill that opens a season picker (links)
  - a 5-tab segmented control (gray-100 track, white active tab)
- **Table:**
  - Group chips (labels from config keys via `strings.ts`).
  - One card holding three tables: `#`/Club pinned left, P…Diff scrolling sideways, **Pts** pinned right. Diff is green when positive and red when negative.
  - Columns that can't be non-zero for the group are hidden: Rugby Sox and Rugby Variations show only TF/TA, Football/Fooba and Short Game show only GF/GA, and All shows both.
  - Empty state: "No league matches submitted yet this season."
- **Matches:**
  - Submitted, non-friendly matches for the season, grouped by date, newest first.
  - Each uses the recorder's list card, plus a tier pill and "5 · 0 pts" (a combined match shows "5 each · 0 each").
  - Tapping opens the read-only `/klc/matches/[id]`.
- **Leaders:** group chips, then one card per non-empty board: rank · nickname · club (small) · value.
- **Seasons:** a list of `S{n} · name`, a status pill and dates. Tapping sets `?season=`.
- **Scoring:**
  - A table of match type × tier win points, plus a draw row and a loss row, rendered from the parsed rules.
  - Note: "Session limits (≤3 matches at 4–6 players, ≤2 at 2–3) are a ground rule; the app doesn't enforce them."

### 6.3 Recorder submit panel
- Before submit it shows "Tier 7+ · Home 5 · Away 0" from `computeMatchPoints`.
  - For a combined match, the sides are labelled by club pair and the points apply per club.
- For a friendly it shows "Friendly — no league points."

## 7. Errors and edge cases
- Malformed config falls back to defaults (parsers never throw). The Scoring tab shows what's actually in use.
- No seasons → empty states on every tab.
- A season with no submitted matches → empty states.
- A submitted match with fewer than 2 distinct players (shouldn't happen) counts as played with 0 pts.
- A child write on a submitted match:
  - The action returns `LOCKED` before reaching the DB.
  - If something bypasses the action, the trigger raises an error, and the repository surfaces it as a thrown error.
- A manager who removes their own club from a draft they created keeps access through `created_by`. Someone who didn't create it loses access, which is acceptable.
- A club manager with no linked account (`manager_player_id` null) simply can't record. Staff record for them.

## 8. Testing
- **Unit (Vitest), written first:**
  - `points` (every type × tier × outcome, null tier)
  - `standings-rules` (v2 and fallbacks)
  - `league-table` (groups, GF/TF split, Diff, sort, friendlies, combined with 4 clubs and with a repeated club)
  - `leaderboards` (sums, allow-list, friendlies only on MMG, ties, top 10)
  - `requireMatchEditor` matrix (with mocked repo and current player)
  - the `league-repository` submitted filter
- **Config contract:** the new and updated `app_config` keys exist in the migration and parse to non-default values.
- **DB (local Supabase):** the lock trigger rejects insert/update/delete on each child table of a submitted match and allows them on a draft. The touch trigger bumps `updated_at`.
- **e2e (Playwright, local Supabase only, never prod):**
  1. Staff record and submit, and the table updates.
  2. KFANDRA reopens, edits and resubmits, and the table changes.
  3. A manager creates and submits their own club's match, gets a 404 on another club's draft, and sees no Reopen button.
  4. A player sees all 5 league tabs, and a draft URL gives a 404.

## 9. Rollout
1. Run the prod checks (§2). Link managers with SQL (or KFANDRA's list) if they aren't linked yet.
2. Feature branch, then PR (Jaidev merges), then `npx supabase db push`.
3. **Heads-up to KFANDRA before go-live** (house rule).
4. Do the S1 acceptance replay (handover §7) once Coach shares the sheet. It doesn't block the merge.

## 10. Beads (under Helper-bsr, in build order)
1. Migration: match types, `created_by`, rules v2, table groups, sport stats, lock + touch triggers (closes 0gr, r01)
2. `standings-rules` v2 + `points.ts`; delete `standings.ts`/`combined.ts`
3. `league-table.ts` + `league-repository.ts`
4. `leaderboards.ts`
5. Manager recording: `requireMatchEditor`, create with home club, move the recorder to `/klc/matches`, redirects (closes h9i)
6. `/klc/league` UI (5 tabs) + home block
7. Recorder: tier and points preview
8. e2e + KFANDRA checkpoint doc

**Follow-ups (filed, not built):** manager-assignment admin UI; match report page; S1 acceptance replay.

## 11. Out of scope
Finance and ticketing; website publishing; squads beyond 6 per side; enforcing session caps.
