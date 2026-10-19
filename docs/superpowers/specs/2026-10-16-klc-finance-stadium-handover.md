# KLC Club Finances: Locked Balance Sheet, Stadium & Ticket Sales — Handover

**Date:** 2026-10-16
**Status:** Handover. It is the input to brainstorm → spec → plan (superpowers flow).
**Source:** KFANDRA email of 2026-10-02 (`docs/KFANDRA-Jacaranda-updates-2026-10-02.pdf`).
**Priority:** 3rd. It follows Diet and the League Scoring package (`2026-10-16-klc-league-scoring-handover.md`), and starts soon after the league is running.
**Codebase baseline:** `main` @ `ae0fba3`.
**Parent bead:** Helper-bsr. This package absorbs KLCSRA **Phase 5 (balance-sheet write-back)** from `2026-08-23-klcsra-release-roadmap.md`.
**Estimate:** ~2 weeks.

---

## 1. Requirements (as asked by KFANDRA)

| ID | Requirement | Notes |
|---|---|---|
| F1 | The **Balance Sheet is not editable**. The stadium and ticket concept are not editable either. | This contrasts with matches, which stay re-editable "on trust". |
| F2 | Each club starts with a **Stadium of 10,000 seats** and has room to expand over seasons. | |
| F3 | **Ticket sales** connect directly to the Club Balance Sheet. | |
| F4 | **Ticket price** ranges from free to **100 Kroopies**. | |
| F5 | The ticket-sales pop-up is **editable until 04:00 on the day of the session/match**. | IST |
| F6 | ~~KFANDRA gives each match a **rating out of 10**. The number of tickets sold is **chosen at random** from the band for that rating (table below).~~ **Superseded by KFANDRA, 2026-10-16:** each club in a match gets **its own rating**. A club's **first** match: KFANDRA enters tickets sold by hand. After that, tickets sold = f(club's rating, club's ticket price, KFANDRA's "ticket price limit"). The formula is **not decided yet** (KFANDRA: "the AI algorithm that we'll fix"). | See Q13–Q15 |
| F7 | Clubs **buy 1,000 seats at a time for 10,000 KR** through the Balance Sheet, and capacity updates. | |
| F8 | Future (not now): **F&B stalls, maintenance costs**, "and more". | The design must make these easy to add. |

### Rating → seats sold band (F6)

| Rating | Seats sold (random, inclusive) |
|---|---|
| 1 | 1 – 20 |
| 2 | 21 – 30 |
| 3 | 31 – 50 |
| 4 | 51 – 100 |
| 5 | 101 – 1,000 |
| 6 | 1,001 – 2,000 |
| 7 | 2,001 – 5,000 |
| 8 | 5,001 – 7,000 |
| 9 | 7,001 – 9,000 |
| 10 | 9,001 – 10,000 |

Seats sold can never exceed the club's current capacity.

> **Status (2026-10-16):** this band table is the original proposal. KFANDRA has replaced the random draw with a rating + price formula (F6), and a bigger stadium must be able to sell more than 10,000 (Q2). Keep the bands only as a possible input to that formula. **Ticket sales (§3.4 draw) are blocked until the formula is agreed.** The ledger, stadium, seat purchase and opening balance are not blocked.

---

## 2. Current state (what exists in code)

| Area | Where | State |
|---|---|---|
| Balance sheet rows | `club_balance_sheets` (migration `20260720120000`): one row per club per `entry_date` with played/won/drawn/lost and `club_bonus` | **The manager has full CRUD, and so does staff.** "Any date's entry stays editable." |
| Loanee rows | `club_player_shares(club_id, entry_date, player_id, amount, source)` | Manager-entered. A `source` of `match:<uuid>` is reserved for recorder write-back (`20260815120100`). |
| Results source | `club_balance_sheets.results_source` | Reserved for write-back. Not used yet. |
| Money maths | `app_config.klc_rates` `{playedToKfandra:10, wonFromKfandra:20, loaneePerShare:10}` | Items 8/9/10 are **flows per date**. There is **no running club balance**. |
| Write-back | — | **Not built** (Phase 5). The submit action already emits a write-back payload (Phase 2). |
| Repository delete bug | `src/lib/klc/repository.ts:112` | Deletes **all** share rows for a club and date, including match-sourced ones (**Helper-3jr, P1**). |
| UI | `/klc`, `/klc/[clubId]`, `/admin/klc` | Editable sheet for managers. Copy-as-text for KFANDRA. |
| Stadium / tickets / rating | — | Nothing exists. |

**Key gap:** buying seats ("can the club afford 10,000 KR?") and ticket revenue both need a **running Kroopie balance per club**. Today's sheet has none. It only computes what's owed and received per date.

---

## 3. Proposed spec

### 3.1 Append-only club ledger (core of F1/F3/F7/F8)
Add a new table, `club_ledger_entries`:

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| club_id | uuid → clubs | |
| season_id | uuid → klc_seasons, nullable | |
| entry_date | date | session date |
| kind | text check | `opening_balance`, `match_fee` (item 8), `match_win` (item 9), `club_bonus` (item 7), `loanee_payout` (item 10), `ticket_sales`, `seat_purchase`, `adjustment`, and later `fnb_*`, `maintenance` |
| amount_kr | numeric | signed. + means into the club, − means out of the club |
| quantity | int, nullable | seats sold, seats bought, matches, shares |
| unit_kr | numeric, nullable | ticket price, cost per 1,000 seats, rate |
| source | text, nullable | `match:<uuid>`, `purchase:<uuid>`, `kfandra` |
| reverses_id | uuid, nullable → self | set on reversal entries |
| note | text | |
| created_by | uuid → players | |
| created_at | timestamptz | |

- The ledger is **immutable**: no UPDATE or DELETE grants, plus a trigger that rejects both. Corrections are **reversal entries** (`reverses_id`) followed by new entries. This gives a non-editable sheet that still allows full correction, with an audit trail.
- **Club balance** = `sum(amount_kr)`. Expose it as a view `club_balances` and a per-entry running total in the UI.
- All writes go through server actions using the service role. RLS allows SELECT for the club's manager, the club's members (to match the current "own club only" privacy) and staff. There are **no client writes**.
- New lines like F&B and maintenance become new `kind` values plus rates in `app_config`. No schema change is needed for them (F8).

### 3.2 Existing balance sheet → derived and read-only
- `club_balance_sheets` and `club_player_shares` become **write-locked for managers**. Drop the manager write policies and keep select.
- On **league match submit** (Phase 5), write ledger entries per club (both clubs get `ticket_sales`, Q1):
  - `match_fee`: −10 per match played
  - `match_win`: +20 per win
  - `loanee_payout`: the final per-player KR from the recorder, which per spec v0.4 overwrites the loanee amounts
  - `ticket_sales`: see 3.4
- Also fill `club_balance_sheets` and `club_player_shares` with `results_source` / `source = match:<id>`, so the existing sheet screens keep working, now read-only.
- **Club Bonus (item 7)** becomes a KFANDRA-only `club_bonus` ledger entry.
- **Reopen** writes reversal entries for that match's ledger rows. Resubmit writes fresh ones. The match itself stays re-editable (R8 in the scoring handover), and the money trail stays immutable.
- **Fix Helper-3jr first**: scope the repository delete to `source is null`, or retire the manual save path entirely once managers can't edit.
- Friendlies write nothing (unchanged from spec v0.4).

### 3.3 Stadium (F2/F7)
- Capacity is **derived, not stored mutable**:
  `capacity = stadium_base_seats + 1000 × (count of seat_purchase entries net of reversals)`.
- Config `app_config.klc_stadium`: `{ "baseSeats": 10000, "blockSeats": 1000, "blockCostKr": 10000, "maxSeats": null }`.
- **Buy seats** action (club manager; KFANDRA too, see Q6):
  1. Confirm dialog showing "1,000 seats for 10,000 KR, balance after: X".
  2. Server re-checks the balance (Q5).
  3. Writes a `seat_purchase` entry (−10,000, qty 1,000).
  4. The stadium card updates.

### 3.4 Ticket sales (F3–F6)
- **Price is per club per session date, not per match.** Matches are created by KFANDRA on the day, often after 04:00, so a per-match price could never be set in time.
- New table `club_ticket_prices(club_id, session_date, price_kr int check 0..100, set_by, set_at)`, unique `(club_id, session_date)`.
  - Editable by the manager until **04:00 Asia/Kolkata on `session_date`**. Enforce this in the server action and by a DB trigger comparing `now()` to `(session_date + 04:00) at time zone 'Asia/Kolkata'`.
  - After the cutoff it is locked for everyone (F1).
  - No price set for a date → **carry forward the club's last price, else 0 (free)** (Q4).
- **Match rating** (*superseded 2026-10-16: one rating **per club per match**, e.g. on `klc_match_ticket_sales`, not one on `klc_matches`; see F6/Q13–Q15*): add `klc_matches.rating smallint check 1..10`.
  - Set by KFANDRA in the recorder (KFANDRA role only).
  - Required before **Submit** for league matches.
- **Draw on submit** (once):
  1. For **each club in the match** (both sell, Q1), pick `seats = random_int(band.min, band.max)` using a server-side CSPRNG.
  2. Cap at that club's capacity on `entry_date`.
  3. Store `klc_match_ticket_sales(match_id, club_id, rating, band_min, band_max, seats_sold, price_kr, revenue_kr, drawn_at)`, unique `(match_id, club_id)`.
  4. Write a `ticket_sales` ledger entry: +revenue, qty seats, unit price.
- **Reopen** reverses the ledger entry but **keeps the stored draw**. Resubmit reuses the same seats, unless the rating changed, in which case it redraws (Q3).
- Band table lives in config `app_config.klc_ticket_bands` (the 10 rows above), so KFANDRA can tune it.

### 3.5 UI
- **Club page** (`/klc/[clubId]`), read-only for everyone:
  - **Balance card**: current Kroopies.
  - **Stadium card**: capacity and a **Buy 1,000 seats** button for the manager.
  - **Tickets card**: the price pop-up for the next session date, with a countdown to the 04:00 lock. After the lock it shows "Locked".
  - **Ledger list** grouped by date, with running balance. Match rows link to the match report.
  - The existing items 1–10 view is kept as a per-date summary computed from the ledger.
- **Recorder**: a rating 1–10 chip row in the submit sheet, and a preview of ticket revenue per selling club.
- **Admin** (`/admin/klc`):
  - KFANDRA adjustment entry form (kind `adjustment` / `club_bonus`, with a required note).
  - Opening balances (one-time per season, Q7).
  - Copy-as-text extended with balance and ticket lines.
- Copy uses `src/content/strings.ts`, saying "KFANDRA", never "Coach".

### 3.6 Tests
- Unit:
  - band draw bounds for each rating
  - capacity cap
  - capacity derivation after purchases and reversals
  - 04:00 IST cutoff edge cases (03:59 / 04:00, dates around midnight)
  - carry-forward price
  - balance check
- DB:
  - ledger UPDATE/DELETE rejected
  - manager cannot write sheet rows
  - price trigger rejects after the cutoff
- e2e (local only):
  - set price → record league match with rating → submit → ledger and balance correct → reopen → reversal → resubmit
  - buy seats → capacity 11,000

---

## 4. Open questions for KFANDRA (defaults used until answered)

KFANDRA replied on 2026-10-16 to Q1, Q2 and Q7. Q13–Q15 come from that reply and are being asked in a follow-up.

| # | Question | Default |
|---|---|---|
| Q1 | **Who sells tickets?** | **Answered (KFANDRA, 2026-10-16):** every club that plays sells, including all clubs in a combined match. Each club sets its **own price**. There are **two ratings per match, one per club** (not one shared rating). Each club's count is capped at its own stadium |
| Q2 | **The bands top out at 10,000**, the starting capacity. Should the bands grow with the stadium? | **Answered (KFANDRA, 2026-10-16): yes.** Seats bought are added to the club's tally, and a bigger stadium must be able to sell more. How the count scales is part of the formula (Q13) |
| Q3 | Once seats are drawn for a match, is the number final even if the match is reopened? | Final unless the rating changes |
| Q4 | Is the ticket price per club **per session** (set before 04:00 that day), or per match? If not set: free, or last price? | Per session. Carry forward the last price, else free |
| Q5 | Can a club **buy seats without enough Kroopies**? Can a balance go below zero? | No. The balance must cover the purchase. Other balances may go negative |
| Q6 | Who can buy seats: the club manager, KFANDRA, or both? | Both |
| Q7 | **Opening balance**: how many Kroopies does each club start S2 with? Should S1 totals carry over? | **Answered (KFANDRA, 2026-10-16):** the amount is secret and comes from pre-KLC sponsorship. **KFANDRA enters it as admin** (preferred), one per club per season, then it is locked. A manager-entered-once option is acceptable but not needed for v1. S1 carry-over: not answered, assume no |
| Q8 | With the sheet locked, **how are mistakes fixed**? Only by KFANDRA adding a correction (visible to the club)? | Yes. KFANDRA-only adjustment entries with a note |
| Q9 | Do **managers still enter anything** (loanee numbers, club bonus)? Or does all of it come from matches and KFANDRA? | Nothing. Loanee KR comes from matches, the bonus from KFANDRA |
| Q10 | Do **friendlies** sell tickets? | No |
| Q11 | Is the rating given **before or after** the match? Is it required for every league match? | After, before Submit. Required |
| Q12 | Is there a **maximum stadium size**? | None |
| Q13 | **Ticket formula**: how do rating, price and the "ticket price limit" give tickets sold? Is the limit a fair maximum price per rating? How does capacity above 10,000 come in? | **Asking KFANDRA.** Blocks §3.4 |
| Q14 | **Who gives the two ratings**: KFANDRA, or each club? Before or after the match? | KFANDRA, after the match, before Submit |
| Q15 | **"First match"** (tickets set by KFANDRA): a club's first official match ever, or its first in each season? | **Asking KFANDRA** |

---

## 5. Prerequisites and related beads
- **Depends on the League Scoring package** (submit lock enforced in the DB, Helper-0gr; touch-parent trigger, Helper-r01). The write-back relies on a locked match being truly locked.
- **Helper-3jr (P1)**: fix before any write-back.
- Production data check before locking: existing `club_balance_sheets` / `club_player_shares` rows for S1/S2 (12 of 13 managers linked; Deep Waters pending). Decide whether to convert existing rows into ledger `opening_balance` / history entries (Q7).
- Deep Waters manager linking (`supabase/snippets/link-club-managers.sql`) should be done before go-live.

## 6. Out of scope
- F&B stalls, maintenance costs and other future economy items (F8). Only the ledger kinds are prepared for them.
- MMG write-back. MMG stays copy-out.
- Website publishing.

## 7. KFANDRA checkpoint (acceptance)
- A manager sets a ticket price the evening before. At 04:00 it locks.
- KFANDRA records a league match, rates each club, and submits. Each club's balance rises by its seats × its price (seats from the agreed formula, or entered by KFANDRA for a club's first match). The match fee, win and loanee lines appear.
- The manager cannot edit any balance-sheet figure. KFANDRA can add a correction, and it shows in the ledger with its note.
- Buying 1,000 seats takes 10,000 KR off the balance and raises capacity to 11,000. With less than 10,000 KR the purchase is refused.
- Reopening a match reverses its money lines. Resubmitting puts them back with the same ticket count.

## 8. Suggested beads (create under Helper-bsr)
1. Fix Helper-3jr (scoped delete / retire manual save)
2. `club_ledger_entries` + immutability trigger + `club_balances` view + RLS
3. Lock manager writes on the sheet tables; KFANDRA adjustment, club bonus and opening-balance actions
4. Phase 5 write-back to the ledger on submit, with reversal on reopen (TDD)
5. Stadium capacity derivation + buy-seats action + config
6. Ticket prices table + 04:00 IST cutoff trigger + carry-forward
7. Match rating field + band config + draw-on-submit + `klc_match_ticket_sales`
8. Club page UI (balance, stadium, tickets, ledger) + recorder rating/preview + admin forms
9. e2e + KFANDRA checkpoint doc + update the usage guide
