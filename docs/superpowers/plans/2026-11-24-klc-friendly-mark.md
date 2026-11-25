# KLC Friendly Mark (Official / Unofficial) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every KLC friendly is marked Official or Unofficial, and KFANDRA or a manager
of a club in the match can switch the mark (managers can't once the season is
closed). Every change is logged.

**Architecture:**
- **Database:** one new column on `klc_matches`.
- **Permission rule:** a pure function in `access.ts`, plus a pure `seasonForDate`
  helper.
- **Server action:** checks the caller, writes the column with the service role and
  adds an `audit_log` row.
- **UI:** the recorder header gets an Official/Unofficial switch, and the matches
  list shows an "Official friendly" tag.
- **Spec:** `docs/superpowers/specs/2026-11-22-klc-player-register-values-design.md`
  §3. Bead: Helper-3u5.

**Tech Stack:** Next.js App Router (server actions), Supabase Postgres, Vitest,
Playwright (local Supabase only).

---

## File map

| File | Change |
|---|---|
| `supabase/migrations/20261124120000_klc_official_friendly.sql` | Create: column, check constraint, comment |
| `src/lib/supabase/database.types.ts` | Regenerate |
| `src/lib/klcsra/season-status.ts` + `season-status.test.ts` | Add pure `seasonForDate` |
| `src/lib/klcsra/access.ts` + `access.test.ts` | Add pure `canSetFriendlyMark` |
| `src/lib/klcsra/types.ts` | `isOfficialFriendly` on `MatchDraft` and `MatchSummary` |
| `src/lib/klcsra/repository.ts` | Select and map the column; League flip clears it; `setOfficialFriendly`; `writeAudit` |
| `src/lib/klcsra/actions.ts` + `actions.test.ts` | `setFriendlyMarkAction` |
| `src/app/klc/matches/[id]/page.tsx`, `match-recorder.tsx`, `recorder-header.tsx` | Friendly-type switch |
| `src/app/klc/matches/page.tsx` | "Official friendly" tag |
| Test factories in `src/lib/klcsra/*.test.ts` | Add `isOfficialFriendly: false` where a full `MatchDraft`/`MatchSummary` is built |
| `e2e/klc-friendly-mark.spec.ts` | Create |
| `docs/klc-league-guide.md` (+ PDF) | Short "Official and unofficial friendlies" section |

---

### Task 1: Migration

**Files:** Create `supabase/migrations/20261124120000_klc_official_friendly.sql`

- [ ] **Step 1: Write the migration**

```sql
-- KLC friendlies are marked Official or Unofficial (KFANDRA, 22 November 2026).
-- Official friendlies will change player values and sell tickets; they never
-- count for league points, the match fee/win bonus or scorers. A league match
-- is never marked: it is official once KFANDRA makes it so (status submitted).
-- Who may change the mark is enforced in the server action
-- (setFriendlyMarkAction), like every other KLC match rule.
alter table public.klc_matches
  add column is_official_friendly boolean not null default false;

alter table public.klc_matches
  add constraint klc_matches_official_friendly_chk
  check (is_friendly or not is_official_friendly);

comment on column public.klc_matches.is_official_friendly is
  'Friendly marked Official (true) or Unofficial (false, default). Always false for a league match.';
```

- [ ] **Step 2: Apply locally and regenerate the types**

Run:
```bash
npx supabase migration up --local
npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
git diff --stat src/lib/supabase/database.types.ts
```
Expected: the migration applies, and the types diff adds `is_official_friendly` to
`klc_matches` Row/Insert/Update.

- [ ] **Step 3: Check that the constraint holds**

Run:
```bash
docker exec -i supabase_db_Helper psql -U postgres -c "begin; insert into klc_matches (entry_date, is_friendly, is_official_friendly) values ('2026-12-01', false, true); rollback;"
```
Expected: `ERROR: new row for relation "klc_matches" violates check constraint "klc_matches_official_friendly_chk"`.

---

### Task 2: `seasonForDate` (pure)

**Files:**
- Modify: `src/lib/klcsra/season-status.ts`
- Test: `src/lib/klcsra/season-status.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { seasonForDate } from "./season-status";
import type { Season } from "./types";

const s = (no: number, start: string, end: string | null, status: Season["status"]): Season => ({
  id: `s${no}`, seasonNo: no, name: `S${no}`, startDate: start, endDate: end, status,
});
const S1 = s(1, "2026-04-01", "2026-09-30", "closed");
const S2 = s(2, "2026-11-01", null, "active");

describe("seasonForDate", () => {
  it("finds the season whose window holds the date, ends inclusive", () => {
    expect(seasonForDate([S1, S2], "2026-04-01")?.id).toBe("s1");
    expect(seasonForDate([S1, S2], "2026-09-30")?.id).toBe("s1");
    expect(seasonForDate([S1, S2], "2026-12-25")?.id).toBe("s2");
  });
  it("is null between seasons and before the first", () => {
    expect(seasonForDate([S1, S2], "2026-10-15")).toBeNull();
    expect(seasonForDate([S1, S2], "2026-01-01")).toBeNull();
  });
  it("an open-ended season runs on for ever", () => {
    expect(seasonForDate([S2], "2030-01-01")?.id).toBe("s2");
  });
});
```

- [ ] **Step 2: Run it and check that it fails**

Run: `npx vitest run src/lib/klcsra/season-status.test.ts`
Expected: FAIL, "seasonForDate is not a function" (or an import error).

- [ ] **Step 3: Implement**

Append to `src/lib/klcsra/season-status.ts` (and change the type import to
`import type { Season, SeasonStatus } from "./types";`):

```ts
/**
 * The season whose window [startDate, endDate] holds `date` (ISO yyyy-mm-dd,
 * both ends inclusive; a null endDate is open-ended), or null. Friendlies
 * carry no season_id, so this is how a friendly is placed in a season, the
 * same window rule as listSubmittedMatchDrafts.
 */
export function seasonForDate(seasons: readonly Season[], date: string): Season | null {
  return (
    seasons.find((s) => s.startDate <= date && (s.endDate === null || date <= s.endDate)) ?? null
  );
}
```

- [ ] **Step 4: Run it and check that it passes**

Run: `npx vitest run src/lib/klcsra/season-status.test.ts`. Expected: PASS (3 tests).

---

### Task 3: `canSetFriendlyMark` (pure)

**Files:**
- Modify: `src/lib/klcsra/access.ts`
- Test: `src/lib/klcsra/access.test.ts`

- [ ] **Step 1: Write the failing tests** (append to `access.test.ts`, and add
  `canSetFriendlyMark` to its import)

```ts
describe("canSetFriendlyMark", () => {
  const friendly = { isFriendly: true, clubIds: ["A", "B"] };
  const open = { seasonClosed: false };
  it("KFANDRA and super_admin: any friendly, closed season included", () => {
    for (const role of ["kfandra", "super_admin"] as const) {
      expect(canSetFriendlyMark({ id: "k", role }, none, friendly, open)).toBe(true);
      expect(canSetFriendlyMark({ id: "k", role }, none, friendly, { seasonClosed: true })).toBe(true);
    }
  });
  it("a manager of a club in the match, while the season isn't closed", () => {
    expect(canSetFriendlyMark({ id: "m", role: "user" }, managesA, friendly, open)).toBe(true);
    expect(canSetFriendlyMark({ id: "m", role: "user" }, managesA, friendly, { seasonClosed: true })).toBe(false);
  });
  it("not another manager, a plain player or an admin without a club in it", () => {
    expect(canSetFriendlyMark({ id: "m", role: "user" }, managesA, { isFriendly: true, clubIds: ["C", "D"] }, open)).toBe(false);
    expect(canSetFriendlyMark({ id: "p", role: "user" }, none, friendly, open)).toBe(false);
    expect(canSetFriendlyMark({ id: "a", role: "admin" }, none, friendly, open)).toBe(false);
  });
  it("never on a league match", () => {
    expect(canSetFriendlyMark({ id: "k", role: "kfandra" }, none, { isFriendly: false, clubIds: ["A"] }, open)).toBe(false);
  });
});
```

- [ ] **Step 2: Run them and check that they fail**

Run: `npx vitest run src/lib/klcsra/access.test.ts`. Expected: FAIL (not exported).

- [ ] **Step 3: Implement** (in `access.ts`, after `canReopenMatch`)

```ts
/**
 * Who may mark a friendly Official or Unofficial (spec 2026-11-22 §3):
 * KFANDRA / super_admin on any friendly at any time; a manager of a club on
 * either side at any status, unless the friendly's date falls in a closed
 * season. Never a league match. An admin is treated as a manager here.
 */
export function canSetFriendlyMark(
  viewer: Viewer,
  managed: ReadonlySet<string>,
  m: { isFriendly: boolean; clubIds: readonly string[] },
  opts: { seasonClosed: boolean },
): boolean {
  if (!m.isFriendly) return false;
  if (canReopenMatch(viewer)) return true;
  if (opts.seasonClosed) return false;
  return m.clubIds.some((id) => managed.has(id));
}
```

- [ ] **Step 4: Run them and check that they pass**

Run: `npx vitest run src/lib/klcsra/access.test.ts`. Expected: PASS.

---

### Task 4: Types and repository

**Files:** Modify `src/lib/klcsra/types.ts`, `src/lib/klcsra/repository.ts`, and the
test factories.

- [ ] **Step 1: Types.** In `types.ts`, add to `MatchDraft` after `isCombined: boolean;`:

```ts
  /** A friendly marked Official (spec 2026-11-22 §3). Always false for a league match. */
  isOfficialFriendly: boolean;
```

and to `MatchSummary` after `isCombined: boolean;`:

```ts
  isOfficialFriendly: boolean;
```

- [ ] **Step 2: Select and map.** In `repository.ts`:
  - **`MATCH_DRAFT_COLS`:** change the first line to
    `` `id, entry_date, sport, is_friendly, is_official_friendly, is_combined, duration_minutes, ``
  - **`MatchDraftRow`:** add `is_official_friendly: boolean;`.
  - **`toMatchDraft`:** add `isOfficialFriendly: data.is_official_friendly,` after
    `isCombined`.
  - **`listMatches`:** change its select to start
    `` `id, entry_date, sport, is_friendly, is_official_friendly, is_combined, status, ``
    and add `isOfficialFriendly: m.is_official_friendly,` after `isCombined` in its map.

- [ ] **Step 3: A League flip clears the mark.** In `updateMatchMeta`, change the
  `is_friendly` line and the type of `fields`:

```ts
  const fields: {
    entry_date?: string; sport?: string; duration_minutes?: number | null;
    is_friendly?: boolean; is_official_friendly?: boolean;
  } = {};
  ...
  if (patch.isFriendly !== undefined) {
    fields.is_friendly = patch.isFriendly;
    // The check constraint forbids a marked league match.
    if (!patch.isFriendly) fields.is_official_friendly = false;
  }
```

- [ ] **Step 4: Write and log.** Append to `repository.ts`:

```ts
/** Mark a friendly Official (true) or Unofficial (false). */
export async function setOfficialFriendly(id: string, official: boolean): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("klc_matches")
    .update({ is_official_friendly: official })
    .eq("id", id)
    .eq("is_friendly", true);
  if (error) throw new Error(`Failed to update the friendly: ${error.message}`);
}

/** Append one row to audit_log (privileged actions). */
export async function writeAudit(entry: {
  actorPlayerId: string; action: string; entityType: string; entityId: string; diff: Json;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_log").insert({
    actor_player_id: entry.actorPlayerId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    diff: entry.diff,
  });
  if (error) throw new Error(`Failed to write the audit log: ${error.message}`);
}
```

Import `Json` with `import type { Json } from "@/lib/supabase/database.types";`
(skip this if `repository.ts` already imports it).

- [ ] **Step 5: Fix the test factories.**

Run: `npx tsc --noEmit 2>&1 | grep -E "isOfficialFriendly" | head -30`.
For each file it lists, add `isOfficialFriendly: false,` next to the factory's
`isFriendly:` entry. Repeat until `npx tsc --noEmit` is clean.

- [ ] **Step 6: Run all the unit tests**

Run: `npx vitest run`. Expected: all PASS.

---

### Task 5: `setFriendlyMarkAction`

**Files:**
- Modify: `src/lib/klcsra/actions.ts`
- Test: `src/lib/klcsra/actions.test.ts`

- [ ] **Step 1: Read how `actions.test.ts` mocks `getCurrentPlayer` and `./repository`.**

Run: `sed -n 1,80p src/lib/klcsra/actions.test.ts`. Use the same mock objects in
the tests below. If it uses a `repo` mock object, add `setOfficialFriendly`,
`writeAudit` and `listSeasons` to it as `vi.fn()`.

- [ ] **Step 2: Write the failing tests** (adapt the mock names to Step 1)

```ts
describe("setFriendlyMarkAction", () => {
  const friendly = { ...baseMatch, isFriendly: true, isOfficialFriendly: false, entryDate: "2026-12-01" };
  it("a manager of a club in it marks it Official and the change is logged", async () => {
    signedInAs({ id: "m", role: "user" });
    repoMock.getMatch.mockResolvedValue(withClubs(friendly, "A", "B"));
    repoMock.listManagedClubIds.mockResolvedValue(new Set(["A"]));
    repoMock.listSeasons.mockResolvedValue([season("active", "2026-11-01", null)]);
    expect(await setFriendlyMarkAction(friendly.id, true)).toEqual({ ok: true, data: undefined });
    expect(repoMock.setOfficialFriendly).toHaveBeenCalledWith(friendly.id, true);
    expect(repoMock.writeAudit).toHaveBeenCalledWith(expect.objectContaining({
      actorPlayerId: "m", action: "klc.friendly_mark", entityType: "klc_match",
      entityId: friendly.id, diff: { from: false, to: true },
    }));
  });
  it("refuses a manager once the season is closed, allows KFANDRA", async () => {
    repoMock.getMatch.mockResolvedValue(withClubs(friendly, "A", "B"));
    repoMock.listManagedClubIds.mockResolvedValue(new Set(["A"]));
    repoMock.listSeasons.mockResolvedValue([season("closed", "2026-11-01", "2026-12-31")]);
    signedInAs({ id: "m", role: "user" });
    expect((await setFriendlyMarkAction(friendly.id, true)).ok).toBe(false);
    signedInAs({ id: "k", role: "kfandra" });
    expect((await setFriendlyMarkAction(friendly.id, true)).ok).toBe(true);
  });
  it("refuses a league match and an unrelated manager", async () => {
    signedInAs({ id: "m", role: "user" });
    repoMock.listManagedClubIds.mockResolvedValue(new Set(["Z"]));
    repoMock.listSeasons.mockResolvedValue([]);
    repoMock.getMatch.mockResolvedValue(withClubs(friendly, "A", "B"));
    expect((await setFriendlyMarkAction(friendly.id, true)).ok).toBe(false);
    repoMock.getMatch.mockResolvedValue(withClubs({ ...friendly, isFriendly: false }, "A", "B"));
    signedInAs({ id: "k", role: "kfandra" });
    expect((await setFriendlyMarkAction(friendly.id, true)).ok).toBe(false);
  });
  it("is a no-op when the mark doesn't change", async () => {
    signedInAs({ id: "k", role: "kfandra" });
    repoMock.listSeasons.mockResolvedValue([]);
    repoMock.getMatch.mockResolvedValue(withClubs({ ...friendly, isOfficialFriendly: true }, "A", "B"));
    expect((await setFriendlyMarkAction(friendly.id, true)).ok).toBe(true);
    expect(repoMock.setOfficialFriendly).not.toHaveBeenCalled();
  });
});
```

`withClubs(match, home, away)` puts the two clubs on half 1, and
`season(status, start, end)` builds a `Season`. Add both as small local helpers if
the file doesn't already have equivalents.

- [ ] **Step 3: Run them and check that they fail**

Run: `npx vitest run src/lib/klcsra/actions.test.ts -t setFriendlyMarkAction`.
Expected: FAIL (not exported).

- [ ] **Step 4: Implement** (in `actions.ts`, after `reopenMatchAction`, and add
  `canSetFriendlyMark` to the `./access` import and
  `import { seasonForDate } from "./season-status";`)

```ts
const NO_MARK = "Only KFANDRA or a manager of a club in this friendly can change that.";
const SEASON_CLOSED = "The season is closed. Only KFANDRA can change this now.";

/**
 * Mark a friendly Official or Unofficial (spec 2026-11-22 §3). Allowed at any
 * status, including on a submitted friendly (the submit lock covers only the
 * child tables). Every change is written to audit_log.
 */
export async function setFriendlyMarkAction(
  matchId: string,
  official: boolean,
): Promise<ActionResult> {
  if (typeof official !== "boolean") return { ok: false, error: "Pick Official or Unofficial." };
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };
  const match = await repo.getMatch(matchId);
  if (!match) return { ok: false, error: NO_MATCH };
  if (!match.isFriendly) return { ok: false, error: "Only a friendly can be marked Official." };

  const loaded = await loadManaged(player.id);
  if (!loaded.ok) return loaded;
  const season = seasonForDate(await repo.listSeasons(), match.entryDate);
  const seasonClosed = season?.status === "closed";
  const clubIds = matchClubIds(match.halves);
  if (!canSetFriendlyMark(player, loaded.data, { isFriendly: true, clubIds }, { seasonClosed })) {
    const manages = clubIds.some((id) => loaded.data.has(id));
    return { ok: false, error: manages && seasonClosed ? SEASON_CLOSED : NO_MARK };
  }
  if (match.isOfficialFriendly === official) return OK;

  try {
    await repo.setOfficialFriendly(matchId, official);
    await repo.writeAudit({
      actorPlayerId: player.id, action: "klc.friendly_mark", entityType: "klc_match",
      entityId: matchId, diff: { from: match.isOfficialFriendly, to: official },
    });
    revalidateMatch(matchId);
    return OK;
  } catch (e) {
    return failed(e, "Failed to change the friendly type.");
  }
}
```

- [ ] **Step 5: Run them and check that they pass**

Run: `npx vitest run src/lib/klcsra/actions.test.ts`. Expected: PASS.

---

### Task 6: UI

**Files:**
- `src/app/klc/matches/[id]/page.tsx`
- `match-recorder.tsx`
- `recorder-header.tsx`
- `src/app/klc/matches/page.tsx`

- [ ] **Step 1: Page works out what the viewer may do.** In `[id]/page.tsx`:
  - import `canSetFriendlyMark` and `listSeasons`, plus `seasonForDate` from
    `@/lib/klcsra/season-status`
  - add `listSeasons()` to the `Promise.all`, as `seasons`
  - after `perms`:

```ts
  const friendlySeason = seasonForDate(seasons, match.entryDate);
  const friendlyMark = {
    canSet: canSetFriendlyMark(player, managed, {
      isFriendly: match.isFriendly, clubIds: matchClubIds(match.halves),
    }, { seasonClosed: friendlySeason?.status === "closed" }),
    /** Not inside any season's dates: an official friendly won't change values. */
    outsideSeason: friendlySeason === null,
  };
```

  Then pass `friendlyMark={friendlyMark}` to `<MatchRecorder>`.

- [ ] **Step 2: Recorder passes it through.** In `match-recorder.tsx`:
  - add the prop `friendlyMark: { canSet: boolean; outsideSeason: boolean }` to the
    props type and destructuring
  - import `setFriendlyMarkAction` from `@/lib/klcsra/actions`
  - pass both to the header:

```tsx
      <RecorderHeader
        ...existing props...
        friendlyMark={friendlyMark}
        onFriendlyMark={(official) => setFriendlyMarkAction(match.id, official)}
      />
```

- [ ] **Step 3: Header switch.** In `recorder-header.tsx`:
  - add the props
    `friendlyMark: { canSet: boolean; outsideSeason: boolean }` and
    `onFriendlyMark: (official: boolean) => Promise<{ ok: true } | { ok: false; error: string }>`
  - add local state:

```tsx
  const [official, setOfficial] = useState(match.isOfficialFriendly);
  const [markError, setMarkError] = useState<string | null>(null);
```

  Then, right after the Type/Format grid, render:

```tsx
      {friendly && (
        <div data-testid="friendly-mark" data-official={official}>
          <Segmented
            label="Friendly type"
            options={[
              { on: official, label: "Official", testId: "flag-official-friendly", buttonTestId: "mark-official" },
              { on: !official, label: "Unofficial", buttonTestId: "mark-unofficial" },
            ]}
            disabled={!friendlyMark.canSet}
            onPick={friendlyMark.canSet ? async (i) => {
              const next = i === 0;
              if (next === official) return;
              setOfficial(next);
              setMarkError(null);
              const res = await onFriendlyMark(next);
              if (!res.ok) { setOfficial(!next); setMarkError(res.error); }
            } : undefined}
          />
          <p className="mt-1 text-[11px] text-gray-500">
            {official
              ? friendlyMark.outsideSeason
                ? "Not inside a season: won't change values."
                : "Official: will change player values. No league points."
              : "Unofficial: changes nothing."}
          </p>
          <ErrorNote message={markError} testId="friendly-mark-error" />
        </div>
      )}
```

  The mark lives outside `locked`, because it can change on a submitted friendly.
  Only the League/Friendly type follows `locked`.

- [ ] **Step 4: List tag.** In `src/app/klc/matches/page.tsx`, replace the friendly
  tag with:

```tsx
          {m.isFriendly && (
            <Tag testId="tag-friendly" tone="violet">
              {m.isOfficialFriendly ? "Official friendly" : "Friendly"}
            </Tag>
          )}
```

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit && npm run -s lint`. Expected: no output.

---

### Task 7: E2E (local Supabase)

**Files:** Create `e2e/klc-friendly-mark.spec.ts`

- [ ] **Step 1: Read the helpers in use**

Run: `grep -n "export async function" e2e/helpers/recorder.ts e2e/helpers/db.ts e2e/helpers/auth.ts`.
Use `rec.createMatch` (check whether it takes `friendly: true`; if not, click
`type-friendly` after creating), `db.listClubs`, `db.setClubManager`, `seedPlayer`,
`signIn` and `db.sql`.

- [ ] **Step 2: Write the spec**

```ts
import { test, expect } from "./fixtures";
import { seedPlayer, signIn, signInAs } from "./helpers/auth";
import * as db from "./helpers/db";
import * as rec from "./helpers/recorder";

/** Friendly mark (spec 2026-11-22 §3). Local Supabase only. */
const SEASON = "KLCFERRSXVSG2";
const DATE = "2026-11-28";
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

test("a manager marks a friendly Official; it is logged and shown in the list", async ({ browser }) => {
  const [a, b] = await db.listClubs(2);
  const mgr = await seedPlayer("user", "E2E Mark Mgr");
  await db.setClubManager(a.id, mgr.id);
  const ctx = await browser.newContext();
  await signIn(ctx, mgr);
  const page = await ctx.newPage();
  try {
    const id = await rec.createMatch(page, { date: DATE, sport: "football", away: b.id, friendly: true });
    await expect(page.getByTestId("friendly-mark")).toHaveAttribute("data-official", "false");
    await page.getByTestId("mark-official").click();
    await expect(page.getByTestId("flag-official-friendly")).toBeVisible();
    await expect.poll(async () => (await db.sql<{ o: boolean }>(
      `select is_official_friendly as o from klc_matches where id = $1`, [id]))[0]?.o).toBe(true);
    const log = await db.sql<{ n: number }>(
      `select count(*)::int as n from audit_log where action = 'klc.friendly_mark' and entity_id = $1`, [id]);
    expect(log[0].n).toBe(1);
    await page.goto("/klc/matches");
    await expect(page.locator(`[data-match-id="${id}"] [data-testid="tag-friendly"]`)).toHaveText(/Official friendly/i);
  } finally {
    await ctx.close();
  }
});

test("a League match shows no friendly type; flipping to League clears the mark", async ({ page }) => {
  await signInAs(page, "kfandra");
  const [a, b] = await db.listClubs(2);
  const id = await rec.createMatch(page, { date: DATE, sport: "football", home: a.id, away: b.id, friendly: true });
  await page.getByTestId("mark-official").click();
  await expect(page.getByTestId("flag-official-friendly")).toBeVisible();
  await page.getByTestId("type-league").click();
  await expect(page.getByTestId("friendly-mark")).toHaveCount(0);
  await expect.poll(async () => (await db.sql<{ o: boolean }>(
    `select is_official_friendly as o from klc_matches where id = $1`, [id]))[0]?.o).toBe(false);
});
```

Change the `rec.createMatch` / `signInAs` arguments to match the real helper
signatures from Step 1.

- [ ] **Step 3: Run it**

Run: `npx playwright test e2e/klc-friendly-mark.spec.ts`. Expected: 2 passed.

---

### Task 8: Guide, quality gates, PR

- [ ] **Step 1: Guide.** In `docs/klc-league-guide.md`, after the section that
  explains friendlies, add:

```markdown
### Official and unofficial friendlies

Every friendly is marked **Official** or **Unofficial**. A new friendly starts
as Unofficial. KFANDRA, or the manager of either club, can switch it on the
match screen, even after the match is final. Once the season is closed, only
KFANDRA can change it. Every change is recorded.

| | Official friendly | Unofficial friendly |
|---|---|---|
| Player values | Will change (coming with player values) | No change |
| League points, results and scorers | No | No |
| Match fee and win bonus | No | No |
```

Then run `npm run -s docs:pdf:league`.

- [ ] **Step 2: Gates**

Run:
```bash
npm run -s lint && npx tsc --noEmit && npx vitest run && npx playwright test e2e/klc-friendly-mark.spec.ts e2e/klc-match-workflow.spec.ts e2e/klcsra-recorder.spec.ts
```
Then run the confidentiality check from the bd memories over `git diff main`.
Expected: everything passes, and the check finds nothing.

- [ ] **Step 3: Commit (one bead, one commit) and open the PR**

```bash
git add -A
git commit -m "feat(klc): mark friendlies Official or Unofficial (Helper-3u5)"
git push -u origin feat/klc-friendly-mark
gh pr create --base main --title "feat(klc): mark friendlies Official or Unofficial"
```
The PR body notes that Jaidev runs `npx supabase db push` after merging, and that
KFANDRA gets a heads-up first.
