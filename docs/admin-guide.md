# KFANDRA Admin Guide

A guide for KFANDRA staff to the in-app **Admin** section. No technical
knowledge needed — you do everything from inside the app.

> Developer tasks (managing players, environment, deployment) live in a separate
> **Developer Guide** (`developer-guide.md`).

---

## 1. Who can open it

Only **KFANDRA staff** accounts can open the Admin area. A normal player who
tries is sent back to the home screen. If you need staff access, ask the
developer to set it once.

## 2. Getting to the Admin section

When you're signed in as staff, an **Admin →** button appears on the **home
screen** (below the MMG / Gym / Diet cards). Tap it — no need to type any web
address.

The Admin dashboard has **four cards**: **MMG**, **Gym**, **Diet**, and
**Scoring**.

> On every Admin page, the **"Admin"** heading (top-left) takes you back to the
> Admin dashboard, and **"← Back to app"** (top-right) returns you to the normal
> app.

## 3. MMG

Open **MMG** to review session points, two ways:

- **By date** → pick a session. You'll see **every current player** with their
  **Arrival**, **Confirm**, **Games**, and **Total** points, and a greyed
  **"not submitted"** marker for anyone missing. The top line shows how many
  submitted. (KFANDRA is excluded — KFANDRA runs the sessions and doesn't earn
  points.)
- **By player** → pick a name to see that player's MMG sessions.

> **Total = Arrival + Confirm + Games.** Arrival/Confirm are the order-of-arrival
> and confirmation ladders (they rise as more players submit). Games is the
> self-scored part (goals, assists, packing, etc.).

There's also a **"Sync this month to Google Sheet"** button here — see §6.

## 4. Gym

Open **Gym** (daily logs — not scored, just a record):

- **By date** → pick a day to see everyone who logged gym, with exercise counts
  and body weight; tap a name to drill in.
- **By player** → pick a name to see every gym entry (exercises, sets/reps, body
  weight).

## 5. Diet

Open **Diet** (daily logs — not scored):

- **By date** → pick a day to see everyone who logged diet; tap a name to drill in.
- **By player** → pick a name to see every diet day (meals + the foods logged).

## 6. Scoring

Open **Scoring** to change values yourself (takes effect the next time a score
is computed):

- **Game type names** — rename any game type (e.g. "Football short").
- **Point values** — edit any value: game results (win/draw/loss), highlights
  (goals, assists, saves, cards…), participation bonuses, the order-of-arrival
  base, and per-game overrides (e.g. Rugby tackle). Type the new number, tap
  **Save**.

> The **names of highlights** (e.g. "Goals") are still set by the developer for
> now — you can edit their point *values* here, just not their labels.

## 7. Google Sheet sync

The app writes a player × session points grid into the club's export sheet — a
tab per month (e.g. **`Jun 2026`**). It syncs **automatically** whenever a player
finalizes a session, so you normally don't need to do anything. To force a
refresh, use the **"Sync this month to Google Sheet"** button on the **MMG** page.

## 8. What the developer still handles

Promoting staff, deactivating players, resetting a PIN, adding/removing game
types, editing the food/gym catalogues, and highlight *names* are done by the
developer (see the **Developer Guide**).

---

> **Private — KFANDRA staff only.** Keep this guide and the app internal to
> KFANDRA.
