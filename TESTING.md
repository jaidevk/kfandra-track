# Testing the Jacaranda App

Thanks for helping test. This round has two goals:

1. **Are the numbers right?** Diet nutrition and MMG points.
2. **Where is it slow?** Especially **Finalize** on MMG.

Test the **live app** — <https://kfandra-track.vercel.app> — with **your own
player account**, the same way you normally use it. You don't need to install
anything or run the code. New to the app? Read the
[player guide](docs/usage-guide.md) first.

Report what you find as a [GitHub issue](https://github.com/jaidevk/kfandra-track/issues/new/choose) using one of
the three templates (details at the end).

---

## 1. Diet — check the numbers

Diet records what you ate and shows calories plus protein / carbs / fat. It is
not scored.

What to check:

- [ ] **Per food.** Log one item of a food you know well and tap **Done**. Do
      the calories and macros look right for one unit?
      **1 waati = 100 g** for every food except dry oats (40 g). The unit is
      shown next to each food.
- [ ] **Counts multiply.** Set a food to 2 or 3. Do the numbers go up 2× or 3×?
- [ ] **Meal total = sum of foods.** Add up the foods in a meal by hand. Does
      the meal sheet match?
- [ ] **Day total = sum of meals.** Does the card at the top of Diet match the
      meals added together?
- [ ] **"Items counted" line.** Custom foods and foods without values are
      logged but not counted. Does the "x of y items counted" line agree?
- [ ] **Dots and notes.** Green / amber (*watch*) / red (*avoid*). Does the
      colour and KFANDRA's note make sense for that food?
- [ ] **Past days.** Pick an earlier date. Do the totals still match what you
      logged?
- [ ] **Missing foods.** Something you eat often that isn't in the list?

Found a wrong number? Use the **"A number looks wrong"** template. Give the
food, the count, what the app showed, and what you expected (and where your
expected value comes from).

## 2. MMG — check the points

- [ ] **Running total.** As you fill in Participation, games, stats and Other,
      does the big total at the top add up? Each line shows the points it's
      worth.
- [ ] **Multiples.** 3 wins should be 3× the win points; 5 goals 5× the goal
      points. Penalties (cards, fouls) should subtract.
- [ ] **Other.** A negative value should reduce the total.
- [ ] **Order-of-arrival points** (shown after **Finalize**). Compare with the
      Google Sheet for the same session. These are provisional — they depend on
      everyone who has entered so far, so note *when* you looked.
- [ ] **Google Sheet.** Compare your session total in the app with the Sheet.
      The Sheet is still the source of truth while we validate.

## 3. Performance — what's slow

We already know **Finalize** on MMG can take a long time, and the cause is
being worked on. Your timings are still useful: they give us a "before" figure
to compare the fix against.

How to report:

1. Count the seconds (a phone stopwatch is fine) from tapping the button until
   the result appears.
2. Note **the time of day** you did it (to the minute). We use it to find your
   visit in our analytics and see exactly what was slow.
3. Note your network (Wi-Fi / 4G / 5G) and phone.

Things worth timing:

- [ ] **Finalize session** on MMG — and, if you can, once early in the month
      and once late in the month (it may get slower as the month fills up).
- [ ] Opening the app from cold (first load of the day).
- [ ] Opening MMG, Gym and Diet from the home screen.
- [ ] Switching dates on MMG and Diet.
- [ ] "Saving…" → "Saved ✓" taking unusually long.

Anything over about **3 seconds** is worth an issue — use the
**"Something is slow"** template.

## 4. Anything else

Crashes, buttons that do nothing, confusing screens, things that look broken on
your phone: use the **"Bug"** template. A screenshot helps a lot.

---

## Reporting — the three templates

| Template | Use it when |
|---|---|
| **A number looks wrong** | A calorie, macro, or points figure doesn't match what you expect. |
| **Something is slow** | An action takes more than ~3 seconds. |
| **Bug** | Anything broken, confusing or crashing. |

One problem per issue, please. Before filing, glance at the
[open issues](https://github.com/jaidevk/kfandra-track/issues) — if someone already reported it, add a 👍 or a
comment with your own timing / numbers instead.

**Privacy:** issues on this repo are public. Don't post phone numbers, PINs, or
other players' data. Your nickname and your own numbers are fine.
