# KLC League Scoring, Tables & Leaderboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatic league points, the 5 league tables, leaderboards and a public `/klc/league` page, with club managers recording their own club's matches.

**Architecture:**
- Pure TypeScript domain modules compute points, tables and boards **on read**, from submitted matches loaded through the existing service-role repository.
- Access control stays in `src/lib/klcsra/actions.ts`, now through a pure `canEditMatch` rule. There are no RLS changes.
- One migration widens the match types, adds `created_by`, rewrites the rules config to v2, and adds a submit-lock trigger and a touch-parent trigger.

**Tech Stack:** Next.js 16 App Router (server components), TypeScript strict, Tailwind, Supabase (Postgres, service-role client), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-20-klc-league-scoring-design.md`. Business rules live in `docs/superpowers/specs/2026-10-16-klc-league-scoring-handover.md` §1 and §4.

### Follows the design doc in full (Jaidev, 2026-10-21: "no shortcuts")

- `src/lib/klcsra/league-repository.ts` is the league read model (Task 10, Step 2), with a mocked-client unit test proving every query filters `status = 'submitted'`.
- A draft's League/Friendly type can be changed in the recorder header (Task 11, Step 5 item 9; Task 12, Step 5 item 8).
- The season pill opens a season picker (Task 14, Step 8).

### Conventions for every task

- Run unit tests with `npx vitest run <path>`. Run the whole unit suite with `npm run test`.
- One task = one commit. Use the bead id from Task 0 in the commit message, and end every commit message with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```
- Never run anything against prod except the read-only checks in Task 0.

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `supabase/migrations/20261020120000_klc_league_scoring.sql` | create | Match types, `created_by`, rules v2, table groups, sport stats, lock and touch triggers |
| `src/lib/klcsra/sport-stats.ts` | modify | 6 sports, labels, `TRY_SPORTS` |
| `src/lib/klcsra/standings-rules.ts` | rewrite | v2 rules type, defaults, parser, `tierFor` |
| `src/lib/klcsra/table-groups.ts` | create | Table group config: defaults, parser, membership, score kinds |
| `src/lib/klcsra/points.ts` | create | `computeMatchPoints` |
| `src/lib/klcsra/league-table.ts` | create | `LeagueMatch` type, aggregates, `buildLeagueTable` |
| `src/lib/klcsra/leaderboards.ts` | create | `StatRow` type, `BOARDS`, `buildLeaderboards` |
| `src/lib/klcsra/league-data.ts` | create | `MatchDraft` → `LeagueMatch` / `StatRow[]` / side labels |
| `src/lib/klcsra/access.ts` | create | `canEditMatch`, `canRecordMatches`, `canReopenMatch`, `matchClubIds` |
| `src/lib/klcsra/league-params.ts` | create | Parsing `/klc/league` search params, `defaultSeasonId`, `leagueHref` |
| `src/lib/klcsra/standings.ts`, `combined.ts` + tests | delete | v1 rules |
| `src/lib/klcsra/types.ts` | modify | `createdBy` on `MatchDraft`; `createdBy`, `clubIds` on `MatchSummary` |
| `src/lib/klcsra/repository.ts` | modify | `created_by`, create with home club, `listManagedClubIds`, `listSubmittedMatchDrafts` |
| `src/lib/klcsra/config.ts` | modify | `loadTableGroups` |
| `src/lib/klcsra/actions.ts` | modify | `requireMatchEditor`, create with home club, new paths |
| `src/lib/klcsra/config-contract.test.ts` | modify | Reads the new migration for the v2 keys |
| `src/app/klc/matches/**` | move from `src/app/admin/klc/matches/**` | Recorder, now for staff + managers |
| `src/app/admin/klc/matches/page.tsx`, `[id]/page.tsx` | replace | `redirect()` to the new paths |
| `src/app/klc/league/*.tsx` | create | League page + 5 tabs |
| `src/app/home-screen.tsx`, `src/app/page.tsx` | modify | KLC League block |
| `src/content/strings.ts` | modify | `home.league`, `league` strings |
| `src/lib/supabase/database.types.ts` | regenerate | `created_by` |
| `e2e/helpers/recorder.ts`, `e2e/klcsra-recorder.spec.ts` | modify | New recorder paths |
| `e2e/klcsra-triggers.spec.ts` | create | DB trigger tests (SQL only, no browser) |
| `e2e/klc-league.spec.ts` | create | League + manager e2e |
| `docs/klc-league-checkpoint.md` | create | KFANDRA acceptance checklist |

---

## Task 0: Branch, beads, prod checks

**Files:** none.

- [ ] **Step 1: Create the branch**

```bash
git checkout -b feat/klc-league-scoring
```

- [ ] **Step 2: Create the beads under Helper-bsr and record their ids**

```bash
bd create "KLC league: migration (types, created_by, rules v2, groups, lock+touch triggers)" -p 1 --parent Helper-bsr
bd create "KLC league: rules v2 + computeMatchPoints; delete v1 standings/combined" -p 1 --parent Helper-bsr
bd create "KLC league: league table aggregation + groups" -p 1 --parent Helper-bsr
bd create "KLC league: leaderboards aggregation" -p 1 --parent Helper-bsr
bd create "KLC league: manager recording (requireMatchEditor, /klc/matches)" -p 1 --parent Helper-bsr
bd create "KLC league: /klc/league UI (5 tabs) + home block" -p 1 --parent Helper-bsr
bd create "KLC league: recorder tier + points preview" -p 2 --parent Helper-bsr
bd create "KLC league: e2e + KFANDRA checkpoint doc" -p 1 --parent Helper-bsr
bd create "KLC: manager-assignment admin UI (clubs.manager_player_id)" -p 3 --parent Helper-bsr
bd create "KLC: match report page" -p 3 --parent Helper-bsr
bd create "KLC league: S1 acceptance replay (needs Coach's KLCFERRSXVSG1 sheet)" -p 2 --parent Helper-bsr
```

If `--parent` isn't accepted, run `bd create --help` and use the dependency flag it lists. Write the 8 build bead ids into the commit messages of Tasks 1–16 as follows:

| Bead | Tasks |
|---|---|
| migration | Tasks 1–5 |
| rules | Task 6 |
| table | Tasks 7–8 |
| leaderboards | Task 9 |
| manager | Tasks 10–13 |
| UI | Task 14 |
| preview | Task 15 |
| e2e | Task 16 |

- [ ] **Step 3: Read-only prod checks** (invoke the `querying-production-data` skill and use its connection method)

```sql
select sport, status, count(*) from klc_matches group by 1,2 order by 1,2;
select season_no, name, status, start_date, end_date from klc_seasons order by season_no;
select name, manager_player_id is not null as linked from clubs order by sort_order;
select version from supabase_migrations.schema_migrations where version like '202608151%' order by 1;
```

Expected:
- No `variation` rows. **If there are any, STOP and ask Jaidev** how to remap them (Q10). The migration in Task 4 assumes there are none.
- All 4 `20260815…` versions are applied.
- Note how many clubs are `linked`. This is for the rollout notes in Task 17.

---

## Task 1: Six match types (`sport-stats.ts`)

**Files:**
- Modify: `src/lib/klcsra/sport-stats.ts`
- Test: `src/lib/klcsra/sport-stats.test.ts`

- [ ] **Step 1: Update the tests (they fail first)**

In `src/lib/klcsra/sport-stats.test.ts`:
1. Add `TRY_SPORTS` to the import list from `"./sport-stats"`.
2. Replace the first `describe("DEFAULT_SPORT_STATS", …)` block's first two `it`s and the `"variation allows every known stat"` `it` with:

```ts
  it("covers the six match types", () => {
    expect(SPORTS).toEqual([
      "football", "fooba", "rugby",
      "rugby_variation", "short_game_variation", "multi_game_variation",
    ]);
  });

  it("matches the spec allow-lists", () => {
    expect(DEFAULT_SPORT_STATS.football).toHaveLength(11);
    expect(DEFAULT_SPORT_STATS.rugby).toHaveLength(8);
    expect(DEFAULT_SPORT_STATS.fooba).toHaveLength(13);
    expect(DEFAULT_SPORT_STATS.rugby_variation).toHaveLength(16);
    expect(DEFAULT_SPORT_STATS.short_game_variation).toHaveLength(16);
    expect(DEFAULT_SPORT_STATS.multi_game_variation).toHaveLength(16);
  });

  it("every variation type allows every known stat", () => {
    for (const s of ["rugby_variation", "short_game_variation", "multi_game_variation"] as const) {
      expect([...DEFAULT_SPORT_STATS[s]].sort()).toEqual([...STAT_KEYS].sort());
    }
  });
```

3. In `describe("SPORT_LABELS", …)`, add after the `fooba` assertion:

```ts
    expect(SPORT_LABELS.rugby).toBe("Rugby Sox");
    expect(SPORT_LABELS.short_game_variation).toBe("Short Game Variation");
```

4. Replace the last assertion of `"degrades to the full stat set for an unrecognised sport"` with:

```ts
    expect(statsForSport("hockey" as Sport)).toEqual([...STAT_KEYS]);
```

5. Append:

```ts
describe("TRY_SPORTS", () => {
  it("is exactly the two rugby types", () => {
    expect([...TRY_SPORTS].sort()).toEqual(["rugby", "rugby_variation"]);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/lib/klcsra/sport-stats.test.ts`
Expected: FAIL (`TRY_SPORTS` is not exported; the SPORTS order differs).

- [ ] **Step 3: Implement**

In `src/lib/klcsra/sport-stats.ts`, replace the `Sport` type, `SPORTS`, `SPORT_LABELS` and the `variation` entry of `DEFAULT_SPORT_STATS`, and change the fallback in `statsForSport`:

```ts
export type Sport =
  | "football"
  | "fooba"
  | "rugby"
  | "rugby_variation"
  | "short_game_variation"
  | "multi_game_variation";

export const SPORTS: readonly Sport[] = [
  "football", "fooba", "rugby",
  "rugby_variation", "short_game_variation", "multi_game_variation",
];

/** `rugby` is shown as "Rugby Sox" (KFANDRA's name for it, 2026-10). */
export const SPORT_LABELS: Record<Sport, string> = {
  football: "Football",
  fooba: "Fooba",
  rugby: "Rugby Sox",
  rugby_variation: "Rugby Variation",
  short_game_variation: "Short Game Variation",
  multi_game_variation: "Multi-Game Variation",
};

/** Sports whose side score is tries (TF/TA), not goals (GF/GA). */
export const TRY_SPORTS: ReadonlySet<Sport> = new Set<Sport>(["rugby", "rugby_variation"]);
```

In `DEFAULT_SPORT_STATS`, replace `variation: [...STAT_KEYS],` with:

```ts
  rugby_variation: [...STAT_KEYS],
  short_game_variation: [...STAT_KEYS],
  multi_game_variation: [...STAT_KEYS],
```

In `statsForSport`, replace the `allowed` line and update its comment's last sentence:

```ts
  // … Falling back to every known stat is the fail-safe direction: it never
  // silently excludes a stat and so never silently zeroes a payout.
  const allowed = config[sport] ?? DEFAULT_SPORT_STATS[sport] ?? [...STAT_KEYS];
```

- [ ] **Step 4: Run, expect PASS**

Run: `npx vitest run src/lib/klcsra/sport-stats.test.ts`
Expected: PASS.

- [ ] **Step 5: Fix the recorder's sport chip grid (6 chips: 3 across)**

In `src/app/admin/klc/matches/[id]/recorder-header.tsx`:
- Change `{/* Sport chips — 4 across. */}` to `{/* Sport chips — 3 across, 2 rows. */}`.
- Change `className="mt-1 grid grid-cols-4 gap-1.5"` to `className="mt-1 grid grid-cols-3 gap-1.5"`.
- In the file's doc comment, change "Sport is chips (4 across)" to "Sport is chips (3 across)".

Run: `npx tsc --noEmit`
Expected: errors only in `config-contract.test.ts` (it still expects the four sports; Task 4 fixes it). If anything else references `"variation"`, fix it to one of the new keys.

Do **not** commit yet; Tasks 1–5 share one commit at the end of Task 5.

---

## Task 2: Rules config v2 (`standings-rules.ts`)

**Files:**
- Rewrite: `src/lib/klcsra/standings-rules.ts`
- Rewrite: `src/lib/klcsra/standings-rules.test.ts`

- [ ] **Step 1: Write the failing test** (replace the whole file)

```ts
import { describe, it, expect } from "vitest";
import {
  DEFAULT_STANDINGS_RULES as D,
  TIER_KEYS,
  parseStandingsRules,
  tierFor,
} from "./standings-rules";
import { SPORTS } from "./sport-stats";

describe("DEFAULT_STANDINGS_RULES (v2)", () => {
  it("has a win entry for every sport and tier", () => {
    for (const s of SPORTS) for (const t of TIER_KEYS) {
      expect(typeof D.win[s][t]).toBe("number");
    }
  });

  it("7+ wins: 5 for football/fooba/rugby, 3 for the variations", () => {
    expect(D.win.football["7plus"]).toBe(5);
    expect(D.win.fooba["7plus"]).toBe(5);
    expect(D.win.rugby["7plus"]).toBe(5);
    expect(D.win.rugby_variation["7plus"]).toBe(3);
    expect(D.win.short_game_variation["7plus"]).toBe(3);
    expect(D.win.multi_game_variation["7plus"]).toBe(3);
  });

  it("below 7 every type earns the variation points", () => {
    for (const s of SPORTS) {
      expect(D.win[s]["4to6"]).toBe(1);
      expect(D.win[s]["2to3"]).toBe(0.5);
    }
  });

  it("draws 1 / 0.2 / 0.1 and loss 0", () => {
    expect(D.draw).toEqual({ "7plus": 1, "4to6": 0.2, "2to3": 0.1 });
    expect(D.loss).toBe(0);
  });
});

describe("tierFor", () => {
  it.each([
    [12, "7plus"], [7, "7plus"], [6, "4to6"], [4, "4to6"],
    [3, "2to3"], [2, "2to3"], [1, null], [0, null],
  ])("%i players -> %s", (n, tier) => {
    expect(tierFor(n, D)).toBe(tier);
  });
});

describe("parseStandingsRules", () => {
  it("parses the defaults as a round trip", () => {
    expect(parseStandingsRules(JSON.parse(JSON.stringify(D)))).toEqual(D);
  });

  it("falls back to defaults for null, garbage and v1", () => {
    expect(parseStandingsRules(null)).toEqual(D);
    expect(parseStandingsRules("nope")).toEqual(D);
    expect(
      parseStandingsRules({
        playerThreshold: 6,
        atOrAbove: { win: 3, draw: 1, loss: 0 },
        below: { win: 0.2, draw: 0.05, loss: 0 },
      }),
    ).toEqual(D);
  });

  it("falls back to defaults when tiers or draw are malformed", () => {
    const bad = JSON.parse(JSON.stringify(D));
    bad.draw = { "7plus": 1 };
    expect(parseStandingsRules(bad)).toEqual(D);
    const bad2 = JSON.parse(JSON.stringify(D));
    bad2.tiers = [{ key: "7plus", min: 7, max: null }];
    expect(parseStandingsRules(bad2)).toEqual(D);
  });

  it("honours a tuned value", () => {
    const tuned = JSON.parse(JSON.stringify(D));
    tuned.win.football["7plus"] = 6;
    expect(parseStandingsRules(tuned).win.football["7plus"]).toBe(6);
  });

  it("defaults one sport whose win entry is malformed, keeping the rest", () => {
    const v = JSON.parse(JSON.stringify(D));
    v.win.fooba = { "7plus": "five" };
    v.win.football["7plus"] = 6;
    const r = parseStandingsRules(v);
    expect(r.win.fooba).toEqual(D.win.fooba);
    expect(r.win.football["7plus"]).toBe(6);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/lib/klcsra/standings-rules.test.ts`
Expected: FAIL (`TIER_KEYS` / `tierFor` are not exported).

- [ ] **Step 3: Implement** (replace the whole file)

```ts
/**
 * Pure KLCSRA league points rules, v2 (no DB/server imports). DB loader in
 * config.ts. Shape and numbers: league-scoring handover spec §3.2.
 *
 * Every type has a win value for every tier: below 7 players all types earn
 * the variation points (Q3), so a win always beats a draw.
 */
import { SPORTS, type Sport } from "./sport-stats";

export type TierKey = "7plus" | "4to6" | "2to3";
export const TIER_KEYS: readonly TierKey[] = ["7plus", "4to6", "2to3"];
export const TIER_LABELS: Record<TierKey, string> = {
  "7plus": "7+",
  "4to6": "4–6",
  "2to3": "2–3",
};

export interface Tier {
  key: TierKey;
  min: number;
  max: number | null;
}
export type TierPoints = Record<TierKey, number>;

export interface StandingsRules {
  version: 2;
  /** Players are counted across both sides together. */
  playerCount: "total";
  tiers: Tier[];
  win: Record<Sport, TierPoints>;
  draw: TierPoints;
  loss: number;
}

const MAIN: TierPoints = { "7plus": 5, "4to6": 1, "2to3": 0.5 };
const VARIATION: TierPoints = { "7plus": 3, "4to6": 1, "2to3": 0.5 };

export const DEFAULT_STANDINGS_RULES: StandingsRules = {
  version: 2,
  playerCount: "total",
  tiers: [
    { key: "7plus", min: 7, max: null },
    { key: "4to6", min: 4, max: 6 },
    { key: "2to3", min: 2, max: 3 },
  ],
  win: {
    football: { ...MAIN },
    fooba: { ...MAIN },
    rugby: { ...MAIN },
    rugby_variation: { ...VARIATION },
    short_game_variation: { ...VARIATION },
    multi_game_variation: { ...VARIATION },
  },
  draw: { "7plus": 1, "4to6": 0.2, "2to3": 0.1 },
  loss: 0,
};

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

function parseTierPoints(raw: unknown): TierPoints | null {
  if (!isObj(raw)) return null;
  const out = {} as TierPoints;
  for (const k of TIER_KEYS) {
    if (!isNum(raw[k])) return null;
    out[k] = raw[k];
  }
  return out;
}

function parseTiers(raw: unknown): Tier[] | null {
  if (!Array.isArray(raw) || raw.length !== TIER_KEYS.length) return null;
  const out: Tier[] = [];
  for (const t of raw) {
    if (!isObj(t) || !TIER_KEYS.includes(t.key as TierKey) || !isNum(t.min)) return null;
    if (t.max !== null && !isNum(t.max)) return null;
    out.push({ key: t.key as TierKey, min: t.min, max: t.max as number | null });
  }
  return new Set(out.map((t) => t.key)).size === TIER_KEYS.length ? out : null;
}

/**
 * Coerce a raw app_config value into v2 rules. Anything that isn't a valid v2
 * object (null, garbage, the old v1 shape) falls back to the defaults whole.
 * A single sport's malformed `win` entry falls back to that sport's default.
 * Never throws: a bad config must not take the league page down.
 */
export function parseStandingsRules(value: unknown): StandingsRules {
  const d = DEFAULT_STANDINGS_RULES;
  if (!isObj(value) || value.version !== 2) return d;
  const tiers = parseTiers(value.tiers);
  const draw = parseTierPoints(value.draw);
  if (!tiers || !draw || !isNum(value.loss) || !isObj(value.win)) return d;
  const winRaw = value.win;
  const win = {} as Record<Sport, TierPoints>;
  for (const s of SPORTS) win[s] = parseTierPoints(winRaw[s]) ?? { ...d.win[s] };
  return { version: 2, playerCount: "total", tiers, win, draw, loss: value.loss };
}

/** The tier a match falls in by total players, or null (fewer than 2). */
export function tierFor(totalPlayers: number, rules: StandingsRules): TierKey | null {
  for (const t of rules.tiers) {
    if (totalPlayers >= t.min && (t.max === null || totalPlayers <= t.max)) return t.key;
  }
  return null;
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `npx vitest run src/lib/klcsra/standings-rules.test.ts`
Expected: PASS.

- [ ] **Step 5: Delete the v1 consumers**

```bash
git rm src/lib/klcsra/standings.ts src/lib/klcsra/standings.test.ts \
       src/lib/klcsra/combined.ts src/lib/klcsra/combined.test.ts
```

`src/lib/klcsra/round.ts` stays. Update its doc comment's first sentence to: "League points are fractional (0.2 / 0.1 draws, 0.5 wins), so sums pick up binary-float noise:".

---

## Task 3: Table groups (`table-groups.ts`)

**Files:**
- Create: `src/lib/klcsra/table-groups.ts`
- Test: `src/lib/klcsra/table-groups.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  DEFAULT_TABLE_GROUPS as G,
  groupScoreKinds,
  parseTableGroups,
  sportInGroup,
} from "./table-groups";

describe("DEFAULT_TABLE_GROUPS", () => {
  it("is All + the 4 separate tables, in display order", () => {
    expect(Object.keys(G)).toEqual([
      "all", "football_fooba", "rugby_sox", "rugby_variations", "short_game_variations",
    ]);
  });

  it("puts multi-game variation in All only (Q2)", () => {
    expect(sportInGroup("multi_game_variation", "all", G)).toBe(true);
    for (const k of Object.keys(G).filter((k) => k !== "all")) {
      expect(sportInGroup("multi_game_variation", k, G)).toBe(false);
    }
  });
});

describe("sportInGroup", () => {
  it("matches listed sports and rejects unknown groups", () => {
    expect(sportInGroup("fooba", "football_fooba", G)).toBe(true);
    expect(sportInGroup("rugby", "football_fooba", G)).toBe(false);
    expect(sportInGroup("rugby", "nope", G)).toBe(false);
  });
});

describe("groupScoreKinds", () => {
  it("All shows both; rugby groups tries only; football groups goals only", () => {
    expect(groupScoreKinds("all", G)).toEqual({ goals: true, tries: true });
    expect(groupScoreKinds("rugby_sox", G)).toEqual({ goals: false, tries: true });
    expect(groupScoreKinds("rugby_variations", G)).toEqual({ goals: false, tries: true });
    expect(groupScoreKinds("football_fooba", G)).toEqual({ goals: true, tries: false });
    expect(groupScoreKinds("short_game_variations", G)).toEqual({ goals: true, tries: false });
  });
});

describe("parseTableGroups", () => {
  it("round-trips the defaults", () => {
    expect(parseTableGroups(JSON.parse(JSON.stringify(G)))).toEqual(G);
  });

  it("falls back for garbage and for an object with no usable groups", () => {
    expect(parseTableGroups(null)).toEqual(G);
    expect(parseTableGroups({ x: ["hockey"] })).toEqual(G);
  });

  it("drops unknown sports and keeps order", () => {
    expect(parseTableGroups({ all: "*", mixed: ["fooba", "hockey"] })).toEqual({
      all: "*",
      mixed: ["fooba"],
    });
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/lib/klcsra/table-groups.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
/**
 * Pure league table groups (no DB/server imports). DB loader in config.ts,
 * key `klcsra_table_groups`. Key order is display order: the first key is the
 * default chip. "*" means every sport.
 */
import { SPORTS, TRY_SPORTS, type Sport } from "./sport-stats";

export type TableGroups = Record<string, "*" | Sport[]>;

export const DEFAULT_TABLE_GROUPS: TableGroups = {
  all: "*",
  football_fooba: ["football", "fooba"],
  rugby_sox: ["rugby"],
  rugby_variations: ["rugby_variation"],
  short_game_variations: ["short_game_variation"],
};

const isSport = (x: unknown): x is Sport =>
  typeof x === "string" && (SPORTS as readonly string[]).includes(x);

export function parseTableGroups(value: unknown): TableGroups {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return DEFAULT_TABLE_GROUPS;
  }
  const out: TableGroups = {};
  for (const [key, raw] of Object.entries(value)) {
    if (raw === "*") out[key] = "*";
    else if (Array.isArray(raw)) {
      const sports = [...new Set(raw.filter(isSport))];
      if (sports.length > 0) out[key] = sports;
    }
  }
  return Object.keys(out).length > 0 ? out : DEFAULT_TABLE_GROUPS;
}

export function sportInGroup(sport: Sport, groupKey: string, groups: TableGroups): boolean {
  const g = groups[groupKey];
  if (g === undefined) return false;
  return g === "*" || g.includes(sport);
}

/** Which score columns can be non-zero in a group (GF/GA vs TF/TA). */
export function groupScoreKinds(
  groupKey: string,
  groups: TableGroups,
): { goals: boolean; tries: boolean } {
  const g = groups[groupKey];
  if (g === undefined || g === "*") return { goals: true, tries: true };
  return {
    goals: g.some((s) => !TRY_SPORTS.has(s)),
    tries: g.some((s) => TRY_SPORTS.has(s)),
  };
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `npx vitest run src/lib/klcsra/table-groups.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the loader** to `src/lib/klcsra/config.ts`

Add the import:

```ts
import { parseTableGroups, type TableGroups } from "./table-groups";
```

Add `export type { TableGroups } from "./table-groups";` next to the other type re-exports. Then append:

```ts
/** Load league table groups from app_config (key 'klcsra_table_groups'). */
export async function loadTableGroups(): Promise<TableGroups> {
  return parseTableGroups(await loadConfigValue("klcsra_table_groups"));
}
```

---

## Task 4: Migration + config contract test

**Files:**
- Create: `supabase/migrations/20261020120000_klc_league_scoring.sql`
- Modify: `src/lib/klcsra/config-contract.test.ts`

- [ ] **Step 1: Update the contract test so it fails first**

In `src/lib/klcsra/config-contract.test.ts`:

1. Replace the single `MIGRATION_PATH` / `SQL` pair with two files:

```ts
const CORE_SQL = readFileSync(
  resolve(REPO_ROOT, "supabase/migrations/20260815120000_klcsra_core.sql"),
  "utf8",
);
/** Re-seeds the standings rules (v2) and sport stats, and adds table groups. */
const LEAGUE_SQL = readFileSync(
  resolve(REPO_ROOT, "supabase/migrations/20261020120000_klc_league_scoring.sql"),
  "utf8",
);
/** The migration that owns each key's CURRENT value. */
const SQL_FOR: Record<string, string> = {
  klcsra_stat_rates: CORE_SQL,
  klcsra_sport_stats: LEAGUE_SQL,
  klcsra_standings_rules: LEAGUE_SQL,
  klcsra_table_groups: LEAGUE_SQL,
};
```

2. In `extractSeededJsonLiteral`, replace `const statements = SQL.split(INSERT).slice(1);` with:

```ts
  const statements = SQL_FOR[key].split(INSERT).slice(1);
```

3. Add `import { DEFAULT_TABLE_GROUPS } from "./table-groups";` to the imports.
4. Add `"klcsra_table_groups"` to the key list in the first `it`.
5. Rename `"klcsra_sport_stats covers exactly the four sports"` to `"klcsra_sport_stats covers exactly the six sports"`.
6. Append inside the `describe`:

```ts
  it("klcsra_table_groups deep-equals DEFAULT_TABLE_GROUPS, in order", () => {
    const seeded = seededValue("klcsra_table_groups") as Record<string, unknown>;
    expect(seeded).toEqual(DEFAULT_TABLE_GROUPS);
    expect(Object.keys(seeded)).toEqual(Object.keys(DEFAULT_TABLE_GROUPS));
  });
```

7. Update the file's doc comment: "The migrations seed four JSON rule sets…; `SQL_FOR` names the migration that owns each key's current value."

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/lib/klcsra/config-contract.test.ts`
Expected: FAIL with ENOENT for `20261020120000_klc_league_scoring.sql`.

- [ ] **Step 3: Write the migration**

`supabase/migrations/20261020120000_klc_league_scoring.sql`:

```sql
-- KLC League Scoring (design: docs/superpowers/specs/2026-10-20-klc-league-scoring-design.md)
--
--  1. Six match types replace football|rugby|fooba|variation. Prod had no
--     `variation` rows when this was written (checked 2026-10-20).
--  2. klc_matches.created_by: who started the draft (club managers may edit
--     drafts they created).
--  3. app_config: standings rules v2, table groups, sport stats for new types.
--  4. Submit lock in the DB (Helper-0gr): child rows of a submitted match
--     cannot be written. The server actions check first; this is the backstop
--     now that non-staff managers can record.
--  5. Touch parent (Helper-r01): any child write bumps klc_matches.updated_at.

-- ─── 1. match types ─────────────────────────────────────────────────────────
alter table public.klc_matches drop constraint klc_matches_sport_chk;
alter table public.klc_matches add constraint klc_matches_sport_chk check (sport in (
  'football','fooba','rugby','rugby_variation','short_game_variation','multi_game_variation'
));

-- ─── 2. created_by ──────────────────────────────────────────────────────────
alter table public.klc_matches
  add column created_by uuid references public.players(id) on delete set null;
create index klc_matches_created_by_idx on public.klc_matches (created_by);
comment on column public.klc_matches.created_by is
  'Player who created the draft. Null for matches created before 2026-10-20.';

-- ─── 3. app_config ──────────────────────────────────────────────────────────
insert into public.app_config (key, value, description) values (
  'klcsra_standings_rules',
  '{
    "version": 2,
    "playerCount": "total",
    "tiers": [
      {"key": "7plus", "min": 7, "max": null},
      {"key": "4to6",  "min": 4, "max": 6},
      {"key": "2to3",  "min": 2, "max": 3}
    ],
    "win": {
      "football":             {"7plus": 5, "4to6": 1, "2to3": 0.5},
      "fooba":                {"7plus": 5, "4to6": 1, "2to3": 0.5},
      "rugby":                {"7plus": 5, "4to6": 1, "2to3": 0.5},
      "rugby_variation":      {"7plus": 3, "4to6": 1, "2to3": 0.5},
      "short_game_variation": {"7plus": 3, "4to6": 1, "2to3": 0.5},
      "multi_game_variation": {"7plus": 3, "4to6": 1, "2to3": 0.5}
    },
    "draw": {"7plus": 1, "4to6": 0.2, "2to3": 0.1},
    "loss": 0
  }'::jsonb,
  'KLC league points v2: win points by match type x tier (total players across both sides), draw points by tier, loss. No session caps (ground rule only).'
) on conflict (key) do update set value = excluded.value, description = excluded.description;

insert into public.app_config (key, value, description) values (
  'klcsra_table_groups',
  '{
    "all": "*",
    "football_fooba": ["football","fooba"],
    "rugby_sox": ["rugby"],
    "rugby_variations": ["rugby_variation"],
    "short_game_variations": ["short_game_variation"]
  }'::jsonb,
  'KLC league tables: group key -> match types ("*" = all). Key order is display order. multi_game_variation is in All only.'
) on conflict (key) do update set value = excluded.value, description = excluded.description;

insert into public.app_config (key, value, description) values (
  'klcsra_sport_stats',
  '{
    "football":  ["goal","assist","preAssist","save","yellowCard","redCard","blueCard","lateChallenge","ownGoal","ownAssist","ownPreAssist"],
    "fooba":     ["mainGoal","reboundGoal","switchover","assist","preAssist","save","yellowCard","redCard","blueCard","lateChallenge","ownGoal","ownAssist","ownPreAssist"],
    "rugby":     ["try","tackle","assist","preAssist","yellowCard","redCard","blueCard","lateChallenge"],
    "rugby_variation":      ["goal","try","mainGoal","reboundGoal","assist","preAssist","switchover","tackle","save","yellowCard","redCard","blueCard","lateChallenge","ownGoal","ownAssist","ownPreAssist"],
    "short_game_variation": ["goal","try","mainGoal","reboundGoal","assist","preAssist","switchover","tackle","save","yellowCard","redCard","blueCard","lateChallenge","ownGoal","ownAssist","ownPreAssist"],
    "multi_game_variation": ["goal","try","mainGoal","reboundGoal","assist","preAssist","switchover","tackle","save","yellowCard","redCard","blueCard","lateChallenge","ownGoal","ownAssist","ownPreAssist"]
  }'::jsonb,
  'KLCSRA per-sport stat allow-list. The recorder filters the stats popup by sport; disallowed keys are ignored by the payout compute.'
) on conflict (key) do update set value = excluded.value, description = excluded.description;

-- ─── 4 + 5. lock + touch triggers ───────────────────────────────────────────
-- Resolve the parent match id of a child row. Returns null when the parent
-- is already gone (cascade delete of the match), which both triggers treat
-- as "nothing to do".
-- The row arrives as jsonb so one helper serves all four tables.
create or replace function app.klc_child_match_id(tbl text, r jsonb)
returns uuid language plpgsql stable as $$
declare mid uuid;
begin
  if tbl in ('klc_match_halves', 'klc_match_appearances') then
    return (r->>'match_id')::uuid;
  elsif tbl = 'klc_match_sides' then
    select h.match_id into mid from public.klc_match_halves h where h.id = (r->>'half_id')::uuid;
    return mid;
  elsif tbl = 'klc_player_stats' then
    select a.match_id into mid from public.klc_match_appearances a where a.id = (r->>'appearance_id')::uuid;
    return mid;
  end if;
  return null;
end $$;

create or replace function app.klc_enforce_submit_lock()
returns trigger language plpgsql as $$
declare
  mid uuid;
  st  text;
begin
  if tg_op = 'DELETE' then
    mid := app.klc_child_match_id(tg_table_name, to_jsonb(old));
  else
    mid := app.klc_child_match_id(tg_table_name, to_jsonb(new));
  end if;
  if mid is not null then
    select status into st from public.klc_matches where id = mid;
    if st = 'submitted' then
      raise exception 'match is submitted' using errcode = 'P0001';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

create or replace function app.klc_touch_parent_match()
returns trigger language plpgsql as $$
declare mid uuid;
begin
  if tg_op = 'DELETE' then
    mid := app.klc_child_match_id(tg_table_name, to_jsonb(old));
  else
    mid := app.klc_child_match_id(tg_table_name, to_jsonb(new));
  end if;
  if mid is not null then
    update public.klc_matches set updated_at = now() where id = mid;
  end if;
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['klc_match_halves','klc_match_sides','klc_match_appearances','klc_player_stats'] loop
    execute format(
      'create trigger %I before insert or update or delete on public.%I
         for each row execute function app.klc_enforce_submit_lock()',
      t || '_submit_lock', t);
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function app.klc_touch_parent_match()',
      t || '_touch_parent', t);
  end loop;
end $$;
```

Why a cascade delete of a submitted match still works: Postgres runs the FK cascade on the children *after* the parent row is deleted. By then the parent lookup finds no row (or the half or appearance is already gone), so `mid` is null and the trigger allows the delete. Task 5 tests this explicitly, because `e2e/helpers/db.ts` `deleteAllMatches()` relies on it.

- [ ] **Step 4: Apply locally and run the contract test**

```bash
npx supabase migration up
npx vitest run src/lib/klcsra/config-contract.test.ts
```

Expected: the migration applies with no errors, and the tests PASS. If `migration up` isn't available in this CLI version, run `npx supabase db reset` instead. That re-seeds local data, which is fine.

- [ ] **Step 5: Regenerate DB types**

```bash
npx supabase gen types typescript --local > src/lib/supabase/database.types.ts
git diff --stat src/lib/supabase/database.types.ts
```

Expected: the diff adds `created_by` to `klc_matches` Row/Insert/Update and the relationship. Nothing else of note changes.

---

## Task 5: DB trigger tests + commit the migration bead

**Files:**
- Create: `e2e/klcsra-triggers.spec.ts`

These run under Playwright because `e2e/helpers/db.ts` already has a local-Postgres `sql()` helper. They don't open a browser.

- [ ] **Step 1: Write the tests**

```ts
import { test, expect } from "@playwright/test";
import * as db from "./helpers/db";
import { seedPlayer } from "./helpers/auth";

/**
 * The submit lock and touch-parent triggers (migration 20261020120000).
 * SQL only; no browser. Local Supabase only.
 */

async function makeMatch(status: "draft" | "submitted") {
  const [c1, c2] = await db.listClubs(2);
  const player = await seedPlayer("user", "E2E Trigger Player");
  const [m] = await db.sql<{ id: string }>(
    `insert into klc_matches (entry_date, sport, is_friendly, status)
     values ('2026-08-23', 'football', true, 'draft') returning id`,
  );
  const [h] = await db.sql<{ id: string }>(
    `insert into klc_match_halves (match_id, half_no) values ($1, 1) returning id`, [m.id],
  );
  await db.sql(
    `insert into klc_match_sides (half_id, side, club_id, role) values ($1,'home',$2,'home'), ($1,'away',$3,'away')`,
    [h.id, c1.id, c2.id],
  );
  const [a] = await db.sql<{ id: string }>(
    `insert into klc_match_appearances (match_id, player_id, side, slot) values ($1,$2,'home',1) returning id`,
    [m.id, player.id],
  );
  await db.sql(
    `insert into klc_player_stats (appearance_id, half_no, stat_key, stat_count) values ($1,1,'goal',1)`,
    [a.id],
  );
  if (status === "submitted") {
    await db.sql(
      `update klc_matches set status='submitted', submitted_at=now() where id=$1`, [m.id],
    );
  }
  return { matchId: m.id, halfId: h.id, appearanceId: a.id };
}

test.beforeEach(async () => { await db.resetKlcsraData(); });
test.afterEach(async () => { await db.resetKlcsraData(); });

test("child writes on a submitted match are rejected", async () => {
  const { halfId, appearanceId } = await makeMatch("submitted");
  await expect(
    db.sql(`update klc_match_sides set score = 9 where half_id = $1`, [halfId]),
  ).rejects.toThrow(/match is submitted/);
  await expect(
    db.sql(`update klc_player_stats set stat_count = 5 where appearance_id = $1`, [appearanceId]),
  ).rejects.toThrow(/match is submitted/);
  await expect(
    db.sql(`delete from klc_match_appearances where id = $1`, [appearanceId]),
  ).rejects.toThrow(/match is submitted/);
});

test("child writes on a draft are allowed and bump updated_at", async () => {
  const { matchId, halfId } = await makeMatch("draft");
  await db.sql(`update klc_matches set updated_at = '2000-01-01' where id = $1`, [matchId]);
  await db.sql(`update klc_match_sides set score = 2 where half_id = $1 and side = 'home'`, [halfId]);
  const [row] = await db.sql<{ updated_at: string }>(
    `select updated_at::text from klc_matches where id = $1`, [matchId],
  );
  expect(row.updated_at.startsWith("2000")).toBe(false);
});

test("deleting a submitted match still cascades", async () => {
  const { matchId } = await makeMatch("submitted");
  await db.sql(`delete from klc_matches where id = $1`, [matchId]);
  const left = await db.sql(`select 1 from klc_match_halves where match_id = $1`, [matchId]);
  expect(left).toHaveLength(0);
});

test("reopen then edit works", async () => {
  const { matchId, halfId } = await makeMatch("submitted");
  await db.sql(
    `update klc_matches set status='draft', submitted_at=null, season_id=null where id=$1`, [matchId],
  );
  await db.sql(`update klc_match_sides set score = 4 where half_id = $1 and side='home'`, [halfId]);
});
```

Before running, check that `db.sql(text, params)` accepts a params array and that `seedPlayer(role, name)` returns `{ id }`. Open `e2e/helpers/db.ts:32` and `e2e/helpers/auth.ts:63`. If `sql` takes no params, add an optional `params?: unknown[]` and pass it to `client.query(text, params)`.

- [ ] **Step 2: Run**

```bash
npx playwright test e2e/klcsra-triggers.spec.ts
```

Expected: 4 passed.

- [ ] **Step 3: Run the unit suite, typecheck and lint**

```bash
npm run test && npx tsc --noEmit && npm run lint
```

Expected: all green.

- [ ] **Step 4: Commit** (closes the migration bead and Helper-0gr / Helper-r01)

```bash
git add -A supabase/migrations/20261020120000_klc_league_scoring.sql src/lib/klcsra src/lib/supabase/database.types.ts e2e/klcsra-triggers.spec.ts e2e/helpers "src/app/admin/klc/matches/[id]/recorder-header.tsx"
git commit -m "feat(klc): league scoring migration — 6 match types, rules v2, table groups, submit-lock + touch triggers

Bead: <migration-bead-id>. Closes Helper-0gr, Helper-r01.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
bd close <migration-bead-id> Helper-0gr Helper-r01
```

---

## Task 6: `computeMatchPoints` (`points.ts`)

**Files:**
- Create: `src/lib/klcsra/points.ts`
- Test: `src/lib/klcsra/points.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { computeMatchPoints } from "./points";
import { DEFAULT_STANDINGS_RULES as R } from "./standings-rules";
import { SPORTS, type Sport } from "./sport-stats";

const MAIN: Sport[] = ["football", "fooba", "rugby"];
const pts = (sport: Sport, totalPlayers: number, homeScore: number, awayScore: number) =>
  computeMatchPoints({ sport, totalPlayers, homeScore, awayScore }, R);

describe("computeMatchPoints", () => {
  it.each(SPORTS.map((s) => [s]))("%s: 7+ win/draw/loss", (sport) => {
    const win = MAIN.includes(sport as Sport) ? 5 : 3;
    expect(pts(sport as Sport, 12, 3, 1)).toEqual({ tier: "7plus", outcome: "home", home: win, away: 0 });
    expect(pts(sport as Sport, 7, 0, 2)).toEqual({ tier: "7plus", outcome: "away", home: 0, away: win });
    expect(pts(sport as Sport, 8, 2, 2)).toEqual({ tier: "7plus", outcome: "draw", home: 1, away: 1 });
  });

  it.each(SPORTS.map((s) => [s]))("%s: 4–6 win 1 / draw 0.2", (sport) => {
    expect(pts(sport as Sport, 6, 1, 0)).toMatchObject({ tier: "4to6", home: 1, away: 0 });
    expect(pts(sport as Sport, 4, 1, 1)).toMatchObject({ tier: "4to6", home: 0.2, away: 0.2 });
  });

  it.each(SPORTS.map((s) => [s]))("%s: 2–3 win 0.5 / draw 0.1", (sport) => {
    expect(pts(sport as Sport, 3, 0, 1)).toMatchObject({ tier: "2to3", home: 0, away: 0.5 });
    expect(pts(sport as Sport, 2, 0, 0)).toMatchObject({ tier: "2to3", home: 0.1, away: 0.1 });
  });

  it("fewer than 2 players: no tier, 0 points, result still decided", () => {
    expect(pts("football", 1, 2, 0)).toEqual({ tier: null, outcome: "home", home: 0, away: 0 });
  });

  it("a winning margin earns no bonus (v1 margin rule is gone)", () => {
    expect(pts("football", 12, 30, 0)).toMatchObject({ home: 5, away: 0 });
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/lib/klcsra/points.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
import { round4 } from "./round";
import type { Sport } from "./sport-stats";
import { tierFor, type StandingsRules, type TierKey } from "./standings-rules";

export type Outcome = "home" | "away" | "draw";

export interface MatchPointsInput {
  sport: Sport;
  /** Distinct players across both sides. */
  totalPlayers: number;
  homeScore: number;
  awayScore: number;
}

export interface MatchPoints {
  tier: TierKey | null;
  outcome: Outcome;
  home: number;
  away: number;
}

/**
 * Pure. League points for one result. Higher score wins; equal scores draw.
 * No tier (fewer than 2 players) scores 0 for both, but the result stands.
 * An unknown sport (unchecked DB text) scores as a multi-game variation.
 */
export function computeMatchPoints(input: MatchPointsInput, rules: StandingsRules): MatchPoints {
  const { sport, totalPlayers, homeScore, awayScore } = input;
  const outcome: Outcome =
    homeScore > awayScore ? "home" : homeScore < awayScore ? "away" : "draw";
  const tier = tierFor(totalPlayers, rules);
  if (tier === null) return { tier, outcome, home: 0, away: 0 };

  const win = (rules.win[sport] ?? rules.win.multi_game_variation)[tier];
  const draw = rules.draw[tier];
  const home = outcome === "home" ? win : outcome === "draw" ? draw : rules.loss;
  const away = outcome === "away" ? win : outcome === "draw" ? draw : rules.loss;
  return { tier, outcome, home: round4(home), away: round4(away) };
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `npx vitest run src/lib/klcsra/points.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/klcsra/points.ts src/lib/klcsra/points.test.ts
git commit -m "feat(klc): computeMatchPoints over rules v2

Bead: <rules-bead-id>.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
bd close <rules-bead-id>
```

---

## Task 7: League table (`league-table.ts`)

**Files:**
- Create: `src/lib/klcsra/league-table.ts`
- Test: `src/lib/klcsra/league-table.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  aggregateScores,
  buildLeagueTable,
  clubsOnSide,
  type LeagueMatch,
} from "./league-table";
import { DEFAULT_STANDINGS_RULES as R } from "./standings-rules";
import { DEFAULT_TABLE_GROUPS as G } from "./table-groups";
import type { Sport } from "./sport-stats";

const CLUBS = ["A", "B", "C", "D", "E"].map((id) => ({ id, name: `Club ${id}` }));

let n = 0;
function single(sport: Sport, home: string, hs: number, away: string, as: number, players = 12,
  extra: Partial<LeagueMatch> = {}): LeagueMatch {
  n += 1;
  return {
    id: `m${n}`, entryDate: "2026-10-18", sport, isCombined: false, isFriendly: false,
    totalPlayers: players,
    halves: [{ halfNo: 1, home: { clubId: home, score: hs }, away: { clubId: away, score: as } }],
    ...extra,
  };
}
const row = (rows: ReturnType<typeof buildLeagueTable>, id: string) => rows.find((r) => r.clubId === id)!;

describe("buildLeagueTable", () => {
  it("counts W/D/L, goals and points for a 7+ football win", () => {
    const t = buildLeagueTable([single("football", "A", 3, "B", 1)], "all", CLUBS, R, G);
    expect(row(t, "A")).toMatchObject({ P: 1, W: 1, D: 0, L: 0, GF: 3, GA: 1, TF: 0, TA: 0, Diff: 2, Pts: 5 });
    expect(row(t, "B")).toMatchObject({ P: 1, W: 0, L: 1, GF: 1, GA: 3, Diff: -2, Pts: 0 });
  });

  it("rugby scores go to tries, not goals", () => {
    const t = buildLeagueTable([single("rugby", "A", 2, "B", 2)], "all", CLUBS, R, G);
    expect(row(t, "A")).toMatchObject({ GF: 0, GA: 0, TF: 2, TA: 2, D: 1, Pts: 1 });
  });

  it("Diff combines goals and tries", () => {
    const t = buildLeagueTable(
      [single("football", "A", 2, "B", 0), single("rugby_variation", "B", 3, "A", 2)],
      "all", CLUBS, R, G,
    );
    expect(row(t, "A")).toMatchObject({ GF: 2, GA: 0, TF: 2, TA: 3, Diff: 1 });
  });

  it("filters by group and skips friendlies", () => {
    const ms = [
      single("football", "A", 1, "B", 0),
      single("rugby", "C", 1, "D", 0),
      single("football", "E", 1, "A", 0, 12, { isFriendly: true }),
    ];
    const foot = buildLeagueTable(ms, "football_fooba", CLUBS, R, G);
    expect(foot.map((r) => r.clubId).sort()).toEqual(["A", "B"]);
    const all = buildLeagueTable(ms, "all", CLUBS, R, G);
    expect(all.map((r) => r.clubId).sort()).toEqual(["A", "B", "C", "D"]);
  });

  it("multi-game variation counts in All only", () => {
    const ms = [single("multi_game_variation", "A", 1, "B", 0)];
    expect(buildLeagueTable(ms, "all", CLUBS, R, G)).toHaveLength(2);
    expect(buildLeagueTable(ms, "short_game_variations", CLUBS, R, G)).toHaveLength(0);
  });

  it("sorts by Pts, then Diff, then scored, then name", () => {
    const ms = [
      single("football", "A", 1, "E", 0),   // A 5 pts, diff +1, scored 1
      single("football", "B", 5, "E", 4),   // B 5 pts, diff +1, scored 5
      single("football", "C", 3, "E", 0),   // C 5 pts, diff +3
      single("football", "D", 1, "E", 0),   // D 5 pts, diff +1, scored 1 (ties A on all but name)
    ];
    const t = buildLeagueTable(ms, "all", CLUBS, R, G);
    expect(t.map((r) => r.clubId)).toEqual(["C", "B", "A", "D", "E"]);
  });

  it("combined match: one aggregate result, full points to every club", () => {
    const m: LeagueMatch = {
      id: "c1", entryDate: "2026-10-16", sport: "fooba", isCombined: true, isFriendly: false,
      totalPlayers: 12,
      halves: [
        { halfNo: 1, home: { clubId: "A", score: 2 }, away: { clubId: "C", score: 3 } },
        { halfNo: 2, home: { clubId: "B", score: 3 }, away: { clubId: "D", score: 0 } },
      ],
    };
    const t = buildLeagueTable([m], "all", CLUBS, R, G);
    for (const id of ["A", "B"]) {
      expect(row(t, id)).toMatchObject({ P: 1, W: 1, GF: 5, GA: 3, Pts: 5 });
    }
    for (const id of ["C", "D"]) {
      expect(row(t, id)).toMatchObject({ P: 1, L: 1, GF: 3, GA: 5, Pts: 0 });
    }
  });

  it("combined match: a club on the same side in both halves counts once", () => {
    const m: LeagueMatch = {
      id: "c2", entryDate: "2026-10-16", sport: "football", isCombined: true, isFriendly: false,
      totalPlayers: 12,
      halves: [
        { halfNo: 1, home: { clubId: "A", score: 1 }, away: { clubId: "C", score: 1 } },
        { halfNo: 2, home: { clubId: "A", score: 1 }, away: { clubId: "D", score: 1 } },
      ],
    };
    const t = buildLeagueTable([m], "all", CLUBS, R, G);
    expect(row(t, "A")).toMatchObject({ P: 1, D: 1, GF: 2, GA: 2, Pts: 1 });
  });

  it("uses the tier from total players", () => {
    const t = buildLeagueTable([single("football", "A", 1, "B", 0, 5)], "all", CLUBS, R, G);
    expect(row(t, "A").Pts).toBe(1);
  });

  it("names an unknown club rather than crashing", () => {
    const t = buildLeagueTable([single("football", "Z", 1, "A", 0)], "all", CLUBS, R, G);
    expect(row(t, "Z").clubName).toBe("Unknown club");
  });
});

describe("helpers", () => {
  it("aggregateScores sums each side over halves", () => {
    const m = single("football", "A", 2, "B", 1);
    expect(aggregateScores(m)).toEqual({ home: 2, away: 1 });
  });
  it("clubsOnSide is distinct, in half order", () => {
    const m: LeagueMatch = {
      ...single("football", "A", 0, "B", 0),
      halves: [
        { halfNo: 1, home: { clubId: "A", score: 0 }, away: { clubId: "B", score: 0 } },
        { halfNo: 2, home: { clubId: "C", score: 0 }, away: { clubId: "B", score: 0 } },
      ],
    };
    expect(clubsOnSide(m, "home")).toEqual(["A", "C"]);
    expect(clubsOnSide(m, "away")).toEqual(["B"]);
  });
});
```

Check the sort test: A and D are identical apart from the name, so "Club A" comes before "Club D". E has 4 losses (0 pts) and comes last.

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/lib/klcsra/league-table.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
/**
 * Pure. League tables, derived on read from submitted matches.
 *
 * `home` / `away` are the AGGREGATE-TEAM SLOTS (`klc_match_sides.side`), not
 * the venue role. A combined match is ONE result between the two slots,
 * decided by the aggregate over both halves; every distinct club that led a
 * slot gets that slot's result and full points (KFANDRA, 2026-10-20).
 */
import { computeMatchPoints, type MatchPoints } from "./points";
import { round4 } from "./round";
import { TRY_SPORTS, type Sport } from "./sport-stats";
import type { StandingsRules } from "./standings-rules";
import { sportInGroup, type TableGroups } from "./table-groups";
import type { SideKey } from "./types";

export interface LeagueSide { clubId: string; score: number }
export interface LeagueHalf { halfNo: number; home: LeagueSide; away: LeagueSide }

export interface LeagueMatch {
  id: string;
  entryDate: string;
  sport: Sport;
  isCombined: boolean;
  isFriendly: boolean;
  /** Distinct players across both sides. */
  totalPlayers: number;
  /** Only halves with a club on both sides. */
  halves: LeagueHalf[];
}

export interface ClubRef { id: string; name: string }

export interface TableRow {
  clubId: string;
  clubName: string;
  P: number; W: number; D: number; L: number;
  GF: number; GA: number; TF: number; TA: number;
  Diff: number;
  Pts: number;
}

export function aggregateScores(m: LeagueMatch): { home: number; away: number } {
  let home = 0;
  let away = 0;
  for (const h of m.halves) {
    home += h.home.score;
    away += h.away.score;
  }
  return { home, away };
}

/** Distinct clubs that led a slot, in half order. */
export function clubsOnSide(m: LeagueMatch, side: SideKey): string[] {
  const ids: string[] = [];
  for (const h of m.halves) {
    const id = h[side].clubId;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function scoreMatch(m: LeagueMatch, rules: StandingsRules): MatchPoints {
  const { home, away } = aggregateScores(m);
  return computeMatchPoints(
    { sport: m.sport, totalPlayers: m.totalPlayers, homeScore: home, awayScore: away },
    rules,
  );
}

function compareRows(a: TableRow, b: TableRow): number {
  return (
    b.Pts - a.Pts ||
    b.Diff - a.Diff ||
    b.GF + b.TF - (a.GF + a.TF) ||
    a.clubName.localeCompare(b.clubName)
  );
}

export function buildLeagueTable(
  matches: LeagueMatch[],
  groupKey: string,
  clubs: ClubRef[],
  rules: StandingsRules,
  groups: TableGroups,
): TableRow[] {
  const names = new Map(clubs.map((c) => [c.id, c.name]));
  const rows = new Map<string, TableRow>();
  const rowFor = (clubId: string): TableRow => {
    let r = rows.get(clubId);
    if (!r) {
      r = {
        clubId, clubName: names.get(clubId) ?? "Unknown club",
        P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, TF: 0, TA: 0, Diff: 0, Pts: 0,
      };
      rows.set(clubId, r);
    }
    return r;
  };

  for (const m of matches) {
    if (m.isFriendly || m.halves.length === 0) continue;
    if (!sportInGroup(m.sport, groupKey, groups)) continue;

    const pts = scoreMatch(m, rules);
    const agg = aggregateScores(m);
    const tries = TRY_SPORTS.has(m.sport);

    for (const side of ["home", "away"] as const) {
      const scored = side === "home" ? agg.home : agg.away;
      const conceded = side === "home" ? agg.away : agg.home;
      const result = pts.outcome === "draw" ? "D" : pts.outcome === side ? "W" : "L";
      for (const clubId of clubsOnSide(m, side)) {
        const r = rowFor(clubId);
        r.P += 1;
        r[result] += 1;
        if (tries) {
          r.TF += scored;
          r.TA += conceded;
        } else {
          r.GF += scored;
          r.GA += conceded;
        }
        r.Pts = round4(r.Pts + pts[side]);
      }
    }
  }

  for (const r of rows.values()) r.Diff = r.GF + r.TF - (r.GA + r.TA);
  return [...rows.values()].sort(compareRows);
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `npx vitest run src/lib/klcsra/league-table.test.ts`
Expected: PASS.

---

## Task 8: Adapters from `MatchDraft` (`league-data.ts`) + types

**Files:**
- Modify: `src/lib/klcsra/types.ts`
- Create: `src/lib/klcsra/league-data.ts`
- Test: `src/lib/klcsra/league-data.test.ts`

- [ ] **Step 1: Extend the types**

In `src/lib/klcsra/types.ts`:
- In `MatchDraft`, after `seasonId: string | null; seasonName: string | null;`, add:
  ```ts
    /** Who created the draft; null for matches created before 2026-10-20. */
    createdBy: string | null;
  ```
- In `MatchSummary`, after `status: MatchStatus; seasonName: string | null;`, add:
  ```ts
    createdBy: string | null;
    /** Every club on any side of any half. */
    clubIds: string[];
  ```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { sideClubLabel, toLeagueMatch, toStatRows } from "./league-data";
import type { MatchDraft } from "./types";

const draft = (over: Partial<MatchDraft> = {}): MatchDraft => ({
  id: "m1", entryDate: "2026-10-18", sport: "fooba",
  isFriendly: false, isCombined: true, durationMinutes: null,
  status: "submitted", submittedAt: "2026-10-18T10:00:00Z",
  seasonId: "s2", seasonName: "KLCFERRSXVSG2", createdBy: null,
  halves: [
    { id: "h1", halfNo: 1, sides: [
      { id: "s1", side: "home", clubId: "A", clubName: "Club A", score: 2 },
      { id: "s2", side: "away", clubId: "C", clubName: "Club C", score: 1 },
    ] },
    { id: "h2", halfNo: 2, sides: [
      { id: "s3", side: "home", clubId: "B", clubName: "Club B", score: 1 },
    ] },
  ],
  appearances: [
    { id: "a1", playerId: "p1", displayName: "Jake", side: "home", slot: 1,
      stats: { 1: { mainGoal: 2 }, 2: { assist: 1, mainGoal: 0 } } },
    { id: "a2", playerId: "p2", displayName: "Mkul", side: "away", slot: 1, stats: {} },
  ],
  ...over,
});

describe("toLeagueMatch", () => {
  it("keeps only halves with both sides, counts distinct players", () => {
    const m = toLeagueMatch(draft());
    expect(m.halves).toEqual([
      { halfNo: 1, home: { clubId: "A", score: 2 }, away: { clubId: "C", score: 1 } },
    ]);
    expect(m.totalPlayers).toBe(2);
    expect(m).toMatchObject({ id: "m1", sport: "fooba", isCombined: true, isFriendly: false });
  });
});

describe("toStatRows", () => {
  it("emits one row per non-zero stat, with the club of that half's side", () => {
    expect(toStatRows(draft())).toEqual([
      { matchId: "m1", entryDate: "2026-10-18", playerId: "p1", displayName: "Jake",
        clubName: "Club A", sport: "fooba", isFriendly: false, statKey: "mainGoal", count: 2 },
      { matchId: "m1", entryDate: "2026-10-18", playerId: "p1", displayName: "Jake",
        clubName: "Club B", sport: "fooba", isFriendly: false, statKey: "assist", count: 1 },
    ]);
  });
});

describe("sideClubLabel", () => {
  it("joins distinct club names on a side with +", () => {
    expect(sideClubLabel(draft(), "home")).toBe("Club A + Club B");
    expect(sideClubLabel(draft(), "away")).toBe("Club C");
  });
});
```

- [ ] **Step 3: Run, expect FAIL**

Run: `npx vitest run src/lib/klcsra/league-data.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement**

`StatRow` is defined here and imported by `leaderboards.ts` (Task 9).

```ts
/**
 * Pure adapters from the recorder's MatchDraft to the league read model.
 * No DB/server imports, so the recorder (a Client Component) can use them
 * for the submit-panel points preview.
 */
import type { LeagueHalf, LeagueMatch } from "./league-table";
import type { Sport } from "./sport-stats";
import type { StatKey } from "./stat-rates";
import type { MatchDraft, SideKey } from "./types";

export interface StatRow {
  matchId: string;
  entryDate: string;
  playerId: string;
  displayName: string;
  /** Club that led the player's side in the half the stat was recorded in. */
  clubName: string | null;
  sport: Sport;
  isFriendly: boolean;
  statKey: StatKey;
  count: number;
}

export function toLeagueMatch(d: MatchDraft): LeagueMatch {
  const halves: LeagueHalf[] = [];
  for (const h of d.halves) {
    const home = h.sides.find((s) => s.side === "home");
    const away = h.sides.find((s) => s.side === "away");
    if (!home?.clubId || !away?.clubId) continue;
    halves.push({
      halfNo: h.halfNo,
      home: { clubId: home.clubId, score: home.score },
      away: { clubId: away.clubId, score: away.score },
    });
  }
  return {
    id: d.id,
    entryDate: d.entryDate,
    sport: d.sport,
    isCombined: d.isCombined,
    isFriendly: d.isFriendly,
    totalPlayers: new Set(d.appearances.map((a) => a.playerId)).size,
    halves,
  };
}

export function toStatRows(d: MatchDraft): StatRow[] {
  const rows: StatRow[] = [];
  for (const a of d.appearances) {
    for (const [halfNo, stats] of Object.entries(a.stats)) {
      const half = d.halves.find((h) => h.halfNo === Number(halfNo));
      const clubName = half?.sides.find((s) => s.side === a.side)?.clubName ?? null;
      for (const [statKey, count] of Object.entries(stats)) {
        if (!count) continue;
        rows.push({
          matchId: d.id, entryDate: d.entryDate,
          playerId: a.playerId, displayName: a.displayName, clubName,
          sport: d.sport, isFriendly: d.isFriendly,
          statKey: statKey as StatKey, count,
        });
      }
    }
  }
  return rows;
}

/** "Club A + Club B": every distinct club that led a side, in half order. */
export function sideClubLabel(d: MatchDraft, side: SideKey): string {
  const names: string[] = [];
  for (const h of d.halves) {
    const name = h.sides.find((s) => s.side === side)?.clubName;
    if (name && !names.includes(name)) names.push(name);
  }
  return names.length > 0 ? names.join(" + ") : "TBD";
}
```

- [ ] **Step 5: Run, expect PASS; then fix the type errors**

Run: `npx vitest run src/lib/klcsra/league-data.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: errors in `repository.ts` (`createdBy` / `clubIds` missing). Task 10 fixes them. Don't commit until Step 6.

- [ ] **Step 6: Patch the repository so it compiles** (the rest of the repository work is in Task 10)

In `src/lib/klcsra/repository.ts`:
- `listMatches()`:
  - Add `created_by,` to the select (after `status,`).
  - In the returned object, add:
    ```ts
          createdBy: m.created_by,
          clubIds: [...new Set(halves.flatMap((h) => h.sides.map((s) => s.clubId)))]
            .filter((id): id is string => id !== null),
    ```
- `getMatch()`:
  - Add `created_by,` to the select (after `season_id,`).
  - Add `createdBy: data.created_by,` to the returned object.

Run: `npx tsc --noEmit && npm run test`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/klcsra
git commit -m "feat(klc): league table aggregation, groups and MatchDraft adapters

Bead: <table-bead-id>.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
bd close <table-bead-id>
```

---

## Task 9: Leaderboards (`leaderboards.ts`)

**Files:**
- Create: `src/lib/klcsra/leaderboards.ts`
- Test: `src/lib/klcsra/leaderboards.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { BOARDS, buildLeaderboards, LEADERBOARD_SIZE } from "./leaderboards";
import type { StatRow } from "./league-data";
import { DEFAULT_STAT_RATES as RATES, type StatKey } from "./stat-rates";
import { DEFAULT_SPORT_STATS as SS, type Sport } from "./sport-stats";
import { DEFAULT_TABLE_GROUPS as G } from "./table-groups";

function r(playerId: string, statKey: StatKey, count: number, over: Partial<StatRow> = {}): StatRow {
  return {
    matchId: "m", entryDate: "2026-10-18", playerId, displayName: playerId.toUpperCase(),
    clubName: "Club", sport: "football" as Sport, isFriendly: false, statKey, count, ...over,
  };
}
const board = (rows: StatRow[], key: string, group = "all") =>
  buildLeaderboards(rows, group, G, RATES, SS).find((b) => b.key === key);

describe("BOARDS", () => {
  it("are the 9 boards in display order", () => {
    expect(BOARDS.map((b) => b.key)).toEqual([
      "goals", "tries", "assists", "preAssists", "saves", "tackles", "discipline", "kroopies", "mmg",
    ]);
  });
});

describe("buildLeaderboards", () => {
  it("Goals sums goal + mainGoal + reboundGoal, not own goals", () => {
    const rows = [
      r("a", "goal", 1),
      r("a", "mainGoal", 2, { sport: "fooba" }),
      r("a", "reboundGoal", 1, { sport: "fooba" }),
      r("a", "ownGoal", 3),
    ];
    expect(board(rows, "goals")!.entries).toEqual([
      { rank: 1, playerId: "a", name: "A", club: "Club", value: 4 },
    ]);
  });

  it("Discipline sums all four sanctions", () => {
    const rows = [r("a", "yellowCard", 1), r("a", "redCard", 1), r("a", "blueCard", 1), r("a", "lateChallenge", 2)];
    expect(board(rows, "discipline")!.entries[0].value).toBe(5);
  });

  it("friendlies count only on MMG", () => {
    const rows = [r("a", "goal", 1, { isFriendly: true })];
    expect(board(rows, "goals")).toBeUndefined();
    expect(board(rows, "kroopies")).toBeUndefined();
    expect(board(rows, "mmg")!.entries[0].value).toBe(RATES.goal.mmg);
  });

  it("Kroopies ignore stats the sport doesn't allow", () => {
    // football does not allow `try`
    const rows = [r("a", "goal", 1), r("a", "try", 1)];
    expect(board(rows, "kroopies")!.entries[0].value).toBe(RATES.goal.kr);
  });

  it("filters by group", () => {
    const rows = [r("a", "try", 2, { sport: "rugby" }), r("b", "goal", 1)];
    expect(board(rows, "tries", "rugby_sox")!.entries.map((e) => e.playerId)).toEqual(["a"]);
    expect(board(rows, "goals", "rugby_sox")).toBeUndefined();
  });

  it("ties share a rank (1, 2, 2, 4) and the list stops at 10", () => {
    const rows = [
      r("a", "goal", 5), r("b", "goal", 3), r("c", "goal", 3), r("d", "goal", 1),
      ...Array.from({ length: 12 }, (_, i) => r(`z${i}`, "goal", 1)),
    ];
    const e = board(rows, "goals")!.entries;
    expect(e.slice(0, 4).map((x) => x.rank)).toEqual([1, 2, 2, 4]);
    expect(e).toHaveLength(LEADERBOARD_SIZE);
  });

  it("shows the club from the player's most recent match", () => {
    const rows = [
      r("a", "goal", 1, { entryDate: "2026-10-01", clubName: "Old" }),
      r("a", "goal", 1, { entryDate: "2026-10-18", clubName: "New" }),
    ];
    expect(board(rows, "goals")!.entries[0].club).toBe("New");
  });

  it("omits empty boards", () => {
    expect(buildLeaderboards([], "all", G, RATES, SS)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/lib/klcsra/leaderboards.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
/**
 * Pure. Season leaderboards from per-half stat rows.
 *
 * Only positive totals are listed: these are leader boards. Friendlies are
 * excluded everywhere except MMG (Q8). Kroopies/MMG apply the same per-sport
 * allow-list as the payout compute, so a board never disagrees with a payout.
 */
import type { StatRow } from "./league-data";
import { round4 } from "./round";
import { statsForSport, type Sport, type SportStats } from "./sport-stats";
import type { StatKey, StatRates } from "./stat-rates";
import { sportInGroup, type TableGroups } from "./table-groups";

export const LEADERBOARD_SIZE = 10;

export type BoardKey =
  | "goals" | "tries" | "assists" | "preAssists" | "saves" | "tackles"
  | "discipline" | "kroopies" | "mmg";

type Allowed = (sport: Sport) => ReadonlySet<StatKey>;

interface BoardDef {
  key: BoardKey;
  label: string;
  includeFriendlies: boolean;
  value: (row: StatRow, rates: StatRates, allowed: Allowed) => number;
}

const tally = (keys: StatKey[]) => (row: StatRow) => (keys.includes(row.statKey) ? row.count : 0);

export const BOARDS: readonly BoardDef[] = [
  { key: "goals", label: "Goals", includeFriendlies: false, value: tally(["goal", "mainGoal", "reboundGoal"]) },
  { key: "tries", label: "Tries", includeFriendlies: false, value: tally(["try"]) },
  { key: "assists", label: "Assists", includeFriendlies: false, value: tally(["assist"]) },
  { key: "preAssists", label: "Pre-assists", includeFriendlies: false, value: tally(["preAssist"]) },
  { key: "saves", label: "Saves", includeFriendlies: false, value: tally(["save"]) },
  { key: "tackles", label: "Tackles", includeFriendlies: false, value: tally(["tackle"]) },
  {
    key: "discipline", label: "Discipline", includeFriendlies: false,
    value: tally(["yellowCard", "redCard", "blueCard", "lateChallenge"]),
  },
  {
    key: "kroopies", label: "Kroopies", includeFriendlies: false,
    value: (row, rates, allowed) =>
      allowed(row.sport).has(row.statKey) ? row.count * rates[row.statKey].kr : 0,
  },
  {
    key: "mmg", label: "MMG", includeFriendlies: true,
    value: (row, rates, allowed) =>
      allowed(row.sport).has(row.statKey) ? row.count * rates[row.statKey].mmg : 0,
  },
];

export interface LeaderEntry {
  rank: number;
  playerId: string;
  name: string;
  club: string | null;
  value: number;
}

export interface Board {
  key: BoardKey;
  label: string;
  entries: LeaderEntry[];
}

export function buildLeaderboards(
  rows: StatRow[],
  groupKey: string,
  groups: TableGroups,
  rates: StatRates,
  sportStats: SportStats,
): Board[] {
  const allowCache = new Map<Sport, ReadonlySet<StatKey>>();
  const allowed: Allowed = (sport) => {
    let s = allowCache.get(sport);
    if (!s) {
      s = new Set(statsForSport(sport, sportStats));
      allowCache.set(sport, s);
    }
    return s;
  };

  const inGroup = rows.filter((r) => sportInGroup(r.sport, groupKey, groups));

  // Name + the club from each player's most recent match.
  const who = new Map<string, { name: string; club: string | null; date: string }>();
  for (const r of inGroup) {
    const cur = who.get(r.playerId);
    if (!cur || r.entryDate >= cur.date) {
      who.set(r.playerId, { name: r.displayName, club: r.clubName, date: r.entryDate });
    }
  }

  const boards: Board[] = [];
  for (const def of BOARDS) {
    const totals = new Map<string, number>();
    for (const r of inGroup) {
      if (r.isFriendly && !def.includeFriendlies) continue;
      const v = def.value(r, rates, allowed);
      if (v !== 0) totals.set(r.playerId, (totals.get(r.playerId) ?? 0) + v);
    }

    const sorted = [...totals]
      .map(([playerId, v]) => ({ playerId, value: round4(v), name: who.get(playerId)?.name ?? "" }))
      .filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
      .slice(0, LEADERBOARD_SIZE);
    if (sorted.length === 0) continue;

    const entries: LeaderEntry[] = [];
    sorted.forEach((e, i) => {
      const prev = entries[i - 1];
      entries.push({
        rank: prev && prev.value === e.value ? prev.rank : i + 1,
        playerId: e.playerId,
        name: e.name,
        club: who.get(e.playerId)?.club ?? null,
        value: e.value,
      });
    });
    boards.push({ key: def.key, label: def.label, entries });
  }
  return boards;
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `npx vitest run src/lib/klcsra/leaderboards.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/klcsra/leaderboards.ts src/lib/klcsra/leaderboards.test.ts
git commit -m "feat(klc): season leaderboards

Bead: <leaderboards-bead-id>.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
bd close <leaderboards-bead-id>
```

---

## Task 10: Repository reads and writes for managers + league

**Files:**
- Modify: `src/lib/klcsra/repository.ts`

There are no unit tests here: the repository is plain persistence, and this repo doesn't unit-test it. Tasks 13 and 16 exercise it end to end.

- [ ] **Step 1: Extract `toMatchDraft` so `getMatch` and the league read share it**

In `src/lib/klcsra/repository.ts`, above `getMatch`, add:

```ts
const MATCH_DRAFT_COLS = `id, entry_date, sport, is_friendly, is_combined, duration_minutes,
   status, submitted_at, season_id, created_by,
   klc_seasons(name),
   klc_match_halves(id, half_no,
     klc_match_sides(id, side, score, club_id, clubs(name))),
   klc_match_appearances(id, player_id, side, slot,
     players(display_name),
     klc_player_stats(half_no, stat_key, stat_count))`;

interface MatchDraftRow {
  id: string; entry_date: string; sport: string;
  is_friendly: boolean; is_combined: boolean; duration_minutes: number | null;
  status: string; submitted_at: string | null; season_id: string | null;
  created_by: string | null;
  klc_seasons: unknown; klc_match_halves: unknown; klc_match_appearances: unknown;
}

function toMatchDraft(data: MatchDraftRow): MatchDraft {
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
    seasonId: data.season_id,
    seasonName: one(data.klc_seasons as ToOne<{ name: string }>)?.name ?? null,
    createdBy: data.created_by,
    halves: toHalfDrafts(data.klc_match_halves as HalfRow[] | null),
    appearances,
  };
}
```

Replace the body of `getMatch` with:

```ts
  const admin = createAdminClient();
  const { data } = await admin
    .from("klc_matches")
    .select(MATCH_DRAFT_COLS)
    .eq("id", matchId)
    .maybeSingle();
  return data ? toMatchDraft(data as MatchDraftRow) : null;
```

Export `MATCH_DRAFT_COLS`, `MatchDraftRow` and `toMatchDraft` (add `export`), because `league-repository.ts` reuses them.

- [ ] **Step 2: Create `src/lib/klcsra/league-repository.ts` with `listSubmittedMatchDrafts`, TDD**

First write `src/lib/klcsra/league-repository.test.ts`. It's the repo's first Supabase-mocking test, so keep the fake small and explicit:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

/** Records every chained call per query; resolves to { data: [], error: null }. */
const queries: { calls: [string, unknown[]][] }[] = [];
function fakeQuery() {
  const q = { calls: [] as [string, unknown[]][] };
  queries.push(q);
  const proxy: Record<string, unknown> = new Proxy({}, {
    get(_t, prop: string) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve({ data: [], error: null });
      }
      return (...args: unknown[]) => { q.calls.push([prop, args]); return proxy; };
    },
  });
  return proxy;
}
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: () => fakeQuery() }),
}));

import { listSubmittedMatchDrafts } from "./league-repository";
import type { Season } from "./types";

const season = (endDate: string | null): Season => ({
  id: "s2", seasonNo: 2, name: "S2", startDate: "2026-08-22", endDate, status: "active",
});
const hasCall = (q: { calls: [string, unknown[]][] }, name: string, ...args: unknown[]) =>
  q.calls.some(([n, a]) => n === name && JSON.stringify(a) === JSON.stringify(args));

beforeEach(() => { queries.length = 0; });

describe("listSubmittedMatchDrafts", () => {
  it("every query filters status = submitted", async () => {
    await listSubmittedMatchDrafts(season(null));
    expect(queries).toHaveLength(2);
    for (const q of queries) expect(hasCall(q, "eq", "status", "submitted")).toBe(true);
  });

  it("league query is by season; friendly query is by date window", async () => {
    await listSubmittedMatchDrafts(season("2026-12-31"));
    const [league, friendlies] = queries;
    expect(hasCall(league, "eq", "season_id", "s2")).toBe(true);
    expect(hasCall(friendlies, "eq", "is_friendly", true)).toBe(true);
    expect(hasCall(friendlies, "gte", "entry_date", "2026-08-22")).toBe(true);
    expect(hasCall(friendlies, "lte", "entry_date", "2026-12-31")).toBe(true);
  });

  it("an open season has no upper date bound", async () => {
    await listSubmittedMatchDrafts(season(null));
    expect(queries[1].calls.some(([n]) => n === "lte")).toBe(false);
  });
});
```

Run `npx vitest run src/lib/klcsra/league-repository.test.ts`. Expected: FAIL (module not found).

Then create `src/lib/klcsra/league-repository.ts`:

```ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { MATCH_DRAFT_COLS, toMatchDraft, type MatchDraftRow } from "./repository";
import type { MatchDraft, Season } from "./types";

/**
 * Read model for the public KLC League page. Server-only, service role.
 *
 * THE public-read guarantee (closes Helper-h9i): every query here filters
 * `status = 'submitted'`, so drafts never reach /klc/league. The unit test
 * asserts the filter on each query. Nothing else may read for the league page.
 */
```

Its single export, `listSubmittedMatchDrafts`, is the function below. Run the test again. Expected: PASS.

```ts
/**
 * The league read model's ONLY source: submitted matches for one season.
 * League matches are tagged with the season; friendlies carry no season, so
 * they are taken by date inside the season's window (they feed the MMG board
 * only). Every query filters `status = 'submitted'`: this is what keeps drafts
 * off the public league page. Newest first.
 */
export async function listSubmittedMatchDrafts(season: Season): Promise<MatchDraft[]> {
  const admin = createAdminClient();
  const league = admin
    .from("klc_matches")
    .select(MATCH_DRAFT_COLS)
    .eq("status", "submitted")
    .eq("season_id", season.id);
  let friendlies = admin
    .from("klc_matches")
    .select(MATCH_DRAFT_COLS)
    .eq("status", "submitted")
    .eq("is_friendly", true)
    .gte("entry_date", season.startDate);
  if (season.endDate) friendlies = friendlies.lte("entry_date", season.endDate);

  const [l, f] = await Promise.all([league, friendlies]);
  if (l.error) throw new Error(`Failed to load league matches: ${l.error.message}`);
  if (f.error) throw new Error(`Failed to load friendlies: ${f.error.message}`);
  return [...(l.data ?? []), ...(f.data ?? [])]
    .map((row) => toMatchDraft(row as MatchDraftRow))
    .sort((a, b) => b.entryDate.localeCompare(a.entryDate));
}
```

- [ ] **Step 3: Add `listManagedClubIds`** (after `listClubs`)

```ts
/** Clubs whose `manager_player_id` is this player. */
export async function listManagedClubIds(playerId: string): Promise<Set<string>> {
  const admin = createAdminClient();
  const { data } = await admin.from("clubs").select("id").eq("manager_player_id", playerId);
  return new Set((data ?? []).map((c) => c.id));
}
```

- [ ] **Step 4: Create with `created_by` and an optional half-1 home club**

Replace `CreateMatchInput` and `createMatch` with:

```ts
export interface CreateMatchInput {
  entryDate: string;
  sport: Sport;
  isCombined: boolean;
  isFriendly: boolean;
  createdBy: string | null;
  /** Created as half 1's home side when given (a manager's own club). */
  homeClubId: string | null;
}

/**
 * Create a draft match and its half rows (1, or 1 and 2 when combined), plus
 * half 1's home side when `homeClubId` is given.
 *
 * Other side rows are NOT created here: `klc_match_sides.club_id` is NOT NULL,
 * so an empty side is unrepresentable. `setSideClub` creates them.
 *
 * @returns the new match id.
 */
export async function createMatch(input: CreateMatchInput): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("klc_matches")
    .insert({
      entry_date: input.entryDate,
      sport: input.sport,
      is_combined: input.isCombined,
      is_friendly: input.isFriendly,
      status: "draft",
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to create match: ${error.message}`);

  const halfNos = input.isCombined ? [1, 2] : [1];
  const { data: halves, error: halvesErr } = await admin
    .from("klc_match_halves")
    .insert(halfNos.map((half_no) => ({ match_id: data.id, half_no })))
    .select("id, half_no");
  if (halvesErr) {
    // Leave no half-built match behind.
    await admin.from("klc_matches").delete().eq("id", data.id);
    throw new Error(`Failed to create match halves: ${halvesErr.message}`);
  }

  if (input.homeClubId) {
    const first = halves?.find((h) => h.half_no === 1);
    const { error: sideErr } = first
      ? await admin.from("klc_match_sides").insert({
          half_id: first.id, side: "home", club_id: input.homeClubId, role: "home",
        })
      : { error: { message: "half 1 was not returned" } };
    if (sideErr) {
      await admin.from("klc_matches").delete().eq("id", data.id);
      throw new Error(`Failed to set your club: ${sideErr.message}`);
    }
  }
  return data.id;
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: one error in `actions.ts`, where `createMatch` is missing `createdBy` and `homeClubId`. Task 11 fixes it. Don't commit yet.

---

## Task 11: Access rule (`access.ts`) + actions

**Files:**
- Create: `src/lib/klcsra/access.ts`
- Test: `src/lib/klcsra/access.test.ts`
- Modify: `src/lib/klcsra/actions.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { canEditMatch, canRecordMatches, canReopenMatch, matchClubIds } from "./access";

const none = new Set<string>();
const managesA = new Set(["A"]);
const match = { createdBy: "creator", clubIds: ["A", "B"] };

describe("canEditMatch", () => {
  it("staff can edit any draft", () => {
    for (const role of ["super_admin", "kfandra", "admin"] as const) {
      expect(canEditMatch({ id: "x", role }, match, none)).toBe(true);
    }
  });
  it("the creator can edit", () => {
    expect(canEditMatch({ id: "creator", role: "user" }, match, none)).toBe(true);
  });
  it("the manager of a club on either side can edit", () => {
    expect(canEditMatch({ id: "m", role: "user" }, match, managesA)).toBe(true);
    expect(canEditMatch({ id: "m", role: "user" }, { createdBy: null, clubIds: ["C", "A"] }, managesA)).toBe(true);
  });
  it("an unrelated manager or a plain player cannot", () => {
    expect(canEditMatch({ id: "m", role: "user" }, { createdBy: null, clubIds: ["C", "D"] }, managesA)).toBe(false);
    expect(canEditMatch({ id: "p", role: "user" }, match, none)).toBe(false);
  });
});

describe("canRecordMatches", () => {
  it("staff or anyone managing a club", () => {
    expect(canRecordMatches({ id: "x", role: "admin" }, none)).toBe(true);
    expect(canRecordMatches({ id: "m", role: "user" }, managesA)).toBe(true);
    expect(canRecordMatches({ id: "p", role: "user" }, none)).toBe(false);
  });
});

describe("canReopenMatch", () => {
  it("only KFANDRA and super_admin", () => {
    expect(canReopenMatch({ id: "x", role: "kfandra" })).toBe(true);
    expect(canReopenMatch({ id: "x", role: "super_admin" })).toBe(true);
    expect(canReopenMatch({ id: "x", role: "admin" })).toBe(false);
  });
});

describe("matchClubIds", () => {
  it("collects distinct non-null club ids across halves", () => {
    expect(matchClubIds([
      { sides: [{ clubId: "A" }, { clubId: "B" }] },
      { sides: [{ clubId: "A" }, { clubId: null }] },
    ])).toEqual(["A", "B"]);
  });
});
```

Before writing this, check the role names in `src/lib/auth/current-user.ts`, which defines the `role` union. If the plain-player role isn't `"user"`, use the real name.

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/lib/klcsra/access.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `access.ts`**

```ts
/**
 * Pure. Who may record and edit KLC matches (design §5.1).
 *
 * Staff edit any draft. A club manager edits a draft they created, or one in
 * which any club they manage leads a side ("anyone involved can edit",
 * decided 2026-10-20). Only KFANDRA / super_admin reopen a submitted match.
 */
import { isStaffRole, type Role } from "@/lib/auth/roles";

export interface Viewer {
  id: string;
  role: Role;
}

export interface MatchOwnership {
  createdBy: string | null;
  clubIds: readonly string[];
}

export function canRecordMatches(viewer: Viewer, managed: ReadonlySet<string>): boolean {
  return isStaffRole(viewer.role) || managed.size > 0;
}

export function canEditMatch(
  viewer: Viewer,
  match: MatchOwnership,
  managed: ReadonlySet<string>,
): boolean {
  if (isStaffRole(viewer.role)) return true;
  if (match.createdBy !== null && match.createdBy === viewer.id) return true;
  return match.clubIds.some((id) => managed.has(id));
}

export function canReopenMatch(viewer: Viewer): boolean {
  return viewer.role === "super_admin" || viewer.role === "kfandra";
}

export function matchClubIds(halves: { sides: { clubId: string | null }[] }[]): string[] {
  const ids: string[] = [];
  for (const h of halves) {
    for (const s of h.sides) {
      if (s.clubId !== null && !ids.includes(s.clubId)) ids.push(s.clubId);
    }
  }
  return ids;
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `npx vitest run src/lib/klcsra/access.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire it into `actions.ts`**

1. Imports: add
   ```ts
   import { canEditMatch, canReopenMatch, matchClubIds } from "./access";
   ```
2. Constants:
   - Change `const MATCHES_PATH = "/admin/klc/matches";` to `const MATCHES_PATH = "/klc/matches";`.
   - Add `const LEAGUE_PATH = "/klc/league";`.
3. In `revalidateMatch`, add `revalidatePath(LEAGUE_PATH);`.
4. Replace `requireEditableMatch` with these two functions:

```ts
/**
 * Signed in + the match exists + the caller may edit it: staff, the draft's
 * creator, or the manager of any club on it (design §5.1).
 */
async function requireMatchEditor(
  matchId: string,
): Promise<ActionResult<{ player: CurrentPlayer; match: MatchDraft }>> {
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };
  const match = await repo.getMatch(matchId);
  if (!match) return { ok: false, error: NO_MATCH };
  if (!isStaffRole(player.role)) {
    const managed = await repo.listManagedClubIds(player.id);
    const ownership = { createdBy: match.createdBy, clubIds: matchClubIds(match.halves) };
    if (!canEditMatch(player, ownership, managed)) return { ok: false, error: NOT_STAFF };
  }
  return { ok: true, data: { player, match } };
}

/**
 * Editor gate + still a draft. Every mutating match action starts here; it is
 * the first place the submit lock is checked (the DB trigger is the second).
 */
async function requireEditableMatch(
  matchId: string,
): Promise<ActionResult<{ player: CurrentPlayer; match: MatchDraft }>> {
  const gate = await requireMatchEditor(matchId);
  if (!gate.ok) return gate;
  if (gate.data.match.status === "submitted") return { ok: false, error: LOCKED };
  return gate;
}
```

5. Update the file's top doc comment, rule 1:
   > **Auth.** Every action re-resolves the caller with `getCurrentPlayer()`. Season actions require staff; match actions require a match editor (`access.ts`: staff, the creator, or a manager of a club on the match). A client-supplied identity is never trusted.

   And rule 2:
   > …so this file is the first lock; the `*_submit_lock` DB triggers are the backstop.

6. Replace `CreateMatchFields` and `createMatchAction` with:

```ts
export interface CreateMatchFields {
  entryDate: string;
  sport: Sport;
  isCombined: boolean;
  isFriendly: boolean;
  /** Required for a club manager (must be a club they manage); optional for staff. */
  homeClubId?: string | null;
}

/** Create a draft match (with its half rows). Returns the new match id. */
export async function createMatchAction(
  input: CreateMatchFields,
): Promise<ActionResult<string>> {
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };

  if (!DATE_RE.test(input?.entryDate ?? "")) {
    return { ok: false, error: "Pick a valid match date." };
  }
  if (!isSport(input.sport)) return { ok: false, error: "Pick a valid sport." };

  const homeClubId = input.homeClubId || null;
  if (!isStaffRole(player.role)) {
    const managed = await repo.listManagedClubIds(player.id);
    if (!homeClubId || !managed.has(homeClubId)) return { ok: false, error: NOT_STAFF };
  }

  try {
    const id = await repo.createMatch({
      entryDate: input.entryDate,
      sport: input.sport,
      isCombined: Boolean(input.isCombined),
      isFriendly: Boolean(input.isFriendly),
      createdBy: player.id,
      homeClubId,
    });
    revalidatePath(MATCHES_PATH);
    return { ok: true, data: id };
  } catch (e) {
    return failed(e, "Failed to create the match.");
  }
}
```

7. In `submitMatchAction`, replace the opening lines (from `const auth = await requireStaff();` to `if (match.status === "submitted") return { ok: false, error: LOCKED };`) with:

```ts
  const gate = await requireEditableMatch(matchId);
  if (!gate.ok) return gate;
  const { player, match } = gate.data;
```

   Then change `repo.submitMatch(matchId, seasonId, auth.data.id)` to `repo.submitMatch(matchId, seasonId, player.id)`.

8. In `reopenMatchAction`, replace the role check `if (player.role !== "super_admin" && player.role !== "kfandra") {` with `if (!canReopenMatch(player)) {`.

9. **League/Friendly is editable on a draft** (design §5.2):
   - Add `isFriendly?: boolean;` to `MatchMetaFields`.
   - In `updateMatchMetaAction`, after the sport block, add:
     ```ts
       if (patch?.isFriendly !== undefined) {
         if (typeof patch.isFriendly !== "boolean") return { ok: false, error: "Pick League or Friendly." };
         fields.isFriendly = patch.isFriendly;
       }
     ```
   - In `src/lib/klcsra/repository.ts`, add `isFriendly?: boolean;` to `MatchMetaPatch`, add `is_friendly?: boolean;` to the `fields` type, and add `if (patch.isFriendly !== undefined) fields.is_friendly = patch.isFriendly;`.
   - Change `updateMatchMeta`'s doc comment to "`is_combined` is fixed at creation (halves exist); `is_friendly` may change while the match is a draft (a draft has no season tag, so `klc_matches_friendly_season_chk` holds)."
   - Change the doc comment above `updateMatchMetaAction` to "Patch the match header. `is_combined` is fixed at creation; `is_friendly` may change on a draft."

- [ ] **Step 6: Typecheck and run the tests**

Run: `npx tsc --noEmit && npm run test`
Expected: clean. `requireStaff` is still used by the season actions, so it stays.

---

## Task 12: Move the recorder to `/klc/matches` (staff + managers)

**Files:**
- Move: `src/app/admin/klc/matches/` → `src/app/klc/matches/` (every file, including `[id]/`)
- Create: `src/app/admin/klc/matches/page.tsx`, `src/app/admin/klc/matches/[id]/page.tsx` (redirects)
- Modify: `src/app/klc/matches/page.tsx`, `src/app/klc/matches/new-match-form.tsx`, `src/app/klc/matches/[id]/page.tsx`, `src/app/klc/matches/[id]/match-recorder.tsx`
- Modify: `src/app/admin/page.tsx:11`
- Modify: `e2e/helpers/recorder.ts`, `e2e/klcsra-recorder.spec.ts`

- [ ] **Step 1: Move the files**

```bash
mkdir -p src/app/klc
git mv src/app/admin/klc/matches src/app/klc/matches
```

The move takes the pages out of `src/app/admin/layout.tsx`, which provided `requireStaff()` and the `max-w-3xl` wrapper. Steps 3 and 5 add the auth back, page by page.

- [ ] **Step 2: Redirects at the old paths**

`src/app/admin/klc/matches/page.tsx`:

```tsx
import { redirect } from "next/navigation";

/** The recorder moved to /klc/matches so club managers can use it. */
export default function OldMatchesPage() {
  redirect("/klc/matches");
}
```

`src/app/admin/klc/matches/[id]/page.tsx`:

```tsx
import { redirect } from "next/navigation";

/** The recorder moved to /klc/matches so club managers can use it. */
export default async function OldMatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/klc/matches/${id}`);
}
```

In `src/app/admin/page.tsx` line 11, change `href: "/admin/klc/matches"` to `href: "/klc/matches"`.

- [ ] **Step 3: The list page (`src/app/klc/matches/page.tsx`)**

1. Change the imports to:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/auth/current-user";
import { isStaffRole } from "@/lib/auth/roles";
import { canEditMatch, canRecordMatches } from "@/lib/klcsra/access";
import {
  getActiveSeason,
  listClubs,
  listManagedClubIds,
  listMatches,
  listSeasons,
} from "@/lib/klcsra/repository";
```

   Keep the `SPORT_LABELS`, types and `NewMatchForm` imports.

2. Replace the start of `MatchesPage` (up to `const groups = groupByDate(matches);`) with:

```tsx
export default async function MatchesPage() {
  const player = await getCurrentPlayer();
  if (!player) redirect("/login?next=/klc/matches");
  const managed = await listManagedClubIds(player.id);
  if (!canRecordMatches(player, managed)) redirect("/klc/league?tab=matches");
  const staff = isStaffRole(player.role);

  const [all, active, seasons, clubs] = await Promise.all([
    listMatches(),
    getActiveSeason(),
    listSeasons(),
    listClubs(),
  ]);
  // Managers see every submitted match plus the drafts they may edit.
  const matches = staff
    ? all
    : all.filter((m) => m.status === "submitted" || canEditMatch(player, m, managed));
  const myClubs = staff ? [] : clubs.filter((c) => managed.has(c.id));
  const upcoming = seasons.find((s) => s.status === "upcoming") ?? null;
  const today = todayIso();
  const groups = groupByDate(matches);
```

   `MatchSummary` has `createdBy` and `clubIds`, so it fits `MatchOwnership` directly.

3. Wrap the returned JSX in the mobile column, and replace the back link:

```tsx
  return (
    <div className="mx-auto max-w-md space-y-4 p-5 pb-24">
      <Link href="/klc/league" className="text-[12px] text-gray-600 hover:underline">
        ← KLC League
      </Link>
```

   (The rest of the JSX stays. Close the `div` as before.)

4. Change `{!active && <BetweenSeasons upcoming={upcoming} />}` to `{!active && staff && <BetweenSeasons upcoming={upcoming} />}`. Managers can't start seasons.

5. Change `<NewMatchForm today={today} />` to `<NewMatchForm today={today} myClubs={myClubs} />`.

6. In `MatchCard`, change `href={`/admin/klc/matches/${m.id}`}` to `href={`/klc/matches/${m.id}`}`.

- [ ] **Step 4: The new-match form gets "Your club" for managers**

In `src/app/klc/matches/new-match-form.tsx`:
1. Add `import type { ClubOption } from "@/lib/klcsra/types";`.
2. Change the signature:
   ```tsx
   export function NewMatchForm({ today, myClubs }: { today: string; myClubs: ClubOption[] }) {
   ```
3. Add state after `isFriendly`:
   ```tsx
     const [homeClubId, setHomeClubId] = useState(myClubs[0]?.id ?? "");
   ```
4. Change the action call to:
   ```tsx
       const res = await createMatchAction({
         entryDate: date, sport, isCombined, isFriendly,
         homeClubId: myClubs.length > 0 ? homeClubId : null,
       });
   ```
5. Change the push to `router.push(`/klc/matches/${res.data}`)`.
6. After the date/sport row, add:
   ```tsx
         {myClubs.length > 0 && (
           <label className="block">
             <span className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
               Your club (home side)
             </span>
             <select
               data-testid="new-match-club"
               aria-label="Your club"
               value={homeClubId}
               onChange={(e) => setHomeClubId(e.target.value)}
               className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
             >
               {myClubs.map((c) => (
                 <option key={c.id} value={c.id}>{c.name}</option>
               ))}
             </select>
           </label>
         )}
   ```
7. In the doc comment, replace "Friendly and Combined are checkboxes here because they are fixed at creation" with "Friendly and Combined are checkboxes here because they are fixed at creation. A club manager also picks their own club, which becomes half 1's home side".

- [ ] **Step 5: The detail page gates drafts**

In `src/app/klc/matches/[id]/page.tsx`:
1. Add imports:
   ```tsx
   import { canEditMatch, canReopenMatch, matchClubIds } from "@/lib/klcsra/access";
   import { loadStandingsRules } from "@/lib/klcsra/config";
   import { listManagedClubIds } from "@/lib/klcsra/repository";
   ```
   Merge `loadStandingsRules` into the existing `@/lib/klcsra/config` import and `listManagedClubIds` into the existing repository import, rather than duplicating them. Also add `import { redirect } from "next/navigation";` alongside `notFound`.
2. Add `loadStandingsRules()` to the `Promise.all`, destructured as `rules`.
3. Replace `if (!match) notFound();` and the `canReopen` line with:

```tsx
  if (!player) redirect(`/login?next=/klc/matches/${id}`);
  if (!match) notFound();
  const managed = await listManagedClubIds(player.id);
  const canEdit = canEditMatch(
    player,
    { createdBy: match.createdBy, clubIds: matchClubIds(match.halves) },
    managed,
  );
  // A draft is private to the people who may edit it; a submitted match is a
  // public record (read-only for everyone but its editors' Reopen path).
  if (match.status === "draft" && !canEdit) notFound();
  const canReopen = canReopenMatch(player);
```

4. Replace the wrapper and back link:

```tsx
  return (
    <div className="mx-auto max-w-md space-y-4 p-5 pb-24">
      <Link href={canEdit ? "/klc/matches" : "/klc/league?tab=matches"}
        className="block text-[12px] text-gray-600 hover:underline">
        ← {canEdit ? "All matches" : "KLC League"}
      </Link>
```

5. Pass `rules={rules}` to `MatchRecorder`. Task 15 uses it.

6. In `src/app/klc/matches/[id]/match-recorder.tsx`:
   - Change `router.push("/admin/klc/matches")` to `router.push("/klc/matches")`.
   - Add the `rules: StandingsRules` prop: import `type StandingsRules` from `@/lib/klcsra/standings-rules`, add it to the props type and the destructuring, and pass `rules={rules}` to `<SubmitPanel …>`.
   - In `src/app/klc/matches/[id]/submit-panel.tsx`, add `rules: StandingsRules` to the props type and the destructuring. It isn't used yet; Task 15 uses it.

7. In `src/app/klc/matches/[id]/recorder-header.tsx`, the "No active season" link points at `/admin/klc/seasons`. Keep it: managers who click it are redirected home by the admin layout, which is acceptable.

8. **Editable League/Friendly in the header.** In `recorder-header.tsx`:
   - Widen `onMeta`'s patch type to `{ entryDate?: string; sport?: Sport; durationMinutes?: number | null; isFriendly?: boolean }`. Make the same change in `match-recorder.tsx`'s `onMeta` handler type.
   - Add local state `const [friendly, setFriendly] = useState(match.isFriendly);`.
   - Give `Segmented` an optional `onPick?: (index: number) => void` and `disabled?: boolean`. When `onPick` is given, render each segment as a `<button type="button" aria-pressed={on} disabled={disabled}>` that calls `onPick(i)`; otherwise keep today's read-only spans. The `data-testid` still rides the active segment.
   - Make the "Type" segmented use `options={[{ on: !friendly, label: "League" }, { on: friendly, label: "Friendly", testId: "flag-friendly" }]}`, with `onPick={(i) => { const f = i === 1; if (f === friendly) return; setFriendly(f); onMeta({ isFriendly: f }, true); }}` and `disabled={locked}`. Add `data-testid="type-league"` and `data-testid="type-friendly"` on the two buttons so e2e can click them (keep `flag-friendly` on the active one by putting it on a wrapper span inside the button).
   - "Format" stays read-only.
   - Change the helper text to: `{friendly ? "Friendly — MMG only, no Kroopies are credited. " : ""}Format is fixed when the match is created.`
   - Change the header's tag logic from `match.isFriendly` to `friendly`.
   - Update the doc comment: "Type (League/Friendly) can change while the match is a draft; Format (Single/Combined) is fixed at creation because the half rows already exist."
   - In the new-match form's footnote (`new-match-form.tsx`), change "Friendly matches carry no season and pay nothing out." to "Friendly matches carry no season and pay MMG only. You can switch League/Friendly until you submit."
   - In `e2e/klc-league.spec.ts` (Task 16), the staff test also covers the toggle (see Task 16).

- [ ] **Step 6: Point the e2e helpers at the new paths**

```bash
sed -i '' 's#/admin/klc/matches#/klc/matches#g' e2e/helpers/recorder.ts e2e/klcsra-recorder.spec.ts
sed -i '' 's#\\/admin\\/klc\\/matches\\/#\\/klc\\/matches\\/#' e2e/helpers/recorder.ts
grep -n "klc/matches\|klc\\\\/matches" e2e/helpers/recorder.ts
```

Expected: `MATCH_URL = /\/klc\/matches\/[0-9a-f-]{36}$/;` and the `goto` paths now use `/klc/matches`.

- [ ] **Step 7: Build, lint and run the existing recorder e2e**

```bash
npx tsc --noEmit && npm run lint && npm run test
npx playwright test e2e/klcsra-recorder.spec.ts e2e/klcsra-seasons.spec.ts
```

Expected: all pass. A failure that names `/admin/klc/matches` means a missed path; grep for it and fix it.

- [ ] **Step 8: Commit**

```bash
git add -A src/app/klc/matches src/app/admin src/lib/klcsra e2e
git commit -m "feat(klc): club managers record their own club's matches at /klc/matches

Bead: <manager-bead-id>. Recorder moves out of /admin (old paths redirect);
requireMatchEditor = staff | creator | manager of a club on the match;
managers create with their club as half-1 home; reopen stays KFANDRA-only.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Don't close the manager bead until Task 16's manager e2e passes.)

---

## Task 13: League page params (`league-params.ts`)

**Files:**
- Create: `src/lib/klcsra/league-params.ts`
- Test: `src/lib/klcsra/league-params.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { defaultSeasonId, leagueHref, parseLeagueParams } from "./league-params";
import { DEFAULT_TABLE_GROUPS as G } from "./table-groups";
import type { Season } from "./types";

const s = (id: string, seasonNo: number, status: Season["status"]): Season => ({
  id, seasonNo, name: `S${seasonNo}`, startDate: "2026-01-01", endDate: null, status,
});

describe("defaultSeasonId", () => {
  it("prefers active, then the newest closed, else null", () => {
    expect(defaultSeasonId([s("1", 1, "closed"), s("2", 2, "active")])).toBe("2");
    expect(defaultSeasonId([s("1", 1, "closed"), s("2", 2, "closed"), s("3", 3, "upcoming")])).toBe("2");
    expect(defaultSeasonId([s("3", 3, "upcoming")])).toBeNull();
  });
});

describe("parseLeagueParams", () => {
  const seasons = [s("1", 1, "closed"), s("2", 2, "active")];
  it("defaults everything", () => {
    expect(parseLeagueParams({}, seasons, G)).toEqual({ tab: "table", seasonId: "2", group: "all" });
  });
  it("accepts valid values", () => {
    expect(parseLeagueParams({ tab: "leaders", season: "1", group: "rugby_sox" }, seasons, G))
      .toEqual({ tab: "leaders", seasonId: "1", group: "rugby_sox" });
  });
  it("falls back on unknown values and takes the first of repeated params", () => {
    expect(parseLeagueParams({ tab: "nope", season: "zzz", group: ["x", "y"] }, seasons, G))
      .toEqual({ tab: "table", seasonId: "2", group: "all" });
  });
});

describe("leagueHref", () => {
  it("builds a URL with a patch applied", () => {
    expect(leagueHref({ tab: "table", seasonId: "2", group: "all" }, { group: "rugby_sox" }))
      .toBe("/klc/league?tab=table&season=2&group=rugby_sox");
    expect(leagueHref({ tab: "table", seasonId: null, group: "all" }, { tab: "scoring" }))
      .toBe("/klc/league?tab=scoring&group=all");
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `npx vitest run src/lib/klcsra/league-params.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
/** Pure. `/klc/league` URL state: ?tab=&season=&group=. Unknown values fall back. */
import type { TableGroups } from "./table-groups";
import type { Season } from "./types";

export const LEAGUE_TABS = ["table", "matches", "leaders", "seasons", "scoring"] as const;
export type LeagueTab = (typeof LEAGUE_TABS)[number];

export interface LeagueParams {
  tab: LeagueTab;
  seasonId: string | null;
  group: string;
}

type RawParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The active season, else the newest closed one, else null. */
export function defaultSeasonId(seasons: Season[]): string | null {
  const active = seasons.find((s) => s.status === "active");
  if (active) return active.id;
  const closed = seasons
    .filter((s) => s.status === "closed")
    .sort((a, b) => b.seasonNo - a.seasonNo)[0];
  return closed?.id ?? null;
}

export function parseLeagueParams(
  raw: RawParams,
  seasons: Season[],
  groups: TableGroups,
): LeagueParams {
  const tab = first(raw.tab);
  const season = first(raw.season);
  const group = first(raw.group);
  const groupKeys = Object.keys(groups);
  return {
    tab: (LEAGUE_TABS as readonly string[]).includes(tab ?? "") ? (tab as LeagueTab) : "table",
    seasonId: seasons.some((s) => s.id === season) ? season! : defaultSeasonId(seasons),
    group: group !== undefined && groupKeys.includes(group) ? group : groupKeys[0],
  };
}

export function leagueHref(current: LeagueParams, patch: Partial<LeagueParams>): string {
  const next = { ...current, ...patch };
  const q = new URLSearchParams();
  q.set("tab", next.tab);
  if (next.seasonId) q.set("season", next.seasonId);
  q.set("group", next.group);
  return `/klc/league?${q.toString()}`;
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `npx vitest run src/lib/klcsra/league-params.test.ts`
Expected: PASS.

---

## Task 14: `/klc/league` page + home block

**Files:**
- Modify: `src/content/strings.ts`
- Create: `src/app/klc/league/page.tsx`, `league-nav.tsx`, `table-tab.tsx`, `matches-tab.tsx`, `leaders-tab.tsx`, `seasons-tab.tsx`, `scoring-tab.tsx`
- Modify: `src/app/home-screen.tsx`, `src/app/page.tsx`

All of these are server components with no `"use client"`. Navigation is plain `<Link>`s that change the URL. Styling copies `src/app/klc/matches/page.tsx` and the approved mockup.

- [ ] **Step 1: Strings**

In `src/content/strings.ts`, inside `home`, after `balanceSheet: {…},`, add:

```ts
    league: {
      title: "KLC League",
      subtitle: "Tables · results · leaders",
      record: "Record a match →",
    },
```

At the top level (a sibling of `klc`), add:

```ts
  league: {
    title: "KLC League",
    breadcrumb: "KLC League",
    tabs: { table: "Table", matches: "Matches", leaders: "Leaders", seasons: "Seasons", scoring: "Scoring" },
    groups: {
      all: "All",
      football_fooba: "Football / Fooba",
      rugby_sox: "Rugby Sox",
      rugby_variations: "Rugby Var.",
      short_game_variations: "Short Game Var.",
    } as Record<string, string>,
    noSeason: "No season has started yet.",
    emptyTable: "No league matches submitted yet this season.",
    emptyMatches: "No league matches submitted yet this season.",
    emptyLeaders: "No stats recorded yet this season.",
    tableNote: "Sorted by Pts, Diff, scored (GF+TF), name. Swipe the middle columns ⇄",
    capNote: "Session limits (≤3 matches at 4–6 players, ≤2 at 2–3) are a ground rule; the app doesn't enforce them.",
    friendliesNote: "Friendlies earn no league points. MMG leaders include friendlies.",
  },
```

- [ ] **Step 2: Nav (`src/app/klc/league/league-nav.tsx`)**

```tsx
import Link from "next/link";
import { strings } from "@/content/strings";
import { LEAGUE_TABS, leagueHref, type LeagueParams } from "@/lib/klcsra/league-params";
import type { TableGroups } from "@/lib/klcsra/table-groups";

export function TabBar({ params }: { params: LeagueParams }) {
  return (
    <nav aria-label="League sections" className="grid grid-cols-5 gap-1 rounded-xl bg-gray-100 p-1 text-[11px] font-bold">
      {LEAGUE_TABS.map((t) => {
        const on = t === params.tab;
        return (
          <Link
            key={t}
            href={leagueHref(params, { tab: t })}
            data-testid={`league-tab-${t}`}
            aria-current={on ? "page" : undefined}
            className={`rounded-lg py-1.5 text-center ${on ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"}`}
          >
            {strings.league.tabs[t]}
          </Link>
        );
      })}
    </nav>
  );
}

export function GroupChips({ params, groups }: { params: LeagueParams; groups: TableGroups }) {
  return (
    <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1" role="group" aria-label="Table">
      {Object.keys(groups).map((g) => {
        const on = g === params.group;
        return (
          <Link
            key={g}
            href={leagueHref(params, { group: g })}
            data-testid="group-chip"
            data-group={g}
            aria-pressed={on}
            className={`shrink-0 rounded-xl px-3 py-2 text-[11px] font-bold ${
              on ? "bg-gray-900 text-white" : "border border-gray-200 bg-white text-gray-700"
            }`}
          >
            {strings.league.groups[g] ?? g}
          </Link>
        );
      })}
    </div>
  );
}

export function Empty({ text, testId }: { text: string; testId: string }) {
  return (
    <div data-testid={testId} className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center">
      <p className="text-[12px] text-gray-600">{text}</p>
    </div>
  );
}
```

- [ ] **Step 3: Table tab (`table-tab.tsx`)**

```tsx
import { strings } from "@/content/strings";
import type { TableRow } from "@/lib/klcsra/league-table";
import { Empty } from "./league-nav";

const fmt = (n: number) => String(n);
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

export function TableTab({ rows, kinds }: { rows: TableRow[]; kinds: { goals: boolean; tries: boolean } }) {
  if (rows.length === 0) return <Empty text={strings.league.emptyTable} testId="league-table-empty" />;
  const cols: { key: keyof TableRow; label: string }[] = [
    { key: "P", label: "P" }, { key: "W", label: "W" }, { key: "D", label: "D" }, { key: "L", label: "L" },
    ...(kinds.goals ? [{ key: "GF" as const, label: "GF" }, { key: "GA" as const, label: "GA" }] : []),
    ...(kinds.tries ? [{ key: "TF" as const, label: "TF" }, { key: "TA" as const, label: "TA" }] : []),
  ];
  const th = "py-2 text-[10px] font-bold uppercase tracking-wide text-gray-600";
  return (
    <>
      <div data-testid="league-table" className="flex overflow-hidden rounded-xl border border-gray-200 bg-white text-[12px] tabular-nums">
        <table>
          <thead><tr className="bg-gray-50"><th className={`${th} pl-3 pr-1 text-left`}>#</th><th className={`${th} pr-2 text-left`}>Club</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r, i) => (
              <tr key={r.clubId} data-testid="table-row" data-club-id={r.clubId}>
                <td className="py-2 pl-3 pr-1 text-gray-500">{i + 1}</td>
                <td className="max-w-[110px] truncate py-2 pr-2 font-semibold text-gray-900">{r.clubName}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-right text-gray-700">
            <thead><tr className="bg-gray-50">
              {cols.map((c) => <th key={c.key} className={`${th} px-1.5`}>{c.label}</th>)}
              <th className={`${th} px-1.5`}>Diff</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.clubId}>
                  {cols.map((c) => (
                    <td key={c.key} data-col={c.key} className="px-1.5 py-2">{fmt(r[c.key] as number)}</td>
                  ))}
                  <td data-col="Diff" className={`px-1.5 ${r.Diff > 0 ? "text-green-700" : r.Diff < 0 ? "text-red-600" : ""}`}>{signed(r.Diff)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <table className="border-l border-gray-100 text-right">
          <thead><tr className="bg-gray-50"><th className={`${th} pl-2 pr-3`}>Pts</th></tr></thead>
          <tbody className="divide-y divide-gray-100 font-bold text-gray-900">
            {rows.map((r) => <tr key={r.clubId}><td data-col="Pts" className="py-2 pl-2 pr-3">{fmt(r.Pts)}</td></tr>)}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-500">{strings.league.tableNote}</p>
    </>
  );
}
```

The `data-col` attributes are on the middle and right cells, so e2e can read a club's values from the row index. The test in Task 16 reads them by row position.

- [ ] **Step 4: Matches tab (`matches-tab.tsx`)**

```tsx
import Link from "next/link";
import { strings } from "@/content/strings";
import { SPORT_LABELS } from "@/lib/klcsra/sport-stats";
import { TIER_LABELS, type StandingsRules } from "@/lib/klcsra/standings-rules";
import { aggregateScores, scoreMatch } from "@/lib/klcsra/league-table";
import { sideClubLabel, toLeagueMatch } from "@/lib/klcsra/league-data";
import type { MatchDraft } from "@/lib/klcsra/types";
import { Empty } from "./league-nav";

function fmtDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function MatchesTab({ drafts, rules }: { drafts: MatchDraft[]; rules: StandingsRules }) {
  const league = drafts.filter((d) => !d.isFriendly);
  if (league.length === 0) return <Empty text={strings.league.emptyMatches} testId="league-matches-empty" />;
  const groups: { date: string; items: MatchDraft[] }[] = [];
  for (const d of league) {
    const last = groups[groups.length - 1];
    if (last && last.date === d.entryDate) last.items.push(d);
    else groups.push({ date: d.entryDate, items: [d] });
  }
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.date}>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-600">{fmtDate(g.date)}</p>
          <ul className="space-y-2">
            {g.items.map((d) => {
              const m = toLeagueMatch(d);
              const agg = aggregateScores(m);
              const pts = scoreMatch(m, rules);
              const each = d.isCombined ? " each" : "";
              return (
                <li key={d.id} data-testid="league-match" data-match-id={d.id}>
                  <Link href={`/klc/matches/${d.id}`} className="block rounded-xl border border-gray-200 bg-white p-3 hover:border-gray-300">
                    <p className="text-sm font-semibold text-gray-900">
                      {sideClubLabel(d, "home")}{" "}
                      <span className="mx-0.5 whitespace-nowrap rounded-md bg-gray-100 px-1.5 py-0.5 font-bold tabular-nums">
                        {agg.home} – {agg.away}
                      </span>{" "}
                      {sideClubLabel(d, "away")}
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-600">
                      <span className="font-medium text-gray-700">{SPORT_LABELS[d.sport] ?? d.sport}</span>
                      {d.isCombined && <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">Combined</span>}
                      {pts.tier && <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700">{TIER_LABELS[pts.tier]}</span>}
                      <span data-testid="league-match-points" className="ml-auto font-semibold tabular-nums text-gray-900">
                        {pts.home}{each} · {pts.away}{each} pts
                      </span>
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Leaders tab (`leaders-tab.tsx`)**

```tsx
import { strings } from "@/content/strings";
import type { Board } from "@/lib/klcsra/leaderboards";
import { Empty } from "./league-nav";

export function LeadersTab({ boards }: { boards: Board[] }) {
  if (boards.length === 0) return <Empty text={strings.league.emptyLeaders} testId="league-leaders-empty" />;
  return (
    <div className="space-y-3">
      {boards.map((b) => (
        <div key={b.key} data-testid="leader-board" data-board={b.key} className="rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-600">{b.label}</p>
          <ol className="mt-1.5 space-y-1 text-[13px]">
            {b.entries.map((e) => (
              <li key={e.playerId} data-testid="leader-entry" data-player-id={e.playerId} className="flex items-center gap-2">
                <span className="w-4 text-right text-[11px] font-bold text-gray-400">{e.rank}</span>
                <span className="font-semibold text-gray-900">{e.name}</span>
                {e.club && <span className="truncate text-[11px] text-gray-500">{e.club}</span>}
                <span data-testid="leader-value" className="ml-auto font-bold tabular-nums">{e.value}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
      <p className="text-[11px] text-gray-500">{strings.league.friendliesNote}</p>
    </div>
  );
}
```

- [ ] **Step 6: Seasons tab (`seasons-tab.tsx`)**

```tsx
import Link from "next/link";
import { leagueHref, type LeagueParams } from "@/lib/klcsra/league-params";
import type { Season } from "@/lib/klcsra/types";

const TONE: Record<Season["status"], string> = {
  active: "bg-green-100 text-green-800",
  upcoming: "bg-amber-100 text-amber-900",
  closed: "bg-gray-100 text-gray-700",
};

export function SeasonsTab({ seasons, params }: { seasons: Season[]; params: LeagueParams }) {
  const newestFirst = [...seasons].sort((a, b) => b.seasonNo - a.seasonNo);
  return (
    <ul className="space-y-2">
      {newestFirst.map((s) => (
        <li key={s.id}>
          <Link
            href={leagueHref(params, { seasonId: s.id, tab: "table" })}
            data-testid="season-row"
            className={`flex items-center gap-2 rounded-xl border bg-white p-3 ${s.id === params.seasonId ? "border-gray-900" : "border-gray-200"}`}
          >
            <span className="text-sm font-semibold text-gray-900">S{s.seasonNo} · {s.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${TONE[s.status]}`}>{s.status}</span>
            <span className="ml-auto text-[11px] text-gray-500">{s.startDate}{s.endDate ? ` → ${s.endDate}` : ""}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 7: Scoring tab (`scoring-tab.tsx`)**

```tsx
import { strings } from "@/content/strings";
import { SPORTS, SPORT_LABELS } from "@/lib/klcsra/sport-stats";
import { TIER_KEYS, TIER_LABELS, type StandingsRules } from "@/lib/klcsra/standings-rules";

export function ScoringTab({ rules }: { rules: StandingsRules }) {
  const th = "px-2 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-600";
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table data-testid="scoring-table" className="w-full text-[12px] tabular-nums">
          <thead className="bg-gray-50">
            <tr>
              <th className={`${th} text-left`}>Win</th>
              {TIER_KEYS.map((t) => <th key={t} className={`${th} text-right`}>{TIER_LABELS[t]} players</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {SPORTS.map((s) => (
              <tr key={s}>
                <td className="px-2 py-2 font-semibold text-gray-900">{SPORT_LABELS[s]}</td>
                {TIER_KEYS.map((t) => <td key={t} className="px-2 text-right">{rules.win[s][t]}</td>)}
              </tr>
            ))}
            <tr className="bg-gray-50">
              <td className="px-2 py-2 font-semibold text-gray-900">Draw (all types)</td>
              {TIER_KEYS.map((t) => <td key={t} className="px-2 text-right">{rules.draw[t]}</td>)}
            </tr>
            <tr>
              <td className="px-2 py-2 font-semibold text-gray-900">Loss</td>
              {TIER_KEYS.map((t) => <td key={t} className="px-2 text-right">{rules.loss}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-500">
        Players are counted across both teams. A combined (joint-manager) match is one result on the aggregate score, with full points to each club.
      </p>
      <p className="text-[11px] text-gray-500">{strings.league.capNote}</p>
    </div>
  );
}
```

- [ ] **Step 8: The page (`src/app/klc/league/page.tsx`)**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { strings } from "@/content/strings";
import { getCurrentPlayer } from "@/lib/auth/current-user";
import {
  loadSportStats, loadStandingsRules, loadStatRates, loadTableGroups,
} from "@/lib/klcsra/config";
import { buildLeaderboards } from "@/lib/klcsra/leaderboards";
import { toLeagueMatch, toStatRows } from "@/lib/klcsra/league-data";
import { leagueHref, parseLeagueParams } from "@/lib/klcsra/league-params";
import { buildLeagueTable } from "@/lib/klcsra/league-table";
import { listClubs, listSeasons, listSubmittedMatchDrafts } from "@/lib/klcsra/repository";
import { groupScoreKinds } from "@/lib/klcsra/table-groups";
import { Empty, GroupChips, TabBar } from "./league-nav";
import { LeadersTab } from "./leaders-tab";
import { MatchesTab } from "./matches-tab";
import { ScoringTab } from "./scoring-tab";
import { SeasonsTab } from "./seasons-tab";
import { TableTab } from "./table-tab";

export const dynamic = "force-dynamic";

/**
 * KLC League: tables, results, leaders, seasons and the points scale, for
 * every signed-in player. Everything is derived on read from SUBMITTED
 * matches (`listSubmittedMatchDrafts`), so drafts never appear here.
 */
export default async function LeaguePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const player = await getCurrentPlayer();
  if (!player) redirect("/login?next=/klc/league");

  const [seasons, groups, rules] = await Promise.all([
    listSeasons(), loadTableGroups(), loadStandingsRules(),
  ]);
  const params = parseLeagueParams(await searchParams, seasons, groups);
  const season = seasons.find((s) => s.id === params.seasonId) ?? null;
  const { league } = strings;

  let body: React.ReactNode;
  if (params.tab === "seasons") {
    body = <SeasonsTab seasons={seasons} params={params} />;
  } else if (params.tab === "scoring") {
    body = <ScoringTab rules={rules} />;
  } else if (!season) {
    body = <Empty text={league.noSeason} testId="league-no-season" />;
  } else {
    const drafts = await listSubmittedMatchDrafts(season);
    if (params.tab === "matches") {
      body = <MatchesTab drafts={drafts} rules={rules} />;
    } else if (params.tab === "leaders") {
      const [rates, sportStats] = await Promise.all([loadStatRates(), loadSportStats()]);
      const boards = buildLeaderboards(drafts.flatMap(toStatRows), params.group, groups, rates, sportStats);
      body = (<><GroupChips params={params} groups={groups} /><LeadersTab boards={boards} /></>);
    } else {
      const clubs = await listClubs();
      const rows = buildLeagueTable(drafts.map(toLeagueMatch), params.group, clubs, rules, groups);
      body = (<><GroupChips params={params} groups={groups} /><TableTab rows={rows} kinds={groupScoreKinds(params.group, groups)} /></>);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-5 pb-24">
      <Breadcrumb label={league.breadcrumb} />
      <div className="flex items-end justify-between gap-2">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-black tracking-tight text-gray-900">
          {league.title}
        </h1>
        {season && <SeasonPicker seasons={seasons} current={season} params={params} />}
      </div>
      <TabBar params={params} />
      {body}
    </div>
  );
}
```

`listClubs` here is `@/lib/klcsra/repository`'s version (`{ id, name, managerName }`). It fits `ClubRef` structurally. Import `listSubmittedMatchDrafts` from `@/lib/klcsra/league-repository`, not from `repository`.

**Season picker** (design §6.2: "a season pill that opens a season picker"). Add to `league-nav.tsx` and import it in the page. It uses native `<details>`, so it needs no client JS and works in a server component:

```tsx
import type { Season } from "@/lib/klcsra/types";

export function SeasonPicker({
  seasons, current, params,
}: { seasons: Season[]; current: Season; params: LeagueParams }) {
  const newestFirst = [...seasons].sort((a, b) => b.seasonNo - a.seasonNo);
  return (
    <details data-testid="league-season-picker" className="relative">
      <summary
        data-testid="league-season-pill"
        className="cursor-pointer list-none rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800 [&::-webkit-details-marker]:hidden"
      >
        S{current.seasonNo} · {current.name} ▾
      </summary>
      <ul className="absolute right-0 z-10 mt-1 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
        {newestFirst.map((s) => (
          <li key={s.id}>
            <Link
              href={leagueHref(params, { seasonId: s.id })}
              data-testid="season-option"
              aria-current={s.id === current.id ? "true" : undefined}
              className={`flex items-center justify-between px-3 py-2 text-[12px] ${
                s.id === current.id ? "bg-gray-50 font-bold text-gray-900" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span>S{s.seasonNo} · {s.name}</span>
              <span className="text-[10px] capitalize text-gray-500">{s.status}</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
```

The `Link` changes the URL, so the server re-renders with the new season and the `<details>` comes back closed.

- [ ] **Step 9: Home block**

`src/app/page.tsx`:

```tsx
import { getCurrentPlayer } from "@/lib/auth/current-user";
import { isStaffRole } from "@/lib/auth/roles";
import { canRecordMatches } from "@/lib/klcsra/access";
import { listManagedClubIds } from "@/lib/klcsra/repository";
import HomeScreen from "./home-screen";

export const dynamic = "force-dynamic";

export default async function Home() {
  const player = await getCurrentPlayer();
  const isStaff = player ? isStaffRole(player.role) : false;
  const canRecord = player
    ? canRecordMatches(player, await listManagedClubIds(player.id))
    : false;
  return <HomeScreen isStaff={isStaff} canRecord={canRecord} />;
}
```

In `src/app/home-screen.tsx`:
- Change the signature to `export default function HomeScreen({ isStaff, canRecord }: { isStaff: boolean; canRecord: boolean })`.
- Insert this block right after the Balance Sheet `motion.div` closes, before `{/* Staff-only admin entry */}`:

```tsx
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="w-full"
          whileHover={{ y: -3, scale: 1.01 }}
        >
          <Link
            href="/klc/league"
            data-testid="home-league"
            onClick={() => capture(AnalyticsEvent.ModeOpened, { mode: "klc_league" })}
            className="flex items-center gap-3 rounded-2xl border border-white/30 bg-white/20 p-4 text-left backdrop-blur"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-400/30 border border-amber-300/40">
              <svg className="h-4 w-4 text-amber-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-white">{home.league.title}</h2>
              <p className="text-[10.5px] text-blue-100/70 leading-snug">{home.league.subtitle}</p>
            </div>
          </Link>
          {canRecord && (
            <Link
              href="/klc/matches"
              data-testid="home-record-match"
              className="mt-1.5 block text-right text-[11px] font-semibold text-white/90 hover:underline"
            >
              {home.league.record}
            </Link>
          )}
        </motion.div>
```

- Change the staff admin entry's `transition={{ delay: 0.9, … }}` to `delay: 1.0`. This keeps the stagger order.

- [ ] **Step 10: Run it and look**

```bash
npx tsc --noEmit && npm run lint && npm run test
```

Then start the app with the `run` skill (or `npm run dev`) and open `http://localhost:3000/klc/league` at phone width (375px), signed in as a plain player. Check that:
- all 5 tabs render
- the group chips change the URL
- the table's middle columns scroll sideways while Club and Pts stay put
- there's no page-level horizontal scroll
- the empty states show on an empty local DB

Compare against `.superpowers/brainstorm/19684-1792516280/content/league-table-v2.html`.

- [ ] **Step 11: Commit**

```bash
git add -A src/app/klc/league src/app/home-screen.tsx src/app/page.tsx src/content/strings.ts src/lib/klcsra/league-params.ts src/lib/klcsra/league-params.test.ts
git commit -m "feat(klc): /klc/league — table, matches, leaders, seasons, scoring + home block

Bead: <ui-bead-id>. Closes Helper-h9i (public read = server-only submitted filter).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
bd close <ui-bead-id> Helper-h9i
```

---

## Task 15: Recorder submit panel — tier + points preview

**Files:**
- Modify: `src/app/klc/matches/[id]/submit-panel.tsx`

- [ ] **Step 1: Add the preview**

In `submit-panel.tsx`:
1. Add imports:

```tsx
import { toLeagueMatch } from "@/lib/klcsra/league-data";
import { aggregateScores, scoreMatch } from "@/lib/klcsra/league-table";
import { TIER_LABELS, type StandingsRules } from "@/lib/klcsra/standings-rules";
```

   (`StandingsRules` was already added as a prop in Task 12, Step 5. Merge the import.)

2. After the `checks` array is built, add:

```tsx
  const leagueMatch = toLeagueMatch(match);
  const complete = leagueMatch.halves.length === match.halves.length && match.halves.length > 0;
  const agg = aggregateScores(leagueMatch);
  const pts = scoreMatch(leagueMatch, rules);
  const each = match.isCombined ? " each" : "";
```

3. Insert this card right before the totals card (`<div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4">` with "Totals preview"):

```tsx
      <div data-testid="league-points" className="space-y-1 rounded-2xl border border-gray-200 bg-white p-4">
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">League points</p>
        {match.isFriendly ? (
          <p className="text-[12px] text-gray-600">Friendly — no league points.</p>
        ) : !complete ? (
          <p className="text-[12px] text-gray-500">Pick both clubs to see the points.</p>
        ) : (
          <p data-testid="league-points-line" className="text-[12px] font-semibold tabular-nums text-gray-900">
            {pts.tier ? `Tier ${TIER_LABELS[pts.tier]}` : "Under 2 players"} · {agg.home} – {agg.away} ·
            Home {pts.home}{each} · Away {pts.away}{each}
          </p>
        )}
      </div>
```

- [ ] **Step 2: Check it in the app**

Run `npx tsc --noEmit && npm run lint`. Then, in the running app, as staff, create a football match with 2 clubs, 1 player and score 1–0. The card should read `Tier … · 1 – 0 · Home … · Away 0`. With 1 player it reads "Under 2 players · … Home 0 · Away 0".

- [ ] **Step 3: Commit**

```bash
git add "src/app/klc/matches/[id]/submit-panel.tsx"
git commit -m "feat(klc): recorder shows tier and league points before submit

Bead: <preview-bead-id>.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
bd close <preview-bead-id>
```

---

## Task 16: e2e — league + managers; checkpoint doc

**Files:**
- Create: `e2e/klc-league.spec.ts`
- Create: `docs/klc-league-checkpoint.md`

- [ ] **Step 1: Write the spec**

First, open `e2e/helpers/auth.ts` (`seedPlayer`, `signIn`, `signInAs`) and `e2e/helpers/db.ts` (`setClubManager`, `listClubs`, `findClub`) to confirm the signatures used below. Then write:

```ts
import { test, expect, expectNoErrors, type Page } from "./fixtures";
import { seedPlayer, signIn, signInAs } from "./helpers/auth";
import * as db from "./helpers/db";
import * as rec from "./helpers/recorder";

/**
 * KLC League end to end (design §8). Local Supabase only.
 * Points expected here come from DEFAULT_STANDINGS_RULES: 2 players total is
 * tier 2–3, so a football win is 0.5.
 */

const SEASON = "KLCFERRSXVSG2";
const MATCH_DATE = "2026-08-23";
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

async function recordWin(page: Page, homeClubId: string, awayClubId: string) {
  const [p1, p2] = [await seedPlayer("user", "E2E L1"), await seedPlayer("user", "E2E L2")];
  const id = await rec.createMatch(page, { date: MATCH_DATE, sport: "football" });
  await rec.pickClub(page, 1, "home", homeClubId);
  await rec.pickClub(page, 1, "away", awayClubId);
  await rec.setScore(page, 1, "home", 2);
  await rec.setScore(page, 1, "away", 1);
  await rec.addPlayer(page, "home", p1.id);
  await rec.addPlayer(page, "away", p2.id);
  await rec.recordStats(page, "home", p1.id, { goal: 2 });
  await expect(page.getByTestId("league-points-line")).toContainText("Home 0.5");
  await rec.submitMatch(page);
  return { id, scorer: p1 };
}

/** A club's Pts cell: the pinned Pts column shares row order with the Club column. */
async function pts(page: Page, clubId: string): Promise<string | null> {
  const ids = await page
    .locator('[data-testid="table-row"]')
    .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-club-id")));
  const idx = ids.indexOf(clubId);
  return idx < 0 ? null : page.locator('[data-col="Pts"]').nth(idx).innerText();
}

test("staff record + submit -> table, matches and leaders update", async ({ page, errors }) => {
  await signInAs(page.context(), "admin");
  const [a, b] = await db.listClubs(2);
  const { scorer } = await recordWin(page, a.id, b.id);

  await page.goto("/klc/league");
  expect(await pts(page, a.id)).toBe("0.5");
  expect(await pts(page, b.id)).toBe("0");

  await page.getByTestId("league-tab-matches").click();
  await expect(page.getByTestId("league-match-points").first()).toHaveText("0.5 · 0 pts");

  await page.getByTestId("league-tab-leaders").click();
  const goals = page.locator('[data-testid="leader-board"][data-board="goals"]');
  await expect(goals.locator(`[data-player-id="${scorer.id}"] [data-testid="leader-value"]`)).toHaveText("2");

  // The season picker lists seasons and switches the table.
  await page.getByTestId("league-tab-table").click();
  await page.getByTestId("league-season-pill").click();
  await expect(page.getByTestId("season-option").first()).toBeVisible();
  expectNoErrors(errors);
});

test("a draft switches League -> Friendly and drops out of the table", async ({ page }) => {
  await signInAs(page.context(), "admin");
  const [a, b] = await db.listClubs(2);
  const [p1, p2] = [await seedPlayer("user", "E2E F1"), await seedPlayer("user", "E2E F2")];
  const id = await rec.createMatch(page, { date: MATCH_DATE, sport: "football" });
  await rec.pickClub(page, 1, "home", a.id);
  await rec.pickClub(page, 1, "away", b.id);
  await rec.setScore(page, 1, "home", 1);
  await rec.addPlayer(page, "home", p1.id);
  await rec.addPlayer(page, "away", p2.id);
  await page.getByTestId("type-friendly").click();
  await rec.expectSaved(page);
  expect((await db.getMatchRow(id))?.is_friendly).toBe(true);
  await rec.submitMatch(page);
  expect((await db.getMatchRow(id))?.season_id).toBeNull();

  await page.goto("/klc/league");
  expect(await pts(page, a.id)).toBeNull();
});

test("KFANDRA reopens, edits and resubmits -> table changes", async ({ page }) => {
  await signInAs(page.context(), "kfandra");
  const [a, b] = await db.listClubs(2);
  const { id } = await recordWin(page, a.id, b.id);

  await rec.openMatch(page, id);
  const dialog = await rec.openReopenDialog(page);
  await dialog.getByTestId("reopen-confirm").click();
  await rec.setScore(page, 1, "away", 2); // now 2–2
  await rec.submitMatch(page);

  await page.goto("/klc/league");
  expect(await pts(page, a.id)).toBe("0.1");
  expect(await pts(page, b.id)).toBe("0.1");
});

test("a club manager records their own club's match but not another club's draft", async ({ page, browser }) => {
  const [mine, theirs, other] = await db.listClubs(3);
  const manager = await seedPlayer("user", "E2E Manager");
  await db.setClubManager(mine.id, manager.id);

  // Someone else's draft between two other clubs.
  const staffCtx = await browser.newContext();
  const staffPage = await staffCtx.newPage();
  await signInAs(staffCtx, "admin");
  const foreign = await rec.createMatch(staffPage, { date: MATCH_DATE, sport: "football" });
  await rec.pickClub(staffPage, 1, "home", theirs.id);
  await rec.pickClub(staffPage, 1, "away", other.id);
  await staffCtx.close();

  await signIn(page.context(), manager);
  await page.goto("/");
  await expect(page.getByTestId("home-record-match")).toBeVisible();

  await page.goto("/klc/matches");
  await expect(page.getByTestId("new-match-club")).toHaveValue(mine.id);
  const id = await rec.createMatch(page, { date: MATCH_DATE, sport: "football" });
  await rec.pickClub(page, 1, "away", theirs.id);
  // The home side was created by the action, so the recorder's "auto-add the
  // manager on pickClub" never ran: add them by hand.
  await rec.addPlayer(page, "home", manager.id);
  await rec.setScore(page, 1, "home", 1);
  await rec.submitMatch(page);
  expect((await db.getMatchRow(id))?.status).toBe("submitted");
  await expect(page.getByTestId("reopen-match")).toHaveCount(0);

  const res = await page.goto(`/klc/matches/${foreign}`);
  expect(res?.status()).toBe(404);
});

test("a plain player sees the league but not drafts", async ({ page, browser }) => {
  const staffCtx = await browser.newContext();
  const staffPage = await staffCtx.newPage();
  await signInAs(staffCtx, "admin");
  const draft = await rec.createMatch(staffPage, { date: MATCH_DATE, sport: "football" });
  await staffCtx.close();

  const player = await seedPlayer("user", "E2E Viewer");
  await signIn(page.context(), player);
  await page.goto("/");
  await page.getByTestId("home-league").click();
  for (const t of ["table", "matches", "leaders", "seasons", "scoring"]) {
    await page.getByTestId(`league-tab-${t}`).click();
    await expect(page).toHaveURL(new RegExp(`tab=${t}`));
  }
  await expect(page.getByTestId("scoring-table")).toBeVisible();
  await expect(page.getByTestId("home-record-match")).toHaveCount(0);

  const res = await page.goto(`/klc/matches/${draft}`);
  expect(res?.status()).toBe(404);
  await page.goto("/klc/matches");
  await expect(page).toHaveURL(/\/klc\/league\?tab=matches/);
});
```

Things to confirm against the helpers before running:
- `rec.createMatch` waits for `new-match-form` and fills date/sport. For the manager, the club select is pre-filled with their only club, so the helper works unchanged.
- In the reopen test, read `rec.openReopenDialog`'s test ids (`e2e/helpers/recorder.ts:359`) and use the confirm id it uses. If it isn't `reopen-confirm`, change it.

- [ ] **Step 2: Run the whole e2e suite**

```bash
npx playwright test
```

Expected: everything passes: smoke, diet, the recorder and seasons specs, the triggers spec and the 4 league tests. Fix failures with the `systematic-debugging` skill. Don't weaken assertions.

- [ ] **Step 3: Checkpoint doc (`docs/klc-league-checkpoint.md`)**

```markdown
# KLC League — KFANDRA checkpoint

Run on the live app after the heads-up to KFANDRA. Tick each line.

- [ ] Replay 3–4 S1 matches from the KLCFERRSXVSG1 sheet: points, W/D/L and for/against match the sheet. *(Needs Coach's sheet; bead "S1 acceptance replay".)*
- [ ] A 7+ football win gives 5 / 0; a 4–6 rugby variation win gives 1 / 0; a 4–6 football draw gives 0.2 / 0.2.
- [ ] A joint-manager (combined) match gives each club on the winning pair 5 and appears once per club in P.
- [ ] A club manager records and submits their own club's match from Home → Record a match.
- [ ] A plain player opens Home → KLC League and sees Table, Matches, Leaders, Seasons and Scoring, and no drafts.
- [ ] KFANDRA reopens a match, edits the score and resubmits: the table changes.
- [ ] Scoring tab matches the agreed points scale.
```

- [ ] **Step 4: Commit**

```bash
git add e2e/klc-league.spec.ts docs/klc-league-checkpoint.md e2e/helpers
git commit -m "test(klc): league + manager e2e; KFANDRA checkpoint doc

Bead: <e2e-bead-id>.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
bd close <e2e-bead-id> <manager-bead-id>
```

---

## Task 17: Quality gates, PR, handover

- [ ] **Step 1: Full gates**

```bash
npm run lint && npx tsc --noEmit && npm run test && npm run build && npx playwright test
```

Expected: all green. Paste the summary lines into the PR body.

- [ ] **Step 2: Review**

Use the `requesting-code-review` skill on the branch diff, and fix anything confirmed.

- [ ] **Step 3: Push and open the PR**

```bash
git pull --rebase origin main
git push -u origin feat/klc-league-scoring
gh pr create --title "KLC League: scoring, tables, leaderboards, manager recording" --body "$(cat <<'EOF'
Implements docs/superpowers/specs/2026-10-20-klc-league-scoring-design.md.

- 6 match types, rules v2 (config-driven), points computed on read
- /klc/league: Table (5 groups) · Matches · Leaders · Seasons · Scoring
- Club managers record their own club's matches at /klc/matches (old /admin paths redirect)
- DB submit-lock + touch-parent triggers (Helper-0gr, Helper-r01); public read = submitted-only server filter (Helper-h9i)

**Before merge/deploy:** prod had no `variation` rows (checked in Task 0); `npx supabase db push` after merge; heads-up to KFANDRA before go-live.

Gates: <paste lint / tsc / vitest / build / playwright summaries>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Jaidev merges, because auto mode blocks `gh pr merge`. After the merge, run `npx supabase db push` (Jaidev confirms first), then send KFANDRA the heads-up.

- [ ] **Step 4: Session close**

Follow `CLAUDE.md`'s session completion steps:
1. `bd dolt push`
2. `git status` is clean and up to date
3. If anything is still in flight, run `/handover-capture` (`.claude/skills/handover-capture/SKILL.md`)
4. Update `handover/README.md` Current state
