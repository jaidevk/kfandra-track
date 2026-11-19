# KLC Club Economy: Player Values, Club Money, Stadium and Tickets

**The next KLC features · For KFANDRA review · 19 November 2026**

<!-- Source of docs/klc-club-economy-review.pdf. Rebuild with `npm run docs:pdf:economy`. -->

> This document describes what the next three pieces of the KLC app will do, in
> plain terms. KFANDRA approved the build order on 18 November. Please read the
> plan and answer the numbered questions, or ask for changes. Where a question
> shows a **planned** answer, we will build that unless KFANDRA says otherwise.

---

## The order

| # | Feature | Status |
|---|---|---|
| 1 | Player register and player values | **Building now** |
| 2 | Club money (running balance) and the stadium | **Building now** |
| 3 | Ticket prices | **Building now**. Ticket sales wait for KFANDRA's formula |
| 4 | Loans | Next |
| 5 | Season 2 starts in the app | After loans and the trial run |

The club money piece has to come before the stadium, because buying seats needs a
club balance.

---

## 1. Player register and player values

### The register

A new screen that only KFANDRA can open lists every member of the app. For each
season, KFANDRA sets:

- **Club**: the one club the player belongs to this season. Playing for any other
  club counts as a loan.
- **Base value** in Kroopies: where the player's value starts this season.
- **KLC name** (optional): a formal name such as "R. Sharma", used on KLC boards
  and scorer lists. If it's left empty, the player's app name is used.

Members without a club aren't in KLC that season. KFANDRA can change anything at
any time, for example a late transfer or a corrected value, and every change is
recorded with who made it and when. Players KFANDRA is still confirming can
simply be added later.

The screen also flags two things: players with a club but no base value yet, and
anyone who played an official match without being in the register.

### How a player's value moves

Values change only through **official league matches**, Multi-Game Variations
included. Friendlies change nothing.

| In an official league match | Value change |
|---|---|
| Win | **+20** |
| Draw | **+5** |
| Loss | **−10** |
| Each goal (Fooba main or rebound goals included), try or conversion | **+2** |
| Each assist | **+1** |
| Each pre-assist | **+0.5** |
| Each save or goal-line save (all saves count the same) | **+2** |

- **Result:** every player on a side gets that side's result. In a Combined match,
  that's the result over both halves, the same as in the league table.
- **When it applies:** all of a session's matches are added together at the end of
  that session's day.
- **Never below zero:** a value can't drop below 0 Kroopies.
- **Small-sided matches** (fewer than 7 players in total): each player's first 5
  small-sided matches in a season change nothing. From the 6th onwards they count.
  Matches with 7 or more players always count.
- **Corrections flow through:** if KFANDRA reopens and corrects a match, or changes
  a base value, every value updates on its own.
- KFANDRA can adjust these numbers later without a developer.

> **Example.** A player starts the season at **200 KR**. In one session their side
> wins a 7 v 7 match (+20), and they score once (+2) and make one assist (+1). At
> the end of the day their value is **223 KR**. The next session their side loses
> (−10), so they drop to **213 KR**.

### Who sees values

Everyone. KLC League gets a new **Values** tab that ranks players by current
value, with their club and last session's change. Tapping a player shows their
value session by session. Base values can only be set by KFANDRA.

### Questions for KFANDRA

1. Do tackles, yellow/red/blue cards or late challenges change a player's value?
   *Planned: no.*
2. Is it fine for everyone, players included, to see all values? *Planned: yes.*

---

## 2. Club money and the stadium

### Each club gets a running balance

Every movement of Kroopies becomes a line in the club's money book: the date,
what it was for, the amount and the balance after it. The balance sheet becomes
**read-only**. Managers can see it but no longer type figures into it.

| Date | What | Amount | Balance |
|---|---|---|---|
| 1 Dec | Opening balance (set by KFANDRA) | +50,000 | 50,000 |
| 3 Dec | Match fee | −10 | 49,990 |
| 3 Dec | Win | +20 | 50,010 |
| 5 Dec | Bought 1,000 seats | −10,000 | 40,010 |

*Example figures only.*

- **Opening balance:** KFANDRA enters each club's opening balance once per season,
  then it locks. The amount is visible only to that club and to staff.
- **From matches:** when KFANDRA makes a league match official, the match fee and
  any win are added automatically, at today's rates (**−10** per match played,
  **+20** per win). Friendlies add nothing.
- **Reopened matches:** if KFANDRA reopens a match, its money lines are cancelled by
  matching "reversal" lines. When it's made official again, fresh lines are added.
  Nothing is ever deleted, so the history is always complete.
- **Club bonus and corrections:** only KFANDRA can add these, and each one needs a
  short note. The note shows on the club's sheet.
- **Who sees a club's money:** the club's manager, the club's players (from the
  register) and staff.

### The stadium

- Every club starts with a **10,000-seat** stadium.
- A club can buy **1,000 more seats for 10,000 KR**, from its club page. The app
  shows the balance after the purchase and asks for a confirmation.
- A purchase is refused if the club can't afford it.
- The new capacity shows straight away.
- There's no maximum size.
- Only KFANDRA can reverse a purchase made by mistake.

### Questions for KFANDRA

3. Who can buy seats? *Planned: the club's manager and KFANDRA.*
4. May a balance go below zero from match fees, even though seat purchases can't?
   *Planned: yes.*
5. Does anything from Season 1 carry over into Season 2 balances? *Planned: no.
   KFANDRA's opening balance is the starting point.*
6. Please send each club's opening balance for Season 2 when ready. KFANDRA can
   also enter these directly on the new screen.

---

## 3. Ticket prices

- Each club sets its **own ticket price**, from free (0) up to **100 KR**, on its
  club page.
- The price is **per session day**, not per match, because matches are often created
  on the day itself.
- The price can be changed until **4:00 am IST** on the session day. After that it's
  locked for everyone.
- If a club doesn't set a price, its last price is used, or free if it has never set
  one.
- Friendlies don't sell tickets.

### Ticket sales: waiting for the formula

The parts we can build now:

- KFANDRA gives **each club its own rating** for a match.
- For a club's **first match of the season**, KFANDRA enters the tickets sold by
  hand.
- Tickets sold can never be more than the club's stadium size.
- Ticket money is added to the club's balance when the match is made official.

How tickets are worked out for later matches, from the club's rating, its price
and KFANDRA's ticket price limit, needs KFANDRA's formula. That part will follow
once we have it.

### Questions for KFANDRA

7. The **ticket-sales formula**: how rating, price and the ticket price limit give
   the number of tickets sold, and how a bigger stadium allows more sales.
8. Is a price per session day right, rather than per match? *Planned: per session
   day.*
9. Does KFANDRA give the ratings after the match, before making it official?
   *Planned: yes, required for every league match.*

---

## What we need from KFANDRA

| Item | Why |
|---|---|
| Base values for each KLC player | These can also be entered on the new screen. |
| Opening balance for each club, for Season 2 | The starting point of each club's money book. |
| The ticket-sales formula | Ticket sales can't be built until we have it. |
| Answers to questions 1–9 | A quick yes or no is enough. Until we hear otherwise, we'll build the plan as written. |
| Loans: do the new loan charges replace the old loanee-share payout on the balance sheet? | Loans can't be built until we know. |
| The minor additions KFANDRA mentioned | Whenever ready. |

Each piece goes live only after KFANDRA has had a heads-up, and after testing on a
separate copy of the app. Updated guides follow each release.
