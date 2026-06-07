# Continuous-Log Model + Daily Diet Feature — 9 May 2026

This document captures the design decisions made after Coach's 9 May feedback round. It supersedes the submission/approval flow described in earlier mocks and adds the new Daily Diet feature.

---

## What changed from prior design rounds

Coach's 9 May note reframed how data moves between the player and KFANDRA:

- **No approval needed.** Sir does not approve MMG / GWW / Diet entries. The data is trusted; if questions arise, it can be looked up.
- **No submission deadline.** Players log when they are free. Best effort.
- **Other players cannot see another player's scores in the app.** They become public when they go up on the sessions sheet — outside the app.
- **MMG today:** Player sees their final tally → the points are messaged/emailed to Coach **outside the app**. (V1 = manual; backend digest deferred to a later round.)
- **GWW today:** App stores the data so Coach does not have to maintain new sheets. Players can download/export their own data and send it monthly.

The combined effect: the player app becomes a **personal continuous logger** with no submit/approval cycle. Delivery to Coach is a separate concern, deferred to its own design round.

---

## Unified continuous-log model (V1)

| Stage | What the app does |
|---|---|
| **Log** | Player taps to add entries. Autosaved to a database the moment a tap registers. No "Submit" button anywhere. No deadline. The player can edit any entry on the current day; older days are read-only in V1. |
| **Tally** | Per-session for MMG (Fooba / Short / Drill / etc.). Per-session for Gym. Per-day for Diet. Player sees only their own tally and history. |
| **Persist** | All data lives in Supabase. Source of truth. |
| **Deliver** | Out of scope for V1. Will be a backend digest job (cron → email). Designed and shipped in a later round. |
| **Privacy** | Player only ever sees their own data. No leaderboards, no other-player visibility, anywhere in the app. |

### What this drops vs. earlier mocks

- ❌ "Submit" button on MMG / Gym session screens
- ❌ "Pending / Approved / Edited" status badges on history rows
- ❌ Coach Approval Queue
- ❌ "Submit by noon, approve by 4 pm" edit-window cutoffs
- ❌ "Sent to KFANDRA" status (delivery is now a backend concern, not a player action)

### What stays

- ✅ Phone number + 4-digit PIN auth (self-register, Coach approves player accounts)
- ✅ Each mode is its own surface (MMG / Gym / Diet) — separate tiles on the home screen
- ✅ Free-form narration field on MMG (helps Coach cross-check when questions arise)
- ✅ Personal history: every player can see their own past entries

### What is deferred to a later round

- Backend daily digest (Edge Function + cron + email service) — a future spec
- Player-initiated export ("email my own data" — not asked for in V1)
- Admin/config screens (Coach edits point values, exercise list, food catalog) — V1 ships with hardcoded seed lists; admin screens are V1.1
- Coach-facing in-app view (browse a player's day) — likely never; the email digest is the surface
- Player-drawn food images / open contribution project — kept private to Coach for now; not designed here

---

## Daily Diet — feature design

### Goal

Make it as cheap as possible for a player to log everything they ate in a day, so Coach (FDrK) can later spot dietary issues. Logging that requires more than a tap per item will not get done.

### Hub-and-spoke flow

**Entry screen ("Today's Diet"):** A vertical stack of **8 meal cards**, one per coach-defined meal slot. Each card shows the slot name, its informational time window, and either the compact summary of what's already logged ("Brown bread × 3, Coffee × 1") or "not logged yet". A small "Skipped" toggle on each card lets the player explicitly mark a fasted/missed meal — distinguishes intent from forgetfulness for FDrK.

The 8 slots:

1. Midnight Snack/Meal — between 10 pm and 2 am
2. Breakfast — between 6 am and 9 am
3. Mid-Morning Snack/Meal — between 9 am and 12 pm
4. Lunch — between 12 pm and 2 pm
5. Midday Snack/Meal — between 2 pm and 4 pm
6. Evening Tea & Snacks — between 4 pm and 6 pm
7. Supper — between 6 pm and 8 pm
8. Post-Supper Snack/Meal — between 8 pm and 10 pm

Time windows are **informational only** — they do not restrict when a meal can be logged. A player who forgets to log lunch at noon can still log it at 11 pm.

**Per-meal screen (drill-in):** Header with meal name + time window. Below it a "Logged so far" list (tap any row to reveal a −/+ stepper for that item's count). Below that, the food catalog as a long scroll grouped by section. A "+ Add custom item" button is pinned at the top of the catalog so it is always discoverable. Bottom-anchored "Done" button just navigates back to the hub — nothing is submitted; everything is already saved.

### Catalog

Player-facing scrolling list of foods grouped by section. Each entry is a button that, when tapped, adds **one unit** of that item to the current meal's tally. Each item has a fixed unit shown on the button:

- **Reference units:** glass = 200 ml, bottle = 1 L, waati/bowl = 150 g/ml, cup = ~150 ml, slice/piece = as labeled.

Item names are bilingual: **English label + transliterated Marathi/Hindi where applicable** (e.g. "Buttermilk / Taak", "Okra / Bhendi"). All in the English alphabet — no Devanagari script in V1.

#### V1 seed catalog

The catalog ships with the following items hardcoded. Coach can prune or extend in his review round; admin-screen editing comes in V1.1.

```
GRAINS & BREAD
  White bread (1 slice)             Roti / phulka (1 piece)
  Brown bread (1 slice)             Paratha (1 piece)
  Naan (1 piece)                    Bhakri (1 piece)

DALS & SABZI
  Dal / varan (1 waati = 150 g)     Mixed sabzi (1 waati)
  Bhendi bhaji (1 waati)            Aloo bhaji (1 waati)
  Paneer sabzi (1 waati)            Chana / chole (1 waati)

RICE
  Plain rice (1 waati)              Khichadi (1 waati)
  Pulao / biryani (1 plate)         Curd rice (1 waati)

DAIRY
  Milk (1 glass = 200 ml)           Buttermilk / taak (1 glass)
  Curd / dahi (1 waati)             Cheese slice (1 piece)

FRUITS
  Banana (1 piece)                  Apple (1 piece)
  Mango (1 piece)                   Papaya (1 waati)
  Watermelon (1 waati)              Mixed fruit (1 waati)

NON-VEG
  Egg, boiled (1 piece)             Egg, omelette (1 piece)
  Egg, scrambled (1 waati)          Chicken curry (1 waati)
  Chicken grilled (1 piece, ~100 g) Mutton curry (1 waati)
  Fish curry (1 waati)              Fish grilled / fried (1 piece)
  Prawns (1 waati)                  Tandoori chicken (1 piece)

BEVERAGES
  Water (1 glass = 200 ml)          Tea / chai (1 cup)
  Coffee (1 cup)                    Juice (1 glass)
  Coconut water (1 glass)           Lassi (1 glass)
  Soft drink / cola (1 glass)       Sports drink (1 bottle = 1 L)

SNACKS
  Poha (1 waati)                    Upma (1 waati)
  Idli (1 piece)                    Dosa (1 piece)
  Vada (1 piece)                    Samosa (1 piece)
  Sandwich (1 piece)                Biscuits (1 piece)
  Maggi / noodles (1 waati)         Chivda / namkeen (1 waati)

SWEETS
  Modak (1 piece)                   Laddu (1 piece)
  Barfi (1 piece)                   Jalebi (1 piece)
  Gulab jamun (1 piece)             Kheer (1 waati)
  Shrikhand (1 waati)               Ice cream (1 scoop)
  Chocolate (1 piece)
```

Approximately 55 items across 9 sections.

#### Free-form custom item

A "+ Add custom item" button is pinned at the top of every catalog. Tapping it opens a small dialog:

- **Item name** (text, required)
- **Quantity** (number, default 1)
- **Unit** (dropdown: piece / waati / glass / bottle / plate / spoon / other)
- **Notes** (optional, free text)

The custom entry shows in the meal's "Logged so far" with a small "custom" tag so it's distinguishable from catalog items. **Recurring custom entries are signal for what to promote into the official catalog** in the next round.

### Visual treatment

- **Color palette:** amber/orange (warm, food-coded). MMG = blue, Gym = emerald, Diet = amber/orange. Distinct at-a-glance on the home screen.
- **Item visuals:** **Emoji placeholders** in the V1 mock. Final illustrations are a separate round per Coach's note.
- Matches the existing mockups' visual language: rounded-2xl cards, subtle gradients, framer-motion entry animations, mobile-first layout.

### Decrement / undo

Tapping a catalog button always **adds one unit**. To remove or adjust, the player taps the row in the "Logged so far" list — that reveals a `−` and `+` stepper inline. Removing the count to 0 deletes the row.

Rationale: keeps the catalog tiles simple (one tap = +1, no need to differentiate add vs subtract on the same surface).

### Backfill

V1 only allows logging on the current day. The hub always shows "today". Older days are visible read-only in History but not editable. (Backfill of yesterday is on the V1.1 list — easy add once the data model is in place.)

---

## Out of scope for this round

These belong to their own design rounds and are not part of the V1 mock:

- L2 atom composition (vegetable + container + preparation modifier → composed dish entries)
- L3 player-contributed image library (kept private to Coach)
- Admin screens for editing the catalog from inside the app
- Backend daily digest (cron + email)
- Coach-facing in-app review surface
- Sheets sync
- Sheet-based delivery from MMG/Gym to Coach (deferred per Coach's "outside the app" note)

---

## Mockup deliverables

| Mockup | Path | Status |
|---|---|---|
| Daily Diet — hub | `src/app/mockups/diet/page.tsx` | New (kfh-oqo) |
| Daily Diet — per-meal | `src/app/mockups/diet/[meal]/page.tsx` | New (kfh-oqo) |
| MMG — strip submit/approval | `src/app/mockups/mmg-session/page.tsx` | Update (kfh-2v8) |
| Gym — strip submit/approval | `src/app/mockups/gym-session/page.tsx` | Update (kfh-e1j) |
| Home — add Diet tile, no status | `src/app/mockups/page.tsx` | Update (kfh-tue) |
| History (was My Submissions) | `src/app/mockups/my-submissions/page.tsx` → renamed | Update (kfh-tue) |
