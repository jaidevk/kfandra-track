# Stakeholder Feedback Review — 13 Apr 2026

Consolidated feedback from Coach (primary) and Admins (meeting notes). This document restates the app's purpose after the feedback and lists open questions to resolve before the next mockup round.

---

## What the Coach Actually Wants

The core problem is **player compliance** — "a majority of players are unable to complete the simple and basic task of sending their MMG score." The app is not a dashboard or leaderboard. It is a **calculator-style data-entry tool** that makes it frictionless for players to:

1. Tap buttons during/after a session to log points earned.
2. Review the accumulated score.
3. Send it to the Coach (message/email) for approval.
4. Reset to zero for the next session.

**Everything else belongs on the KFANDRA website/sheets, not in the app.**

---

## In Scope (V1)

### MMG point entry — calculator-style

Fixed buttons, each with a pre-configured point value. Pressing a button adds those points to the running total. Repeated presses keep accumulating.

Button categories named by the Coach:
- Pre-session unpacking
- GWW unpacking
- Post-GWW packing
- Confirmation points
- Order-of-arrival points
- Win Bonus 1000
- Win Bonus 500
- Goal bonus
- MMG drill 100 (repeat-tap accumulates)

### Main game / match entry

Quantity-driven inputs ("1 goal scored" → auto-calculates points). Implies entry fields for: goals, assists, saves, pre-assists, clearances, goals conceded, plus a match result (win/draw/loss).

### Free-form narration

Separate text box. Descriptive only — does NOT affect points. Helps the Coach cross-check submissions.

### Submission workflow

1. Player finishes entering points.
2. Taps "Submit" → data goes to an authority (Coach/Admin) for approval.
3. Player's local scorepad can be reset to zero.
4. Approved submissions are stored (for future reprisal/dispute resolution).

### Authentication

Keep it low-friction. Options on the table: Google sign-in, mobile + OTP, or email + 4-digit PIN.

### Data source

App initially **copies/reads** from the existing KFANDRA master Google Sheet. App is secondary until it proves reliable.

---

## Out of Scope (V1) — Remove from current mockups

- MMG Standings / Leaderboard (lives on the KFANDRA website)
- League Table (KLCFESGR1)
- Player Values / Market Values
- Club Balance Sheets
- Player Loans
- Fixtures, top scorers, division standings
- Club rosters

Everything KLCFESGR1-related is **deferred to V2**.

---

## Later (V2+)

- Balance sheets & loans (once V1 is in use)
- GWW / GWTT fitness-tracking app — same calculator model but for exercises (shoulder ex → sets → reps). *Coach wants this; likely a separate but linked app.*

---

## Naming

Coach is unsure about "KFandra Track" — asked if it's a real name or IT slang. Meeting notes mention "cafender tracking app" as a placeholder. **The Coach will provide the official name.**

---

## Target Outcomes (the bar the app must clear)

| # | Outcome | How we'll know |
|---|---------|----------------|
| O1 | Any player (including the least tech-savvy) can submit MMG points in under 30 seconds post-session | Field test with 2–3 players; measure time-to-submit |
| O2 | Players never need to remember point values — tapping a button records the correct points | All Coach-defined categories appear as buttons; values configured server-side |
| O3 | Coach receives a clean, cross-checkable submission per player per session | Submission includes player, session date, itemized tally, narration, timestamp |
| O4 | Submissions are auditable and editable before approval | Coach/Admin can review, edit, approve, reject; audit log per change |
| O5 | Login works for every player on their own phone | Single-tap re-auth after first login; no password resets needed day-to-day |
| O6 | App and the master Google Sheet stay consistent during validation | Sheet remains primary until the Coach signs off |
| O7 | Coach can change point values without a new app release | Values stored in a config table, editable via an admin screen |

---

## Open Questions

### Q1 — App Name
Coach asked if "KFandra Track" is intentional or IT slang. What name should we use? (Coach was going to ask Sir.)

### Q2 — Login Method
Which of these does the Coach prefer?
- Google Sign-In (easiest for players with Gmail)
- Mobile + OTP (genuine but costs per SMS)
- Email + 4-digit PIN (cheap, simple, but lower security)

### Q3 — Submission Channel
After "Submit," how does the Coach *receive* the submission?
- In-app approval queue only (Coach opens app → approves)
- In-app + email copy to Coach
- In-app + WhatsApp message
- In-app + push notification

### Q4 — Attendance Data
- "Order-of-arrival" and "Confirmation points" — does the player self-declare these (e.g. "I was 3rd to confirm"), or are they auto-populated from Coach's attendance sheet?

### Q5 — Point Values — Editable?
- Are the point values (e.g., Confirmation 800/700/…, Goal bonus, Win 1000) fixed in code, or should the Coach be able to edit them from the app? (We recommend editable via admin screen — O7.)

### Q6 — Match Events: Button-tap or Quantity Input?
Two options for goals/assists/saves:
- **Tap-to-add**: Press "Goal +500" once per goal, like the drill 100 button
- **Quantity input**: Enter "Goals: 2" → auto-calc 2×500=1000
Which feels more natural to the Coach?

### Q7 — Different Game Types
MMG has Fooba (big goal vs rebound wall), Short Game, drills, 3-and-in, etc. — each with different point rules. Should the player:
- Pick the game type first, then see buttons tailored to it?
- Have all buttons visible on one screen?

### Q8 — Post-Submission Visibility
Coach said "no MMG totals" in the app. After submitting, what does the player see?
- Just a confirmation screen ("Submitted to Coach")?
- Their own past submissions (history), but no leaderboard?
- Nothing — app resets to zero immediately?

### Q9 — Draft / Auto-save
If a player starts entering points mid-session and phone dies, should the partial score persist? Or is every session a clean slate until submit?

### Q10 — Reset Behaviour
Does "Reset to zero" happen:
- Automatically after Submit?
- Manually by the player (explicit button)?
- Both (submit resets, manual reset also available)?

### Q11 — Narration Field
- Is it optional or required?
- Character limit?
- Should it be per-category (narration on the goals entry) or one narration per submission?

### Q12 — Other Points / Blip Test / Random MMG
Meeting mentioned "other points" tab for things like blip test or random MMG drill points. Should this be:
- A free-form "Other +N" button where player enters custom amount?
- A list of additional Coach-defined buttons?

---

## Proposed V1 Mockup Updates

Once Q1–Q12 are answered, the mockups will change as follows:

**Removed screens:**
- MMG Standings / Rankings
- KLCFESGR1 League Table
- KLCFESGR1 Balance Sheet

**New/changed screens:**
1. **Home** — Today's session, "Enter Points" primary action, recent submissions list (no leaderboard)
2. **Points Entry** — Calculator-style grid of buttons with running total at top, narration box, submit button
3. **Submission Confirmation** — "Sent to Coach" state with undo/edit window
4. **Coach Approval Queue** — List of pending submissions, tap to approve/edit/reject
5. **History** — Player's past submissions (what they submitted, approval status)
6. **Admin / Point Config** — Coach-only screen to edit button labels and point values

**Retained screens:**
- Landing / Login (pending auth method decision)
