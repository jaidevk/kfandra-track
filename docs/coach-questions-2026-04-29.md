# Coach — 4 quick design questions before we lock V1

Hi Coach,

Based on your feedback we&rsquo;ve trimmed the app down to just two things: an MMG point calculator and a Gym performance logger. Submissions go from the player to you for approval. No leaderboards, no league, no balance sheets in the app.

Before we lock the V1 design, four small questions. One-line answers are fine.

---

## 1. App name

We&rsquo;re calling it **&ldquo;KFandra Track&rdquo;** as a working name. It&rsquo;s only in the IT/mockup &mdash; not real branding yet.

- (a) Keep &ldquo;KFandra Track&rdquo;
- (b) Pick a different name now &mdash; what name?
- (c) Wait for Sir / a club vote later

## 2. Tap-to-add for MMG points

For the calculator, we&rsquo;re thinking the player just **taps a button each time** something happens, and the points add up.

> Example: scored 2 goals &rarr; tap the &ldquo;Goal&rdquo; button twice &rarr; +1000 added to total.
> Did 6 reps of the MMG drill &rarr; tap &ldquo;MMG drill&rdquo; six times &rarr; +600.

This matches your &ldquo;MMG drill 100&rdquo; example. The alternative would be one button + a number field (&ldquo;Goals: 2&rdquo;).

- (a) Tap-to-add &mdash; preferred (faster, fewer fields)
- (b) Number field &mdash; one entry per category
- (c) Up to you / either is fine

## 3. Game type pre-selector

Different games have different point rules (Fooba Big Goal vs Short Game vs End-game Drill etc.). Two options:

- (a) **Pick the game first** &rarr; only the relevant buttons show. Cleaner, less to scroll through. Player has to remember which game it was.
- (b) Show **all buttons** in one long screen, grouped. Fewer taps to start, but more buttons on screen.

Our recommendation: **(a)**, because most players will know exactly which game they played.

## 4. &ldquo;Other&rdquo; / blip / random points

Sometimes you award points outside the standard list (you mentioned this). How would you like the player to log those?

- (a) **Free-form &ldquo;Other +N&rdquo;** field &mdash; player types a reason and a number. You confirm/edit on approval.
- (b) **A short list of named extras** &mdash; e.g. &ldquo;Extra reps&rdquo;, &ldquo;Helped a teammate&rdquo;, etc. You tell us the labels, we hard-code them.
- (c) **No &lsquo;Other&rsquo; field** &mdash; only Coach can add bonus points after submission.

Our recommendation: **(a)** for V1. We can switch to (b) later if specific categories emerge.

---

## Already locked (no need to confirm)

- Login: phone number + 4-digit PIN. Self-register, you approve. SMS OTP in V2.
- After Submit, the player&rsquo;s screen resets to zero. Drafts saved if the phone dies.
- Edit window: practice ends 8 am &rarr; player submits by 12 noon &rarr; you approve by 4 pm.
- Players can see their own history including any edits you made.
- Gym catalog uses Jaidev&rsquo;s GWW/GWtW exercise list. You can add more exercises later.
- App syncs to a designated Google Sheet so you can keep using sheets in parallel.

Reply when convenient &mdash; even one-line answers like &ldquo;1a, 2a, 3a, 4a&rdquo; works.

Thanks Coach.
