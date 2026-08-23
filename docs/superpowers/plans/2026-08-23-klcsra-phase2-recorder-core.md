# KLCSRA Phase 2 — Recorder core (repository + actions + seasons + placeholder UI)

**Goal:** make KLCSRA usable end-to-end tonight, so KFANDRA can answer the four
Phase 2 checkpoint questions from the roadmap themselves. The UI is deliberately
minimal — this phase proves the mechanics; Phase 3 is the real recorder UX.

**The four questions this must satisfy** (`docs/superpowers/specs/2026-08-23-klcsra-release-roadmap.md`):

1. Create Season 2, mark it active, and see the season tag stick to matches submitted after that point.
2. Record a football match end-to-end (pick clubs → add players → tap stats → enter score → Submit) and see correct KR + MMG totals.
3. Record a friendly and confirm **no KR** is credited.
4. Reopen a submitted match (as KFANDRA) and re-submit.

**Built on Phase 1** (complete): schema + RLS + seeded rules, and the pure
domain in `src/lib/klcsra/` — `computePlayerPayout`, `computeStandingPoints`,
`computeCombinedPoints`, `statsForSport`, and the three `load*` config loaders.
**No pure-domain file is modified in this phase.**

**Scope calls made for tonight**
- **No Supabase-integration test harness.** The repo has none to copy (every
  existing test is pure), and building one would consume the evening. Phase 1's
  223 unit tests cover the arithmetic; correctness here is verified by driving
  the real UI through the four questions above (Task 5).
- **Placeholder UI only.** Plain forms and tables, house Tailwind classes, no
  animation, no autosave, no SyncBadge. Explicit "Phase 3 replaces this" notice
  on the page so KFANDRA is not surprised.
- **No balance-sheet write-back.** Submit computes the payouts and *displays*
  them; landing them on the sheet is Phase 5.

---

## Task 1 — Types + repository (server-only)

**Files:** `src/lib/klcsra/types.ts`, `src/lib/klcsra/repository.ts`

Mirror `src/lib/klc/repository.ts`: `import "server-only"`, use
`createAdminClient()`, return plain serialisable objects, no business rules.

### `types.ts`

```ts
import type { StatKey } from "./stat-rates";
import type { Sport } from "./sport-stats";

export type MatchStatus = "draft" | "submitted";
export type SideKey = "home" | "away";
export type SeasonStatus = "upcoming" | "active" | "closed";

export interface Season {
  id: string; seasonNo: number; name: string;
  startDate: string; endDate: string | null; status: SeasonStatus;
}

export interface ClubOption { id: string; name: string; managerName: string; }
export interface MemberOption { id: string; displayName: string; }

export interface SideDraft {
  id: string; side: SideKey;
  clubId: string | null; clubName: string | null;
  score: number;
}
export interface HalfDraft { id: string; halfNo: number; sides: SideDraft[]; }

/** One player, one team, whole match. Stats are keyed by half. */
export interface AppearanceDraft {
  id: string; playerId: string; displayName: string;
  side: SideKey; slot: number;
  stats: Record<number, Partial<Record<StatKey, number>>>;
}

export interface MatchDraft {
  id: string; entryDate: string; sport: Sport;
  isFriendly: boolean; isCombined: boolean;
  durationMinutes: number | null;
  status: MatchStatus; submittedAt: string | null;
  seasonId: string | null; seasonName: string | null;
  halves: HalfDraft[];
  appearances: AppearanceDraft[];
}

export interface MatchSummary {
  id: string; entryDate: string; sport: Sport;
  isFriendly: boolean; isCombined: boolean;
  status: MatchStatus; seasonName: string | null;
  homeLabel: string; awayLabel: string; scoreLine: string;
}

/** What Submit produces. Displayed in Phase 2; written to the sheet in Phase 5. */
export interface PayoutLine {
  playerId: string; displayName: string;
  side: SideKey; clubName: string | null;
  kr: number; mmg: number;
}
```

### `repository.ts` — exported functions

Seasons: `listSeasons()`, `getActiveSeason()`, `createSeason(name, startDate)`
(next `season_no` = max+1), `setSeasonStatus(id, status)`,
`renameSeason(id, name)`, `countDraftMatchesInSeason(id)`.

Matches: `listMatches()` → `MatchSummary[]` newest first;
`getMatch(id)` → `MatchDraft | null`; `createMatch({entryDate, sport, isCombined, isFriendly})`
— creates the match **and** its half rows (1, or 1+2 when combined) **and** two
empty `klc_match_sides` per half; `updateMatchMeta(id, {entryDate?, sport?, durationMinutes?})`;
`deleteMatch(id)`.

Sides: `setSideClub(sideId, clubId)`, `setSideScore(sideId, score)`.

Squad: `addAppearance(matchId, playerId, side)` — slot = next free for that
side; `removeAppearance(appearanceId)`; `setStat(appearanceId, halfNo, statKey, count)`
— upsert on `(appearance_id, half_no, stat_key)`, and **delete the row when
count reaches 0** rather than storing zeros.

Lookups: `listClubs()`, `listActiveMembers()`.

Lock: `submitMatch(id, seasonId | null)` sets `status='submitted'`,
`submitted_at=now()`, `submitted_by`, and `season_id`; `reopenMatch(id)` sets
`status='draft'` and **clears `submitted_at` and `season_id`** (the DB's
`klc_matches_submitted_at_chk` and `klc_matches_league_season_chk` both require
this ordering — clear before flipping status, or do it in one UPDATE).

---

## Task 2 — Server actions

**File:** `src/lib/klcsra/actions.ts` — `"use server"`, mirroring
`src/lib/klc/actions.ts` including its `ActionResult<T>` shape.

**Every action re-resolves the caller** via `getCurrentPlayer()` and requires
`isStaffRole(...)`. Never trust a client-supplied identity.

**Every mutating action must refuse when the match is `submitted`** — this is
the submit lock, and it lives here because RLS deliberately does not enforce it
(see the Phase 1 plan's threat-model note). Load the match first, check
`status`, return `{ok:false, error:"This match is locked. Reopen it first."}`.

Actions: `createMatchAction`, `updateMatchMetaAction`, `setSideClubAction`,
`setSideScoreAction`, `addAppearanceAction`, `removeAppearanceAction`,
`setStatAction`, `submitMatchAction`, `reopenMatchAction`, plus
`createSeasonAction`, `startSeasonAction`, `closeSeasonAction`,
`renameSeasonAction`.

`revalidatePath` the affected route after each mutation.

### `submitMatchAction` — the important one

1. Reject if already `submitted`.
2. Reject if any side has no club, or the squads are empty.
3. **League matches require an active season.** If `!isFriendly` and there is no
   active season, refuse with *"No active season. Start one in Seasons first."* —
   this matches the spec and the DB's `klc_matches_league_season_chk`.
4. Compute payouts per player:
   - `rates = await loadStatRates()`, `sportStats = await loadSportStats()`
   - `allowed = statsForSport(match.sport, sportStats)`
   - For each appearance, for each half it has stats in, call
     `computePlayerPayout(counts, rates, { includeKR: !isFriendly, allowed })`
     and **sum across halves** — a player earns independently per half
     (spec §Cross-half stats), so compute per half and add.
   - `clubName` on each line = the club of that appearance's `side` in half 1.
5. Persist the lock (`submitMatch`), tag the season (null for friendlies).
6. Return `PayoutLine[]` so the UI can show the totals.

### `reopenMatchAction`

KFANDRA-only — `super_admin` or `kfandra`, **not** plain `admin`. Everything
else is staff-wide.

### Season actions

`startSeasonAction` sets `active` and must first `closed` any currently-active
season (the partial unique index allows only one). `closeSeasonAction` refuses
when `countDraftMatchesInSeason(id) > 0`.

---

## Task 3 — Seasons admin page

**Files:** `src/app/admin/klc/seasons/page.tsx` (+ a client component)

Server component lists seasons (no, name, dates, status). Controls: create
(name + start date), **Start**, **Close**, **Rename**. Show which season is
active prominently — it is what league Submit depends on.

Season 1 ships seeded as `upcoming`, so **the first thing KFANDRA must do is
press Start.** Say so on the page.

---

## Task 4 — Placeholder recorder

**Files:** `src/app/admin/klc/matches/page.tsx`,
`src/app/admin/klc/matches/[id]/page.tsx` (+ client components)

List page: matches newest-first with date, sport, season tag, friendly badge,
status, score line. "＋ New match" form — date, sport, Combined?, Friendly?.

Detail page, in plain sections:
1. **Header** — date, sport, duration, friendly/combined flags (read-only once submitted).
2. **Per half** — for each side: club `<select>`, score `<input>`.
3. **Squads** — one column per side; member `<select>` + Add; each player row
   shows a stat stepper per allowed stat (`statsForSport`), and for a combined
   match a small H1/H2 toggle.
4. **Submit / Reopen** — Submit shows the returned `PayoutLine[]` in a table
   (player, club, KR, MMG). Locked matches show a banner and the stored totals.

Put a visible notice at the top: *"Phase 2 placeholder — mechanics only. The
real recorder UI lands in Phase 3."*

---

## Task 5 — End-to-end verification (the actual quality gate)

Drive the real UI and confirm each roadmap question, recording what happened:

- [ ] Start Season 1, create + start Season 2, confirm only one is active.
- [ ] Record a football match: two clubs, ≥6 players total, stats, scores → Submit → KR/MMG match a hand-calculation from `DEFAULT_STAT_RATES`.
- [ ] Confirm the submitted match carries the **active season's** tag.
- [ ] Record a friendly → Submit → **every KR is 0**, MMG unchanged.
- [ ] Confirm a friendly carries **no** season tag.
- [ ] Try to submit a league match with no active season → refused with a clear message.
- [ ] Try to edit a submitted match → refused.
- [ ] Reopen as KFANDRA → edit → re-submit.
- [ ] Confirm a plain `admin` cannot reopen.
- [ ] `npm run test`, `npx tsc --noEmit` (3 lucide-react errors are the baseline), `npm run lint`, `npm run build`.
