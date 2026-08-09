# Club Balance Sheet — User Experience

**A proposed new feature for the KFANDRA app · For KFANDRA review**

> This document describes how the new **Club Balance Sheet** would look and feel
> for everyone who touches it — a player in a club, a club's Player Manager, and
> KFANDRA/Admin. Nothing here is built yet: this is the plan, written for you to
> review and approve (or ask for changes) before any work begins.

---

## In one sentence

Each club gets its own private balance sheet inside the app. A club's own members
fill it in, the app does all the Kroopies maths automatically, and **only that
club and KFANDRA can see it** — so KFANDRA can read every sheet in one place and
copy-paste the figures out to each club whenever needed.

---

## Who sees what

| Person | What they can do |
| --- | --- |
| A player | Opens **only their own club's** sheet. Can view and edit it. |
| Other clubs' sheets | Visible as a logo only — **locked**, no numbers shown. |
| KFANDRA / Admin | Sees and can edit **every** club's sheet, all in one place. |

This is the core privacy promise: a club's numbers are known **only to that club
and to KFANDRA**. No club can see another club's figures.

---

## The journey, screen by screen

### 1. The opening page — a new "Club Balance Sheet" block

When anyone opens the app, alongside the existing MMG, Strength & Conditioning,
and Diet blocks there is now a new block:

> **Club Balance Sheet** — Bal. Sheet

Tapping it opens the balance-sheet area.

### 2. The clubs page — "KLCFERRSXVSG1"

This page is titled **KLCFERRSXVSG1** and shows **all 13 club logos** together,
like a wall of crests.

- The player's **own** club is active — tap it to open the sheet.
- The other **12** clubs appear as logos but are **locked** (a small lock icon,
  no figures shown). Tapping them does nothing.
- KFANDRA/Admin can open any of the 13.

> If a player hasn't been assigned to a club yet, every crest is locked and a
> short note explains they aren't in a club yet.

### 3. The club page — name, manager, and the sheet

Tapping your club opens its page. At the top:

- The **Club name**
- **Player Manager — [the manager's name]**
- The heading **Club Balance Sheet**

Below that is the sheet itself, as a simple top-to-bottom list.

---

## The Balance Sheet — what you fill in, what the app works out

The sheet is one **running** sheet per club: you keep the same sheet and update
it over time (there is no need to start a new one each match). Everything you type
**saves automatically** as you go — there is no "submit" button to remember.

### You type these in

| # | Item | What it is |
| --- | --- | --- |
| 1 | **Date** | The date the sheet is current as of. |
| 2 | **Matches played** | A number. |
| 3 | **Matches won** | A number. |
| 4 | **The 13 players** | Each player's name is listed with a small box next to it — type a number (e.g. 1, 2, …) against each. |
| 5 | **Matches drawn** | A number (recorded only). |
| 6 | **Matches lost** | A number (recorded only). |
| 7 | **Club Bonus from KFANDRA** | A number, in Kroopies. |

> The 13 player names come from the club's roster — the members KFANDRA has
> assigned to that club — so managers don't have to type names, only the numbers.

### The app works these out for you — automatically, in Kroopies

You never calculate these by hand. As soon as you enter the numbers above, these
update on screen:

| # | Item | How it's worked out |
| --- | --- | --- |
| 8 | **Total to be paid to KFANDRA** | Matches played **× 10** |
| 9 | **Total to be received by the Club from KFANDRA** | (Matches won **× 20**) **plus** the Club Bonus (item 7) |
| 10 | **Total to be distributed to the loanees** | Each player's number **× 10**, added up across all 13 players |

**A worked example.** Suppose a club has played 6, won 4, and KFANDRA has given a
Club Bonus of 50 Kroopies, and the players' numbers add up to 9:

- **Item 8 — paid to KFANDRA:** 6 × 10 = **60 Kroopies**
- **Item 9 — received from KFANDRA:** (4 × 20) + 50 = 80 + 50 = **130 Kroopies**
- **Item 10 — distributed to loanees:** 9 × 10 = **90 Kroopies**

If any input changes, these three totals instantly change with it.

> The "× 10", "× 20", "× 10" rates are settings KFANDRA can adjust later without
> any app rebuild — they are not baked into the app.

---

## What KFANDRA sees (the Admin view)

Just like the Diet and MMG data you already review, KFANDRA gets a dedicated
**Club Balance Sheet** area in the Admin section:

1. A list of all **13 clubs**.
2. Tap a club to see its **full sheet** — every figure (items 1–10) plus each of
   the 13 players' numbers — laid out cleanly.
3. A **"Copy sheet as text"** button, so you can copy a club's figures in one tap
   and paste them straight into a message to that club.

This keeps every club's data in one place for KFANDRA, while each club only ever
sees its own — exactly the arrangement you asked for.

---

## What we'd need from KFANDRA to finish

To load the real clubs, we'll need:

1. The **13 club names**.
2. Each club's **Player Manager name**.
3. The **13 logo images** (one per club).
4. The **player → club mapping** — which member belongs to which club (this also
   fills in each club's 13-name roster automatically).

Until those arrive, the feature will be built and demonstrated with 13
placeholder clubs, then the real names, crests and rosters dropped in.

---

## Decisions already agreed (for the record)

- Each **player belongs to one club**; a player can open and edit **only** their
  own club's sheet.
- Every club has **one running balance sheet** it keeps updating (not a new one
  per match).
- The clubs page is titled exactly **KLCFERRSXVSG1**.
- **Player Manager** is a name shown at the top of the club's page.

---

## Not in this version (noted for later)

- KFANDRA charging a **different loan amount per individual player** — you noted
  this is for a later email, so it is intentionally left out for now. Today's
  design handles the club-level figures above cleanly, and per-player loan rates
  can be added on top later.

---

*Prepared for KFANDRA review. Please mark anything you'd like changed and send it
back — nothing is built until this is approved.*
