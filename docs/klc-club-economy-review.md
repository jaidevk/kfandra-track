# KLC Club Economy: Player Values, Club Money, Stadium and Tickets

**The next KLC features · Version 2, for KFANDRA review · 22 November 2026**

<!-- Source of docs/klc-club-economy-review.pdf. Rebuild with `npm run docs:pdf:economy`. -->

> This version includes KFANDRA's answers of 19 November and the decisions made
> since. Please check the changes below and the remaining questions at the end.
> Where something shows a **planned** answer, we will build that unless KFANDRA
> says otherwise.

---

## What changed since 19 November

| Topic | Before | Now |
|---|---|---|
| A player's club | KFANDRA would assign each player a club every season | Each player's club is **the club they manage**. It stays the same all season |
| Friendlies | Changed nothing | Every friendly is marked **Official** or **Unofficial**. Official friendlies change player values and sell tickets |
| Cards | No effect on value | Yellow **−10**, red **−20**, blue **−50** |
| Tackles, late challenges | No effect on value | Confirmed: no effect |
| Value changes mid-season | KFANDRA could correct a base value | KFANDRA can also **change a value from a chosen date**, for example after an illness |
| KLC name | An optional formal name | The player's **official name** |
| Who sees a club's money | Manager, the club's players and staff | **The manager and KFANDRA** only, for now |
| A balance below zero | Allowed from match fees only | Confirmed: allowed |
| Season 1 balances | Not carried over | Confirmed: Season 2 starts from KFANDRA's opening balances |
| Loans | Waiting on the old loanee-share rule | Confirmed: the new loan charges **replace** the old loanee share |
| Organisations | Not covered | Senile Wombats, Juvenile Wombats and AWAVA play in the league. See section 5 |

---

## The order

| # | Feature | Status |
|---|---|---|
| 1 | Player register, player values and the friendly type | **Building now** |
| 2 | Club money (running balance) and the stadium | **Building now** |
| 3 | Ticket prices | **Building now**. Ticket sales wait for KFANDRA's formula |
| 4 | Loans | Next. Loan fees first; loan points wait for KFANDRA's answer |
| 5 | Season 2 starts in the app | After loans and the trial run |
| Later | Cup competition, divisions | Details to come from KFANDRA |

---

## 1. Player register and player values

### The register

A new screen that only KFANDRA can open. For each season, KFANDRA sets for every
player:

- **Base value** in Kroopies: where the player's value starts this season.
- **Official KLC name**: used on KLC boards, tables and scorer lists.

There is nothing else to set. Each player's club is the club they manage, and it
doesn't change during the season. When a player plays for another club's side,
they are **on loan** from their own club.

Players KFANDRA is still confirming can be added later. The screen flags anyone
who has played an official match without a base value.

### What changes a player's value

| Match | Changes values? |
|---|---|
| League match, Multi-Game Variations included | **Yes** |
| **Official** friendly | **Yes** |
| **Unofficial** friendly | No |

| In a match that counts | Value change |
|---|---|
| Win | **+20** |
| Draw | **+5** |
| Loss | **−10** |
| Each goal (Fooba main or rebound goals included), try or conversion | **+2** |
| Each assist | **+1** |
| Each pre-assist | **+0.5** |
| Each save or goal-line save | **+2** |
| Yellow card | **−10** |
| Red card | **−20** |
| Blue card | **−50** |
| Tackles, late challenges | No change |

- **Result:** every player on a side gets that side's result. In a Combined match,
  that's the result over both halves, the same as in the league table.
- **When it applies:** all of a session's matches are added together at the end of
  that session's day.
- **Never below zero:** a value can't drop below 0 Kroopies.
- **Small-sided matches** (fewer than 7 players in total): *planned, as agreed on
  28 October:* each player's first 5 small-sided matches in a season change
  nothing. From the 6th onwards they count like any other match. Matches with 7 or
  more players always count. This can be switched off. See question 1.
- KFANDRA can adjust all these numbers later without a developer.

> **Example.** A player starts the season at **200 KR**. In one session their side
> wins a 7 v 7 league match (+20), and they score once (+2) and make one assist
> (+1). At the end of the day their value is **223 KR**. The next session their
> side loses an official friendly (−10) and they get a yellow card (−10), so they
> drop to **203 KR**.

### KFANDRA's value changes during the season

KFANDRA can change a player's value **from a chosen date**, for example when a
player has been ill. The change applies from that date onwards and all later
matches build on it. Each change needs a short note, and the player's history
shows who made it, when and why.

For a single match, there will also be an option to agree a **lower loan price**
without changing the player's value. That comes with Loans.

### Who sees values

Everyone. KLC League gets a new **Values** tab that ranks players by current
value. Tapping a player shows their value session by session, with every change
and its reason.

---

## 2. Friendlies: Official or Unofficial

The friendly workflow stays simple. A friendly is final as soon as both managers
have sent their team, with no KFANDRA step.

- Every friendly is marked **Official** or **Unofficial**. A new friendly starts
  as *Unofficial*.
- **KFANDRA or either manager** can change the mark.
- If the mark changes after the match, player values and club money update on
  their own.

| | Official friendly | Unofficial friendly |
|---|---|---|
| Player values | Change | No change |
| Ticket sales | Yes, once ticket sales are live | No |
| Match fee (−10) and win bonus (+20) | **No** | No |
| League table points | **No** | No |
| Results and scorers in the league | **No** | No |

---

## 3. Club money and the stadium

### Each club gets a running balance

Every movement of Kroopies becomes a line in the club's money book: the date,
what it was for, the amount and the balance after it. The balance sheet becomes
**read-only**. Managers see it but no longer type figures into it.

| Date | What | Amount | Balance |
|---|---|---|---|
| 1 Dec | Opening balance (set by KFANDRA) | +50,000 | 50,000 |
| 3 Dec | Match fee, league match | −10 | 49,990 |
| 3 Dec | Win, league match | +20 | 50,010 |
| 5 Dec | Bought 1,000 seats | −10,000 | 40,010 |

*Example figures only.*

- **Opening balance:** KFANDRA enters each club's opening balance once per season
  (from the club's chosen sponsor offer), then it locks.
- **From league matches:** when KFANDRA makes a league match official, the match
  fee (**−10**) and any win (**+20**) are added automatically.
- **From official friendlies:** ticket money only, once ticket sales are live. No
  match fee or win bonus.
- **Below zero:** a balance can go negative. Seat purchases still need enough
  money.
- **Who sees it:** the club's manager and KFANDRA.

### How corrections work

Nothing in the money book is ever deleted or overwritten, so the history is
always complete.

1. **A match result was wrong.** KFANDRA reopens the match. Its money lines are
   cancelled by matching "reversal" lines, dated today. Player values from that
   match are taken back at the same time.
2. **KFANDRA corrects the match and makes it official again.** Fresh money lines
   are added, and player values are worked out again.
3. **A friendly's mark is changed** (Official ↔ Unofficial). Values and ticket
   money are added or taken back the same way.
4. **Any other mistake, or a club bonus.** KFANDRA adds a correction line with a
   short note, plus or minus. The note shows on the club's sheet.
5. **A seat purchase made by mistake.** Only KFANDRA can reverse it.

### The stadium

- Every club starts with a **10,000-seat** stadium.
- A club can buy **1,000 more seats for 10,000 KR** from its club page. The app
  shows the balance after the purchase and asks for a confirmation.
- A purchase is refused if the club can't afford it.
- The new capacity shows straight away. There's no maximum size.
- *Planned:* the club's manager and KFANDRA can buy seats.

---

## 4. Ticket prices

- Each club sets its **own ticket price**, from free (0) up to **100 KR**, from its
  first match.
- The price is **per session day**, because matches are often created on the day.
- It can be changed until **4:00 am IST** on the session day. After that it's
  locked for everyone.
- If a club doesn't set a price, its last price is used, or free if it has never
  set one.
- League matches and **official friendlies** sell tickets.

### Ticket sales: waiting for the formula

Tickets sold will follow KFANDRA's fixed internal system, using each club's
rating, its price and its stadium size. Ticket money is added when the match is
made official (league) or marked Official (friendly). That part will be built
once we have the formula.

---

## 5. Organisations

Senile Wombats, Juvenile Wombats and AWAVA play in the league and appear in the
league tables.

- An organisation has **no players of its own**. For each match, its side is
  picked from the members still available once the opposing club (its manager
  and loaned players) has been chosen.
- It has **no balance sheet**. KFANDRA makes its payments.

How loans, values and payments work for players on an organisation's side is
question 3 below. Organisations come with Loans.

---

## Questions for KFANDRA

1. **Small-sided matches.** In matches with fewer than 7 players in total, should a
   player's first 5 such matches in a season change nothing (as agreed on 28
   October), or should small matches always change values like any other match?
2. **Points for clubs that loan a player.** A club that loans a player to the
   winning side gets 1 point when the winner gets 5, and 0.5 when the winner gets
   3. What does it get for smaller wins (1 or 0.5 points), and for draws (1, 0.2
   or 0.1 points)? *Asked separately on 22 November.*
3. **Players on an organisation's side.** *Planned:* their values change as in any
   match, KFANDRA pays each player's club the loan fee, and if the organisation
   wins, each player's club gets the loan points.
4. **"Player increments" on the balance sheet.** *Planned:* value changes show on
   the player's history and the Values tab, not as money on the club's sheet.

## What we still need from KFANDRA

| Item | Why |
|---|---|
| Base values and official names for each KLC player | These can also be entered on the new screen. |
| Opening balance for each club, for Season 2 | Sent privately, or entered by KFANDRA on the new screen. |
| The ticket-sales formula | Ticket sales can't be built until we have it. |
| Answers to questions 1–4 | A quick yes or no is enough. |
| Cup competition and divisions | Whenever ready. These come later. |

Each piece goes live only after KFANDRA has had a heads-up, and after testing on a
separate copy of the app. Updated guides follow each release.
