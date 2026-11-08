# KLC Match Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Managers record their own team on one shared match without a league score. KFANDRA or an admin enters the official score and makes the match official. The plan also adds a duplicate-match warning, a Conversion stat and goal/try times.

**Architecture:**
- **One pure permissions rule.** `matchPermissions` in `src/lib/klcsra/access.ts` answers "what can this viewer change on this match right now" for both the server actions and the recorder UI.
- **New statuses.** League matches go `draft → sent → submitted`, where `submitted` means *Official*. Friendlies go `draft → submitted` once both teams are sent.
- **Unchanged read paths.** Everything downstream (tables, leaders, public RLS) keeps reading `status = 'submitted'` and doesn't change.
- **Two migrations.** One adds the conversion config. The other adds the `sent` status, the per-team sent stamps, `klc_player_stats.minutes`, and a submit-lock exception for minutes-only updates.

**Tech Stack:** Next.js 16 App Router (server components and server actions), TypeScript strict, Tailwind, Supabase (Postgres, service-role client), Vitest, Playwright (local Supabase only).

**Spec:** `docs/superpowers/specs/2026-11-08-klc-match-workflow-design.md`. Approved by Jaidev on 2026-11-08, including the §12 choices: per-team send, friendlies use per-team send too, and Reopen goes back to Sent. **Bead:** Helper-bsr.16. **Branch:** `feat/klc-match-workflow`, which already exists and holds the spec commit.

> **Confidential:** this plan gives no reason for the missing keeper tick, and the code mustn't either. Read bd memory `klc-confidential-2026-11-08` before starting. Nothing it describes may appear in UI text, comments, commits, PR text or the guide.

---

## File map

| File | Responsibility | Task |
|---|---|---|
| `src/lib/klcsra/stat-rates.ts` (+test) | `conversion` stat key, label and rate | 1 |
| `src/lib/klcsra/sport-stats.ts` (+test) | conversion allowed in Rugby Sox | 1 |
| `src/lib/klcsra/leaderboards.ts` (+test) | Tries board counts conversions | 1 |
| `supabase/migrations/20261108120000_klc_conversion_stat.sql` | conversion config upserts | 1 |
| `src/lib/klcsra/config-contract.test.ts` | points the two keys at the new migration | 1 |
| `supabase/migrations/20261108120100_klc_match_workflow.sql` | `sent` status, sent stamps, minutes, lock exception | 2 |
| `e2e/klcsra-triggers.spec.ts` | DB-level tests for the new constraints and lock exception | 3 |
| `src/lib/klcsra/types.ts` | `sent` status, sent stamps, times, `sideClubs` | 4 |
| `src/lib/klcsra/repository.ts` | new reads and writes for the workflow | 4 |
| `src/lib/klcsra/access.ts` (+test) | `ownedSides`, `sentSides`, `matchPermissions` | 5 |
| `src/lib/klcsra/tally.ts` (+test, new) | `goalTally`, `officialScore` | 6 |
| `src/lib/klcsra/match-status.ts` (+test, new) | `statusLabel` | 7 |
| `src/lib/klcsra/duplicates.ts` (+test, new) | `sideClubsOf`, `findDuplicates` | 7 |
| `src/lib/klcsra/goal-times.ts` (+test, new) | `TIMED_STATS`, `isTimed`, `trimTimes`, `cleanTimes`, `scorersLine` | 8 |
| `src/lib/klcsra/actions.ts` (+test) | the permission gate, per-team edits, create with an opponent, send, make official, send back, reopen to Sent, goal times | 9–11 |
| `src/app/klc/matches/page.tsx`, `new-match-form.tsx` | status labels, Waiting for KFANDRA list, opponent picker, duplicate warning | 12 |
| `src/app/klc/matches/[id]/*` | permissions wiring, per-team lock, staff score panel, send buttons, duplicate banner, minute boxes, Scorers line | 13–15 |
| `e2e/helpers/recorder.ts`, `e2e/helpers/db.ts`, existing specs | helpers, plus existing tests moved to the new flow | 16 |
| `e2e/klc-match-workflow.spec.ts` (new) | the five end-to-end scenarios from spec §11 | 17 |
| `docs/klc-league-guide.md` (+PDF) | the guide | 18 |

Run commands from the repo root. Unit tests run with `npx vitest run <file>`. E2E needs local Supabase (`npx supabase start`) and runs with `npx playwright test <file>`.

---

## Task 0: Claim the bead and check the branch

- [ ] **Step 1: Check the branch and claim the bead**

```bash
git checkout feat/klc-match-workflow && git pull --rebase
git log --oneline -2   # expect the spec commit "docs(klc): match workflow design (Helper-bsr.16)" on top
bd update Helper-bsr.16 --claim
npx supabase status    # local Supabase must be running for Tasks 2, 3, 16, 17
```

---

## Task 1: Conversion stat

**Files:**
- Modify: `src/lib/klcsra/stat-rates.ts`, `src/lib/klcsra/sport-stats.ts`, `src/lib/klcsra/leaderboards.ts`
- Modify: `src/lib/klcsra/stat-rates.test.ts`, `src/lib/klcsra/sport-stats.test.ts`, `src/lib/klcsra/leaderboards.test.ts`, `src/lib/klcsra/config-contract.test.ts`
- Create: `supabase/migrations/20261108120000_klc_conversion_stat.sql`

- [ ] **Step 1: Write the failing tests**

In `src/lib/klcsra/stat-rates.test.ts`, replace the first test's title and length check, and add a conversion test:

```ts
  it("has all 17 stats with the agreed KR/MMG values", () => {
    expect(STAT_KEYS).toHaveLength(17);
```

```ts
  it("conversion pays the try rate and sits right after try (2026-11-04)", () => {
    expect(DEFAULT_STAT_RATES.conversion).toEqual(DEFAULT_STAT_RATES.try);
    expect(STAT_KEYS.indexOf("conversion")).toBe(STAT_KEYS.indexOf("try") + 1);
    expect(STAT_LABELS.conversion).toBe("Conversion");
  });
```

In `src/lib/klcsra/sport-stats.test.ts`, update the lengths in "matches the spec allow-lists":

```ts
    expect(DEFAULT_SPORT_STATS.football).toHaveLength(11);
    expect(DEFAULT_SPORT_STATS.rugby).toHaveLength(9);
    expect(DEFAULT_SPORT_STATS.fooba).toHaveLength(13);
    expect(DEFAULT_SPORT_STATS.rugby_variation).toHaveLength(17);
    expect(DEFAULT_SPORT_STATS.short_game_variation).toHaveLength(17);
    expect(DEFAULT_SPORT_STATS.multi_game_variation).toHaveLength(17);
```

Then add:

```ts
  it("Rugby Sox has conversion; football and fooba don't", () => {
    expect(DEFAULT_SPORT_STATS.rugby).toContain("conversion");
    expect(DEFAULT_SPORT_STATS.football).not.toContain("conversion");
    expect(DEFAULT_SPORT_STATS.fooba).not.toContain("conversion");
  });
```

In `src/lib/klcsra/leaderboards.test.ts`, inside `describe("buildLeaderboards", …)`:

```ts
  it("Tries counts tries plus conversions", () => {
    const rows = [r("a", "try", 2, { sport: "rugby" }), r("a", "conversion", 1, { sport: "rugby" })];
    expect(board(rows, "tries")!.entries[0].value).toBe(3);
  });
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/lib/klcsra/stat-rates.test.ts src/lib/klcsra/sport-stats.test.ts src/lib/klcsra/leaderboards.test.ts`
Expected: FAIL. The length is 16, not 17, and `conversion` isn't in `StatKey` (a TS error at runtime surfaces as `undefined`).

- [ ] **Step 3: Implement**

In `src/lib/klcsra/stat-rates.ts`:

```ts
export type StatKey =
  | "goal" | "try" | "conversion" | "mainGoal" | "reboundGoal"
  | "assist" | "preAssist" | "switchover"
  | "tackle" | "save"
  | "yellowCard" | "redCard" | "blueCard" | "lateChallenge"
  | "ownGoal" | "ownAssist" | "ownPreAssist";
```

```ts
export const STAT_KEYS: readonly StatKey[] = [
  "goal", "try", "conversion", "mainGoal", "reboundGoal",
  "assist", "preAssist", "switchover",
  "tackle", "save",
  "yellowCard", "redCard", "blueCard", "lateChallenge",
  "ownGoal", "ownAssist", "ownPreAssist",
];
```

In `STAT_LABELS`, after `try: "Try",` add `conversion: "Conversion",`. In `DEFAULT_STAT_RATES`, after the `try` line add:

```ts
  // Rugby Sox conversion: counts like a try and pays the try rate (2026-11-04).
  conversion: { kr: 25, mmg: 500 },
```

In `src/lib/klcsra/sport-stats.ts`, change the `rugby` default to:

```ts
  rugby: [
    "try", "conversion", "tackle", "assist", "preAssist",
    "yellowCard", "redCard", "blueCard", "lateChallenge",
  ],
```

The three variations are `[...STAT_KEYS]`, so they pick up `conversion` automatically.

In `src/lib/klcsra/leaderboards.ts`:

```ts
  { key: "tries", label: "Tries", includeFriendlies: false, value: tally(["try", "conversion"]) },
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run the same command as Step 2. Expected: PASS.

- [ ] **Step 5: Write the config migration and point the contract test at it**

Create `supabase/migrations/20261108120000_klc_conversion_stat.sql`:

```sql
-- KLC Rugby Sox conversion stat (Helper-bsr.16, spec 2026-11-08 §6).
--
-- Stat rates: MERGE, so any rate KFANDRA has edited is kept and only the new
-- key is added (excluded.value || existing: the existing keys win). The
-- literal below is the full default set, so config-contract.test.ts can
-- compare it with DEFAULT_STAT_RATES.
insert into public.app_config (key, value, description) values (
  'klcsra_stat_rates',
  '{
    "goal":         {"kr": 20,  "mmg": 500},
    "try":          {"kr": 25,  "mmg": 500},
    "conversion":   {"kr": 25,  "mmg": 500},
    "mainGoal":     {"kr": 20,  "mmg": 500},
    "reboundGoal":  {"kr": 10,  "mmg": 300},
    "assist":       {"kr": 10,  "mmg": 200},
    "preAssist":    {"kr": 5,   "mmg": 100},
    "switchover":   {"kr": 5,   "mmg": 100},
    "tackle":       {"kr": 5,   "mmg": 100},
    "save":         {"kr": 5,   "mmg": 200},
    "yellowCard":   {"kr": -10, "mmg": -200},
    "redCard":      {"kr": -20, "mmg": -500},
    "blueCard":     {"kr": -30, "mmg": -1000},
    "lateChallenge":{"kr": -5,  "mmg": -100},
    "ownGoal":      {"kr": -20, "mmg": -500},
    "ownAssist":    {"kr": -10, "mmg": -200},
    "ownPreAssist": {"kr": -5,  "mmg": -100}
  }'::jsonb,
  'KLCSRA per-stat payout: Kroopies (kr) + MMG points (mmg) per event. Admin-editable.'
) on conflict (key) do update set value = excluded.value || public.app_config.value;

-- Sport allow-lists: overwritten in full, as 20261020120000 did.
insert into public.app_config (key, value, description) values (
  'klcsra_sport_stats',
  '{
    "football":  ["goal","assist","preAssist","save","yellowCard","redCard","blueCard","lateChallenge","ownGoal","ownAssist","ownPreAssist"],
    "fooba":     ["mainGoal","reboundGoal","switchover","assist","preAssist","save","yellowCard","redCard","blueCard","lateChallenge","ownGoal","ownAssist","ownPreAssist"],
    "rugby":     ["try","conversion","tackle","assist","preAssist","yellowCard","redCard","blueCard","lateChallenge"],
    "rugby_variation":      ["goal","try","conversion","mainGoal","reboundGoal","assist","preAssist","switchover","tackle","save","yellowCard","redCard","blueCard","lateChallenge","ownGoal","ownAssist","ownPreAssist"],
    "short_game_variation": ["goal","try","conversion","mainGoal","reboundGoal","assist","preAssist","switchover","tackle","save","yellowCard","redCard","blueCard","lateChallenge","ownGoal","ownAssist","ownPreAssist"],
    "multi_game_variation": ["goal","try","conversion","mainGoal","reboundGoal","assist","preAssist","switchover","tackle","save","yellowCard","redCard","blueCard","lateChallenge","ownGoal","ownAssist","ownPreAssist"]
  }'::jsonb,
  'KLCSRA per-sport stat allow-list. The recorder filters the stats popup by sport; disallowed keys are ignored by the payout compute.'
) on conflict (key) do update set value = excluded.value, description = excluded.description;
```

In `src/lib/klcsra/config-contract.test.ts`, add after `MGV_SQL`:

```ts
/** Adds the Rugby Sox conversion stat (2026-11-08). */
const CONVERSION_SQL = readFileSync(
  resolve(REPO_ROOT, "supabase/migrations/20261108120000_klc_conversion_stat.sql"),
  "utf8",
);
```

Then change `SQL_FOR`:

```ts
const SQL_FOR = {
  klcsra_stat_rates: CONVERSION_SQL,
  klcsra_sport_stats: CONVERSION_SQL,
  klcsra_standings_rules: LEAGUE_SQL,
  klcsra_table_groups: MGV_SQL,
} satisfies Record<SeededKey, string>;
```

If `CORE_SQL` is now unused, delete its `const` as well; ESLint flags unused variables.

- [ ] **Step 6: Run the klcsra unit tests and apply the migration locally**

```bash
npx vitest run src/lib/klcsra
npx supabase migration up
```

Expected: all klcsra tests pass, and the migration applies with no error.

- [ ] **Step 7: Commit**

```bash
git add src/lib/klcsra supabase/migrations/20261108120000_klc_conversion_stat.sql
git commit -m "feat(klc): Rugby Sox conversion stat (Helper-bsr.16)"
```

---

## Task 2: Workflow migration

**Files:**
- Create: `supabase/migrations/20261108120100_klc_match_workflow.sql`

- [ ] **Step 1: Write the migration**

```sql
-- KLC match workflow (Helper-bsr.16, spec docs/superpowers/specs/2026-11-08-klc-match-workflow-design.md).
-- Prod had no KLC matches when this was written (checked 2026-11-07).

-- 1. League: draft -> sent (both teams sent by their managers) -> submitted
--    (Official). Friendlies never use `sent`: they go draft -> submitted.
alter table public.klc_matches drop constraint klc_matches_status_chk;
alter table public.klc_matches add constraint klc_matches_status_chk
  check (status in ('draft', 'sent', 'submitted'));

alter table public.klc_matches
  add column home_sent_at timestamptz,
  add column away_sent_at timestamptz,
  add constraint klc_matches_sent_league_chk check (status <> 'sent' or not is_friendly);
comment on column public.klc_matches.home_sent_at is
  'When the home team''s manager tapped Send my team. Cleared by Send back.';
comment on column public.klc_matches.away_sent_at is
  'When the away team''s manager tapped Send my team. Cleared by Send back.';

-- 2. Goal/try times: whole minutes, one per event in entry order; a null
--    element is a time not entered yet.
alter table public.klc_player_stats
  add column minutes int[] not null default '{}',
  add constraint klc_player_stats_minutes_len_chk
    check (cardinality(minutes) <= stat_count),
  add constraint klc_player_stats_minutes_range_chk
    check (0 <= all (minutes) and 150 >= all (minutes));
comment on column public.klc_player_stats.minutes is
  'Goal/try minutes for this tally, in entry order (null = not entered). Only league Fooba goals and Rugby Sox tries use it.';

-- 3. The submit lock, with one exception: an UPDATE of klc_player_stats that
--    changes nothing but `minutes` is allowed on an official match, so KFANDRA
--    can add goal times later (spec D13). Body otherwise unchanged from
--    20261020120000_klc_league_scoring.sql.
create or replace function app.klc_enforce_submit_lock()
returns trigger language plpgsql
security definer set search_path = public, pg_temp as $$
declare
  mids uuid[] := array[]::uuid[];
  mid  uuid;
  st   text;
begin
  if tg_table_name = 'klc_player_stats' and tg_op = 'UPDATE'
     and (to_jsonb(new) - 'minutes') = (to_jsonb(old) - 'minutes') then
    return new;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    mids := mids || app.klc_child_match_id(tg_table_name, to_jsonb(old));
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    mids := mids || app.klc_child_match_id(tg_table_name, to_jsonb(new));
  end if;
  foreach mid in array mids loop
    continue when mid is null;
    select status into st from public.klc_matches where id = mid for no key update;
    if st = 'submitted' then
      raise exception 'match is submitted' using errcode = 'P0001';
    end if;
  end loop;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

revoke execute on function app.klc_enforce_submit_lock() from public;
```

- [ ] **Step 2: Apply it locally**

Run: `npx supabase migration up`
Expected: it applies with no error. Then check:

```bash
psql postgres://postgres:postgres@127.0.0.1:54322/postgres -c "\d klc_matches" | grep sent_at
```

Expected: two `timestamptz` rows.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20261108120100_klc_match_workflow.sql
git commit -m "feat(klc): match workflow schema: sent status, team stamps, goal minutes (Helper-bsr.16)"
```

---

## Task 3: DB-level tests for the new constraints

**Files:**
- Modify: `e2e/klcsra-triggers.spec.ts`
- Modify: `e2e/helpers/db.ts` (the `MatchRow` type)

- [ ] **Step 1: Widen `MatchRow` in `e2e/helpers/db.ts`**

```ts
export interface MatchRow {
  id: string;
  entry_date: string;
  status: "draft" | "sent" | "submitted";
  is_friendly: boolean;
  is_combined: boolean;
  season_id: string | null;
  submitted_at: string | null;
  home_sent_at: string | null;
  away_sent_at: string | null;
}

export async function getMatchRow(id: string): Promise<MatchRow | null> {
  const rows = await sql<MatchRow>(
    `select id, to_char(entry_date, 'YYYY-MM-DD') as entry_date, status,
            is_friendly, is_combined, season_id, submitted_at,
            home_sent_at, away_sent_at
       from klc_matches where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}
```

- [ ] **Step 2: Add the tests to `e2e/klcsra-triggers.spec.ts`**

These go after the existing tests and reuse `makeMatch`. Its match is a friendly with one `goal` row, `stat_count = 1`.

```ts
test("'sent' is for league matches only", async () => {
  const { matchId } = await makeMatch("draft"); // a friendly
  await expect(
    db.sql(`update klc_matches set status = 'sent' where id = $1`, [matchId]),
  ).rejects.toThrow(/klc_matches_sent_league_chk/);
  await db.sql(`update klc_matches set is_friendly = false where id = $1`, [matchId]);
  await db.sql(`update klc_matches set status = 'sent' where id = $1`, [matchId]);
  expect((await db.getMatchRow(matchId))?.status).toBe("sent");
});

test("goal times can be added to an official match, and nothing else can", async () => {
  const { appearanceId } = await makeMatch("submitted");
  await db.sql(`update klc_player_stats set minutes = '{12}' where appearance_id = $1`, [appearanceId]);
  const [row] = await db.sql<{ minutes: number[] }>(
    `select minutes from klc_player_stats where appearance_id = $1`, [appearanceId],
  );
  expect(row.minutes).toEqual([12]);
  await expect(
    db.sql(
      `update klc_player_stats set minutes = '{12}', stat_count = 2 where appearance_id = $1`,
      [appearanceId],
    ),
  ).rejects.toThrow(/match is submitted/);
});

test("times can't outnumber the tally or leave 0..150", async () => {
  const { appearanceId } = await makeMatch("draft");
  await expect(
    db.sql(`update klc_player_stats set minutes = '{1,2}' where appearance_id = $1`, [appearanceId]),
  ).rejects.toThrow(/klc_player_stats_minutes_len_chk/);
  await expect(
    db.sql(`update klc_player_stats set minutes = '{151}' where appearance_id = $1`, [appearanceId]),
  ).rejects.toThrow(/klc_player_stats_minutes_range_chk/);
  // A blank (null) time is allowed.
  await db.sql(`update klc_player_stats set minutes = '{null}' where appearance_id = $1`, [appearanceId]);
});
```

- [ ] **Step 3: Run the tests**

Run: `npx playwright test e2e/klcsra-triggers.spec.ts`
Expected: all pass, the old tests and the three new ones.

- [ ] **Step 4: Commit**

```bash
git add e2e/klcsra-triggers.spec.ts e2e/helpers/db.ts
git commit -m "test(klc): DB checks for sent status and goal minutes (Helper-bsr.16)"
```

---

## Task 4: Types and repository

**Files:**
- Modify: `src/lib/klcsra/types.ts`, `src/lib/klcsra/repository.ts`
- Modify fixtures: `src/lib/klcsra/points-preview.test.ts`, `src/lib/klcsra/league-data.test.ts`, `src/lib/klcsra/league-repository.test.ts`

The repository is `server-only` persistence with no unit tests. It's covered by `tsc`, the action tests (which mock it) and the e2e suite.

- [ ] **Step 1: Types (`src/lib/klcsra/types.ts`)**

```ts
export type MatchStatus = "draft" | "sent" | "submitted";
```

Add to `AppearanceDraft`, after `stats`:

```ts
  /**
   * Goal/try minutes per half per stat, in entry order (null = not entered).
   * Absent when none are recorded.
   */
  times?: Record<number, Partial<Record<StatKey, (number | null)[]>>>;
```

Add to `MatchDraft`, after `submittedAt`:

```ts
  /** When each team's manager tapped Send my team; null until then. */
  homeSentAt: string | null;
  awaySentAt: string | null;
```

Add to `MatchSummary`, after `clubIds`:

```ts
  homeSentAt: string | null;
  awaySentAt: string | null;
  /** Every (side, club) pair across the halves. Used for duplicate detection. */
  sideClubs: { side: SideKey; clubId: string }[];
```

- [ ] **Step 2: Repository reads (`src/lib/klcsra/repository.ts`)**

Replace `StatRow`, `toAppearanceDraft`, `MATCH_DRAFT_COLS`, `MatchDraftRow` and `toMatchDraft` with:

```ts
interface StatRow { half_no: number; stat_key: string; stat_count: number; minutes: (number | null)[] | null }

function toAppearanceDraft(a: AppearanceRow): AppearanceDraft {
  const stats: Record<number, Partial<Record<StatKey, number>>> = {};
  const times: Record<number, Partial<Record<StatKey, (number | null)[]>>> = {};
  for (const s of a.klc_player_stats ?? []) {
    (stats[s.half_no] ??= {})[s.stat_key as StatKey] = s.stat_count;
    if (s.minutes && s.minutes.length > 0) {
      (times[s.half_no] ??= {})[s.stat_key as StatKey] = s.minutes;
    }
  }
  return {
    id: a.id,
    playerId: a.player_id,
    displayName: one(a.players)?.display_name ?? "Unknown",
    side: a.side as SideKey,
    slot: a.slot,
    stats,
    ...(Object.keys(times).length > 0 ? { times } : {}),
  };
}

export const MATCH_DRAFT_COLS = `id, entry_date, sport, is_friendly, is_combined, duration_minutes,
   status, submitted_at, season_id, created_by, home_sent_at, away_sent_at,
   klc_seasons(name),
   klc_match_halves(id, half_no,
     klc_match_sides(id, side, score, club_id, clubs(name))),
   klc_match_appearances(id, player_id, side, slot,
     players(display_name),
     klc_player_stats(half_no, stat_key, stat_count, minutes))`;

export interface MatchDraftRow {
  id: string; entry_date: string; sport: string;
  is_friendly: boolean; is_combined: boolean; duration_minutes: number | null;
  status: string; submitted_at: string | null; season_id: string | null;
  created_by: string | null;
  home_sent_at: string | null; away_sent_at: string | null;
  klc_seasons: unknown; klc_match_halves: unknown; klc_match_appearances: unknown;
}

/** Map a `MATCH_DRAFT_COLS` row to a `MatchDraft` (shared with league-repository). */
export function toMatchDraft(data: MatchDraftRow): MatchDraft {
  const appearances = ((data.klc_match_appearances as AppearanceRow[] | null) ?? [])
    .map(toAppearanceDraft)
    .sort((a, b) =>
      SIDE_ORDER.indexOf(a.side) - SIDE_ORDER.indexOf(b.side) || a.slot - b.slot,
    );
  return {
    id: data.id,
    entryDate: data.entry_date,
    sport: data.sport as Sport,
    isFriendly: data.is_friendly,
    isCombined: data.is_combined,
    durationMinutes: data.duration_minutes,
    status: data.status as MatchStatus,
    submittedAt: data.submitted_at,
    homeSentAt: data.home_sent_at,
    awaySentAt: data.away_sent_at,
    seasonId: data.season_id,
    seasonName: one(data.klc_seasons as ToOne<{ name: string }>)?.name ?? null,
    createdBy: data.created_by,
    halves: toHalfDrafts(data.klc_match_halves as HalfRow[] | null),
    appearances,
  };
}
```

Replace `listMatches` with a version that can filter by date and returns the new summary fields:

```ts
/** Matches newest first (optionally one date only), with their aggregate score line. */
export async function listMatches(opts: { entryDate?: string } = {}): Promise<MatchSummary[]> {
  const admin = createAdminClient();
  let query = admin
    .from("klc_matches")
    .select(
      `id, entry_date, sport, is_friendly, is_combined, status,
       created_by, home_sent_at, away_sent_at,
       klc_seasons(name),
       klc_match_halves(id, half_no,
         klc_match_sides(id, side, score, club_id, clubs(name)))`,
    );
  if (opts.entryDate) query = query.eq("entry_date", opts.entryDate);
  const { data } = await query
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  return (data ?? []).map((m) => {
    const halves = toHalfDrafts(m.klc_match_halves as HalfRow[] | null);
    const sideClubs = halves.flatMap((h) =>
      h.sides
        .filter((s): s is SideDraft & { clubId: string } => s.clubId !== null)
        .map((s) => ({ side: s.side, clubId: s.clubId })),
    );
    return {
      id: m.id,
      entryDate: m.entry_date,
      sport: m.sport as Sport,
      isFriendly: m.is_friendly,
      isCombined: m.is_combined,
      status: m.status as MatchStatus,
      seasonName: one(m.klc_seasons as ToOne<{ name: string }>)?.name ?? null,
      createdBy: m.created_by,
      clubIds: [...new Set(sideClubs.map((s) => s.clubId))],
      homeSentAt: m.home_sent_at,
      awaySentAt: m.away_sent_at,
      sideClubs,
      homeLabel: sideLabel(halves, "home"),
      awayLabel: sideLabel(halves, "away"),
      scoreLine: scoreLine(halves),
    };
  });
}
```

Rename `countDraftMatchesDatedInSeason` to `countUnfinishedMatchesDatedInSeason`. Make its query `.in("status", ["draft", "sent"])` instead of `.eq("status", "draft")`, and change the first doc line to: *How many matches are still unfinished (`draft` or `sent`) with an `entry_date` inside this season's window.*

- [ ] **Step 3: Repository writes**

In `CreateMatchInput`, add after `homeClubId`:

```ts
  /** Created as half 1's away side when given (the opponent). */
  awayClubId: string | null;
```

In `createMatch`, replace the `if (input.homeClubId) { … }` block with:

```ts
  const first = halves?.find((h) => h.half_no === 1);
  const sides = [
    input.homeClubId ? { side: "home", club_id: input.homeClubId } : null,
    input.awayClubId ? { side: "away", club_id: input.awayClubId } : null,
  ].filter((s): s is { side: string; club_id: string } => s !== null);
  if (sides.length > 0) {
    const { error: sideErr } = first
      ? await admin.from("klc_match_sides").insert(
          sides.map((s) => ({ half_id: first.id, side: s.side, club_id: s.club_id, role: s.side })),
        )
      : { error: { message: "half 1 was not returned" } };
    if (sideErr) {
      await admin.from("klc_matches").delete().eq("id", data.id);
      throw new Error(`Failed to set the clubs: ${sideErr.message}`);
    }
  }
```

Replace `setStat` with a version that carries the trimmed minutes:

```ts
/**
 * Set one stat tally for one appearance in one half.
 *
 * A count of 0 (or less) DELETES the row instead of storing a zero. `minutes`
 * is written with the count, already trimmed by the caller to at most
 * `count` entries (`klc_player_stats_minutes_len_chk`).
 */
export async function setStat(
  appearanceId: string,
  halfNo: number,
  statKey: StatKey,
  count: number,
  minutes: (number | null)[] = [],
): Promise<void> {
  const admin = createAdminClient();
  if (count <= 0) {
    const { error } = await admin
      .from("klc_player_stats")
      .delete()
      .eq("appearance_id", appearanceId)
      .eq("half_no", halfNo)
      .eq("stat_key", statKey);
    if (error) throw new Error(`Failed to clear ${statKey}: ${error.message}`);
    return;
  }
  const { error } = await admin
    .from("klc_player_stats")
    .upsert(
      { appearance_id: appearanceId, half_no: halfNo, stat_key: statKey, stat_count: count, minutes },
      { onConflict: "appearance_id,half_no,stat_key" },
    );
  if (error) throw new Error(`Failed to record ${statKey}: ${error.message}`);
}

/**
 * Set the goal/try minutes on an existing tally. The only write the submit
 * lock lets through on an official match (minutes-only UPDATE).
 */
export async function setGoalTimes(
  appearanceId: string,
  halfNo: number,
  statKey: StatKey,
  minutes: (number | null)[],
): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("klc_player_stats")
    .update({ minutes })
    .eq("appearance_id", appearanceId)
    .eq("half_no", halfNo)
    .eq("stat_key", statKey)
    .select("id");
  if (error) throw new Error(`Failed to save the times: ${error.message}`);
  if ((data ?? []).length === 0) throw new Error("Record the goal before its time.");
}
```

Replace the whole `// ── lock ──` section (`submitMatch`, `reopenMatch`) with:

```ts
// ── workflow ────────────────────────────────────────────────────────────────

/** Stamp one team as sent. Only a draft with that team unsent changes. */
export async function sendTeam(id: string, side: SideKey): Promise<void> {
  const admin = createAdminClient();
  const col = side === "home" ? "home_sent_at" : "away_sent_at";
  const { data, error } = await admin
    .from("klc_matches")
    .update({ [col]: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft")
    .is(col, null)
    .select("id");
  if (error) throw new Error(`Failed to send your team: ${error.message}`);
  if (!data || data.length === 0) throw new Error("This team has already been sent.");
}

/**
 * Move a draft on once BOTH teams are sent: a league match to `sent`, a
 * friendly straight to `submitted`. Safe to call twice (two managers sending
 * at once): the guard makes the second call a no-op. Returns the status after.
 */
export async function finishSending(id: string, by: string | null): Promise<MatchStatus> {
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("klc_matches")
    .select("status, is_friendly, home_sent_at, away_sent_at")
    .eq("id", id)
    .single();
  if (error) throw new Error(`Failed to read the match: ${error.message}`);
  if (row.status !== "draft" || !row.home_sent_at || !row.away_sent_at) {
    return row.status as MatchStatus;
  }
  const next = row.is_friendly
    ? { status: "submitted", submitted_at: new Date().toISOString(), submitted_by: by }
    : { status: "sent" };
  const { error: upErr } = await admin
    .from("klc_matches")
    .update(next)
    .eq("id", id)
    .eq("status", "draft")
    .not("home_sent_at", "is", null)
    .not("away_sent_at", "is", null);
  if (upErr) throw new Error(`Failed to send the match: ${upErr.message}`);
  return next.status as MatchStatus;
}

/**
 * Make a match official (lock it). `seasonId` is null for a friendly and the
 * active season for a league match (both DB constraints). Only a draft or a
 * sent match flips, so a lost race updates 0 rows.
 */
export async function makeOfficial(
  id: string,
  seasonId: string | null,
  by: string | null,
): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("klc_matches")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      submitted_by: by,
      season_id: seasonId,
    })
    .eq("id", id)
    .in("status", ["draft", "sent"])
    .select("id");
  if (error) throw new Error(`Failed to make the match official: ${error.message}`);
  if (!data || data.length === 0) throw new Error("This match is locked. Reopen it first.");
}

/** KFANDRA's Send back: both teams editable again. */
export async function sendBack(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("klc_matches")
    .update({ status: "draft", home_sent_at: null, away_sent_at: null })
    .eq("id", id)
    .in("status", ["draft", "sent"]);
  if (error) throw new Error(`Failed to send the match back: ${error.message}`);
}

/**
 * Unlock an official match. A league match goes back to `sent` (KFANDRA edits
 * and re-officials without the managers); a friendly goes back to `draft`
 * with its stamps cleared. `submitted_at` and `season_id` are cleared in the
 * SAME update as the status flip: `klc_matches_submitted_at_chk` and
 * `klc_matches_league_season_chk` are checked per statement.
 */
export async function reopenMatch(id: string, to: "sent" | "draft"): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("klc_matches")
    .update({
      status: to,
      submitted_at: null,
      season_id: null,
      ...(to === "draft" ? { home_sent_at: null, away_sent_at: null } : {}),
    })
    .eq("id", id)
    .eq("status", "submitted");
  if (error) throw new Error(`Failed to reopen the match: ${error.message}`);
}
```

- [ ] **Step 4: Fix the test fixtures the new required fields break**

- `src/lib/klcsra/points-preview.test.ts` (the `match()` fixture) and `src/lib/klcsra/league-data.test.ts` (the `draft()` fixture): add `homeSentAt: null, awaySentAt: null,` next to `submittedAt`.
- `src/lib/klcsra/league-repository.test.ts` (the `MatchDraftRow` fixture at line 64): add `home_sent_at: null, away_sent_at: null,` next to `submitted_at`.
- `src/lib/klcsra/actions.test.ts` builds its draft with `as MatchDraft`, so it still compiles. Its updates come in Task 9.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`

Expected: errors **only** in `src/lib/klcsra/actions.ts` and `src/app/klc/**`, which still call `repo.submitMatch`, `countDraftMatchesDatedInSeason`, `reopenMatch(id)` and `createMatch` without `awayClubId`. Tasks 9–15 fix those. Any error anywhere else is a mistake in this task, so fix it now.

- [ ] **Step 6: Commit**

`tsc` is red only in the callers, which the next tasks rewrite. Note that in the message.

```bash
git add src/lib/klcsra/types.ts src/lib/klcsra/repository.ts src/lib/klcsra/*.test.ts
git commit -m "feat(klc): repository for send/official/send-back and goal minutes (Helper-bsr.16)

Callers move over in the following commits."
```

---

## Task 5: `matchPermissions`

**Files:**
- Modify: `src/lib/klcsra/access.ts`, `src/lib/klcsra/access.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/klcsra/access.test.ts`:

```ts
import { matchPermissions, ownedSides, type PermissionMatch } from "./access";

const pm = (over: Partial<PermissionMatch> = {}): PermissionMatch => ({
  status: "draft", isFriendly: false, createdBy: null,
  homeSentAt: null, awaySentAt: null,
  halves: [{ id: "h1", sides: [{ side: "home", clubId: "A" }, { side: "away", clubId: "B" }] }],
  appearances: [],
  ...over,
});
const userV = { id: "u", role: "user" as const };
const adminV = { id: "s", role: "admin" as const };
const kfandraV = { id: "k", role: "kfandra" as const };
const A = new Set(["A"]);

describe("ownedSides", () => {
  it("is every side led by a managed club in any half", () => {
    const halves = [
      { id: "h1", sides: [{ side: "home" as const, clubId: "A" }, { side: "away" as const, clubId: "B" }] },
      { id: "h2", sides: [{ side: "home" as const, clubId: "C" }, { side: "away" as const, clubId: "D" }] },
    ];
    expect(ownedSides(halves, new Set(["D"]))).toEqual(["away"]);
    expect(ownedSides(halves, new Set(["A", "D"]))).toEqual(["home", "away"]);
    expect(ownedSides(halves, new Set())).toEqual([]);
  });
});

describe("matchPermissions — manager", () => {
  it("edits only their own team, and no league score", () => {
    const p = matchPermissions(userV, pm(), A);
    expect(p.team).toEqual({ home: true, away: false });
    expect(p.times).toEqual({ home: true, away: false });
    expect(p.score).toBe(false);
    expect(p.details).toBe(true);
    expect(p.send).toEqual(["home"]);
    expect(p.makeOfficial).toBe(false);
  });

  it("can set the opponent's club only while that team is empty", () => {
    expect(matchPermissions(userV, pm(), A).clubs).toEqual({ home: true, away: true });
    const withAway = pm({ appearances: [{ side: "away" }] });
    expect(matchPermissions(userV, withAway, A).clubs.away).toBe(false);
  });

  it("enters a friendly score until a team is sent", () => {
    expect(matchPermissions(userV, pm({ isFriendly: true }), A).score).toBe(true);
    const sent = pm({ isFriendly: true, awaySentAt: "t" });
    expect(matchPermissions(userV, sent, A).score).toBe(false);
  });

  it("after sending, their team, details and send are closed", () => {
    const p = matchPermissions(userV, pm({ homeSentAt: "t" }), A);
    expect(p.team.home).toBe(false);
    expect(p.details).toBe(false);
    expect(p.deleteDraft).toBe(false);
    expect(p.send).toEqual([]);
    expect(p.clubs.home).toBe(false);
  });

  it("the other manager keeps their own team while one team is sent", () => {
    const p = matchPermissions(userV, pm({ awaySentAt: "t" }), A);
    expect(p.team.home).toBe(true);
    expect(p.send).toEqual(["home"]);
    expect(p.details).toBe(false);
  });

  it("can change nothing once the match is sent or official", () => {
    for (const status of ["sent", "submitted"] as const) {
      const p = matchPermissions(userV, pm({ status }), A);
      expect(p.team).toEqual({ home: false, away: false });
      expect(p.times).toEqual({ home: false, away: false });
      expect(p.reopen).toBe(false);
    }
  });

  it("an unrelated manager gets nothing", () => {
    const p = matchPermissions(userV, pm(), new Set(["Z"]));
    expect(p.details).toBe(false);
    expect(p.team).toEqual({ home: false, away: false });
  });

  it("a creator who manages nothing keeps the details but has no team", () => {
    const p = matchPermissions(userV, pm({ createdBy: "u" }), new Set());
    expect(p.details).toBe(true);
    expect(p.team).toEqual({ home: false, away: false });
  });
});

describe("matchPermissions — staff", () => {
  it("edit everything before official, and make official", () => {
    for (const status of ["draft", "sent"] as const) {
      const p = matchPermissions(adminV, pm({ status }), new Set());
      expect(p.team).toEqual({ home: true, away: true });
      expect(p.score).toBe(true);
      expect(p.details).toBe(true);
      expect(p.makeOfficial).toBe(true);
      expect(p.send).toEqual([]);
    }
  });

  it("send back only when a team has been sent", () => {
    expect(matchPermissions(adminV, pm(), new Set()).sendBack).toBe(false);
    expect(matchPermissions(adminV, pm({ homeSentAt: "t" }), new Set()).sendBack).toBe(true);
    expect(matchPermissions(adminV, pm({ status: "sent" }), new Set()).sendBack).toBe(true);
  });

  it("on an official match: goal times only; only KFANDRA reopens", () => {
    const admin = matchPermissions(adminV, pm({ status: "submitted" }), new Set());
    expect(admin.times).toEqual({ home: true, away: true });
    expect(admin.team).toEqual({ home: false, away: false });
    expect(admin.score).toBe(false);
    expect(admin.reopen).toBe(false);
    expect(matchPermissions(kfandraV, pm({ status: "submitted" }), new Set()).reopen).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/lib/klcsra/access.test.ts`
Expected: FAIL, because `matchPermissions is not a function`.

- [ ] **Step 3: Implement (append to `src/lib/klcsra/access.ts`)**

Add `import type { MatchStatus, SideKey } from "./types";` at the top, next to the existing import. Then append:

```ts
// ── match workflow (spec 2026-11-08 §3) ─────────────────────────────────────

/** The fields `matchPermissions` reads. `MatchDraft` satisfies it. */
export interface PermissionMatch {
  status: MatchStatus;
  isFriendly: boolean;
  createdBy: string | null;
  homeSentAt: string | null;
  awaySentAt: string | null;
  halves: { id: string; sides: { side: SideKey; clubId: string | null }[] }[];
  appearances: { side: SideKey }[];
}

/** What one viewer may change on one match, right now. */
export interface MatchPermissions {
  /** Date, sport, duration, League/Friendly. */
  details: boolean;
  deleteDraft: boolean;
  /** Squad and stats, per team. */
  team: Record<SideKey, boolean>;
  /** Pick the club leading this side (pair and keep-your-club rules apply on top). */
  clubs: Record<SideKey, boolean>;
  score: boolean;
  /** Goal/try minutes, per team. */
  times: Record<SideKey, boolean>;
  /** Teams this viewer can send now. */
  send: SideKey[];
  makeOfficial: boolean;
  sendBack: boolean;
  reopen: boolean;
}

const SIDE_KEYS: readonly SideKey[] = ["home", "away"];
const both = (v: boolean): Record<SideKey, boolean> => ({ home: v, away: v });

const NOTHING: MatchPermissions = {
  details: false, deleteDraft: false, team: both(false), clubs: both(false),
  score: false, times: both(false), send: [], makeOfficial: false, sendBack: false, reopen: false,
};

/** The teams (aggregate sides) led by a managed club in any half. */
export function ownedSides(
  halves: { sides: { side: SideKey; clubId: string | null }[] }[],
  managed: ReadonlySet<string>,
): SideKey[] {
  return SIDE_KEYS.filter((side) =>
    halves.some((h) =>
      h.sides.some((s) => s.side === side && s.clubId !== null && managed.has(s.clubId)),
    ),
  );
}

export function sentSides(m: { homeSentAt: string | null; awaySentAt: string | null }) {
  return { home: m.homeSentAt !== null, away: m.awaySentAt !== null };
}

/**
 * The one permission rule, used by the server actions (to refuse) and the
 * recorder (to hide what would be refused).
 *
 *  - Official: nothing changes, except staff may add goal times (D13), and
 *    KFANDRA may reopen.
 *  - Staff: everything before official; they never "send", they make official.
 *  - Manager (draft only): their own team until they send it (D9, D2); the
 *    match details and a friendly score until either team is sent; the other
 *    side's club only while that team has no players (that's how the creator
 *    names the opponent).
 */
export function matchPermissions(
  viewer: Viewer,
  m: PermissionMatch,
  managed: ReadonlySet<string>,
): MatchPermissions {
  const staff = isStaffRole(viewer.role);
  if (m.status === "submitted") {
    return { ...NOTHING, times: both(staff), reopen: canReopenMatch(viewer) };
  }
  const sent = sentSides(m);
  if (staff) {
    return {
      details: true, deleteDraft: true, team: both(true), clubs: both(true),
      score: true, times: both(true), send: [], makeOfficial: true,
      sendBack: m.status === "sent" || sent.home || sent.away, reopen: false,
    };
  }
  if (m.status !== "draft") return NOTHING;
  const owned = ownedSides(m.halves, managed);
  const involved = owned.length > 0 || (m.createdBy !== null && m.createdBy === viewer.id);
  if (!involved) return NOTHING;

  const noneSent = !sent.home && !sent.away;
  const team = {
    home: owned.includes("home") && !sent.home,
    away: owned.includes("away") && !sent.away,
  };
  const empty = (side: SideKey) => !m.appearances.some((a) => a.side === side);
  const clubs = {
    home: owned.includes("home") ? !sent.home : noneSent && empty("home"),
    away: owned.includes("away") ? !sent.away : noneSent && empty("away"),
  };
  return {
    details: noneSent, deleteDraft: noneSent, team, clubs,
    score: m.isFriendly && noneSent, times: team,
    send: SIDE_KEYS.filter((s) => team[s]),
    makeOfficial: false, sendBack: false, reopen: false,
  };
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/lib/klcsra/access.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/klcsra/access.ts src/lib/klcsra/access.test.ts
git commit -m "feat(klc): matchPermissions, the one rule for who changes what (Helper-bsr.16)"
```

---

## Task 6: Goal tally

**Files:**
- Create: `src/lib/klcsra/tally.ts`, `src/lib/klcsra/tally.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { goalTally, officialScore } from "./tally";
import type { AppearanceDraft, MatchDraft } from "./types";

const app = (side: "home" | "away", stats: AppearanceDraft["stats"]): AppearanceDraft =>
  ({ id: `${side}-${Math.random()}`, playerId: "p", displayName: "P", side, slot: 1, stats });
const m = (over: Partial<MatchDraft>): Pick<MatchDraft, "isCombined" | "halves" | "appearances"> => ({
  isCombined: false,
  halves: [{ id: "h1", halfNo: 1, sides: [] }],
  appearances: [],
  ...over,
});

describe("goalTally", () => {
  it("counts every scoring stat for the side, and own goals for the other side", () => {
    const t = goalTally(m({
      appearances: [
        app("home", { 1: { goal: 1, mainGoal: 1, reboundGoal: 1, try: 1, conversion: 1, assist: 3 } }),
        app("away", { 1: { ownGoal: 2 } }),
      ],
    }));
    expect(t).toEqual({ home: 7, away: 0 });
  });

  it("a normal match counts half 1 only; a combined match adds both halves", () => {
    const appearances = [app("home", { 1: { goal: 1 }, 2: { goal: 2 } })];
    const halves = [{ id: "h1", halfNo: 1, sides: [] }, { id: "h2", halfNo: 2, sides: [] }];
    expect(goalTally(m({ appearances, halves })).home).toBe(1);
    expect(goalTally(m({ appearances, halves, isCombined: true })).home).toBe(3);
  });
});

describe("officialScore", () => {
  it("sums the counted halves' side scores", () => {
    const side = (s: "home" | "away", score: number) =>
      ({ id: s, side: s, clubId: s, clubName: s, score });
    const halves = [
      { id: "h1", halfNo: 1, sides: [side("home", 2), side("away", 1)] },
      { id: "h2", halfNo: 2, sides: [side("home", 1), side("away", 1)] },
    ];
    expect(officialScore(m({ halves }))).toEqual({ home: 2, away: 1 });
    expect(officialScore(m({ halves, isCombined: true }))).toEqual({ home: 3, away: 2 });
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/lib/klcsra/tally.test.ts`. Expected: FAIL, because the module isn't found.

- [ ] **Step 3: Implement `src/lib/klcsra/tally.ts`**

```ts
/**
 * Pure. The managers' goal tally, shown to KFANDRA next to the official score
 * (spec §3.3). It never changes the score: KFANDRA's score wins (D4).
 */
import { countedHalves } from "./league-table";
import type { StatKey } from "./stat-rates";
import type { MatchDraft, SideKey } from "./types";

/** Stats that put points on the scoreboard for the scorer's own side. */
export const SCORING_STATS: readonly StatKey[] = ["goal", "mainGoal", "reboundGoal", "try", "conversion"];

type Score = Record<SideKey, number>;
type TallyMatch = Pick<MatchDraft, "isCombined" | "halves" | "appearances">;

export function goalTally(m: TallyMatch): Score {
  const halfNos = new Set(countedHalves(m).map((h) => h.halfNo));
  const t: Score = { home: 0, away: 0 };
  for (const a of m.appearances) {
    const other: SideKey = a.side === "home" ? "away" : "home";
    for (const [half, counts] of Object.entries(a.stats)) {
      if (!halfNos.has(Number(half))) continue;
      for (const k of SCORING_STATS) t[a.side] += counts[k] ?? 0;
      t[other] += counts.ownGoal ?? 0;
    }
  }
  return t;
}

/** The score entered for the counted halves, aggregated as the league table does. */
export function officialScore(m: TallyMatch): Score {
  const s: Score = { home: 0, away: 0 };
  for (const h of countedHalves(m)) for (const side of h.sides) s[side.side] += side.score;
  return s;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/lib/klcsra/tally.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/klcsra/tally.ts src/lib/klcsra/tally.test.ts
git commit -m "feat(klc): goal tally vs official score (Helper-bsr.16)"
```

---

## Task 7: Status labels and duplicate detection

**Files:**
- Create: `src/lib/klcsra/match-status.ts`, `src/lib/klcsra/match-status.test.ts`
- Create: `src/lib/klcsra/duplicates.ts`, `src/lib/klcsra/duplicates.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/klcsra/match-status.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { statusLabel } from "./match-status";

const s = (status: "draft" | "sent" | "submitted", over: object = {}) =>
  ({ status, isFriendly: false, homeSentAt: null, awaySentAt: null, ...over });

describe("statusLabel", () => {
  it("names each state", () => {
    expect(statusLabel(s("draft"))).toBe("Draft");
    expect(statusLabel(s("draft", { homeSentAt: "t" }))).toBe("Draft · 1 of 2 teams sent");
    expect(statusLabel(s("sent"))).toBe("Waiting for KFANDRA");
    expect(statusLabel(s("submitted"))).toBe("Official");
    expect(statusLabel(s("submitted", { isFriendly: true }))).toBe("Submitted");
  });
});
```

`src/lib/klcsra/duplicates.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { findDuplicates, sideClubsOf, type DuplicateCandidate } from "./duplicates";

const cand = (id: string, sideClubs: DuplicateCandidate["sideClubs"], entryDate = "2026-11-08"): DuplicateCandidate => ({
  id, entryDate, status: "draft", isFriendly: false, homeSentAt: null, awaySentAt: null,
  sideClubs, homeLabel: "H", awayLabel: "A",
});
const target = (home: string, away: string, id: string | null = null) => ({
  id, entryDate: "2026-11-08",
  sideClubs: [{ side: "home" as const, clubId: home }, { side: "away" as const, clubId: away }],
});

describe("findDuplicates", () => {
  it("finds the same pair on the same date, either way round", () => {
    const same = cand("m1", [{ side: "home", clubId: "A" }, { side: "away", clubId: "B" }]);
    const reversed = cand("m2", [{ side: "home", clubId: "B" }, { side: "away", clubId: "A" }]);
    expect(findDuplicates(target("A", "B"), [same, reversed]).map((d) => d.id)).toEqual(["m1", "m2"]);
  });

  it("a club of a combined pair counts", () => {
    const combined = cand("m1", [
      { side: "home", clubId: "A" }, { side: "away", clubId: "B" },
      { side: "home", clubId: "C" }, { side: "away", clubId: "D" },
    ]);
    expect(findDuplicates(target("C", "B"), [combined])).toHaveLength(1);
  });

  it("ignores another date, the match itself, and clubs on the same side", () => {
    const otherDay = cand("m1", [{ side: "home", clubId: "A" }, { side: "away", clubId: "B" }], "2026-11-09");
    const itself = cand("m2", [{ side: "home", clubId: "A" }, { side: "away", clubId: "B" }]);
    const sameSide = cand("m3", [{ side: "home", clubId: "A" }, { side: "home", clubId: "B" }]);
    expect(findDuplicates(target("A", "B", "m2"), [otherDay, itself, sameSide])).toEqual([]);
  });

  it("needs a club on both sides of the target", () => {
    const m = cand("m1", [{ side: "home", clubId: "A" }, { side: "away", clubId: "B" }]);
    expect(findDuplicates({ id: null, entryDate: "2026-11-08", sideClubs: [{ side: "home", clubId: "A" }] }, [m])).toEqual([]);
  });
});

describe("sideClubsOf", () => {
  it("lists every (side, club) with a club", () => {
    expect(sideClubsOf([{ sides: [{ side: "home", clubId: "A" }, { side: "away", clubId: null }] }]))
      .toEqual([{ side: "home", clubId: "A" }]);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/lib/klcsra/match-status.test.ts src/lib/klcsra/duplicates.test.ts`. Expected: FAIL, because the modules aren't found.

- [ ] **Step 3: Implement**

`src/lib/klcsra/match-status.ts`:

```ts
/** Pure. The words a match's state is shown in, everywhere (list, header, warnings). */
import type { MatchStatus } from "./types";

export function statusLabel(m: {
  status: MatchStatus; isFriendly: boolean;
  homeSentAt: string | null; awaySentAt: string | null;
}): string {
  if (m.status === "submitted") return m.isFriendly ? "Submitted" : "Official";
  if (m.status === "sent") return "Waiting for KFANDRA";
  const sent = Number(m.homeSentAt !== null) + Number(m.awaySentAt !== null);
  return sent === 0 ? "Draft" : `Draft · ${sent} of 2 teams sent`;
}
```

`src/lib/klcsra/duplicates.ts`:

```ts
/**
 * Pure. The duplicate-match warning (spec §4, D8): another match on the same
 * date where the two clubs lead opposite sides in any half. It warns and
 * never blocks: two clubs can genuinely play twice in a morning.
 */
import type { MatchSummary, SideKey } from "./types";

export type DuplicateCandidate = Pick<
  MatchSummary,
  "id" | "entryDate" | "status" | "isFriendly" | "homeSentAt" | "awaySentAt" | "sideClubs" | "homeLabel" | "awayLabel"
>;

type SideClub = { side: SideKey; clubId: string };

export function sideClubsOf(
  halves: { sides: { side: SideKey; clubId: string | null }[] }[],
): SideClub[] {
  return halves.flatMap((h) =>
    h.sides
      .filter((s): s is { side: SideKey; clubId: string } => s.clubId !== null)
      .map((s) => ({ side: s.side, clubId: s.clubId })),
  );
}

const clubsOn = (list: SideClub[], side: SideKey) =>
  new Set(list.filter((s) => s.side === side).map((s) => s.clubId));

export function findDuplicates<C extends DuplicateCandidate>(
  target: { id: string | null; entryDate: string; sideClubs: SideClub[] },
  candidates: C[],
): C[] {
  const home = clubsOn(target.sideClubs, "home");
  const away = clubsOn(target.sideClubs, "away");
  if (home.size === 0 || away.size === 0) return [];
  const meets = (x: Set<string>, y: Set<string>) =>
    [...home].some((c) => x.has(c)) && [...away].some((c) => y.has(c));
  return candidates.filter((c) => {
    if (c.id === target.id || c.entryDate !== target.entryDate) return false;
    const cHome = clubsOn(c.sideClubs, "home");
    const cAway = clubsOn(c.sideClubs, "away");
    return meets(cHome, cAway) || meets(cAway, cHome);
  });
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Same command as Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/klcsra/match-status.* src/lib/klcsra/duplicates.*
git commit -m "feat(klc): match status labels and duplicate-match detection (Helper-bsr.16)"
```

---

## Task 8: Goal times (pure)

**Files:**
- Create: `src/lib/klcsra/goal-times.ts`, `src/lib/klcsra/goal-times.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { cleanTimes, isTimed, scorersLine, trimTimes } from "./goal-times";
import type { AppearanceDraft } from "./types";

describe("isTimed", () => {
  it("is league Fooba goals and Rugby Sox tries only", () => {
    expect(isTimed("fooba", "mainGoal", false)).toBe(true);
    expect(isTimed("fooba", "reboundGoal", false)).toBe(true);
    expect(isTimed("rugby", "try", false)).toBe(true);
    expect(isTimed("rugby", "conversion", false)).toBe(false);
    expect(isTimed("football", "goal", false)).toBe(false);
    expect(isTimed("fooba", "mainGoal", true)).toBe(false);
  });
});

describe("trimTimes", () => {
  it("keeps at most `count` entries and drops trailing blanks", () => {
    expect(trimTimes([12, 34, 56], 2)).toEqual([12, 34]);
    expect(trimTimes([12, null, null], 3)).toEqual([12]);
    expect(trimTimes([null, 40], 2)).toEqual([null, 40]);
  });
});

describe("cleanTimes", () => {
  it("accepts whole minutes 0..150 and blanks", () => {
    expect(cleanTimes([12, null, 0, 150])).toEqual([12, null, 0, 150]);
  });
  it("rejects anything else", () => {
    expect(cleanTimes([151])).toBeNull();
    expect(cleanTimes([-1])).toBeNull();
    expect(cleanTimes([1.5])).toBeNull();
    expect(cleanTimes(["12"])).toBeNull();
    expect(cleanTimes("12" as unknown as unknown[])).toBeNull();
  });
});

describe("scorersLine", () => {
  const a = (name: string, side: "home" | "away", stats: AppearanceDraft["stats"], times?: AppearanceDraft["times"]): AppearanceDraft =>
    ({ id: name, playerId: name, displayName: name, side, slot: 1, stats, ...(times ? { times } : {}) });

  it("lists scorers with counts and sorted times, earliest scorer first", () => {
    const apps = [
      a("Acid", "home", { 1: { mainGoal: 1 } }),
      a("Caveman", "home", { 1: { mainGoal: 2 } }, { 1: { mainGoal: [34, 12] } }),
      a("Pam", "away", { 1: { mainGoal: 1 } }, { 1: { mainGoal: [5] } }),
    ];
    expect(scorersLine(apps, "home", [1])).toBe("Caveman ×2 (12', 34') · Acid");
    expect(scorersLine(apps, "away", [1])).toBe("Pam (5')");
  });

  it("ignores halves that don't count, and non-scoring stats", () => {
    const apps = [a("X", "home", { 1: { assist: 2 }, 2: { goal: 1 } })];
    expect(scorersLine(apps, "home", [1])).toBe("");
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run src/lib/klcsra/goal-times.test.ts`. Expected: FAIL, because the module isn't found.

- [ ] **Step 3: Implement `src/lib/klcsra/goal-times.ts`**

```ts
/**
 * Pure. Goal/try times (spec §7, D12–D13): optional whole minutes, recorded by
 * the referee in official Fooba and Rugby Sox matches, shown next to the
 * scorer as "Caveman (12', 34')".
 */
import type { Sport } from "./sport-stats";
import type { StatKey } from "./stat-rates";
import type { AppearanceDraft, SideKey } from "./types";

export const TIMED_STATS: Partial<Record<Sport, readonly StatKey[]>> = {
  fooba: ["mainGoal", "reboundGoal"],
  rugby: ["try"],
};
export const MAX_MINUTE = 150;

/** Stats shown in the Scorers line. */
const SCORER_STATS: readonly StatKey[] = ["goal", "mainGoal", "reboundGoal", "try"];

export function isTimed(sport: Sport, statKey: StatKey, isFriendly: boolean): boolean {
  return !isFriendly && (TIMED_STATS[sport]?.includes(statKey) ?? false);
}

/** At most `count` entries, with trailing blanks dropped. */
export function trimTimes(times: readonly (number | null)[], count: number): (number | null)[] {
  const out = times.slice(0, Math.max(0, count));
  while (out.length > 0 && out[out.length - 1] === null) out.pop();
  return out;
}

/** Validated minutes (whole, 0..MAX_MINUTE, or null), or null when any entry is invalid. */
export function cleanTimes(raw: unknown): (number | null)[] | null {
  if (!Array.isArray(raw)) return null;
  const out: (number | null)[] = [];
  for (const v of raw) {
    if (v === null) out.push(null);
    else if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_MINUTE) out.push(v);
    else return null;
  }
  return out;
}

/** "Caveman ×2 (12', 34') · Acid": one team's scorers over the counted halves. */
export function scorersLine(
  appearances: readonly AppearanceDraft[],
  side: SideKey,
  halfNos: readonly number[],
): string {
  const rows: { text: string; first: number }[] = [];
  for (const a of appearances) {
    if (a.side !== side) continue;
    let count = 0;
    const mins: number[] = [];
    for (const h of halfNos) {
      for (const k of SCORER_STATS) {
        count += a.stats[h]?.[k] ?? 0;
        for (const t of a.times?.[h]?.[k] ?? []) if (t !== null) mins.push(t);
      }
    }
    if (count === 0) continue;
    mins.sort((x, y) => x - y);
    const times = mins.length > 0 ? ` (${mins.map((t) => `${t}'`).join(", ")})` : "";
    rows.push({
      text: `${a.displayName}${count > 1 ? ` ×${count}` : ""}${times}`,
      first: mins[0] ?? Number.POSITIVE_INFINITY,
    });
  }
  // Stable sort: untimed scorers keep squad order, after the timed ones.
  return rows.sort((x, y) => x.first - y.first).map((r) => r.text).join(" · ");
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npx vitest run src/lib/klcsra/goal-times.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/klcsra/goal-times.*
git commit -m "feat(klc): goal/try times helpers and Scorers line (Helper-bsr.16)"
```

---

## Task 9: Actions: the permission gate and per-team edits

**Files:**
- Modify: `src/lib/klcsra/actions.ts`, `src/lib/klcsra/actions.test.ts`

- [ ] **Step 1: Update the test harness and write the failing tests**

In `src/lib/klcsra/actions.test.ts`:

1. Extend the `./repository` mock with `setSideScore`, `addAppearance`, `removeAppearance`, `setStat`, `setGoalTimes`, `sendTeam`, `finishSending`, `makeOfficial`, `sendBack`, `listMatches` (each `vi.fn()`). Remove `submitMatch`.
2. In `draft()`, add `homeSentAt: null, awaySentAt: null,` after `submittedAt: null,`.
3. Add these constants after `NOT_KFANDRA`:

```ts
const TEAM_SENT = "Your team has been sent. Ask KFANDRA to send it back if something needs fixing.";
const NOT_YOUR_TEAM = "You can only edit your own team.";
const WAITING = "Waiting for KFANDRA to make this official.";
const STAFF_SCORE = "Only KFANDRA or an admin can enter a league score.";
const DETAILS_FIXED = "A team has been sent, so the match details are fixed. Ask KFANDRA to send it back if something needs fixing.";
const withPlayers = {
  appearances: [
    { id: "ap1", side: "home", slot: 1, playerId: "p1", displayName: "P1", stats: {} },
    { id: "ap2", side: "away", slot: 1, playerId: "p2", displayName: "P2", stats: {} },
  ],
} as Partial<MatchDraft>;
```

4. Append:

```ts
describe("per-team edits (manager of A = home)", () => {
  beforeEach(() => { signIn(as("user")); manages("A"); });

  it("adds a player to their own team", async () => {
    expect(await addAppearanceAction("m1", "p9", "home")).toEqual({ ok: true, data: undefined });
    expect(repo.addAppearance).toHaveBeenCalledWith("m1", "p9", "home");
  });

  it("can't touch the other team", async () => {
    vi.mocked(repo.getMatch).mockResolvedValue(draft(withPlayers));
    expect(await addAppearanceAction("m1", "p9", "away")).toEqual({ ok: false, error: NOT_YOUR_TEAM });
    expect(await removeAppearanceAction("m1", "ap2")).toEqual({ ok: false, error: NOT_YOUR_TEAM });
    expect(await setStatAction("m1", "ap2", 1, "goal", 1)).toEqual({ ok: false, error: NOT_YOUR_TEAM });
    expect(repo.addAppearance).not.toHaveBeenCalled();
    expect(repo.removeAppearance).not.toHaveBeenCalled();
    expect(repo.setStat).not.toHaveBeenCalled();
  });

  it("can't pull a player out of the other team by re-adding them", async () => {
    vi.mocked(repo.getMatch).mockResolvedValue(draft(withPlayers));
    expect(await addAppearanceAction("m1", "p2", "home"))
      .toEqual({ ok: false, error: "That player is already in the other team." });
  });

  it("after sending, their team is closed", async () => {
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ ...withPlayers, homeSentAt: "t" }));
    expect(await setStatAction("m1", "ap1", 1, "goal", 1)).toEqual({ ok: false, error: TEAM_SENT });
    expect(await updateMatchMetaAction("m1", { sport: "rugby" })).toEqual({ ok: false, error: DETAILS_FIXED });
  });

  it("a sent match is read-only for managers", async () => {
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ ...withPlayers, status: "sent" }));
    expect(await setStatAction("m1", "ap1", 1, "goal", 1)).toEqual({ ok: false, error: WAITING });
  });

  it("enters no league score, but can enter a friendly's", async () => {
    expect(await setSideScoreAction("m1", "h1", "home", 2)).toEqual({ ok: false, error: STAFF_SCORE });
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ isFriendly: true }));
    expect(await setSideScoreAction("m1", "h1", "home", 2)).toEqual({ ok: true, data: undefined });
  });

  it("can set the opponent's club only while that team has no players", async () => {
    expect(await setSideClubAction("m1", "h1", "away", "C")).toEqual({ ok: true, data: undefined });
    vi.mocked(repo.getMatch).mockResolvedValue(draft(withPlayers));
    expect(await setSideClubAction("m1", "h1", "away", "C")).toEqual({
      ok: false, error: "That side belongs to the other club now. Ask their manager or KFANDRA.",
    });
  });

  it("lowering a count trims that stat's goal times", async () => {
    vi.mocked(repo.getMatch).mockResolvedValue(draft({
      appearances: [{
        id: "ap1", side: "home", slot: 1, playerId: "p1", displayName: "P1",
        stats: { 1: { mainGoal: 2 } }, times: { 1: { mainGoal: [12, 34] } },
      }],
    }));
    await setStatAction("m1", "ap1", 1, "mainGoal", 1);
    expect(repo.setStat).toHaveBeenCalledWith("ap1", 1, "mainGoal", 1, [12]);
  });
});

describe("staff edit both teams before official", () => {
  it("sets any score and stat on a sent match", async () => {
    signIn(as("admin"));
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ ...withPlayers, status: "sent" }));
    expect(await setSideScoreAction("m1", "h1", "away", 3)).toEqual({ ok: true, data: undefined });
    expect(await setStatAction("m1", "ap2", 1, "goal", 1)).toEqual({ ok: true, data: undefined });
  });
});
```

Add `addAppearanceAction`, `removeAppearanceAction`, `setSideScoreAction` and `setStatAction` to the import from `./actions`.

Update two existing expectations that the new rules change:
- `"a manager replacing their last club is refused"` and `"a creator replacing their last club is refused too"` still expect `KEEP_OWN_CLUB` for `home → C`. Keep them as they are: `clubs.home` is true for the owner, and keep-your-club applies after that.
- `"a valid change writes the side"` (manager sets away to C with no away players) still passes.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run src/lib/klcsra/actions.test.ts`
Expected: the new tests FAIL. The others may fail to compile until Step 3.

- [ ] **Step 3: Implement: replace the gate section of `src/lib/klcsra/actions.ts`**

Update the imports:

```ts
import {
  canEditMatch, canReopenMatch, clubOnBothSlots, clubOnOtherSide, keepsManagedClub, matchClubIds,
  matchPermissions, ownedSides, sentSides, type MatchPermissions,
} from "./access";
import { cleanTimes, isTimed, trimTimes } from "./goal-times";
import { findDuplicates, type DuplicateCandidate } from "./duplicates";
import type { MatchDraft, MatchStatus, PayoutLine, Season, SideKey } from "./types";
```

Add these messages after `NO_ACTIVE_SEASON`:

```ts
const WAITING = "Waiting for KFANDRA to make this official.";
const TEAM_SENT = "Your team has been sent. Ask KFANDRA to send it back if something needs fixing.";
const NOT_YOUR_TEAM = "You can only edit your own team.";
const DETAILS_FIXED =
  "A team has been sent, so the match details are fixed. Ask KFANDRA to send it back if something needs fixing.";
const STAFF_SCORE = "Only KFANDRA or an admin can enter a league score.";
const OTHER_CLUB = "That side belongs to the other club now. Ask their manager or KFANDRA.";
```

Replace `EditorGate`, `requireMatchEditor` and `requireEditableMatch` with:

```ts
interface MatchGate {
  player: CurrentPlayer;
  match: MatchDraft;
  /** The caller's managed clubs; empty for staff (never looked up). */
  managed: Set<string>;
  perms: MatchPermissions;
}

/**
 * Signed in + the match exists + the caller is staff or involved in it
 * (creator, or manager of a club on it). What they may CHANGE is
 * `perms` (`matchPermissions`, spec §3); each action checks its own slice.
 */
async function loadMatchGate(matchId: string): Promise<ActionResult<MatchGate>> {
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };
  const match = await repo.getMatch(matchId);
  if (!match) return { ok: false, error: NO_MATCH };
  let managed = new Set<string>();
  if (!isStaffRole(player.role)) {
    const loaded = await loadManaged(player.id);
    if (!loaded.ok) return loaded;
    managed = loaded.data;
    const ownership = { createdBy: match.createdBy, clubIds: matchClubIds(match.halves) };
    if (!canEditMatch(player, ownership, managed)) return { ok: false, error: NOT_STAFF };
  }
  return { ok: true, data: { player, match, managed, perms: matchPermissions(player, match, managed) } };
}

/** The state-level refusal (locked, or waiting for KFANDRA), if any. */
function stateRefusal(g: MatchGate): string | null {
  if (g.match.status === "submitted") return LOCKED;
  if (g.match.status === "sent" && !isStaffRole(g.player.role)) return WAITING;
  return null;
}

function teamRefusal(g: MatchGate, side: SideKey): string | null {
  if (g.perms.team[side]) return null;
  return stateRefusal(g) ?? (sentSides(g.match)[side] && ownedSides(g.match.halves, g.managed).includes(side)
    ? TEAM_SENT
    : NOT_YOUR_TEAM);
}

function detailsRefusal(g: MatchGate): string | null {
  return g.perms.details ? null : (stateRefusal(g) ?? DETAILS_FIXED);
}
```

Replace the beginning of each action, up to and including its gate check, as follows (the rest of each body stays):

`updateMatchMetaAction`:

```ts
  const gate = await loadMatchGate(matchId);
  if (!gate.ok) return gate;
  const why = detailsRefusal(gate.data);
  if (why) return { ok: false, error: why };
```

`deleteMatchAction`:

```ts
  const gate = await loadMatchGate(matchId);
  if (!gate.ok) return gate;
  if (!gate.data.perms.deleteDraft) {
    return { ok: false, error: stateRefusal(gate.data) ?? DETAILS_FIXED };
  }
```

`setSideClubAction`: replace its body from the gate through the keep-your-club block with:

```ts
  const gate = await loadMatchGate(matchId);
  if (!gate.ok) return gate;

  if (!isSideKey(side)) return { ok: false, error: "Unknown side." };
  if (!clubId) return { ok: false, error: "Pick a club." };
  const { player, match, managed, perms } = gate.data;
  if (!match.halves.some((h) => h.id === halfId)) {
    return { ok: false, error: "That half does not belong to this match." };
  }
  if (!perms.clubs[side]) {
    const why = stateRefusal(gate.data) ??
      (ownedSides(match.halves, managed).includes(side) ? TEAM_SENT : OTHER_CLUB);
    return { ok: false, error: why };
  }
  if (clubOnOtherSide(match.halves, side, clubId)) {
    return { ok: false, error: "That club is already on the other side of this match." };
  }
  // A manager may not edit their own club off the match. Staff are exempt.
  if (!isStaffRole(player.role) && !keepsManagedClub(match.halves, halfId, side, clubId, managed)) {
    return { ok: false, error: KEEP_OWN_CLUB };
  }
```

`setSideScoreAction`:

```ts
  const gate = await loadMatchGate(matchId);
  if (!gate.ok) return gate;
  if (!gate.data.perms.score) {
    const why = stateRefusal(gate.data) ?? (gate.data.match.isFriendly ? DETAILS_FIXED : STAFF_SCORE);
    return { ok: false, error: why };
  }
```

Then use `gate.data.match.halves` as before.

`addAppearanceAction`:

```ts
  const gate = await loadMatchGate(matchId);
  if (!gate.ok) return gate;

  if (!isSideKey(side)) return { ok: false, error: "Unknown side." };
  if (!playerId) return { ok: false, error: "Pick a player." };
  const why = teamRefusal(gate.data, side);
  if (why) return { ok: false, error: why };
  // Re-adding moves a player between sides: never out of a team the caller can't edit.
  const existing = gate.data.match.appearances.find((a) => a.playerId === playerId);
  if (existing && existing.side !== side && !gate.data.perms.team[existing.side]) {
    return { ok: false, error: "That player is already in the other team." };
  }
```

`removeAppearanceAction`:

```ts
  const gate = await loadMatchGate(matchId);
  if (!gate.ok) return gate;

  const app = gate.data.match.appearances.find((a) => a.id === appearanceId);
  if (!app) return { ok: false, error: "That player is not in this match." };
  const why = teamRefusal(gate.data, app.side);
  if (why) return { ok: false, error: why };
```

`setStatAction`:

```ts
  const gate = await loadMatchGate(matchId);
  if (!gate.ok) return gate;

  const { match } = gate.data;
  const app = match.appearances.find((a) => a.id === appearanceId);
  if (!app) return { ok: false, error: "That player is not in this match." };
  if (!match.halves.some((h) => h.halfNo === halfNo)) {
    return { ok: false, error: "This match has no such half." };
  }
  if (!KNOWN_STATS.has(statKey)) return { ok: false, error: "Unknown stat." };
  const why = teamRefusal(gate.data, app.side);
  if (why) return { ok: false, error: why };

  const value = Math.max(0, nonNegativeInt(count) ?? 0);
  // A lower count drops the latest goal times with it (minutes_len_chk).
  const minutes = trimTimes(app.times?.[halfNo]?.[statKey] ?? [], value);

  try {
    await repo.setStat(appearanceId, halfNo, statKey, value, minutes);
```

The rest is unchanged. Delete the `isStaffRole`-based managed lookup that `setSideClubAction` used to do itself.

Also update the doc comment at the top of the file. Point 2 becomes:

```
 *  2. **Who may change what.** `matchPermissions` (access.ts) per state and
 *     team; RLS deliberately does not enforce it (staff have blanket write
 *     access), so this file is the first lock; the `*_submit_lock` DB
 *     triggers are the backstop for official matches.
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npx vitest run src/lib/klcsra/actions.test.ts`
Expected: the Task 9 tests PASS. The `submitMatchAction` describe still fails. Task 11 replaces it.

- [ ] **Step 5: Commit**

Commit after Task 11, so the file compiles. Go straight on to Task 10.

---

## Task 10: Actions: create with an opponent, and the duplicate check

**Files:**
- Modify: `src/lib/klcsra/actions.ts`, `src/lib/klcsra/actions.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace the `createMatchAction` describe blocks with:

```ts
describe("createMatchAction", () => {
  beforeEach(() => { vi.mocked(repo.listMatches).mockResolvedValue([]); });

  it("a plain user with no managed clubs is refused, nothing written", async () => {
    signIn(as("user"));
    expect(await createMatchAction({ ...newMatch, homeClubId: "A", awayClubId: "B" }))
      .toEqual({ ok: false, error: NOT_STAFF });
    expect(repo.createMatch).not.toHaveBeenCalled();
  });

  it("a manager must pick their own club and an opponent", async () => {
    signIn(as("user"));
    manages("A");
    expect(await createMatchAction({ ...newMatch, homeClubId: "A" }))
      .toEqual({ ok: false, error: "Pick the other club." });
    expect(await createMatchAction({ ...newMatch, homeClubId: "A", awayClubId: "A" }))
      .toEqual({ ok: false, error: "Pick two different clubs." });
    expect(repo.createMatch).not.toHaveBeenCalled();
  });

  it("a manager creates with both clubs", async () => {
    signIn(as("user", "mgr"));
    manages("A");
    expect(await createMatchAction({ ...newMatch, homeClubId: "A", awayClubId: "B" }))
      .toEqual({ ok: true, data: { kind: "created", id: "new-id" } });
    expect(repo.createMatch).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: "mgr", homeClubId: "A", awayClubId: "B" }),
    );
  });

  it("a duplicate is returned, not created, unless allowed", async () => {
    signIn(as("user"));
    manages("A");
    const dup = {
      id: "m0", entryDate: newMatch.entryDate, status: "draft", isFriendly: false,
      homeSentAt: null, awaySentAt: null, homeLabel: "B", awayLabel: "A",
      sideClubs: [{ side: "home", clubId: "B" }, { side: "away", clubId: "A" }],
    };
    vi.mocked(repo.listMatches).mockResolvedValue([dup as never]);
    const res = await createMatchAction({ ...newMatch, homeClubId: "A", awayClubId: "B" });
    expect(res).toEqual({ ok: true, data: { kind: "duplicates", matches: [dup] } });
    expect(repo.listMatches).toHaveBeenCalledWith({ entryDate: newMatch.entryDate });
    expect(repo.createMatch).not.toHaveBeenCalled();

    await createMatchAction({ ...newMatch, homeClubId: "A", awayClubId: "B", allowDuplicate: true });
    expect(repo.createMatch).toHaveBeenCalled();
  });

  it("staff need no clubs and skip the duplicate check without both", async () => {
    signIn(as("admin", "staff"));
    expect(await createMatchAction(newMatch)).toEqual({ ok: true, data: { kind: "created", id: "new-id" } });
    expect(repo.createMatch).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: "staff", homeClubId: null, awayClubId: null }),
    );
    expect(repo.listManagedClubIds).not.toHaveBeenCalled();
    expect(repo.listMatches).not.toHaveBeenCalled();
  });
});

describe("createMatchAction lookup failure", () => {
  it("a failed managed-clubs lookup is an error, not a refusal or a pass", async () => {
    signIn(as("user"));
    vi.mocked(repo.listManagedClubIds).mockRejectedValue(new Error("Failed to load your clubs: db down"));
    const res = await createMatchAction({ ...newMatch, homeClubId: "A", awayClubId: "B" });
    expect(res).toEqual({ ok: false, error: "Failed to load your clubs: db down" });
    expect(repo.createMatch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement: replace `CreateMatchFields` and `createMatchAction`**

```ts
export interface CreateMatchFields {
  entryDate: string;
  sport: Sport;
  isCombined: boolean;
  isFriendly: boolean;
  /** Required for a club manager (must be a club they manage); optional for staff. */
  homeClubId?: string | null;
  /** The opponent. Required for a club manager; optional for staff. */
  awayClubId?: string | null;
  /** Create even though a match between the same clubs exists that day (spec §4). */
  allowDuplicate?: boolean;
}

export type CreateMatchOutcome =
  | { kind: "created"; id: string }
  | { kind: "duplicates"; matches: DuplicateCandidate[] };

/**
 * Create a draft match (with its half rows, and half 1's clubs when given).
 * When both clubs are known and another match on that date has the same two
 * clubs on opposite sides, nothing is created and those matches are returned,
 * so the form can offer "Open it" (D8). `allowDuplicate` skips the check.
 */
export async function createMatchAction(
  input: CreateMatchFields,
): Promise<ActionResult<CreateMatchOutcome>> {
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };

  if (!DATE_RE.test(input?.entryDate ?? "")) {
    return { ok: false, error: "Pick a valid match date." };
  }
  if (!isSport(input.sport)) return { ok: false, error: "Pick a valid sport." };

  const homeClubId = input.homeClubId || null;
  const awayClubId = input.awayClubId || null;
  if (!isStaffRole(player.role)) {
    const managed = await loadManaged(player.id);
    if (!managed.ok) return managed;
    if (!homeClubId || !managed.data.has(homeClubId)) return { ok: false, error: NOT_STAFF };
    if (!awayClubId) return { ok: false, error: "Pick the other club." };
  }
  if (homeClubId && awayClubId && homeClubId === awayClubId) {
    return { ok: false, error: "Pick two different clubs." };
  }

  if (homeClubId && awayClubId && !input.allowDuplicate) {
    const sameDay = await repo.listMatches({ entryDate: input.entryDate });
    const matches = findDuplicates(
      {
        id: null,
        entryDate: input.entryDate,
        sideClubs: [{ side: "home", clubId: homeClubId }, { side: "away", clubId: awayClubId }],
      },
      sameDay,
    );
    if (matches.length > 0) return { ok: true, data: { kind: "duplicates", matches } };
  }

  try {
    const id = await repo.createMatch({
      entryDate: input.entryDate,
      sport: input.sport,
      isCombined: Boolean(input.isCombined),
      isFriendly: Boolean(input.isFriendly),
      createdBy: player.id,
      homeClubId,
      awayClubId,
    });
    revalidatePath(MATCHES_PATH);
    return { ok: true, data: { kind: "created", id } };
  } catch (e) {
    return failed(e, "Failed to create the match.");
  }
}
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run src/lib/klcsra/actions.test.ts -t createMatchAction`
Expected: PASS.

---

## Task 11: Actions: send, make official, send back, reopen, goal times

**Files:**
- Modify: `src/lib/klcsra/actions.ts`, `src/lib/klcsra/actions.test.ts`

- [ ] **Step 1: Write the failing tests**

Replace the `describe("submitMatchAction", …)` and `describe("reopenMatchAction", …)` blocks with:

```ts
describe("sendTeamAction", () => {
  beforeEach(() => {
    signIn(as("user", "mgr"));
    manages("A");
    vi.mocked(repo.getMatch).mockResolvedValue(draft(withPlayers));
    vi.mocked(repo.finishSending).mockResolvedValue("draft");
  });

  it("sends the manager's own team and returns the status after", async () => {
    expect(await sendTeamAction("m1", "home")).toEqual({ ok: true, data: "draft" });
    expect(repo.sendTeam).toHaveBeenCalledWith("m1", "home");
    expect(repo.finishSending).toHaveBeenCalledWith("m1", "mgr");
  });

  it("refuses the other team, and an empty own team", async () => {
    expect(await sendTeamAction("m1", "away")).toEqual({ ok: false, error: NOT_YOUR_TEAM });
    vi.mocked(repo.getMatch).mockResolvedValue(draft());
    expect(await sendTeamAction("m1", "home"))
      .toEqual({ ok: false, error: "Add at least one player to your team before sending." });
    expect(repo.sendTeam).not.toHaveBeenCalled();
  });

  it("refuses a match with a club missing", async () => {
    vi.mocked(repo.getMatch).mockResolvedValue(draft({
      ...withPlayers,
      halves: [{ id: "h1", halfNo: 1, sides: [side("home", "A")] }],
    }));
    expect(await sendTeamAction("m1", "home"))
      .toEqual({ ok: false, error: "Pick a club for both sides before sending." });
  });

  it("refuses a team already sent", async () => {
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ ...withPlayers, homeSentAt: "t" }));
    expect(await sendTeamAction("m1", "home")).toEqual({ ok: false, error: TEAM_SENT });
  });
});

describe("makeOfficialAction", () => {
  beforeEach(() => {
    vi.mocked(repo.getActiveSeason).mockResolvedValue({ id: "s2" } as never);
    vi.mocked(loadStatRates).mockResolvedValue(DEFAULT_STAT_RATES);
    vi.mocked(loadSportStats).mockResolvedValue(DEFAULT_SPORT_STATS);
  });

  it("a manager can't", async () => {
    signIn(as("user"));
    manages("A");
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ ...withPlayers, status: "sent" }));
    expect(await makeOfficialAction("m1")).toEqual({ ok: false, error: WAITING });
    expect(repo.makeOfficial).not.toHaveBeenCalled();
  });

  it("staff make a sent league match official in the active season", async () => {
    signIn(as("admin"));
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ ...withPlayers, status: "sent" }));
    const res = await makeOfficialAction("m1");
    expect(res.ok).toBe(true);
    expect(repo.makeOfficial).toHaveBeenCalledWith("m1", "s2", "admin-id");
  });

  it("a friendly carries no season", async () => {
    signIn(as("admin"));
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ ...withPlayers, isFriendly: true }));
    await makeOfficialAction("m1");
    expect(repo.makeOfficial).toHaveBeenCalledWith("m1", null, "admin-id");
  });

  it("an official match is locked", async () => {
    signIn(as("admin"));
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ status: "submitted" }));
    expect(await makeOfficialAction("m1")).toEqual({ ok: false, error: LOCKED });
  });

  it("a club leading home in one half and away in the other is refused", async () => {
    signIn(as("admin"));
    vi.mocked(repo.getMatch).mockResolvedValue(draft({
      ...withPlayers,
      isCombined: true,
      halves: [
        { id: "h1", halfNo: 1, sides: [side("home", "A"), side("away", "B")] },
        { id: "h2", halfNo: 2, sides: [side("home", "C"), side("away", "A")] },
      ],
    }));
    expect(await makeOfficialAction("m1")).toEqual({
      ok: false,
      error: "A club can't be on both sides of one match. Fix the clubs before submitting.",
    });
  });

  it("a lost race surfaces the repository's locked message", async () => {
    signIn(as("admin"));
    vi.mocked(repo.getMatch).mockResolvedValue(draft(withPlayers));
    vi.mocked(repo.makeOfficial).mockRejectedValue(new Error(LOCKED));
    expect(await makeOfficialAction("m1")).toEqual({ ok: false, error: LOCKED });
  });
});

describe("sendBackAction", () => {
  it("staff send a sent match back", async () => {
    signIn(as("admin"));
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ status: "sent", homeSentAt: "t", awaySentAt: "t" }));
    expect(await sendBackAction("m1")).toEqual({ ok: true, data: undefined });
    expect(repo.sendBack).toHaveBeenCalledWith("m1");
  });
  it("a manager can't", async () => {
    signIn(as("user"));
    manages("A");
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ status: "sent" }));
    expect(await sendBackAction("m1")).toEqual({ ok: false, error: WAITING });
  });
  it("nothing to send back on an unsent draft", async () => {
    signIn(as("admin"));
    expect(await sendBackAction("m1")).toEqual({ ok: false, error: "No team has been sent yet." });
  });
});

describe("reopenMatchAction", () => {
  beforeEach(() => {
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ status: "submitted" }));
  });
  it("an admin is refused", async () => {
    signIn(as("admin"));
    expect(await reopenMatchAction("m1")).toEqual({ ok: false, error: NOT_KFANDRA });
    expect(repo.reopenMatch).not.toHaveBeenCalled();
  });
  it("KFANDRA reopens a league match to Sent, a friendly to Draft", async () => {
    signIn(as("kfandra"));
    expect(await reopenMatchAction("m1")).toEqual({ ok: true, data: undefined });
    expect(repo.reopenMatch).toHaveBeenCalledWith("m1", "sent");
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ status: "submitted", isFriendly: true }));
    await reopenMatchAction("m1");
    expect(repo.reopenMatch).toHaveBeenLastCalledWith("m1", "draft");
  });
});

describe("setGoalTimesAction", () => {
  const timed = (over: Partial<MatchDraft> = {}) => draft({
    sport: "fooba",
    appearances: [{
      id: "ap1", side: "home", slot: 1, playerId: "p1", displayName: "P1",
      stats: { 1: { mainGoal: 2 } },
    }],
    ...over,
  });

  it("a manager times their own team's goals", async () => {
    signIn(as("user"));
    manages("A");
    vi.mocked(repo.getMatch).mockResolvedValue(timed());
    expect(await setGoalTimesAction("m1", "ap1", 1, "mainGoal", [12, null]))
      .toEqual({ ok: true, data: undefined });
    expect(repo.setGoalTimes).toHaveBeenCalledWith("ap1", 1, "mainGoal", [12]);
  });

  it("staff add times to an official match; a manager can't", async () => {
    vi.mocked(repo.getMatch).mockResolvedValue(timed({ status: "submitted" }));
    signIn(as("admin"));
    expect(await setGoalTimesAction("m1", "ap1", 1, "mainGoal", [12, 34])).toEqual({ ok: true, data: undefined });
    signIn(as("user"));
    manages("A");
    expect(await setGoalTimesAction("m1", "ap1", 1, "mainGoal", [12])).toEqual({ ok: false, error: LOCKED });
  });

  it("refuses untimed stats, too many times, and bad minutes", async () => {
    signIn(as("admin"));
    vi.mocked(repo.getMatch).mockResolvedValue(timed());
    expect(await setGoalTimesAction("m1", "ap1", 1, "assist", [1]))
      .toEqual({ ok: false, error: "Times are only kept for league Fooba goals and Rugby Sox tries." });
    expect(await setGoalTimesAction("m1", "ap1", 1, "mainGoal", [1, 2, 3]))
      .toEqual({ ok: false, error: "More times than goals: lower the times first." });
    expect(await setGoalTimesAction("m1", "ap1", 1, "mainGoal", [200]))
      .toEqual({ ok: false, error: "Enter whole minutes between 0 and 150." });
    expect(repo.setGoalTimes).not.toHaveBeenCalled();
  });
});
```

Update the import from `./actions`. Remove `submitMatchAction` and add `makeOfficialAction`, `sendBackAction`, `sendTeamAction` and `setGoalTimesAction`.

- [ ] **Step 2: Implement: replace the `// ── submit / reopen ──` section's actions**

Keep `buildPayoutLines` unchanged. Replace `submitMatchAction` and `reopenMatchAction` with:

```ts
/** The checks Send and Make official share. Null when the match is complete. */
function completenessRefusal(match: MatchDraft, verb: "sending" | "submitting"): string | null {
  if (match.halves.length === 0) return "This match has no halves.";
  // Sides are created lazily, so a side with no club is an ABSENT row.
  const incomplete = match.halves.find((h) => h.sides.length < 2);
  if (incomplete) {
    return match.halves.length > 1
      ? `Pick a club for both sides of half ${incomplete.halfNo}.`
      : `Pick a club for both sides before ${verb}.`;
  }
  if (clubOnBothSlots(match.halves) !== null) {
    return `A club can't be on both sides of one match. Fix the clubs before ${verb}.`;
  }
  return null;
}

/**
 * A manager sends their own team (D2, D9). It then locks for them. When both
 * teams are sent, a league match moves to Sent (waiting for KFANDRA) and a
 * friendly is submitted. Returns the match status after the send.
 */
export async function sendTeamAction(
  matchId: string,
  side: SideKey,
): Promise<ActionResult<MatchStatus>> {
  const gate = await loadMatchGate(matchId);
  if (!gate.ok) return gate;
  if (!isSideKey(side)) return { ok: false, error: "Unknown side." };
  const { player, match, perms } = gate.data;
  if (!perms.send.includes(side)) {
    return { ok: false, error: teamRefusal(gate.data, side) ?? NOT_YOUR_TEAM };
  }
  const incomplete = completenessRefusal(match, "sending");
  if (incomplete) return { ok: false, error: incomplete };
  if (!match.appearances.some((a) => a.side === side)) {
    return { ok: false, error: "Add at least one player to your team before sending." };
  }

  try {
    await repo.sendTeam(matchId, side);
    const status = await repo.finishSending(matchId, player.id);
    revalidateMatch(matchId);
    return { ok: true, data: status };
  } catch (e) {
    return failed(e, "Failed to send your team.");
  }
}

/**
 * Staff make a match official (D3): it locks and, for a league match, tags the
 * ACTIVE season and starts counting in the tables. Works from Draft or Sent
 * (a club may never send). A friendly made official here carries no season.
 * Returns the payout lines, as Submit did.
 */
export async function makeOfficialAction(
  matchId: string,
): Promise<ActionResult<PayoutLine[]>> {
  const gate = await loadMatchGate(matchId);
  if (!gate.ok) return gate;
  const { player, match, perms } = gate.data;
  if (!perms.makeOfficial) return { ok: false, error: stateRefusal(gate.data) ?? NOT_STAFF };

  const incomplete = completenessRefusal(match, "submitting");
  if (incomplete) return { ok: false, error: incomplete };
  if (match.appearances.length === 0) {
    return { ok: false, error: "Add at least one player before submitting." };
  }

  let seasonId: string | null = null;
  if (!match.isFriendly) {
    const active = await repo.getActiveSeason();
    if (!active) return { ok: false, error: NO_ACTIVE_SEASON };
    seasonId = active.id;
  }

  const [rates, sportStats] = await Promise.all([loadStatRates(), loadSportStats()]);
  const lines = buildPayoutLines(match, rates, statsForSport(match.sport, sportStats));

  try {
    await repo.makeOfficial(matchId, seasonId, player.id);
  } catch (e) {
    return failed(e, "Failed to make the match official.");
  }
  revalidateMatch(matchId);
  return { ok: true, data: lines };
}

/** Staff send a match back to the managers (D5): both teams editable again. */
export async function sendBackAction(matchId: string): Promise<ActionResult> {
  const gate = await loadMatchGate(matchId);
  if (!gate.ok) return gate;
  if (!isStaffRole(gate.data.player.role)) {
    return { ok: false, error: stateRefusal(gate.data) ?? NOT_STAFF };
  }
  if (gate.data.match.status === "submitted") return { ok: false, error: LOCKED };
  if (!gate.data.perms.sendBack) return { ok: false, error: "No team has been sent yet." };

  try {
    await repo.sendBack(matchId);
    revalidateMatch(matchId);
    return OK;
  } catch (e) {
    return failed(e, "Failed to send the match back.");
  }
}

/**
 * Unlock an official match (KFANDRA only, D6). A league match goes back to
 * Sent, so KFANDRA edits and re-officials without involving the managers; a
 * friendly goes back to Draft. Reopening a match that isn't official is a no-op.
 */
export async function reopenMatchAction(matchId: string): Promise<ActionResult> {
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };
  if (!canReopenMatch(player)) return { ok: false, error: NOT_KFANDRA };

  const match = await repo.getMatch(matchId);
  if (!match) return { ok: false, error: NO_MATCH };
  if (match.status !== "submitted") return OK;

  try {
    await repo.reopenMatch(matchId, match.isFriendly ? "draft" : "sent");
    revalidateMatch(matchId);
    return OK;
  } catch (e) {
    return failed(e, "Failed to reopen the match.");
  }
}

/**
 * Set the goal/try minutes for one tally (D12). A manager, for their own team
 * while it's editable; staff any time, including on an official match (D13:
 * times don't touch the score or the tables). Trailing blanks are dropped.
 */
export async function setGoalTimesAction(
  matchId: string,
  appearanceId: string,
  halfNo: number,
  statKey: StatKey,
  minutes: (number | null)[],
): Promise<ActionResult> {
  const gate = await loadMatchGate(matchId);
  if (!gate.ok) return gate;
  const { match, perms } = gate.data;
  const app = match.appearances.find((a) => a.id === appearanceId);
  if (!app) return { ok: false, error: "That player is not in this match." };
  if (!perms.times[app.side]) {
    return { ok: false, error: stateRefusal(gate.data) ?? teamRefusal(gate.data, app.side) ?? LOCKED };
  }
  if (!KNOWN_STATS.has(statKey) || !isTimed(match.sport, statKey, match.isFriendly)) {
    return { ok: false, error: "Times are only kept for league Fooba goals and Rugby Sox tries." };
  }
  const cleaned = cleanTimes(minutes);
  if (!cleaned) return { ok: false, error: "Enter whole minutes between 0 and 150." };
  const count = app.stats[halfNo]?.[statKey] ?? 0;
  const trimmed = trimTimes(cleaned, cleaned.length);
  if (trimmed.length > count) {
    return { ok: false, error: "More times than goals: lower the times first." };
  }

  try {
    await repo.setGoalTimes(appearanceId, halfNo, statKey, trimmed);
    revalidateMatch(matchId);
    return OK;
  } catch (e) {
    return failed(e, "Failed to save the times.");
  }
}
```

In `closeSeasonAction`, change the call and the message:

```ts
  const drafts = await repo.countUnfinishedMatchesDatedInSeason(seasonId);
  if (drafts > 0) {
    return {
      ok: false,
      error: `${drafts} unfinished match${drafts === 1 ? "" : "es"} dated in this season. Finish or delete them first.`,
    };
  }
```

Then fix the comment in `src/app/admin/klc/seasons/seasons-admin.tsx:22`, which quotes the old message, to say "N unfinished match(es)".

Note that the staff-only `staff` check on an official match in `sendBackAction` runs before the `perms` check. The unit test expects `LOCKED` for staff and `WAITING` for a manager on a sent match.

- [ ] **Step 3: Run the tests and confirm they pass**

```bash
npx vitest run src/lib/klcsra
npx tsc --noEmit
```

Expected: all klcsra unit tests pass. `tsc` errors remain only in `src/app/klc/**`, which Tasks 12–15 fix.

- [ ] **Step 4: Commit (Tasks 9–11)**

```bash
git add src/lib/klcsra/actions.ts src/lib/klcsra/actions.test.ts src/app/admin/klc/seasons/seasons-admin.tsx
git commit -m "feat(klc): per-team edits, send, make official, send back, goal times actions (Helper-bsr.16)"
```

---

## Task 12: Matches list and the new-match form

**Files:**
- Modify: `src/app/klc/matches/page.tsx`
- Rewrite: `src/app/klc/matches/new-match-form.tsx`

- [ ] **Step 1: Rewrite `src/app/klc/matches/new-match-form.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { fmtDayDate } from "@/lib/format-date";
import { createMatchAction } from "@/lib/klcsra/actions";
import type { DuplicateCandidate } from "@/lib/klcsra/duplicates";
import { statusLabel } from "@/lib/klcsra/match-status";
import { SPORTS, SPORT_LABELS, type Sport } from "@/lib/klcsra/sport-stats";
import type { ClubOption } from "@/lib/klcsra/types";
import { ErrorNote } from "./notice";

/**
 * The one CTA on Screen 1. Combined is a checkbox here because it is fixed at
 * creation (the half rows are written by `createMatchAction`). Friendly is
 * chosen here too, but can be switched in the recorder header until a team
 * is sent.
 *
 * A club manager picks their own club (home side) and the opponent; staff may
 * pick both clubs or leave them for later. With both clubs known, the server
 * checks for a match between them that day and, if one exists, this form
 * offers to open it instead (spec §4).
 *
 * `today` is computed on the server and passed in: deriving it in the client
 * would hydrate a different value whenever the render straddles midnight.
 */
export function NewMatchForm({
  today,
  myClubs,
  allClubs,
  isStaff,
}: {
  today: string;
  myClubs: ClubOption[];
  allClubs: ClubOption[];
  isStaff: boolean;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(today);
  const [sport, setSport] = useState<Sport>("football");
  const [isCombined, setCombined] = useState(false);
  const [isFriendly, setFriendly] = useState(false);
  const [homeClubId, setHomeClubId] = useState(isStaff ? "" : (myClubs[0]?.id ?? ""));
  const [awayClubId, setAwayClubId] = useState("");
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Any change to the form makes an earlier duplicate warning stale. */
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    setDuplicates([]);
    set(v);
  };

  const create = async (allowDuplicate: boolean) => {
    setBusy(true);
    setError(null);
    const res = await createMatchAction({
      entryDate: date, sport, isCombined, isFriendly,
      homeClubId: homeClubId || null,
      awayClubId: awayClubId || null,
      allowDuplicate,
    });
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    if (res.data.kind === "duplicates") {
      setDuplicates(res.data.matches);
      setBusy(false);
      return;
    }
    const id = res.data.id;
    // Stay busy across the navigation so the button cannot double-fire.
    startTransition(() => router.push(`/klc/matches/${id}`));
  };

  const working = busy || pending;
  const homeOptions = isStaff ? allClubs : myClubs;

  return (
    <div
      data-testid="new-match-form"
      data-hydrated={hydrated}
      className="space-y-2.5 rounded-xl border border-gray-200 bg-white p-3"
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-600">New match</p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          data-testid="new-match-date"
          aria-label="Match date"
          value={date}
          onChange={(e) => edit(setDate)(e.target.value)}
          className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
        />
        <select
          data-testid="new-match-sport"
          aria-label="Sport"
          value={sport}
          onChange={(e) => edit(setSport)(e.target.value as Sport)}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
        >
          {SPORTS.map((s) => (
            <option key={s} value={s}>
              {SPORT_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
            {isStaff ? "Home club" : "Your club (home side)"}
          </span>
          <select
            data-testid="new-match-club"
            aria-label={isStaff ? "Home club" : "Your club"}
            value={homeClubId}
            onChange={(e) => edit(setHomeClubId)(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
          >
            {isStaff && <option value="">— pick later —</option>}
            {homeOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
            {isStaff ? "Away club" : "Opponent"}
          </span>
          <select
            data-testid="new-match-opponent"
            aria-label={isStaff ? "Away club" : "Opponent"}
            value={awayClubId}
            onChange={(e) => edit(setAwayClubId)(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
          >
            <option value="">{isStaff ? "— pick later —" : "— pick a club —"}</option>
            {allClubs.map((c) => (
              <option key={c.id} value={c.id} disabled={c.id === homeClubId}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Toggle
          testId="new-match-combined"
          label="Combined"
          checked={isCombined}
          onChange={edit(setCombined)}
        />
        <Toggle
          testId="new-match-friendly"
          label="Friendly"
          checked={isFriendly}
          onChange={edit(setFriendly)}
        />
      </div>

      {duplicates.length > 0 ? (
        <div
          data-testid="duplicate-warning"
          className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[12px] text-amber-900"
        >
          {duplicates.map((d) => (
            <p key={d.id}>
              {d.homeLabel} vs {d.awayLabel} already has a match on {fmtDayDate(d.entryDate)} (
              {statusLabel(d)}).{" "}
              <Link
                href={`/klc/matches/${d.id}`}
                data-testid="duplicate-open"
                className="font-bold underline"
              >
                Open it
              </Link>
            </p>
          ))}
          <button
            type="button"
            data-testid="duplicate-create-anyway"
            disabled={working}
            onClick={() => void create(true)}
            className="text-[12px] font-semibold text-amber-900 underline disabled:opacity-40"
          >
            Create a new match anyway
          </button>
        </div>
      ) : (
        <button
          data-testid="new-match-submit"
          onClick={() => void create(false)}
          disabled={working}
          className="w-full rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-40"
        >
          {working ? "Creating…" : "＋ New match"}
        </button>
      )}

      <p className="text-[11px] text-gray-500">
        Combined = two halves with different clubs. Friendly matches carry no season and pay
        MMG only. Each club enters its own team; KFANDRA enters the league score.
      </p>

      <ErrorNote message={error} testId="new-match-error" />
    </div>
  );
}
```

Keep the existing `Toggle` component unchanged at the bottom of the file.

- [ ] **Step 2: Edit `src/app/klc/matches/page.tsx`**

1. Add the import: `import { statusLabel } from "@/lib/klcsra/match-status";`
2. Split out the staff waiting list after `const matches = …`:

```ts
  // Staff: league matches both clubs have sent wait at the top, oldest first.
  const waiting = staff ? matches.filter((m) => m.status === "sent").reverse() : [];
  const listed = staff ? matches.filter((m) => m.status !== "sent") : matches;
```

   Then use `listed` (not `matches`) in `groupByDate(listed)` and in the empty-state check. The count line keeps `matches.length`.
3. Replace the `NewMatchForm` line with:

```tsx
      {canRecord && (
        <NewMatchForm today={today} myClubs={myClubs} allClubs={clubs} isStaff={staff} />
      )}

      {waiting.length > 0 && (
        <section data-testid="waiting-for-kfandra" className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">
            Waiting for KFANDRA
          </p>
          <ul className="space-y-2">
            {waiting.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </ul>
        </section>
      )}
```

4. In `MatchCard`, replace the status pill:

```tsx
          <span
            data-testid="match-status"
            data-status={m.status}
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${
              m.status === "submitted"
                ? "bg-green-100 text-green-800"
                : m.status === "sent"
                  ? "bg-amber-100 text-amber-900"
                  : "bg-gray-100 text-gray-700"
            }`}
          >
            {statusLabel(m)}
          </span>
```

   Delete the now-unused `const submitted = …` line.
5. Managers see "every submitted match plus the drafts they may edit". Keep that filter, since `canEditMatch` covers sent matches involving their club.

- [ ] **Step 3: Typecheck and lint**

```bash
npx tsc --noEmit 2>&1 | grep -v "src/app/klc/matches/\[id\]" ; npm run lint -- src/app/klc/matches/page.tsx src/app/klc/matches/new-match-form.tsx
```

Expected: no errors outside `src/app/klc/matches/[id]`.

- [ ] **Step 4: Commit**

```bash
git add src/app/klc/matches/page.tsx src/app/klc/matches/new-match-form.tsx
git commit -m "feat(klc): opponent picker, duplicate warning, Waiting for KFANDRA list (Helper-bsr.16)"
```

---

## Task 13: Recorder: permissions, per-team lock, staff panel, send buttons

**Files:**
- Modify: `src/app/klc/matches/[id]/page.tsx`, `match-recorder.tsx`, `team-board.tsx`, `recorder-header.tsx`
- Rewrite: `src/app/klc/matches/[id]/submit-panel.tsx`

- [ ] **Step 1: `page.tsx`**

1. Imports: replace the `access` import with:

```ts
import {
  canEditMatch,
  canRecordMatches,
  matchClubIds,
  matchPermissions,
} from "@/lib/klcsra/access";
import { findDuplicates, sideClubsOf } from "@/lib/klcsra/duplicates";
```

   Add `listMatches` to the repository import.
2. Replace `if (match.status === "draft" && !canEdit) notFound();` with:

```ts
  // Only an official match is a public record; drafts and sent matches are
  // private to the people involved.
  if (match.status !== "submitted" && !canEdit) notFound();
  const perms = matchPermissions(player, match, managed);
  const staff = isStaffRole(player.role);
  // Matches between the same two clubs that day (spec §4), shown as a banner
  // until this one is official. A manager sees only those they could open.
  const duplicates =
    match.status === "submitted"
      ? []
      : findDuplicates(
          { id: match.id, entryDate: match.entryDate, sideClubs: sideClubsOf(match.halves) },
          await listMatches({ entryDate: match.entryDate }),
        ).filter((d) => staff || d.status === "submitted" || canEditMatch(player, d, managed));
```

   Delete `const canReopen = canReopenMatch(player);`.
3. In the `showMatchesLink` expression, replace `match.status === "draft"` with `match.status !== "submitted"`.
4. Pass these to `MatchRecorder` instead of `canReopen` and `isStaff={isStaffRole(player.role)}`:

```tsx
        perms={perms}
        isStaff={staff}
        duplicates={duplicates}
```

- [ ] **Step 2: Rewrite `submit-panel.tsx`**

```tsx
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { clubOnBothSlots, sentSides, type MatchPermissions } from "@/lib/klcsra/access";
import { sideClubLabel } from "@/lib/klcsra/league-data";
import { leaguePointsLine } from "@/lib/klcsra/points-preview";
import type { StandingsRules } from "@/lib/klcsra/standings-rules";
import { goalTally, officialScore } from "@/lib/klcsra/tally";
import type { MatchDraft, PayoutLine, SideKey } from "@/lib/klcsra/types";
import { ErrorNote, SIDE_LABELS, fmtStamp, signed } from "./recorder-shared";

/**
 * Screen 6 — where a match moves on (spec §3).
 *
 *  - A manager sends their own team (Send my team), then waits.
 *  - Staff see the managers' goal tally next to the official score, make the
 *    match official, or send it back.
 *  - KFANDRA reopens an official match.
 *
 * The checks are ADVISORY: the buttons stay enabled whatever they say, so the
 * refusal shown is always the action's own wording.
 */
export function SubmitPanel({
  match,
  lines,
  locked,
  busy,
  perms,
  canEdit,
  isStaff,
  hasActiveSeason,
  seasonName,
  submittedBy,
  rules,
  submitError,
  sendBackError,
  reopenError,
  deleteError,
  onSend,
  onMakeOfficial,
  onSendBack,
  onReopen,
  onDelete,
}: {
  match: MatchDraft;
  lines: PayoutLine[];
  /** The match is official (submitted). */
  locked: boolean;
  busy: boolean;
  perms: MatchPermissions;
  /** False for a read-only viewer of an official match: editor-only hints are hidden. */
  canEdit: boolean;
  isStaff: boolean;
  hasActiveSeason: boolean;
  seasonName: string | null;
  submittedBy: string | null;
  rules: StandingsRules;
  submitError: string | null;
  sendBackError: string | null;
  reopenError: string | null;
  deleteError: string | null;
  onSend: (side: SideKey) => void;
  onMakeOfficial: () => void;
  onSendBack: () => void;
  onReopen: () => void;
  onDelete: () => void;
}) {
  const [confirmReopen, setConfirmReopen] = useState(false);

  const totalKr = lines.reduce((n, l) => n + l.kr, 0);
  const totalMmg = lines.reduce((n, l) => n + l.mmg, 0);
  const sent = sentSides(match);

  // Sides are created lazily, so "fewer than two rows" IS "a club is missing".
  const clubsOk = match.halves.length > 0 && match.halves.every((h) => h.sides.length === 2);
  const checks: { ok: boolean; label: string }[] = [
    {
      ok: clubsOk,
      label: match.isCombined ? "Clubs picked for both halves" : "Clubs picked for both sides",
    },
  ];
  if (perms.makeOfficial) {
    checks.push({ ok: match.appearances.length > 0, label: "At least one player added" });
  } else {
    for (const side of perms.send) {
      checks.push({
        ok: match.appearances.some((a) => a.side === side),
        label: perms.send.length > 1
          ? `At least one player in the ${SIDE_LABELS[side]} team`
          : "At least one player in your team",
      });
    }
  }
  const twoSided = clubOnBothSlots(match.halves);
  if (twoSided !== null) {
    const name =
      match.halves.flatMap((h) => h.sides).find((s) => s.clubId === twoSided)?.clubName ?? "A club";
    checks.push({ ok: false, label: `${name} is on both sides of this match` });
  }
  if (perms.makeOfficial && !match.isFriendly) {
    checks.push({
      ok: hasActiveSeason,
      label: hasActiveSeason
        ? `Active season — ${seasonName}`
        : "No active season. Start one in Seasons first.",
    });
  }
  const showChecks = perms.makeOfficial || perms.send.length > 0;

  // A manager never sees a league score before it is official.
  const showPoints = match.isFriendly || isStaff || locked;
  const points = leaguePointsLine(match, rules);

  const showTally = isStaff && !locked && !match.isFriendly;
  const tally = goalTally(match);
  const score = officialScore(match);
  const mismatch = tally.home !== score.home || tally.away !== score.away;

  return (
    <section className="space-y-3">
      {locked && (
        <div
          data-testid="lock-banner"
          className="space-y-1 rounded-2xl border border-green-300 bg-green-50 px-3 py-2.5"
        >
          <p className="text-[12px] font-bold text-green-900">
            {match.isFriendly ? "Locked — submitted" : "Official"}
            {match.submittedAt ? ` ${fmtStamp(match.submittedAt)}` : ""}.
            {match.seasonName ? ` Season: ${match.seasonName}.` : ""}
            {canEdit && perms.reopen ? " Reopen it to make changes." : ""}
          </p>
          <p data-testid="audit-line" className="text-[11px] text-green-800">
            {match.isFriendly ? "Submitted by" : "Made official by"} {submittedBy ?? "—"}
            {match.submittedAt ? ` · ${fmtStamp(match.submittedAt)}` : ""}
          </p>
        </div>
      )}

      {!locked && match.status === "sent" && !isStaff && (
        <p
          data-testid="waiting-banner"
          className="rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12px] font-semibold text-amber-900"
        >
          Sent to KFANDRA. Waiting for KFANDRA to make this official.
        </p>
      )}
      {!locked && match.status === "draft" && !isStaff && canEdit && perms.send.length === 0
        && (sent.home || sent.away) && (
        <p
          data-testid="sent-note"
          className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[12px] text-gray-700"
        >
          Your team has been sent. Waiting for the other club to send theirs.
        </p>
      )}
      {!locked && match.status === "sent" && isStaff && (
        <p
          data-testid="staff-sent-note"
          className="rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900"
        >
          Both teams have been sent. Check the match, enter the score and make it official.
        </p>
      )}

      {showChecks && (
        <div
          data-testid="submit-checks"
          className="space-y-1.5 rounded-2xl border border-gray-200 bg-white p-4"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
            {perms.makeOfficial ? "Before submitting" : "Before sending"}
          </p>
          {checks.map((c) => (
            <p
              key={c.label}
              data-testid="submit-check"
              data-ok={c.ok}
              className={`flex items-start gap-2 text-[12px] ${
                c.ok ? "text-gray-700" : "text-amber-800"
              }`}
            >
              <span className="font-bold">{c.ok ? "✓" : "•"}</span>
              <span>{c.label}</span>
            </p>
          ))}
        </div>
      )}

      {showTally && (
        <div
          data-testid="tally"
          data-mismatch={mismatch}
          className={`space-y-1 rounded-2xl border p-4 ${
            mismatch ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white"
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
            Recorded goals
          </p>
          <p data-testid="tally-line" className="text-[12px] font-semibold tabular-nums text-gray-900">
            {sideClubLabel(match, "home", { counted: true })} {tally.home} – {tally.away}{" "}
            {sideClubLabel(match, "away", { counted: true })}
          </p>
          {mismatch && (
            <p data-testid="tally-mismatch" className="text-[12px] text-amber-900">
              Differs from the recorded goals. Your score is used.
            </p>
          )}
        </div>
      )}

      {showPoints && (
        <div data-testid="league-points" className="space-y-1 rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">League points</p>
          {points.kind === "friendly" ? (
            <p className="text-[12px] text-gray-600">Friendly — no league points.</p>
          ) : points.kind === "incomplete" ? (
            <p className="text-[12px] text-gray-500">Pick both clubs to see the points.</p>
          ) : (
            <p data-testid="league-points-line" className="text-[12px] font-semibold tabular-nums text-gray-900">
              {points.text}
            </p>
          )}
        </div>
      )}

      <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4">
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
          {locked ? "Final totals" : "Totals preview"}
        </p>
        {match.isFriendly && (
          <p className="text-[11px] text-gray-500">
            Friendly — MMG only, no Kroopies are credited.
          </p>
        )}
        {lines.length === 0 ? (
          <p className="text-[12px] text-gray-500">No players yet — nothing to pay.</p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table data-testid="payout-table" className="w-full text-[12px]">
              <thead className="text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-1 py-1 text-left">Player</th>
                  <th className="px-1 py-1 text-left">Club</th>
                  <th className="px-1 py-1 text-right">KR</th>
                  <th className="px-1 py-1 text-right">MMG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((l) => (
                  <tr key={l.playerId} data-testid="payout-row" data-player-id={l.playerId}>
                    <td data-testid="payout-player" className="px-1 py-1.5 font-semibold text-gray-900">
                      {l.displayName}
                    </td>
                    <td data-testid="payout-club" className="px-1 py-1.5 text-gray-500">
                      {l.clubName ?? "—"}
                    </td>
                    <td data-testid="payout-kr" className="px-1 py-1.5 text-right tabular-nums">
                      {l.kr}
                    </td>
                    <td data-testid="payout-mmg" className="px-1 py-1.5 text-right tabular-nums">
                      {l.mmg}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 font-bold text-gray-900">
                <tr data-testid="payout-total">
                  <td className="px-1 py-1.5" colSpan={2}>
                    Total
                  </td>
                  <td data-testid="payout-total-kr" className="px-1 py-1.5 text-right tabular-nums">
                    {totalKr}
                  </td>
                  <td
                    data-testid="payout-total-mmg"
                    className="px-1 py-1.5 text-right tabular-nums"
                  >
                    {totalMmg}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {!locked && lines.length > 0 && (
          <p className="text-[11px] text-gray-500">
            Running totals from the stats recorded so far ({signed(totalKr)} KR ·{" "}
            {signed(totalMmg)} MMG).
          </p>
        )}
      </div>

      {perms.send.map((side) => (
        <button
          key={side}
          type="button"
          data-testid={`send-team-${side}`}
          disabled={busy}
          onClick={() => onSend(side)}
          className="w-full rounded-2xl bg-green-600 px-4 py-3.5 text-sm font-bold text-white shadow-sm disabled:opacity-40"
        >
          {perms.send.length > 1 ? `Send ${SIDE_LABELS[side]} team` : "Send my team"}
        </button>
      ))}
      {perms.send.length > 0 && (
        <p className="text-[11px] text-gray-500">
          After sending, you can&apos;t change your team. KFANDRA can send it back if needed.
        </p>
      )}

      {perms.makeOfficial && (
        <button
          type="button"
          data-testid="submit-match"
          disabled={busy}
          onClick={onMakeOfficial}
          className="w-full rounded-2xl bg-green-600 px-4 py-3.5 text-sm font-bold text-white shadow-sm disabled:opacity-40"
        >
          {match.isFriendly ? "Submit & lock" : "Make official"}
        </button>
      )}
      <ErrorNote message={submitError} testId="submit-error" />

      {perms.sendBack && (
        <>
          <button
            type="button"
            data-testid="send-back"
            disabled={busy}
            onClick={onSendBack}
            className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-bold text-gray-800 disabled:opacity-40"
          >
            Send back to managers
          </button>
          <ErrorNote message={sendBackError} testId="send-back-error" />
        </>
      )}

      {locked && perms.reopen && (
        <>
          <button
            type="button"
            data-testid="reopen-match"
            disabled={busy}
            onClick={() => setConfirmReopen(true)}
            className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-bold text-gray-800 disabled:opacity-40"
          >
            Reopen match
          </button>
          <Dialog open={confirmReopen} onOpenChange={setConfirmReopen}>
            <DialogContent
              data-testid="reopen-dialog"
              showCloseButton={false}
              className="max-w-sm gap-3 bg-white p-4"
            >
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-gray-900">
                  Reopen this match?
                </DialogTitle>
                <DialogDescription className="text-[12px] text-gray-600">
                  {match.isFriendly
                    ? "Reopening takes it back to Draft for both clubs, "
                    : "Reopening takes it back to Waiting for KFANDRA, "}
                  clears the season tag and re-opens totals that may already have been read
                  as final.
                </DialogDescription>
              </DialogHeader>
              <ErrorNote message={reopenError} testId="reopen-error" />
              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid="reopen-cancel"
                  onClick={() => setConfirmReopen(false)}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-[13px] font-bold text-gray-800"
                >
                  Keep locked
                </button>
                <button
                  type="button"
                  data-testid="reopen-confirm"
                  disabled={busy}
                  onClick={onReopen}
                  className="flex-1 rounded-xl bg-amber-600 px-3 py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
                >
                  Reopen match
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
      {locked && canEdit && !perms.reopen && (
        <p className="text-[11px] text-gray-600">Only KFANDRA can reopen a match.</p>
      )}

      {perms.deleteDraft && (
        <div className="pt-1">
          <button
            type="button"
            data-testid="delete-match"
            disabled={busy}
            onClick={onDelete}
            className="text-[11px] font-semibold text-red-700 hover:underline disabled:opacity-40"
          >
            Delete this draft match
          </button>
          <ErrorNote message={deleteError} testId="delete-error" />
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: `recorder-header.tsx`**

1. Add a prop `showSync: boolean` after `locked`, and render `{showSync && <SyncBadge status={sync} />}` instead of `{!locked && <SyncBadge …/>}`.
2. Replace the status `Tag`:

```tsx
          <Tag testId="match-status" tone={match.status === "submitted" ? "green" : match.status === "sent" ? "amber" : "gray"}>
            {statusLabel(match)}
          </Tag>
```

   Import `statusLabel` from `@/lib/klcsra/match-status`. `locked` keeps meaning "header fields disabled".

- [ ] **Step 4: `team-board.tsx`**

1. Imports: add `import type { MatchPermissions } from "@/lib/klcsra/access";`, `import { sentSides } from "@/lib/klcsra/access";` (merge with the existing access import), `import { scorersLine } from "@/lib/klcsra/goal-times";` and `import { countedHalves } from "@/lib/klcsra/league-table";`.
2. `TeamBoard` props: keep `locked` (the match is official), and add `perms: MatchPermissions` after `isStaff`.
3. In the scoreboard, a manager on a league match that isn't official gets no score boxes. Add before `return`:

```ts
  const scoreHidden = !match.isFriendly && !locked && !perms.score;
  const halfNos = countedHalves(match).map((h) => h.halfNo);
  const sent = sentSides(match);
```

   Replace each `<ScoreInput … />` pair's container contents with:

```tsx
          <div className="flex items-center gap-1.5">
            {scoreHidden ? (
              <span data-testid="score-hidden" className="px-3 text-xl font-black text-gray-500">
                ? – ?
              </span>
            ) : (
              <>
                <ScoreInput
                  key={`${half.id}-home`}
                  halfNo={half.halfNo}
                  side="home"
                  score={clubOf(half, "home")?.score ?? 0}
                  locked={!perms.score}
                  onScore={(n) => onScore(half, "home", n)}
                />
                <span className="text-lg font-black text-gray-600">–</span>
                <ScoreInput
                  key={`${half.id}-away`}
                  halfNo={half.halfNo}
                  side="away"
                  score={clubOf(half, "away")?.score ?? 0}
                  locked={!perms.score}
                  onScore={(n) => onScore(half, "away", n)}
                />
              </>
            )}
          </div>
```

   Then, after the scoreboard `div`:

```tsx
      {scoreHidden && (
        <p data-testid="score-by-kfandra" className="text-center text-[11px] text-gray-500">
          KFANDRA enters the official score.
        </p>
      )}
```

4. Pass these to each `TeamCard`:

```tsx
            teamLocked={!perms.team[side]}
            clubLocked={!perms.clubs[side]}
            sent={sent[side]}
            scorers={scorersLine(match.appearances, side, halfNos)}
```

   Remove `locked={locked}` from `TeamCard`.
5. Swap hint: change `{!locked && (` to `{perms.details && (`.
6. `TeamCard`: replace the `locked: boolean` prop with `teamLocked: boolean; clubLocked: boolean; sent: boolean; scorers: string;`. Inside it:
   - club select: `disabled={clubLocked || busy}`
   - `Slot locked={teamLocked}` (both places)
   - placeholders: `length: teamLocked ? 0 : empties`
   - `AddPlayer` renders when `!teamLocked`
   - in the header row, next to the player count:

```tsx
        {sent && (
          <span data-testid={`team-sent-${side}`} className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-800">
            Sent
          </span>
        )}
```

   - after the manager line:

```tsx
      {scorers && (
        <p data-testid={`scorers-${side}`} className="text-[11px] text-gray-700">
          <span className="font-semibold">Scorers:</span> {scorers}
        </p>
      )}
```

   That `<p>`'s text content is `Scorers: <line>`. The e2e test asserts with `toContainText(line)`.

- [ ] **Step 5: `match-recorder.tsx`**

1. Imports: replace `submitMatchAction` with `makeOfficialAction, sendBackAction, sendTeamAction, setGoalTimesAction`. Add:

```ts
import type { MatchPermissions } from "@/lib/klcsra/access";
import type { DuplicateCandidate } from "@/lib/klcsra/duplicates";
import { isTimed, trimTimes } from "@/lib/klcsra/goal-times";
import { DuplicateBanner } from "./duplicate-banner";
```

   `DuplicateBanner` arrives in Task 14. Until then, leave that import and its JSX out, and add both in Task 14.
2. Props: remove `canReopen`, and add `perms: MatchPermissions` and `duplicates: DuplicateCandidate[]`. Keep `canEdit` and `isStaff`.
3. After `const locked = …`:

```ts
  const editable =
    perms.details || perms.score || perms.team.home || perms.team.away ||
    perms.times.home || perms.times.away;
  const timedStats = allowedStats.filter((k) => isTimed(match.sport, k, match.isFriendly));
  /** `${appearanceId}|${halfNo}|${statKey}` → optimistic minutes. */
  const [timesOverlay, setTimesOverlay] = useState<Record<string, (number | null)[]>>({});
```

4. Replace `onSubmit` with:

```ts
  /** A workflow step (send, make official, send back): flush typing first. */
  const step = async (slot: string, fn: () => Promise<Result>) => {
    setWorking(true);
    // Await: a write still in flight would be refused once the match moves on.
    await flushSaves();
    setErrors((e) => ({ ...e, [slot]: null }));
    const res = await fn();
    if (res.ok) startTransition(() => router.refresh());
    else setErrors((e) => ({ ...e, [slot]: res.error }));
    setWorking(false);
  };

  const onSetTimes = (appearanceId: string, halfNo: number, statKey: StatKey, minutes: (number | null)[]) => {
    const key = `${appearanceId}|${halfNo}|${statKey}`;
    setTimesOverlay((o) => ({ ...o, [key]: minutes }));
    autosave(
      `times-${key}`,
      `player-${appearanceId}`,
      () => setGoalTimesAction(match.id, appearanceId, halfNo, statKey, trimTimes(minutes, minutes.length)),
      {
        refresh: false,
        onFail: () =>
          setTimesOverlay((o) => {
            const next = { ...o };
            delete next[key];
            return next;
          }),
      },
    );
  };
```

5. `RecorderHeader`: `locked={!perms.details}` and `showSync={editable}`.
6. `TeamBoard`: add `perms={perms}`.
7. `StatsDialog` (the props are added in Task 15): pass `locked={!openAppearance || !perms.team[openAppearance.side]}`.
8. Replace the `SubmitPanel` element with:

```tsx
      <SubmitPanel
        match={match}
        lines={lines}
        locked={locked}
        busy={busy}
        perms={perms}
        canEdit={canEdit}
        isStaff={isStaff}
        hasActiveSeason={activeSeasonName !== null}
        seasonName={activeSeasonName}
        submittedBy={submittedBy}
        rules={rules}
        submitError={err("submit")}
        sendBackError={err("send-back")}
        reopenError={err("reopen")}
        deleteError={err("delete")}
        onSend={(side) => void step("submit", () => sendTeamAction(match.id, side))}
        onMakeOfficial={() => void step("submit", () => makeOfficialAction(match.id))}
        onSendBack={() => void step("send-back", () => sendBackAction(match.id))}
        onReopen={() => void run("reopen", () => reopenMatchAction(match.id))}
        onDelete={async () => {
          if (!confirm("Delete this draft match?")) return;
          const ok = await run("delete", () => deleteMatchAction(match.id));
          if (ok) router.push("/klc/matches");
        }}
      />
```

- [ ] **Step 6: Typecheck and lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: clean, apart from the `StatsDialog` props that Task 15 adds. If `tsc` complains only about `timedStats`, `timesOverlay` or `onSetTimes` being unused, leave it: Task 15 wires them up.

- [ ] **Step 7: Commit**

```bash
git add src/app/klc/matches/\[id\]
git commit -m "feat(klc): recorder per-team lock, Send my team, Make official, Send back, tally (Helper-bsr.16)"
```

---

## Task 14: Recorder duplicate banner

**Files:**
- Create: `src/app/klc/matches/[id]/duplicate-banner.tsx`
- Modify: `src/app/klc/matches/[id]/match-recorder.tsx`

- [ ] **Step 1: Create the banner**

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { fmtDayDate } from "@/lib/format-date";
import type { DuplicateCandidate } from "@/lib/klcsra/duplicates";
import { statusLabel } from "@/lib/klcsra/match-status";

/**
 * "Another match between these clubs that day" (spec §4). It warns and never
 * blocks. "This is a different match" hides it for this viewer only, in
 * localStorage. That's a convenience; nothing depends on it.
 */
export function DuplicateBanner({
  matchId,
  duplicates,
}: {
  matchId: string;
  duplicates: DuplicateCandidate[];
}) {
  const key = `klc-dup-dismissed:${matchId}`;
  const hydrated = useHydrated();
  const [dismissedNow, setDismissedNow] = useState(false);
  const stored = hydrated && readFlag(key);
  if (duplicates.length === 0 || dismissedNow || stored) return null;

  return (
    <div
      data-testid="duplicate-banner"
      className="space-y-1.5 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900"
    >
      {duplicates.map((d) => (
        <p key={d.id}>
          {d.homeLabel} vs {d.awayLabel} already has a match on {fmtDayDate(d.entryDate)} (
          {statusLabel(d)}).{" "}
          <Link href={`/klc/matches/${d.id}`} data-testid="duplicate-open" className="font-bold underline">
            Open it
          </Link>
        </p>
      ))}
      <button
        type="button"
        data-testid="duplicate-dismiss"
        onClick={() => {
          setDismissedNow(true);
          try {
            localStorage.setItem(key, "1");
          } catch {
            /* private mode: the in-memory flag is enough */
          }
        }}
        className="font-semibold underline"
      >
        This is a different match
      </button>
    </div>
  );
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Render it in `match-recorder.tsx`**

Add the import from Task 13 Step 5.1. Then render it as the first child of the root `div`, before `RecorderHeader`:

```tsx
      <DuplicateBanner matchId={match.id} duplicates={duplicates} />
```

- [ ] **Step 3: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/app/klc/matches/\[id\]
git commit -m "feat(klc): duplicate-match banner in the recorder (Helper-bsr.16)"
```

---

## Task 15: Minute boxes in the stats popup

**Files:**
- Modify: `src/app/klc/matches/[id]/stats-dialog.tsx`, `src/app/klc/matches/[id]/match-recorder.tsx`

- [ ] **Step 1: `stats-dialog.tsx`**

Add these props after `locked`:

```ts
  /** Stats that take a minute per event (league Fooba goals, Rugby Sox tries). */
  timedStats: StatKey[];
  /** Optimistic minutes for this appearance in this half. */
  times: Partial<Record<StatKey, (number | null)[]>>;
  /** True when this viewer may enter minutes for this player's team (also on an official match, for staff). */
  timesEditable: boolean;
  onSetTimes: (statKey: StatKey, minutes: (number | null)[]) => void;
```

Wrap the existing `<li>` content in a vertical block, and add the minute row under the stat row. The new `li` is:

```tsx
                <li
                  key={key}
                  data-testid="stat-cell"
                  data-stat-key={key}
                  data-stat-count={count}
                  className="space-y-1.5 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    {/* …the existing label block and the −/count/+ block, unchanged… */}
                  </div>
                  {timedStats.includes(key) && count > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                        Minute
                      </span>
                      {Array.from({ length: count }, (_, i) => {
                        const list = times[key] ?? [];
                        return (
                          <input
                            key={i}
                            type="number"
                            min={0}
                            max={150}
                            inputMode="numeric"
                            data-testid="minute-input"
                            data-stat-key={key}
                            data-index={i}
                            aria-label={`${STAT_LABELS[key]} ${i + 1} minute`}
                            placeholder="–"
                            disabled={!timesEditable}
                            value={list[i] ?? ""}
                            onChange={(e) => {
                              const raw = e.target.value.trim();
                              const n = raw === "" ? null : Number(raw);
                              if (n !== null && (!Number.isInteger(n) || n < 0 || n > 150)) return;
                              const next = Array.from({ length: count }, (_, j) => list[j] ?? null);
                              next[i] = n;
                              onSetTimes(key, next);
                            }}
                            className="w-12 rounded-lg border border-gray-200 px-1 py-1 text-center text-[12px] tabular-nums disabled:bg-gray-50"
                          />
                        );
                      })}
                    </div>
                  )}
                </li>
```

(The comment marks where the two existing blocks go. Move them in exactly as they are.)

- [ ] **Step 2: Pass the props in `match-recorder.tsx`**

Add to `StatsDialog`:

```tsx
        timedStats={timedStats}
        times={
          openAppearance
            ? Object.fromEntries(
                timedStats.map((k) => {
                  const key = `${openAppearance.id}|${activeHalf}|${k}`;
                  const stored = openAppearance.times?.[activeHalf]?.[k] ?? [];
                  const count = countsFor(openAppearance.id, activeHalf, openAppearance.stats[activeHalf] ?? {})[k] ?? 0;
                  return [k, trimTimes(timesOverlay[key] ?? stored, count).concat()];
                }),
              )
            : {}
        }
        timesEditable={openAppearance ? perms.times[openAppearance.side] : false}
        onSetTimes={(statKey, minutes) =>
          openAppearance && onSetTimes(openAppearance.id, activeHalf, statKey, minutes)
        }
```

`trimTimes` keeps the inputs consistent when a count goes down.

- [ ] **Step 3: Typecheck, lint, and test the recorder by hand**

```bash
npx tsc --noEmit && npm run lint && npx vitest run
npm run dev
```

As staff at `/klc/matches`, create a league Fooba match with two clubs and one player each. Then:
1. Record 2 main goals and type minutes 12 and 34. The badge reads "Autosaved ✓".
2. Close the popup. The Home card shows `Scorers: <name> ×2 (12', 34')`.
3. Make it official (activate S2 first in Admin → KLC → Seasons). Reopen the popup: the counts are locked and the minute boxes are still editable.

- [ ] **Step 4: Commit**

```bash
git add src/app/klc/matches/\[id\]
git commit -m "feat(klc): goal/try minute boxes in the stats popup (Helper-bsr.16)"
```

---

## Task 16: E2E helpers, and moving the existing specs to the new flow

**Files:**
- Modify: `e2e/helpers/recorder.ts`, `e2e/klc-league.spec.ts`, `e2e/klcsra-recorder.spec.ts`

- [ ] **Step 1: Helpers (`e2e/helpers/recorder.ts`)**

Replace `NewMatch` and `createMatch` with:

```ts
export interface NewMatch {
  date: string;
  sport?: Sport;
  combined?: boolean;
  friendly?: boolean;
  /** Home club id. A manager's form preselects their own club. */
  home?: string;
  /** Away club id (the opponent). Required for a manager. */
  away?: string;
}

const MATCH_URL = /\/klc\/matches\/[0-9a-f-]{36}$/;

/**
 * Fill the new-match form and press + New match, without waiting to land
 * anywhere (a duplicate keeps the page on the list with a warning).
 *
 * Waits for the form to hydrate before touching it. The inputs are controlled,
 * so a value filled into the server HTML is silently reset to the server's
 * `today` when React takes over.
 */
export async function startMatch(page: Page, match: NewMatch): Promise<void> {
  await page.goto("/klc/matches");
  await expect(page.getByTestId("new-match-form")).toHaveAttribute("data-hydrated", "true");
  const date = page.getByTestId("new-match-date");
  const sport = page.getByTestId("new-match-sport");
  await date.fill(match.date);
  await sport.selectOption(match.sport ?? "football");
  if (match.home) await page.getByTestId("new-match-club").selectOption(match.home);
  if (match.away) await page.getByTestId("new-match-opponent").selectOption(match.away);
  if (match.combined) await page.getByTestId("new-match-combined").check();
  if (match.friendly) await page.getByTestId("new-match-friendly").check();
  await expect(date).toHaveValue(match.date);
  await expect(sport).toHaveValue(match.sport ?? "football");
  await page.getByTestId("new-match-submit").click();
}

/**
 * Create a match from the list page and land on its detail page.
 * @returns the new match id (taken from the URL it navigated to).
 */
export async function createMatch(page: Page, match: NewMatch): Promise<string> {
  await startMatch(page, match);
  await page.waitForURL(MATCH_URL);
  const id = page.url().split("/").pop();
  if (!id) throw new Error(`Could not read a match id out of ${page.url()}`);
  await expect(page.getByTestId("match-header")).toBeVisible();
  return id;
}
```

Add these to the `// ── submit / reopen ──` section:

```ts
/** A manager sends their own team; the card then shows Sent. */
export async function sendTeam(page: Page, side: SideKey): Promise<void> {
  await page.getByTestId(`send-team-${side}`).click();
  await expect(page.getByTestId(`team-sent-${side}`)).toBeVisible();
}

/**
 * Type one goal/try minute in the OPEN stats popup and wait for it to save.
 * Catching `saving` first rules out a stale `saved` (700ms debounce).
 */
export async function setMinute(
  page: Page,
  statKey: StatKey,
  index: number,
  minute: number,
): Promise<void> {
  const input = statsDialog(page).locator(
    `[data-testid="minute-input"][data-stat-key="${statKey}"][data-index="${index}"]`,
  );
  await input.fill(String(minute));
  await expect(syncBadge(page)).toHaveAttribute("data-sync-status", "saving");
  await expectSaved(page);
}
```

`submitMatch` and `submitExpectingError` stay as they are. Staff's primary button keeps `data-testid="submit-match"`, now labelled "Make official" (league) or "Submit & lock" (friendly).

- [ ] **Step 2: `e2e/klcsra-recorder.spec.ts`**

- Line ~160: `await expect(page.getByTestId("match-status")).toHaveText("Official");`
- Line ~180: `await expect(row.getByTestId("match-status")).toHaveText("Official");`
- In "a plain admin cannot reopen a submitted match; KFANDRA can", after `reopen-confirm`:

```ts
      await expect(kfandra.page.getByTestId("submit-match")).toBeVisible();
      await expect(kfandra.page.getByTestId("match-status")).toHaveText("Waiting for KFANDRA");
      await expect(kfandra.page.getByTestId("lock-banner")).toHaveCount(0);

      const reopened = await db.getMatchRow(matchId);
      // A league match reopens to Sent (spec D6/§3.2), not Draft.
      expect(reopened?.status).toBe("sent");
```

- [ ] **Step 3: `e2e/klc-league.spec.ts`**

- "KFANDRA reopens, edits and resubmits": the `submit-match` visibility line stays valid, because staff see Make official on a Sent match. No change.
- Replace the body of "a club manager records their own club's match but not another club's draft", from `await page.goto("/klc/matches");` to the end, with:

```ts
    await page.goto("/klc/matches");
    await expect(page.getByTestId("new-match-club")).toHaveValue(mine.id);
    const id = await rec.createMatch(page, { date: MATCH_DATE, sport: "football", away: theirs.id });
    // The action put both clubs on half 1.
    await expect(page.getByTestId("club-select-1-home")).toHaveValue(mine.id);
    await expect(page.getByTestId("club-select-1-away")).toHaveValue(theirs.id);
    await expect(page.getByTestId("swap-hint")).toHaveText("To swap sides, ask KFANDRA or an admin.");

    // The picker greys out what the server would refuse.
    const option = (side: "home" | "away", clubId: string) =>
      page.getByTestId(`club-select-1-${side}`).locator(`option[value="${clubId}"]`);
    await expect(option("away", mine.id)).toBeDisabled();
    await expect(option("away", mine.id)).toHaveText(`${mine.name} (other side)`);
    await expect(option("home", other.id)).toBeDisabled();
    await expect(option("home", other.id)).toHaveText(`${other.name} (keep your club)`);
    expect(
      (await db.listSideRows(id)).map((s) => [s.side, s.club_id]),
    ).toEqual([["away", theirs.id], ["home", mine.id]]);

    // A manager enters no league score and edits only their own team.
    await expect(page.getByTestId("score-by-kfandra")).toBeVisible();
    await expect(page.getByTestId("member-select-away")).toHaveCount(0);
    await rec.addPlayer(page, "home", manager.id);
    await rec.sendTeam(page, "home");
    await expect(page.getByTestId("member-select-home")).toHaveCount(0);
    await expect(page.getByTestId("sent-note")).toBeVisible();
    const row = await db.getMatchRow(id);
    expect(row?.status).toBe("draft");
    expect(row?.home_sent_at).not.toBeNull();

    await expectDraft(foreign);
    const res = await page.goto(`/klc/matches/${foreign}`);
    expect(res?.status()).toBe(404);
```

- "a creator who no longer manages a club keeps their draft on the matches list": use `const [mine, other] = await db.listClubs(2);` and `rec.createMatch(page, { date: MATCH_DATE, sport: "football", away: other.id })`.

- [ ] **Step 4: Run the KLC e2e suites**

```bash
npx playwright test e2e/klcsra-recorder.spec.ts e2e/klc-league.spec.ts e2e/klcsra-seasons.spec.ts e2e/klcsra-triggers.spec.ts
```

Expected: all pass. If a test fails on a cold dev server compile, re-run that file once before investigating. This happened on 2026-10-28. Report any flake in the PR.

- [ ] **Step 5: Commit**

```bash
git add e2e
git commit -m "test(klc): move recorder and league e2e onto the send/official flow (Helper-bsr.16)"
```

---

## Task 17: New e2e spec for the workflow

**Files:**
- Create: `e2e/klc-match-workflow.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import type { Browser } from "@playwright/test";
import { test, expect, type Page } from "./fixtures";
import { seedPlayer, signIn, signInAs } from "./helpers/auth";
import * as db from "./helpers/db";
import * as rec from "./helpers/recorder";
import { DEFAULT_STANDINGS_RULES } from "../src/lib/klcsra/standings-rules";

/**
 * KLC match workflow end to end (spec 2026-11-08 §11). Local Supabase only.
 * Each club enters its own team on one shared match; KFANDRA enters the
 * official score and makes it official.
 */

const SEASON = "KLCFERRSXVSG2";
const MATCH_DATE = "2026-08-23";
const DRAW = String(DEFAULT_STANDINGS_RULES.draw["2to3"]);

let seasonsBefore: db.SeasonRow[];

test.beforeEach(async () => {
  seasonsBefore = await db.snapshotSeasons();
  await db.resetKlcsraData();
  await db.activateSeason(SEASON);
});

test.afterEach(async () => {
  await db.resetKlcsraData();
  await db.restoreSeasons(seasonsBefore);
});

/** A club manager in their own browser. Close `context` when done. */
async function managerOf(browser: Browser, club: db.ClubRow, name: string) {
  const player = await seedPlayer("user", name);
  await db.setClubManager(club.id, player.id);
  const context = await browser.newContext();
  await signIn(context, player);
  return { player, context, page: await context.newPage() };
}

async function pts(page: Page, clubId: string): Promise<string | null> {
  await page.goto("/klc/league");
  await expect(page.getByTestId("league-table").or(page.getByTestId("league-table-empty"))).toBeVisible();
  const ids = await page
    .locator('[data-testid="table-row"]')
    .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-club-id")));
  const idx = ids.indexOf(clubId);
  return idx < 0 ? null : (await page.locator('[data-col="Pts"]').nth(idx).innerText()).trim();
}

test.describe("KLC match workflow", () => {
  test("two managers fill one shared match; KFANDRA makes it official and adds goal times", async ({
    page,
    browser,
  }) => {
    const [a, b] = await db.listClubs(2);
    const mA = await managerOf(browser, a, "E2E Mgr A");
    const mB = await managerOf(browser, b, "E2E Mgr B");
    const pA = await seedPlayer("user", "E2E PA");
    const pB = await seedPlayer("user", "E2E PB");
    try {
      // 1. A creates the match against B, records A's team and sends it.
      const id = await rec.createMatch(mA.page, { date: MATCH_DATE, sport: "fooba", away: b.id });
      await expect(mA.page.getByTestId("score-by-kfandra")).toBeVisible();
      await expect(mA.page.getByTestId("member-select-away")).toHaveCount(0);
      await rec.addPlayer(mA.page, "home", pA.id);
      await rec.recordStats(mA.page, "home", pA.id, { mainGoal: 2 });
      await rec.sendTeam(mA.page, "home");
      await expect(mA.page.getByTestId("member-select-home")).toHaveCount(0);

      // 2. B starts the same match, is warned, and opens A's instead.
      await rec.startMatch(mB.page, { date: MATCH_DATE, sport: "fooba", away: a.id });
      await expect(mB.page.getByTestId("duplicate-warning")).toContainText("1 of 2 teams sent");
      await mB.page.getByTestId("duplicate-open").first().click();
      await mB.page.waitForURL(new RegExp(`/klc/matches/${id}$`));
      await rec.addPlayer(mB.page, "away", pB.id);
      await rec.recordStats(mB.page, "away", pB.id, { mainGoal: 1 });
      await rec.sendTeam(mB.page, "away");
      await expect(mB.page.getByTestId("waiting-banner")).toBeVisible();
      expect((await db.getMatchRow(id))?.status).toBe("sent");
      const [{ n }] = await db.sql<{ n: number }>(`select count(*)::int as n from klc_matches`);
      expect(n).toBe(1);

      // 3. KFANDRA finds it waiting, enters a score that differs from the tally, makes it official.
      await signInAs(page.context(), "kfandra");
      await page.goto("/klc/matches");
      await expect(
        page.getByTestId("waiting-for-kfandra").locator(`[data-match-id="${id}"]`),
      ).toBeVisible();
      await rec.openMatch(page, id);
      await expect(page.getByTestId("tally-line")).toContainText("2 – 1");
      await rec.setScore(page, 1, "home", 2);
      await rec.setScore(page, 1, "away", 2);
      await expect(page.getByTestId("tally")).toHaveAttribute("data-mismatch", "true");
      await expect(page.getByTestId("tally-mismatch")).toBeVisible();
      await rec.submitMatch(page);
      const official = await db.getMatchRow(id);
      expect(official?.status).toBe("submitted");
      expect(official?.season_id).toBe((await db.findSeason(SEASON)).id);
      // KFANDRA's 2–2 is used, not the recorded 2–1.
      expect(await pts(page, a.id)).toBe(DRAW);
      expect(await pts(page, b.id)).toBe(DRAW);

      // 4. KFANDRA adds the goal times to the official match.
      await rec.openMatch(page, id);
      await rec.openStats(page, "home", pA.id);
      await expect(rec.statCell(page, "mainGoal").getByTestId("stat-inc")).toHaveCount(0);
      await rec.setMinute(page, "mainGoal", 0, 34);
      await rec.setMinute(page, "mainGoal", 1, 12);
      await rec.closeStats(page);
      await expect(page.getByTestId("scorers-home")).toContainText("E2E PA ×2 (12', 34')");
      const [row] = await db.sql<{ minutes: number[] }>(
        `select s.minutes from klc_player_stats s
           join klc_match_appearances a on a.id = s.appearance_id
          where a.match_id = $1 and a.player_id = $2`,
        [id, pA.id],
      );
      expect(row.minutes).toEqual([34, 12]);
    } finally {
      await mA.context.close();
      await mB.context.close();
    }
  });

  test("a friendly is submitted once both managers have sent their teams", async ({ browser }) => {
    const [a, b] = await db.listClubs(2);
    const mA = await managerOf(browser, a, "E2E Mgr FA");
    const mB = await managerOf(browser, b, "E2E Mgr FB");
    const pA = await seedPlayer("user", "E2E FPA");
    const pB = await seedPlayer("user", "E2E FPB");
    try {
      const id = await rec.createMatch(mA.page, {
        date: MATCH_DATE, sport: "football", friendly: true, away: b.id,
      });
      await rec.addPlayer(mA.page, "home", pA.id);
      await rec.setScore(mA.page, 1, "home", 1);
      await rec.sendTeam(mA.page, "home");

      await rec.openMatch(mB.page, id);
      await rec.addPlayer(mB.page, "away", pB.id);
      await rec.sendTeam(mB.page, "away");
      await expect(mB.page.getByTestId("lock-banner")).toBeVisible();
      const row = await db.getMatchRow(id);
      expect(row?.status).toBe("submitted");
      expect(row?.season_id).toBeNull();
    } finally {
      await mA.context.close();
      await mB.context.close();
    }
  });

  test("KFANDRA sends a sent match back and the managers can edit again", async ({
    page,
    browser,
  }) => {
    const [a, b] = await db.listClubs(2);
    const mA = await managerOf(browser, a, "E2E Mgr SA");
    const mB = await managerOf(browser, b, "E2E Mgr SB");
    try {
      const id = await rec.createMatch(mA.page, { date: MATCH_DATE, sport: "football", away: b.id });
      await rec.addPlayer(mA.page, "home", mA.player.id);
      await rec.sendTeam(mA.page, "home");
      await rec.openMatch(mB.page, id);
      await rec.addPlayer(mB.page, "away", mB.player.id);
      await rec.sendTeam(mB.page, "away");
      expect((await db.getMatchRow(id))?.status).toBe("sent");

      await signInAs(page.context(), "kfandra");
      await rec.openMatch(page, id);
      await page.getByTestId("send-back").click();
      await expect(page.getByTestId("send-back")).toHaveCount(0);
      const row = await db.getMatchRow(id);
      expect(row?.status).toBe("draft");
      expect(row?.home_sent_at).toBeNull();
      expect(row?.away_sent_at).toBeNull();

      await rec.openMatch(mA.page, id);
      await expect(mA.page.getByTestId("send-team-home")).toBeVisible();
      await expect(mA.page.getByTestId("member-select-home")).toBeVisible();
    } finally {
      await mA.context.close();
      await mB.context.close();
    }
  });

  test("the recorder warns about a duplicate until dismissed", async ({ page }) => {
    await signInAs(page.context(), "admin");
    const [a, b] = await db.listClubs(2);
    const first = await rec.createMatch(page, { date: MATCH_DATE, sport: "football", home: a.id, away: b.id });
    await rec.startMatch(page, { date: MATCH_DATE, sport: "football", home: b.id, away: a.id });
    await expect(page.getByTestId("duplicate-warning")).toBeVisible();
    await page.getByTestId("duplicate-create-anyway").click();
    await page.waitForURL(/\/klc\/matches\/[0-9a-f-]{36}$/);
    expect(page.url()).not.toContain(first);

    const banner = page.getByTestId("duplicate-banner");
    await expect(banner).toBeVisible();
    await banner.getByTestId("duplicate-dismiss").click();
    await expect(banner).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("match-header")).toBeVisible();
    await expect(page.getByTestId("duplicate-banner")).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx playwright test e2e/klc-match-workflow.spec.ts`
Expected: 4 passed.

- [ ] **Step 3: Commit**

```bash
git add e2e/klc-match-workflow.spec.ts
git commit -m "test(klc): e2e for shared match, send, official, send back, duplicates, goal times (Helper-bsr.16)"
```

---

## Task 18: League guide

**Files:**
- Modify: `docs/klc-league-guide.md`
- Regenerate: `docs/klc-league-guide.pdf`

- [ ] **Step 1: Rewrite §7 ("Recording a match") and the related rules**

Replace §7 from `## 7. Recording a match — club managers and KFANDRA` down to (but not including) `## 8.` with:

```markdown
## 7. Recording a match — club managers

Each club enters **its own team** on **one shared match**. Managers don't enter
the score of a league match: KFANDRA does.

1. On the home screen, tap **Record a match**.
2. Under **New match**:
   - Set the date and the match type.
   - Your club is the home side. Pick the **Opponent**.
   - Tick **Combined** for a joint-manager match (two halves), and/or **Friendly**.
   - Tap **+ New match**.
3. **Already recorded?** If the other club has already started this match, the
   app says so and offers **Open it**. Open it and add your team there, so the
   match is only entered once.
4. In the recorder, add **your team's** players and tap a player to record their
   stats. Everything saves as you go. You can see the other team, but not change it.
5. In official Fooba and Rugby Sox matches, type each goal's or try's **minute**
   (from the referee) under it. It's optional.
6. Check the **Before sending** list, then tap **Send my team**. After that your
   team is locked.
7. When both teams are sent, a league match shows **Waiting for KFANDRA**. A
   friendly is submitted straight away.

**Saves:** record a save only when it's a proper save: a shot on target, or a
save that stops a clear goal-scoring chance.

**Conversions** (Rugby Sox) count like a try.

### Friendlies

Either manager enters the score of a friendly, before the first team is sent.
A friendly earns no league points and no Kroopies, but counts towards MMG.

### Rules the recorder checks for you

- **Your own team only:** you add and edit your own club's players and stats.
- **Keep your own club on the match:** a manager can't remove their last club from it.
- **Clubs stay with their pair:** in a combined match, a club can't be on both
  sides. Clubs that aren't allowed are greyed out. To swap sides, ask KFANDRA or an admin.
- **After sending:** you can't change your team. Ask **KFANDRA** to send the match back.

## 7a. Making a match official — KFANDRA and admins

1. **Record a match** lists **Waiting for KFANDRA** first.
2. Open the match. You can change anything: clubs, players, stats, times.
3. Enter the **official score**. Next to it, **Recorded goals** shows what the
   managers recorded. If the two differ, it turns amber. **Your score is used.**
4. Tap **Make official**. The match locks and counts in the tables.
5. Something wrong? Tap **Send back to managers** instead. Both teams can edit again.
6. **Goal times** can be added to an official match at any time, without reopening it.
```

- [ ] **Step 2: Update §8 and §9**

- In §8, change "**Reopen:** only KFANDRA can reopen a submitted match." to "**Reopen:** only KFANDRA can reopen an official match. A league match goes back to **Waiting for KFANDRA**; a friendly goes back to draft."
- In §8, change "**Which season a match counts for:** the season that's **active when it's submitted**." to "…the season that's **active when it's made official**."
- In §8, change the Close bullet to: "It's refused while unfinished matches (draft or waiting for KFANDRA) dated in that season are still open."
- In §9, change the first answer to: "It's either still a **draft** or **waiting for KFANDRA** (not official yet), marked **Friendly**, or a different match type from the chip you picked. Try **All**."
- In §9, change "Can players see drafts?" to "Can players see drafts? | No. Only official matches appear for everyone. A draft or a match waiting for KFANDRA is visible only to the clubs involved and staff."
- In §4 (Leaders), change the Tries bullet to: "**Tries** (includes Rugby Sox conversions)".

Make sure the guide says nothing about keepers (see bd memory `klc-confidential-2026-11-08`).

- [ ] **Step 3: Rebuild the PDF and check it**

```bash
npm run docs:pdf:league
```

Expected: `Wrote …/docs/klc-league-guide.pdf`. Open it and check that the §7 and §7a numbered lists render.

- [ ] **Step 4: Commit**

```bash
git add docs/klc-league-guide.md docs/klc-league-guide.pdf
git commit -m "docs(klc): league guide for the shared-match workflow (Helper-bsr.16)"
```

---

## Task 19: Quality gates, PR, handover

- [ ] **Step 1: Full gates**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build && npm run test:e2e
git checkout -- next-env.d.ts 2>/dev/null || true   # build rewrites it; never commit it
```

Expected: everything is green. Report any e2e flake honestly with its output.

- [ ] **Step 2: Confidentiality check**

Run the pre-PR check named in bd memory `klc-confidential-2026-11-08` against `git diff main`.
Expected: no matches.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin feat/klc-match-workflow
gh pr create --title "KLC match workflow: managers send their team, KFANDRA makes it official" --body "$(cat <<'EOF'
Helper-bsr.16. Spec: docs/superpowers/specs/2026-11-08-klc-match-workflow-design.md

- Each club enters its own team on one shared match; managers enter no league score
- Send my team → Waiting for KFANDRA → KFANDRA enters the score (goal tally shown, Sir's score wins) → Make official; Send back; Reopen goes to Sent
- Friendlies: both teams sent → submitted
- Duplicate-match warning on create and in the recorder
- Rugby Sox conversion stat (try rate), counted on the Tries board
- Goal/try minutes for league Fooba and Rugby Sox; KFANDRA can add them to an official match
- Guide + PDF updated

Migrations (Jaidev runs `supabase db push`): 20261108120000_klc_conversion_stat, 20261108120100_klc_match_workflow. Prod has no KLC matches, so there is no data migration.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Close out**

```bash
bd close Helper-bsr.16 --reason "PR open: match workflow"
git pull --rebase && bd dolt push && git push
git status   # up to date with origin
```

Then run `/handover-capture`. Next steps for Jaidev:
1. Merge the PR.
2. Run `npx supabase db push` (the two migrations).
3. Give Sir a heads-up.
4. Arrange the players' trial (Helper-bsr.17).
