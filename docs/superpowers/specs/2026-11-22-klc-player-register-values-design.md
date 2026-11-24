# KLC player register, player values and the friendly mark: design

**Date:** 22 November 2026
**Beads:** Helper-bsr.18 (register and values), Helper-3u5 (friendly mark)
**Status:** design approved by Jaidev on 22 November 2026, waiting for the written spec review
**Sources:**
- bd memories `klc-player-values-loans-decisions`, `klc-economy-sir-reply-2026-11-19`, `klc-economy-jaidev-answers-2026-11-22` and `klc-points-sir-2026-11-22`
- `docs/klc-club-economy-review.md` (version 2, the one sent to KFANDRA)

## 1. Goal

Each KLC player has a value in Kroopies (KR) that KFANDRA sets at the start of a
season and that then moves with every match that counts. Everyone can see the
values. This is the base for loans (a loan fee is the player's value at the start
of the session), which comes next.

Two pieces, two PRs:

1. **Helper-3u5, the friendly mark.** Every friendly is Official or Unofficial. It's
   small and can ship first.
2. **Helper-bsr.18, the register and values.** The register screen for KFANDRA, the
   value calculation, the Values tab and the value history.

Out of scope: loans, loan fees and loan points, organisations, club money, tickets
and later competition formats.

## 2. Rules (from KFANDRA)

| Rule | Value |
|---|---|
| A player's club | The club they manage (`clubs.manager_player_id`). Fixed for the season |
| Matches that count | Submitted **league** matches of the season (Multi-Game Variations included), and submitted **official friendlies** dated inside the season's window |
| Matches that don't count | Unofficial friendlies, drafts, and league matches not yet made official |
| Result | Win **+20**, draw **+5**, loss **−10**. Every player on a side gets that side's result |
| Stats | Goal, main goal, rebound goal, try, conversion **+2**. Assist **+1**. Pre-assist **+0.5**. Save **+2** |
| Cards | Yellow **−10**, red **−20**, blue **−50** |
| No effect | Tackle, late challenge, switchover. Own goal, own assist and own pre-assist are planned at 0 (see §10) |
| When it applies | The total of a session day (`entry_date`) is applied at the end of that day |
| Floor | A value never drops below 0. The floor applies after each session day |
| Small-sided | In matches with fewer than 7 players in total, a player's first 5 small-sided matches of the season change nothing; the 6th onwards count. The rule can be switched off |
| KFANDRA changes | A plus or minus amount from a chosen date, with a note |

All numbers live in a new `app_config` key, `klc_value_rules`, so KFANDRA can change
them without a developer:

```json
{
  "version": 1,
  "result": { "win": 20, "draw": 5, "loss": -10 },
  "stats": {
    "goal": 2, "mainGoal": 2, "reboundGoal": 2, "try": 2, "conversion": 2,
    "assist": 1, "preAssist": 0.5, "save": 2,
    "yellowCard": -10, "redCard": -20, "blueCard": -50
  },
  "floor": 0,
  "smallSided": { "enabled": true, "belowPlayers": 7, "freeMatches": 5 }
}
```

A stat key that is missing from `stats` is worth 0. The parser follows the existing
pattern, `parseX(value)`, which falls back to `DEFAULT_VALUE_RULES` field by field.
The config contract test gains the new key.

## 3. The friendly mark (Helper-3u5)

### Data

`klc_matches.is_official_friendly boolean not null default false`, with
`check (is_friendly or not is_official_friendly)`. A league match is never marked:
it is "official" once KFANDRA makes it so (`status = 'submitted'`).

### Who can change it

- **KFANDRA** (`kfandra` or `super_admin`): any friendly, any time.
- **A manager of a club on either side**, at any status (draft, sent or submitted),
  unless the friendly's date falls in a **closed** season.

These rules live in a pure helper in `access.ts`,
`canSetFriendlyMark(viewer, managedClubIds, match, seasonClosed)`.

### Where it shows

- **Match screen:** an "Official / Unofficial" switch for friendlies. When the
  viewer can't change it, it shows as a read-only label.
- **Matches tab and match lists:** an "Official friendly" badge.

### Logging and storage

- Every change goes into `audit_log`, with `action = 'klc.friendly_mark'`,
  `entity_type = 'klc_match'` and `diff = { from, to }`.
- The change is a server action. It checks permission and writes with the service
  role, like the existing match actions.
- No change to the submit lock is needed. `app.klc_enforce_submit_lock` covers
  only the child tables (halves, sides, appearances, stats), not `klc_matches`.
  The server action is the only writer of this column on a submitted match.

### What it changes

On its own, nothing yet. Official friendlies start counting for values when
bsr.18 ships, and for ticket money later. They never count towards league points,
the match fee or win bonus, or scorers.

## 4. The register (Helper-bsr.18)

### Data

| Table / column | Purpose |
|---|---|
| `players.klc_name text null` | The official KLC name. Kept per player, because names don't change between seasons |
| `klc_player_base_values (season_id, player_id, base_value numeric(10,2) ≥ 0, updated_by, updated_at)`, primary key `(season_id, player_id)` | The starting value for each season. KFANDRA can edit it; the edit is logged to `audit_log` |
| `klc_player_value_changes (id, season_id, player_id, effective_date, amount numeric(10,2) ≠ 0, note text not null, created_by, created_at, voided_at, voided_by, void_note)` | KFANDRA's dated changes. Append-only: a mistake is **voided** with a note, never deleted |

**Row-level security:**
- Both tables can be read by any signed-in user, because values are public.
- There are no insert, update or delete policies. Writes go through server actions
  that check `canReopenMatch(viewer)` (KFANDRA or `super_admin`) and use the service
  role.

### Who is in the register

The managers of active clubs (`clubs.is_active` and `manager_player_id` not null).
If a player manages more than one active club, the register flags it, and the club
with the lowest `sort_order` is used.

### The admin screen: Admin › KLC › Register

Access: KFANDRA and `super_admin`. It has a season picker, which defaults to the
active season, otherwise the upcoming one.

**One row per manager:**
- official name (editable)
- club
- base value (editable)
- current value
- last session's change

**Flags:**
- **No base value yet.** This player isn't valued and isn't on the Values tab.
- **Played without a base value.** This player appeared in a counted match without
  one.
- **Manages more than one club.**

**Per player, value changes:**
- A list of the player's changes.
- An **Add change** form: date, plus or minus amount, and a note (required).
- **Void**, which needs a note.

## 5. Working out values

Values are **never stored**. They are worked out on every read from the base value,
the counted matches and KFANDRA's changes. Corrections then need no clean-up:
- reopening a match takes it out of the count
- fixing a score or a stat changes the result
- switching a friendly's mark adds or removes it
- editing a base value or voiding a change updates the value straight away

The league table already works this way.

### Pure module

`src/lib/klcsra/player-values.ts`, with no database or server imports, so it is
unit-tested in full:

```ts
computePlayerValues({
  players,      // register rows: playerId, klcName, displayName, clubId, baseValue | null
  matches,      // counted MatchDrafts (already filtered)
  changes,      // non-voided value changes for the season
  rules,        // ValueRules
}): PlayerValue[]

interface PlayerValue {
  playerId: string;
  baseValue: number | null;
  current: number | null;            // null when there is no base value
  lastSession: { date: string; change: number } | null;
  sessions: SessionValue[];          // oldest first
  playedWithoutBase: boolean;
}

interface SessionValue {
  date: string;                      // entry_date
  matches: MatchValueLine[];         // one per counted match the player appeared in
  changes: { id: string; amount: number; note: string }[];
  total: number;                     // sum before the floor
  valueAfter: number;                // max(floor, previous + total)
  hitFloor: boolean;
}

interface MatchValueLine {
  matchId: string;
  label: string;                     // "Club A v Club B", using sideClubLabel
  kind: "league" | "official_friendly";
  result: "win" | "draw" | "loss" | null;  // null for an incomplete or 1-player match
  resultChange: number;
  stats: { statKey: StatKey; count: number; change: number }[];
  smallSidedFree: number | null;     // 1..5 when this match was one of the free ones, else null
  total: number;                     // 0 when smallSidedFree is set
}
```

### The steps

1. **The side's result.**
   - The player's side (`appearance.side`) is scored with the same rules the league
     table uses (`toLeagueMatch`, `countedHalves`): the higher total score over the
     counted halves wins.
   - A Combined match is one result over both halves.
   - The new helper `sideOutcome(match, side)` lives next to `computeMatchPoints`
     and reuses its comparison.
   - A match the league table can't score (an incomplete half, or fewer than 2
     players) gives the player no result change. Their stats still count.
2. **Stats:** every half's stats for the appearance, each multiplied by its rate.
3. **The small-sided rule:**
   - A match is small-sided when `totalPlayers < belowPlayers`, counting distinct
     players in the appearances, as the league table does.
   - For each player, their small-sided matches in the season are put in order by
     `entryDate`, then `submittedAt`, then `id`. The first `freeMatches` count as 0.
4. **Session days:** the match totals are grouped by `entry_date`. A KFANDRA change
   joins the session on its `effective_date`. A change dated on a day with no match
   becomes a session of its own.
5. **Running value:** start at the base value, then for each session in date order,
   `value = max(floor, value + total)`.
6. **Players without a base value** are left out of the Values tab and flagged on
   the register.

### Reading the data

`listCountedMatches(season)` in `league-repository.ts`, which keeps the public-read
guarantee (`status = 'submitted'` on every query):

- league matches with `season_id = season.id`
- friendlies with `is_official_friendly = true` and `entry_date` inside the
  season's window (the same window rule as `listSubmittedMatchDrafts`)

`listSubmittedMatchDrafts` already loads both lists. The new function filters its
result rather than querying a second time.

The register and the value changes come from `value-repository.ts` (new,
server-only).

## 6. Where people see values

### KLC League › Values tab (everyone)

- A new tab, `?tab=values`, which uses the existing season picker.
- It ranks players by current value, showing:
  - rank
  - official name, or the app name if none is set
  - club
  - current value
  - last session's change, with an up or down arrow and the date
- Players with no base value aren't listed.
- Before any base values are entered, it shows: "Values appear once KFANDRA has
  entered the base values for this season."

### Player value history: `/klc/league/values/[playerId]?season=`

- A header with the official name, club, base value and current value.
- One card per session, newest first: the date, each match (its label, result
  change, stat lines and a "free small-sided match n of 5" note), KFANDRA's changes
  with their notes, the session total, the value after it, and "stopped at 0" when
  the floor applied.

### Official names elsewhere

The Leaders tab and scorer lists show `klc_name` when it is set. The player lookup
already happens in `toStatRows` via `displayName`, so the repository adds
`klc_name` to the player join and boards prefer it.

## 7. Errors and edge cases

| Case | Behaviour |
|---|---|
| A match is reopened | It drops out of the counted matches, and values recalculate on the next read |
| A friendly's mark changes after the match | It is added to or removed from the count, and the change is logged |
| A friendly's date falls outside every season | It never counts. The mark can still be set, and the match screen says "Not inside a season: won't change values" |
| A base value is edited mid-season | Every session is recalculated from the new start |
| A KFANDRA change is voided | Removed from the calculation. The history keeps it, struck through |
| A negative change takes the value below 0 | It stops at 0, and that session shows "stopped at 0" |
| A player with no base value plays | Not valued. Flagged on the register |
| `klc_value_rules` is missing or invalid | Falls back to the defaults field by field, like the other KLC config keys |

## 8. Testing

**Unit tests (Vitest), written first:**
- `player-values.test.ts`:
  - win, draw and loss
  - each stat and each card
  - an unknown stat counting 0
  - a Combined match
  - an incomplete match (stats only)
  - official friendlies counting and unofficial ones not
  - the small-sided rule: the 6th match counts, the switch turns it off, and the
    matches are put in the right order
  - the floor applying per session day
  - KFANDRA changes, including one on a day with no match and a voided one
  - a player with no base value
  - "last session" being the newest
  - Sir's worked example (200 → 223 → 203)
- `value-rules.test.ts`: parsing and field-by-field fallbacks.
- `access.test.ts`: `canSetFriendlyMark` for KFANDRA, a manager of a club in the
  match, another manager, a closed season and a league match.
- `config-contract.test.ts`: `klc_value_rules` in the migration deep-equals
  `DEFAULT_VALUE_RULES`.
- Repository test: the counted-matches query keeps `status = 'submitted'` and the
  official-friendly filter.

**End-to-end tests (Playwright, local Supabase only):**
- A manager marks a friendly Official, and another manager can't.
- KFANDRA enters base values on the register, and a non-KFANDRA user is refused.
- A submitted league match changes the values on the Values tab.
- KFANDRA adds a dated change, and the history shows it.

## 9. Rollout

1. Helper-3u5 (the friendly mark): one PR and one migration.
2. Helper-bsr.18 (register and values): one PR and one migration (new tables,
   `players.klc_name` and the `klc_value_rules` seed).
3. After each merge, Jaidev runs `npx supabase db push` on prod. KFANDRA gets a
   heads-up before each goes live.
4. Guides: the KLC league guide gains a "Player values" section and the
   Official/Unofficial mark. The admin guide gains the Register screen.

## 10. Open items (none blocks the build)

| Item | Plan until KFANDRA answers |
|---|---|
| The small-sided "first 5 don't count" rule (question 1 in the review) | Built as agreed on 28 October, with a switch in `klc_value_rules` |
| Own goal, own assist and own pre-assist | 0. One config change if KFANDRA wants them to count |
| Players on an organisation's side | Values change as in any match (review question 3). Organisations come with Loans |
