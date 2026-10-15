# Diet Nutrition Info: Design

**Date:** 2026-10-16
**Status:** Reviewed 2026-10-16. Implementation plan: `docs/superpowers/plans/2026-10-16-diet-nutrition.md`.
**Source:** KFANDRA email of 2026-10-02 plus two attachments: *Athlete Diet Nutrition Matrix v2* ("the 2nd one is more thorough") and *Comprehensive Food Nutrition Guide*. The source PDFs stay local; they are not committed because the repo is public.
**Brainstormed with Jaidev on 2026-10-16.** All decisions are recorded in §1. D11–D15 came from the implementation review the same day; §10 lists the defaults chosen for the smaller questions.
**Estimate:** about 1 week.

---

## 0. Goal

After a player logs a meal, and again at the end of the day, show them what they ate in **calories, protein, carbs and fat**, along with KFANDRA's per-food guidance (good / watch / avoid). KFANDRA can see this for **every** player, so they can guide them.

## 1. Decisions

| # | Decision |
|---|---|
| D1 | Nutrition is stored **per 100 g**, plus **grams per serving** for each catalogue food. The app converts. ml are treated as g for drinks. |
| D2 | When the two PDFs disagree, the **Athlete Matrix v2 wins**. The table in KFANDRA's email adds Jackfruit, Grapes, Watermelon, Papaya, Pineapple, Wada Pav, Sev, Chivda, Biscuits, Idli and Dosa. |
| D3 | Serving weights: **1 waati = 150 g**, the same as dal uses today. 1 glass = 200 ml. 1 cup = 100 ml. Fruit "medium unit" = 100 g, per the matrix. Dry snacks are the exception: 1 waati of sev or chivda = 50 g, because 150 g of namkeen is not a realistic serving. |
| D4 | Values KFANDRA gave **per piece or per serving** are stored by recording an assumed piece weight. The per-100 g figure is derived from it, so the converted value always equals KFANDRA's number exactly. Examples: Wada Pav 300 kcal per piece, nuts per 5 pieces. |
| D5 | Foods with **no KFANDRA data** count as **"not counted"**. Custom and personal foods are also not counted. Totals show "X of Y items counted". |
| D6 | Each food carries a **verdict tag** (good / watch / avoid) and **KFANDRA's note**. Claude proposes the verdicts from KFANDRA's wording (Appendix A), and KFANDRA confirms them. |
| D7 | Player UX: a **summary sheet when a meal is closed**, a **day-total card** on the Diet page, and an **end-of-day recap**: the first time Diet is opened on a new IST day, it shows the previous day. |
| D8 | KFANDRA sees **everyone**: totals and flags are added to the existing `/admin/diet` by-date and by-player pages, plus a new **team grid** (players × last 7 days). |
| D9 | Values are maintained through an **admin edit screen**, not migrations. This follows the "rules not hard-coded" convention and overlaps Helper-nog. |
| D10 | Nutrition is **for guidance only**. Both PDFs are AI-generated, so a one-line disclaimer appears in the sheets. There are no daily targets, because KFANDRA gave none. |
| D11 | **The date picker stays.** Players can still fill in past days. The recap shows only the player's **latest** logged day before today, once. Earlier unseen days are never shown, and filling in a day after its recap was seen does not show it again. |
| D12 | **Nutrition counts from a start date only.** `app_config.diet_nutrition_start_date` is set to the IST date the migration runs. Days before it show no totals anywhere, and no old records are migrated or snapshotted. Totals use the catalogue's current values, so an edit in the food editor changes every day since the start date. |
| D13 | **One source for the seed.** KFANDRA's numbers are typed once into `src/lib/diet/nutrition-seed.ts`, exactly as the PDFs give them, with the weight each number refers to. The SQL block in the migration is generated from that file, and a unit test checks that the two match and that every food converts back to KFANDRA's number. |
| D14 | **Paneer and meat use the unit "100 g".** One tap is 100 g and the 0.5 step is 50 g. Whey and mass gainer use "1 scoop" with placeholder weights of 30 g and 100 g; the per-scoop totals equal the matrix whatever the weight. Paneer is one food ("Paneer", boiled values) plus "Paneer, fried". |
| D15 | **Duplicate foods are merged; different dishes stay separate.** `chicken-grilled` becomes "Chicken breast (skinless)" (unit 100 g), and the new meat rows join the existing "Non-Veg" section, so there is no "Meat" section. `roti` becomes "Roti, whole wheat". `paneer-sabzi`, `aloo-bhaji`, `dal` and the plain/sugared drink pairs stay separate foods. No food is deactivated. |

## 2. Current state

- `food_catalog(key, name, emoji, unit, unit_detail, section_label, sort_order, is_active)` holds 63 foods across 9 sections, seeded in `20260607120008_seed_diet_catalog.sql`. It has **no nutrition columns**.
- Logging uses `diet_logs` (one per player per date), then `diet_log_meals` (one per slot, which can be marked skipped), then `diet_log_items` (`food_item_id` or `custom_*`, plus `count numeric(6,2)` in 0.5 steps).
- Personal foods live in `player_food_items` ("My foods"). They have no nutrition.
- UI: `src/app/diet/diet-entry.tsx` (meal sheet, auto-save, no submit). Pure helpers live in `src/lib/diet/summary.ts`, `types.ts` and `draft.ts`.
- Admin: `src/app/admin/diet/page.tsx` shows the index, by date and by player (`src/lib/admin/activity-repository.ts`).
- Meal slots include a midnight snack and slots that run past 22:00. That is why the recap is keyed to the next IST day.

## 3. Data model

### 3.1 `food_catalog`: new columns (migration `2026101612xxxx_diet_nutrition.sql`)

| column | type | notes |
|---|---|---|
| kcal_per_100g | numeric(7,2) | null means not counted |
| protein_g_per_100g | numeric(6,2) | |
| carbs_g_per_100g | numeric(6,2) | |
| fat_g_per_100g | numeric(6,2) | |
| grams_per_unit | numeric(7,2) | weight of one `unit` (for example 1 slice = 25) |
| sodium_mg_per_100g | numeric(7,1), nullable | only where KFANDRA gave sodium. Shown in the note, not totalled. |
| verdict | text, nullable | check `in ('good','watch','avoid')` |
| nutrition_note | text, nullable | KFANDRA's note, for example "Hidden Trap. Added oil and high-glycemic potato mash." |
| nutrition_source | text, nullable | `matrix_v2`, `email_2026_10_02`, `app_default` (water), `kfandra` |
| nutrition_updated_at / nutrition_updated_by | timestamptz / uuid → players | |

- **Check constraint:** the four macro columns and `grams_per_unit` are either all null or all non-null. This avoids half-counted foods.
- The **seed** keeps KFANDRA's numbers readable (D13). `src/lib/diet/nutrition-seed.ts` lists the **whole catalogue in display order**, and each counted food carries *source values over a basis weight*, for example white bread is 67 kcal per 25 g slice. The migration's generated block upserts every food (name, unit, section, `sort_order`, converted per-100 g values, verdict, note) and carries a comment with the source values on each row.

### 3.2 Catalogue changes (same migration)
- **Splits**, keeping existing keys so past logs stay valid. Logs from before the start date are not counted (D12), so the renames cannot miscount them.
  - `dosa` is renamed "Dosa, plain", and `masala-dosa` is added.
  - `biscuits` is renamed "Glucose biscuits", and `cream-biscuits` is added.
  - `wada-pav` is added. `vada` is renamed "Medu vada" and is not counted.
- **Merges** (D15): `chicken-grilled` becomes "Chicken breast (skinless)", unit "100 g". `roti` becomes "Roti, whole wheat".
- **New foods** from the PDFs are listed in Appendix A. New sections are "Vegetables & Salad" (after Dals & Sabzi), "Nuts & Seeds" (after Dairy) and "Supplements" (after Beverages). Meat goes into "Non-Veg". `sort_order` is renumbered across the whole catalogue.

### 3.3 Recap tracking
- Add `diet_logs.recap_seen_at timestamptz null`.
- When `/diet` renders, the server finds the player's **latest** `diet_logs` row with `log_date` before today, on or after the start date, and with at least one item. If its `recap_seen_at` is null, the recap is shown (D11). Older days are ignored.
- Because this is stored server-side, the recap shows **once per player**, even across devices. Autosave upserts only `narration`, so it never clears `recap_seen_at`.

### 3.4 Start date
- `app_config` row `diet_nutrition_start_date`, a JSON string `"YYYY-MM-DD"`, seeded with the IST date the migration runs (D12). A missing or invalid value means nutrition is off everywhere.

## 4. Calculation (pure, `src/lib/diet/nutrition.ts`, TDD)

```ts
type Macros = { kcal: number; protein: number; carbs: number; fat: number };
itemNutrition(food: FoodNutrition | null, count: number): Macros | null
  // = per100 × grams_per_unit / 100 × count. Returns null if the food has no values, or for custom/personal items.
mealNutrition(meal, foodById): { totals: Macros; counted: number; total: number; flagged: FlaggedItem[] }
dayNutrition(draft, foodById): same shape, summed over non-skipped meals
```

- **Rounding (display only):** kcal to an integer, macros to 1 decimal place. Sums are taken before rounding.
- **Flagged foods:** items whose verdict is `watch` or `avoid`, with their note. They are de-duplicated per meal.
- **Tests:**
  - half portions
  - mixed counted and uncounted items
  - custom items
  - skipped meals
  - every seeded food round-tripping to KFANDRA's source number within 0.5 kcal and 0.05 g (contract test over `nutrition-seed.ts`)
  - the migration's generated block equals what `nutrition-seed.ts` renders (contract test; `WRITE_NUTRITION_SEED=1` rewrites the block)

## 5. Player UX (`/diet`)

1. **Catalogue tiles** show a small verdict dot (green / amber / red) when a verdict is set.
2. **Meal summary sheet:** when a player closes a meal whose items changed since it was opened, a bottom sheet shows:
   - "Breakfast · 420 kcal"
   - P / C / F chips
   - "3 of 4 items counted"
   - each flagged food with its dot and KFANDRA's note
   - the disclaimer line
   - a **Done** button

   It does not appear for skipped or empty meals.
3. **Day card** at the top of the Diet page: the **selected date's** kcal and P/C/F with the counted ratio. It updates live as items are logged. It is hidden for dates before the start date and when nothing is logged.
4. **Recap:** when Diet is opened and the latest earlier logged day is unseen (§3.3), a sheet shows that day's totals by meal and the flagged foods. Closing it sets `recap_seen_at`.
5. All copy lives in `src/content/strings.ts` and is light-style, matching the house look. In UI copy the name is "KFANDRA", never "Coach".

## 6. KFANDRA UX (`/admin/diet`)

1. **By date:** each player row adds kcal, P/C/F, counted ratio and the number of flagged foods.
2. **By player:** each day adds totals, plus per-meal totals and flagged items when expanded.
3. **New team grid** at `/admin/diet/nutrition`: players as rows and the last 7 IST days as columns.
   - Each cell shows kcal, protein in grams, and a red badge with the flagged count.
   - Empty cells mean nothing was logged.
   - Tapping a cell opens that player's day.
   - Rows are players with at least one diet log in the week, sorted by name. A footer counts the players who logged nothing.
   - The week is the 7 IST days ending on `?end=` (default today). The switcher moves by 7 days.
4. **Food editor** at `/admin/diet/foods`: a list grouped by section with an "uncounted only" filter.
   - Editable per food: grams per unit, kcal/protein/carbs/fat **per unit** (what KFANDRA thinks in; converted to per 100 g on save), sodium per unit, verdict, note, and whether it is active. Clearing all values makes the food uncounted. The name, unit label and section are not editable here.
   - Saving stamps `nutrition_updated_*` and sets the source to `kfandra`.
   - Only the editor role (`isEditorRole`) can edit. Other staff can view.

**Access:** players keep seeing only their own logs (existing RLS). The admin pages read through the existing staff path. The new catalogue columns are readable by everyone, since they are not private.

## 7. Out of scope
- Daily targets or goals per player.
- Micronutrient totals and sodium totals (sodium appears in notes only).
- Nutrition for personal foods ("My foods"). A possible later bead is to let players enter values.
- Push notifications. The PWA has none; the recap shows when Diet is opened.

## 8. Open items for KFANDRA (not blocking)
1. **Values for uncounted foods** that players log most: eggs (boiled, omelette, scrambled), chicken, mutton and fish curry, poha, upma, paratha, aloo bhaji, paneer sabzi, khichadi, pulao, juice, lassi, cheese slice, chocolate, sweets.
2. **Confirm the verdicts** in Appendix A.
3. **Confirm the piece weights**: idli 40 g, dosa 80 g, masala dosa 150 g, glucose biscuit 6 g, cream biscuit 12 g, Wada Pav 150 g.
4. Apple and mango use KFANDRA's "medium unit ≈ 100 g". Real fruit is often heavier, so is that intended?
5. Chicken and meat values are **raw** per 100 g. Do players log raw weight or cooked portions?

## 9. Suggested beads
1. Migration: nutrition columns, check constraint, recap column, catalogue splits and new foods, seed with basis weights.
2. `nutrition.ts` pure calculation plus seed contract test (TDD).
3. Player UX: verdict dots, meal summary sheet, day card.
4. End-of-day recap (`recap_seen_at` action and sheet).
5. Admin: totals in the by-date and by-player pages.
6. Admin: team grid `/admin/diet/nutrition`.
7. Admin: food editor `/admin/diet/foods`.
8. Usage guide and admin guide updates, plus e2e: log a meal → summary; next day → recap; editing a food changes the totals.

## 10. Implementation defaults (chosen 2026-10-16)
1. **Inactive foods keep counting.** The diet page loads inactive foods into the lookup (not the tiles), so deactivating a food does not drop it from past totals.
2. **Nothing counted shows "—"**, not "0 kcal", on the meal sheet, day card, recap and admin cells. The meal sheet still appears so the player sees the "0 of N counted" line and any flags.
3. **The meal sheet** compares the meal's items when it was opened with the items on Done/Back, as a multiset of (food, count). A change that nets to zero is not a change. Reset and Skip from the hub never open it.
4. **The midnight slot** follows the IST date it was logged on. A snack logged at 01:00 belongs to the new day.
5. **Who can edit foods:** `isEditorRole`, which today is all staff. Any save in the editor sets `nutrition_source = 'kfandra'`.
6. **One calculation.** `nutrition.ts` works on a `DietDraft` plus a key-to-food map. The admin repository maps its rows into `DietDraft`s, so the player and admin screens share it.

---

## Appendix A: food mapping (proposed; verdicts for KFANDRA to confirm)

Source: **M** = Athlete Matrix v2, **E** = KFANDRA email table. "Basis" is the weight that the source values refer to.

### Existing app foods that become counted
| App food (key) | Unit → grams | Source row | Basis | Verdict |
|---|---|---|---|---|
| White bread (`white-bread`) | 1 slice → 25 | M White Bread | 25 g | watch |
| Brown bread (`brown-bread`) | 1 slice → 25 | M Brown Bread | 25 g | good |
| Roti, whole wheat (`roti`, renamed) | 1 piece → 40 | M Roti (Whole Wheat) | 40 g | good |
| Dal / varan (`dal`) | 1 waati → 150 | M Toor Dal (Boiled) | 100 g | good |
| Plain rice (`plain-rice`) | 1 waati → 150 | M White Rice (Boiled) | 100 g | watch |
| Milk (`milk`) | 1 glass → 200 | M Cow Milk (Whole) | 100 g | good |
| Buttermilk (`taak`) | 1 glass → 200 | M Buttermilk | 100 g | good |
| Curd (`curd`) | 1 waati → 150 | M Yoghurt (Whole) | 100 g | good |
| Banana / Apple / Mango | 1 piece → 100 | M fruit rows | 100 g | good |
| Papaya / Watermelon | 1 waati → 150 | M/E fruit rows | 100 g | good |
| Water (`water`) | 1 glass → 200 | zero values | 100 g | good |
| Tea / chai (`tea`) | 1 cup → 100 | M Tea (Chai Mix + Sugar) | 100 g | watch |
| Coffee (`coffee`) | 1 cup → 100 | M Coffee (1 tsp sugar + milk) | 100 g | watch |
| Soft drink (`soft-drink`) | 1 glass → 200 | M Soft Drinks | 100 g | avoid |
| Idli (`idli`) | 1 piece → 40 | E Idli | 100 g | good |
| Dosa, plain (`dosa`) | 1 piece → 80 | E Plain Dosa | 100 g | good |
| Glucose biscuits (`biscuits`) | 1 piece → 6 | E Glucose Biscuits | 100 g | avoid |
| Chicken breast, skinless (`chicken-grilled`, merged) | 100 g → 100 | M Chicken Breast (Skinless, Raw) | 100 g | good |
| Chivda (`chivda`) | 1 waati → 50 | E Chivda | 100 g | avoid |
| Laddu (`laddu`) | 1 piece → 50 | M Motichoor Laddu | 50 g | avoid |
| Gulab jamun (`gulab-jamun`) | 1 piece → 50 | M Gulab Jamun | 50 g | avoid |

### New app foods
| Food | Unit → grams | Source row | Basis | Verdict |
|---|---|---|---|---|
| Masala dosa | 1 piece → 150 | E Masala Dosa | 100 g | watch |
| Cream biscuits | 1 piece → 12 | E Cream Cookies | 100 g | avoid |
| Wada pav | 1 piece → 150 | E Wada Pav | 150 g (per piece) | avoid |
| Sev / shev | 1 waati → 50 | E Mixed Shev/Sev | 100 g | avoid |
| Almonds, Pistachios, Cashews, Peanuts, Walnuts | 5 pieces → 6 / 4 / 8 / 5 / 10 | M Nuts (per 5) | per 5 pieces | good |
| Soya chunks (boiled) | 5 pieces → 10 | M Soya (Boiled) | per 5 pieces | good |
| Soya chunks (fried) | 5 pieces → 10 | M Soya (Fried) | per 5 pieces | avoid |
| Paneer | 100 g → 100 | M Paneer (Boiled/Steamed) | 100 g | good |
| Paneer, fried | 100 g → 100 | M Paneer (Fried) | 100 g | watch |
| Greek yoghurt | 1 waati → 150 | M Greek Yoghurt | 100 g | good |
| Skimmed milk | 1 glass → 200 | M Cow Milk (Skimmed) | 100 g | good |
| Ghee | 1 tsp → 5 | M Ghee | 100 g | watch |
| Dal tadka (toor) | 1 waati → 150 | M Toor Dal (Fried/Tadka) | 100 g | watch |
| Moong dal / Masoor dal / Chana dal (boiled) | 1 waati → 150 | M boiled rows | 100 g | good |
| Brown rice | 1 waati → 150 | M Brown Rice (Boiled) | 100 g | good |
| Oats (dry) | 1 waati → 40 | M Oats (Rolled) | 100 g | good |
| Roti, maida / multigrain | 1 piece → 40 | M Roti rows | 40 g | watch / good |
| Potato boiled / sweet potato boiled / arbi boiled | 1 waati → 150 | M boiled rows | 100 g | good |
| Potato fried / chips, Arbi fried | 1 waati → 100 | M fried rows | 100 g | avoid |
| Vegetables & salad: cucumber, tomato, carrot, onion, lettuce, cabbage, spinach, beans (boiled), corn, bell pepper, pumpkin, cauliflower | 1 waati → 100 | M veg rows (raw) | 100 g | good |
| Chicken (with skin), Chicken (fried) | 100 g → 100 | M meat rows | 100 g | watch / avoid |
| Pork (lean / with fat), Beef (lean), Buff (lean) | 100 g → 100 | M meat rows | 100 g | good / watch / watch / good |
| Jackfruit, Grapes, Pineapple | 1 waati → 150 | M/E fruit rows | 100 g | good |
| Orange | 1 piece → 100 | M Oranges | 100 g | good |
| Black coffee / Black tea | 1 cup → 100 | M rows | 100 g | good |
| Diet soda | 1 glass → 200 | M Diet/Zero Soda | 100 g | watch |
| Whey shake / Mass gainer | 1 scoop → 30 / 100 | M rows | per scoop | good / watch |
| Sugar / Jaggery | 1 tsp → 4 / 5 | M rows | per tsp | avoid / watch |
| Chocolate cake | 1 slice → 60 | M Chocolate Cake | 60 g | avoid |

### Stays "not counted" until KFANDRA supplies values
Paratha, naan, bhakri, bhendi bhaji, mixed sabzi, aloo bhaji, paneer sabzi, chana/chole (dish), khichadi, pulao/biryani, curd rice, cheese slice, mixed fruit, all eggs, chicken/mutton/fish curry, fish fried, prawns, tandoori, juice, coconut water, lassi, sports drink, poha, upma, medu vada, samosa, sandwich, maggi, modak, barfi, jalebi, kheer, shrikhand, ice cream, chocolate.
