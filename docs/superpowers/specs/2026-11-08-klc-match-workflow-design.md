# KLC Match Workflow — Design

**Date:** 2026-11-08 · **Bead:** Helper-bsr.16 · **Status:** Draft for Jaidev's review
**Sources:** KFANDRA emails of 23 Oct and 28 Oct 2026; KFANDRA's review of the workflow summary,
`~/Downloads/KFANDRA-response-20261107.pdf` (8 Nov). Decisions are also in bd memory
`klc-match-workflow-decisions`.
**Baseline:** `main` @ `90da0ce`. Prod has **no KLC matches** (checked 2026-11-07), so nothing
needs migrating.

> **Confidential:** one reason behind §5 (why there is no keeper tick) is a KFANDRA rule that is
> not announced yet. It's recorded in bd memory `klc-gk-rotation-confidential`. Don't mention it
> in UI text, guides, commits or PR descriptions.

---

## 1. Goal

Stop double entry and make KFANDRA the only person who sets a league result.

- Managers record everything **except the score**.
- Each club enters **its own team**, on **one shared match**.
- A league match counts in the tables only once KFANDRA (or an admin) has entered the
  official score and made it official.

Also in this package: a duplicate-match warning, a **Conversion** stat, and **goal/try times**.

**Not in this package:**
- loans (Helper-bsr.20)
- player values (bsr.18)
- formal names such as "A. Sharma" (these come from the player register, bsr.18; until then the
  app shows today's display name)
- balance-sheet write-back (bsr.19)

## 2. Decisions

| # | Decision | Who, when |
|---|---|---|
| D1 | Managers record date, match type, clubs, players, stats (cards included) and goal times. They **don't enter a league score**. | KFANDRA 28 Oct; confirmed 8 Nov |
| D2 | Once a team is sent, its manager can't change it. | Jaidev 4 Nov; KFANDRA 8 Nov |
| D3 | KFANDRA or an admin edits anything, enters the official score and taps **Make official**. Only then does the match count in tables and get tagged to the active season. | KFANDRA 28 Oct, 8 Nov |
| D4 | The app shows the managers' goal tally next to KFANDRA's score. A difference is a warning only, and **KFANDRA's score wins**. | Jaidev 28 Oct |
| D5 | KFANDRA can **Send back** a sent match to the managers. | KFANDRA 8 Nov |
| D6 | Only KFANDRA (not a plain admin) can **Reopen** an official match. | Unchanged, re-confirmed 8 Nov |
| D7 | **Friendlies** keep today's flow: managers enter the score themselves. KFANDRA has no step. | Jaidev 4 Nov; KFANDRA 8 Nov |
| D8 | **Duplicate warning:** if the same date and the same two clubs already have a match, warn and offer to open it. Warn, don't block: two clubs can play twice in a morning. | KFANDRA 8 Nov |
| D9 | **Each club enters its own team only.** | Jaidev 8 Nov (KFANDRA 16 Oct: "Club A fills in… Club B will do the same") |
| D10 | **No keeper tick.** All saves by any player count the same. A save means a *proper* save (a shot on target, or one that stops a clear chance). This is a ground rule, explained to players; the app doesn't check it. | KFANDRA 8 Nov |
| D11 | **Conversion** is a new Rugby Sox stat. It counts in the team score like a try and pays the try rate. | Jaidev 4 Nov; KFANDRA 8 Nov |
| D12 | **Goal/try times:** optional whole minutes, for league Fooba goals (main and rebound) and Rugby Sox tries. Managers enter them after checking with the referee. | KFANDRA 23 Oct, 8 Nov |
| D13 | KFANDRA can add or fix goal times on an **official** match without reopening it. Times don't affect the score or the tables. | Jaidev 8 Nov |

## 3. Match states

```
League:   Draft ──(both teams sent)──▶ Sent ──Make official──▶ Official
            ▲                           │                        │
            └──────── Send back ────────┘◀──── Reopen (KFANDRA) ─┘
Friendly: Draft ──(both teams sent)──▶ Submitted
```

**How the states map to the database:**
- **Official** keeps the existing `submitted` status. The league read model, public RLS, the
  submit-lock triggers and the leaderboards all filter on `status = 'submitted'`, so they need
  no change.
- **Sent** is a new status, `sent`. Like `draft`, it's hidden from players.

### 3.1 Teams

A **team** is one aggregate side, home or away, for the whole match. In a combined match it is
the club pair that leads that side.

A manager **owns a team** when any club they manage leads that side in any half.

**What a manager can do:**

| Action | Allowed when |
|---|---|
| Add or remove players and stats **in their own team** | Their team isn't sent and the match is a draft |
| Change match details (date, type, Combined, Friendly) | Neither team has been sent |
| Change the clubs on their own side | Neither team has been sent; the rule that a manager must keep their own club still applies |
| Set the **other** side's club | Only while that side has no players. This is how the creator names the opponent; after that it belongs to the opponent's manager. |
| Enter the score | **Friendlies only**, either manager, while the match is a draft and neither team has been sent |
| See the other team | Always, read-only |

**Send my team:**
- Each manager taps **Send my team**, which stamps `home_sent_at` or `away_sent_at`.
- When the second team is sent, the match moves on automatically: a league match to **Sent**,
  a friendly to **Submitted**.
- Before sending, the manager sees the same checks as today's Submit:
  - clubs on both sides
  - at least one player in their own team
  - no club on both slots
- A manager can't un-send. Only KFANDRA's **Send back** reopens a team.

**Staff** (KFANDRA, admin, super_admin):
- Can edit both teams and every field at any time before Official.
- Don't need to send. **Make official** works from Draft or Sent, for example when one club never
  sends, or when staff record the match themselves.

### 3.2 KFANDRA's step (league matches)

- The **Record a match** page shows staff a **Waiting for KFANDRA** list first: Sent matches,
  oldest first.
- Draft matches where one team has been sent show "1 of 2 teams sent".
- In a Sent match, staff see:
  - **Score boxes**, per half for combined matches, as today.
  - **The tally line** next to them, e.g. *"Recorded goals: Kraken 3 – 1 Paper Tigers"*. If it
    differs from the entered score, the line is amber with *"Differs from the recorded goals.
    Your score is used."*
  - **The League points preview**, as today, computed from the official score.
  - **Make official**. It needs an active season, and stamps the season, as Submit does today.
  - **Send back**. It clears both sent stamps and returns the match to Draft.
- **Reopen** (KFANDRA only) takes an Official league match back to **Sent**, not Draft, and clears
  its season. Today's Reopen goes to Draft. A reopened friendly goes back to Draft, as today.

### 3.3 Goal tally (pure function)

For each side, per counted half, summed over halves exactly as `matchResult` aggregates:

```
tally(side) = own goal, mainGoal, reboundGoal, try and conversion
            + the OTHER side's ownGoal
```

The tally is shown to staff only. It never changes the score.

## 4. Duplicate warning

**New match form:**
- Gains an **Opponent** club picker. It's required for managers, and optional for staff
  (who may not know yet).
- On **+ New match**, the server looks for any match (draft, sent or official; league or friendly)
  on the same date where the two chosen clubs lead opposite sides in any half.
- If one exists, nothing is created. The form shows:

  > Kraken vs Paper Tigers already has a match on 8 Nov (Draft, 1 of 2 teams sent).
  > **Open it** · **Create a new match anyway**

- If more than one exists, each is listed with its own **Open it**.

**Recorder banner:**
- Shows the same warning while a duplicate exists, for example when clubs are changed later.
- Shows to managers and staff, including staff in the Sent view before Make official.
- **This is a different match** dismisses it for that viewer in local storage. It's a
  convenience only.

**Pure function:** `findDuplicates(target, candidates)`. The repository supplies same-date
candidates.

## 5. Saves and keepers

There is no new UI and no schema change. `save` stays one stat for every player (D10).
Player-value rules (bsr.18) count every save as +2 KR.

The guide wording for the Save button: *"a proper save: a shot on target, or a save that stops a
clear chance"*. Nothing else is said about keepers.

## 6. Conversion stat

- **New `StatKey` `conversion`**, labelled "Conversion" and placed after `try` in `STAT_KEYS`.
- **Rate:** `{kr: 25, mmg: 500}`, the try rate, in `app_config.klcsra_stat_rates`.
- **Allowed in:** `rugby`, `rugby_variation`, `short_game_variation` and `multi_game_variation`
  (the variations allow every stat). Set in `app_config.klcsra_sport_stats`.
- **Leaders:** the Tries board counts tries plus conversions.
- **Defaults:** the TypeScript defaults change, and `config-contract.test.ts` points both keys at
  the new migration.

## 7. Goal and try times

**Data:**
- `klc_player_stats.minutes int[] not null default '{}'`, one entry per event, in entry order.
- Check constraints:
  - `cardinality(minutes) <= stat_count`
  - every entry is between 0 and 150
- Lowering a count below the number of times recorded drops the latest times (in the action),
  then saves.

**Where times apply:** `mainGoal` and `reboundGoal` in Fooba, and `try` in Rugby Sox, on
**league** matches only. The list is a constant, `TIMED_STATS`.

**Entry:**
- In the stats popup, each timed stat with a count shows one small minute box per event.
- Times are optional, and never block Send or Make official.
- **Who can enter them:**
  - a manager, for their own team while it's editable
  - staff, any time before Official
  - staff on an Official match (D13), through a separate action, `setGoalTimesAction`

**Lock exception (D13):**
- The `klc_player_stats` submit-lock trigger lets an UPDATE through on a submitted match **only
  when `minutes` is the only column that changed**.
- `setGoalTimesAction` checks for staff and rejects any count change.
- A manager can never reach it.

**Display:**
- The match view gets a **Scorers** line per team, e.g. *"Caveman (12', 34') · Acid"*.
- Untimed goals show the name alone.

## 8. Schema changes (one migration)

1. **`klc_matches.status` check:** add `'sent'`.
2. **`klc_matches`:** add `home_sent_at timestamptz` and `away_sent_at timestamptz`.
   - A check keeps `'sent'` league-only: `status <> 'sent' or not is_friendly`.
3. **`klc_player_stats`:** add `minutes int[]` with the checks in §7.
4. **The submit-lock trigger function:** adds the minutes-only exception for `klc_player_stats`.
5. **`app_config` upserts:** `klcsra_stat_rates` (adds `conversion`) and `klcsra_sport_stats`
   (adds `conversion`).

**Code changes outside the migration:**
- `closeSeasonAction`'s draft guard counts `draft` **and** `sent` matches dated in the season.
- Public RLS stays `submitted` only.

## 9. Code map

| Area | Change |
|---|---|
| `src/lib/klcsra/access.ts` | `ownedSides(viewer, match, managed)`, `canEditTeam`, `canEditDetails`, `canSetOpponentClub`, `canMakeOfficial` (staff), `canSendBack` (staff). Pure, unit-tested. |
| `src/lib/klcsra/tally.ts` (new) | `goalTally(match)`. Pure. |
| `src/lib/klcsra/duplicates.ts` (new) | `findDuplicates`. Pure. |
| `src/lib/klcsra/goal-times.ts` (new) | `TIMED_STATS`, `isTimed(sport, stat, isFriendly)`, `trimTimes`, `scorersLine`. Pure. |
| `src/lib/klcsra/actions.ts` | `sendTeamAction`, `makeOfficialAction`, `sendBackAction`, `setGoalTimesAction`; `createMatchAction` gains opponent and duplicate check; the team and score gates; Reopen goes to Sent for league matches. Old `submitMatchAction` is removed; friendlies submit through `sendTeamAction`. |
| `src/lib/klcsra/repository.ts` | status `sent`, sent stamps, minutes, same-date candidates. |
| `src/lib/klcsra/stat-rates.ts`, `sport-stats.ts`, `leaderboards.ts` | conversion. |
| Recorder UI (`src/app/klc/matches/**`) | Opponent picker, duplicate dialog and banner, per-team lock, Send my team, staff score and tally panel, Make official / Send back, minute boxes, Scorers line, Waiting for KFANDRA list. |
| `docs/klc-league-guide.md` (+ PDF, screenshots) | New flow, Conversion, goal times, the "proper save" wording. |

## 10. Error handling

Every new action re-resolves the caller and returns a human message, as today. New messages:

- *"Your team has been sent. Ask KFANDRA to send it back if something needs fixing."*
- *"Only KFANDRA or an admin can enter a league score."*
- *"You can only edit your own team."*
- *"Waiting for KFANDRA to make this official."* (a manager opens a Sent match)
- *"More times than goals: lower the times first."* (a defensive check; the UI trims)
- **Make official with no active season:** today's *"No active season…"* message.

## 11. Testing

**Unit (Vitest):**
- **Access rules per state and role:**
  - a manager can edit only their own team
  - nothing is editable after sending
  - the opponent club is settable only while that side is empty
  - staff can do everything
  - only KFANDRA can reopen
- **Tally:** own goals and conversions; combined aggregation.
- **`findDuplicates`:** a same-date pair; reversed sides; a combined pair member; a different
  date isn't a duplicate.
- **Goal times:** `isTimed` per sport, league vs friendly; trimming; `scorersLine` formatting.
- **Config contract:** conversion in rates and sport stats.
- **Mocked-client:** `makeOfficialAction` stamps the season; `sendBackAction` clears the stamps.

**DB (local Supabase, run from e2e setup):**
- `sent` is rejected for friendlies.
- The minutes-only update passes on an official match.
- Any other change on an official match is still blocked.
- The cardinality check holds.

**E2E (Playwright, local only):**
1. Manager A creates a match against B, adds their team, sends it, and can't edit it.
2. Manager B gets the duplicate warning, opens the existing match, adds their team and sends it.
   The match shows as Sent.
3. Staff sees it under Waiting for KFANDRA, enters a score that differs from the tally, sees the
   amber line, and makes it official. The league table updates.
4. Staff adds a goal time to the official match, and the Scorers line shows it.
5. A friendly: both managers send their teams and it's submitted, with no staff step.

## 12. Open points for review

1. **Per-team send (§3.1).** Each manager sends their own team, and the match moves on when both
   are sent. This follows from D9. The alternative is one Send for the whole match, by either
   manager, which is simpler but lets one club send before the other has entered its team.
2. **Friendlies use per-team send too.** This keeps one flow for managers. Today either manager
   submits a friendly on their own.
3. **Reopen goes to Sent.** It doesn't go back to Draft, so KFANDRA edits and re-officials
   without the managers being involved.
