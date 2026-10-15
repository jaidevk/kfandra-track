# Diet Nutrition Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** After a player logs food, show calories, protein, carbs and fat with KFANDRA's good / watch / avoid notes, and give KFANDRA per-player totals, a team grid and a food editor.

**Architecture:** Nutrition values live on `food_catalog` (per 100 g plus grams per unit). KFANDRA's numbers are typed once into a TypeScript seed file, and a unit test generates and checks the migration's SQL block from it. A single pure module (`src/lib/diet/nutrition.ts`) turns a `DietDraft` plus a food lookup into totals. The player page and every admin page use it. Nutrition counts only from `app_config.diet_nutrition_start_date`.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind, framer-motion, Supabase (Postgres, PostgREST via the service-role client), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-16-diet-nutrition-design.md` (decisions D1–D15, defaults in §10). Read it first.

**Ground rules for the engineer**
- TDD: write the test, watch it fail, implement, watch it pass. `npm run test -- <path>` runs one file.
- One task = one bead = one commit. End each commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Use `bd` for tracking (`bd update <id> --claim`, `bd close <id>`), never TodoWrite.
- UI copy goes in `src/content/strings.ts`, which non-programmers edit, so it holds **plain strings only** (no functions, no placeholders). In UI copy the name is "KFANDRA", never "Coach".
- `src/lib/diet/config.ts` and `repository.ts` are `server-only`. Never import them from a client component; pure helpers go in their own modules.
- Local Supabase must be running (`npx supabase start`) for Tasks 3, 14 and 15.

---

### Task 1: Seed data file (KFANDRA's numbers, typed once)

**Files:**
- Create: `src/lib/diet/nutrition-seed.ts`
- Test: `src/lib/diet/nutrition-seed.test.ts`

**Step 1: Write the failing test**

```ts
// src/lib/diet/nutrition-seed.test.ts
import { describe, it, expect } from "vitest";
import { NUTRITION_SEED, SECTION_ORDER, per100g } from "./nutrition-seed";

/** The 63 keys seeded in 20260607120008_seed_diet_catalog.sql. Past logs point at these. */
const ORIGINAL_KEYS = [
  "white-bread", "brown-bread", "roti", "paratha", "naan", "bhakri",
  "dal", "bhendi", "mixed-sabzi", "aloo-bhaji", "paneer-sabzi", "chana",
  "plain-rice", "khichadi", "pulao", "curd-rice",
  "milk", "taak", "curd", "cheese-slice",
  "banana", "apple", "mango", "papaya", "watermelon", "mixed-fruit",
  "egg-boiled", "egg-omelette", "egg-scrambled", "chicken-curry", "chicken-grilled",
  "mutton-curry", "fish-curry", "fish-fried", "prawns", "tandoori",
  "water", "tea", "coffee", "juice", "coconut-water", "lassi", "soft-drink", "sports-drink",
  "poha", "upma", "idli", "dosa", "vada", "samosa", "sandwich", "biscuits", "maggi", "chivda",
  "modak", "laddu", "barfi", "jalebi", "gulab-jamun", "kheer", "shrikhand", "ice-cream", "chocolate",
];

const byKey = Object.fromEntries(NUTRITION_SEED.map((f) => [f.key, f]));

describe("NUTRITION_SEED shape", () => {
  it("has unique keys", () => {
    const keys = NUTRITION_SEED.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("keeps every original catalogue key so past logs stay valid", () => {
    for (const key of ORIGINAL_KEYS) expect(byKey[key], key).toBeDefined();
  });

  it("lists sections in SECTION_ORDER, each as one contiguous run", () => {
    const runs: string[] = [];
    for (const f of NUTRITION_SEED) if (runs.at(-1) !== f.section) runs.push(f.section);
    expect(runs).toEqual([...SECTION_ORDER]);
  });

  it("has no separate Meat section (meat merges into Non-Veg, D15)", () => {
    expect(SECTION_ORDER).not.toContain("Meat (100 g)");
    expect(byKey["chicken-grilled"].section).toBe("Non-Veg");
    expect(byKey["chicken-grilled"].name).toBe("Chicken breast (skinless)");
    expect(byKey["chicken-grilled"].unit).toBe("100 g");
  });

  it("gives every counted food positive weights and non-negative values", () => {
    for (const f of NUTRITION_SEED) {
      const n = f.nutrition;
      if (!n) continue;
      expect(n.gramsPerUnit, f.key).toBeGreaterThan(0);
      expect(n.basisG, f.key).toBeGreaterThan(0);
      for (const v of [n.kcal, n.protein, n.carbs, n.fat]) expect(v, f.key).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("per100g round-trips to KFANDRA's numbers", () => {
  it.each(NUTRITION_SEED.filter((f) => f.nutrition).map((f) => [f.key, f] as const))(
    "%s",
    (_key, f) => {
      const n = f.nutrition!;
      const p = per100g(n);
      const back = (v: number) => (v * n.basisG) / 100;
      expect(Math.abs(back(p.kcal) - n.kcal)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(back(p.protein) - n.protein)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(back(p.carbs) - n.carbs)).toBeLessThanOrEqual(0.05);
      expect(Math.abs(back(p.fat) - n.fat)).toBeLessThanOrEqual(0.05);
    },
  );

  it("converts a per-piece source exactly (white bread: 67 kcal per 25 g)", () => {
    expect(per100g(byKey["white-bread"].nutrition!)).toMatchObject({
      kcal: 268, protein: 8, carbs: 48, fat: 3.2,
    });
  });

  it("converts sodium per basis to per 100 g (wada pav: 450 mg per 150 g piece)", () => {
    expect(per100g(byKey["wada-pav"].nutrition!).sodiumMg).toBe(300);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/diet/nutrition-seed.test.ts`
Expected: FAIL, "Failed to resolve import ./nutrition-seed".

**Step 3: Write the seed file**

The values below are copied from `docs/Athlete_Diet_Nutrition_Matrix_v2.pdf` (source `matrix_v2`) and KFANDRA's email of 2026-10-02 (`docs/KFANDRA-Jacaranda-updates-2026-10-02.pdf`, source `email_2026_10_02`). Notes are KFANDRA's wording, verbatim. `basisG` is the weight the source numbers describe; `gramsPerUnit` is the weight of one tap. Where the matrix wins over the email (papaya, watermelon), the matrix row is used (D2).

```ts
// src/lib/diet/nutrition-seed.ts
/**
 * KFANDRA's nutrition numbers, typed ONCE, exactly as the source gives them.
 *
 * This is the single source for the food catalogue seed (spec D13): the SQL
 * block in supabase/migrations/20261016120000_diet_nutrition.sql is generated
 * from this list (see nutrition-seed-sql.ts) and a contract test fails if the
 * two drift. The list is the WHOLE catalogue in display order; sort_order is
 * the array index + 1.
 *
 * `basisG` is the weight the source numbers refer to (e.g. 25 for "1 slice -
 * 25 g", 100 for "per 100 g"). `gramsPerUnit` is the weight of one tap of the
 * food's unit (ml are treated as g, D1). They differ when KFANDRA's numbers
 * are per 100 g but the player logs a waati or a glass.
 *
 * Pure: no imports, no I/O. Safe for tests and client bundles.
 */

export type SeedVerdict = "good" | "watch" | "avoid";
export type SeedSource = "matrix_v2" | "email_2026_10_02" | "app_default";

export interface SeedNutrition {
  gramsPerUnit: number;
  source: SeedSource;
  basisG: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Sodium in mg per basisG, only where KFANDRA gave it. */
  sodiumMg: number | null;
  verdict: SeedVerdict;
  note: string | null;
}

export interface SeedFood {
  key: string;
  name: string;
  emoji: string;
  unit: string;
  unitDetail: string | null;
  section: string;
  nutrition: SeedNutrition | null;
}

type Values = [kcal: number, protein: number, carbs: number, fat: number];

/** A row from the Athlete Matrix v2. */
function M(gramsPerUnit: number, basisG: number, v: Values, verdict: SeedVerdict, note: string): SeedNutrition {
  const [kcal, protein, carbs, fat] = v;
  return { gramsPerUnit, source: "matrix_v2", basisG, kcal, protein, carbs, fat, sodiumMg: null, verdict, note };
}

/** A row from KFANDRA's email table of 2026-10-02. */
function E(
  gramsPerUnit: number, basisG: number, v: Values, verdict: SeedVerdict, note: string,
  sodiumMg: number | null = null,
): SeedNutrition {
  const [kcal, protein, carbs, fat] = v;
  return { gramsPerUnit, source: "email_2026_10_02", basisG, kcal, protein, carbs, fat, sodiumMg, verdict, note };
}

type Row = Omit<SeedFood, "section">;
function food(key: string, name: string, emoji: string, unit: string, unitDetail: string | null, nutrition: SeedNutrition | null = null): Row {
  return { key, name, emoji, unit, unitDetail, nutrition };
}

const WATER: SeedNutrition = {
  gramsPerUnit: 200, source: "app_default", basisG: 100,
  kcal: 0, protein: 0, carbs: 0, fat: 0, sodiumMg: null, verdict: "good", note: null,
};

const SECTIONS: Array<[string, Row[]]> = [
  ["Grains & Bread", [
    food("white-bread", "White bread", "🍞", "1 slice", "25 g", M(25, 25, [67, 2.0, 12.0, 0.8], "watch", "High GI Processing, Low Dietary Fiber")),
    food("brown-bread", "Brown bread", "🍞", "1 slice", "25 g", M(25, 25, [65, 2.2, 11.5, 0.9], "good", "B Vitamins, Intermediate Fiber Density")),
    food("roti", "Roti, whole wheat", "🫓", "1 piece", "40 g", M(40, 40, [105, 3.5, 22.0, 0.5], "good", "Complex Carbs, Magnesium, Core Fuel")),
    food("roti-maida", "Roti, maida", "🫓", "1 piece", "40 g", M(40, 40, [120, 3.0, 24.5, 1.2], "watch", "Maida Base, Low Transit Velocity, High GI")),
    food("roti-multigrain", "Roti, multigrain", "🫓", "1 piece", "40 g", M(40, 40, [102, 4.0, 20.5, 0.8], "good", "Maximum Fiber, Low Insulin Response Profile")),
    food("paratha", "Paratha", "🫓", "1 piece", null),
    food("naan", "Naan", "🫓", "1 piece", null),
    food("bhakri", "Bhakri", "🫓", "1 piece", null),
    food("oats", "Oats (dry)", "🥣", "1 waati", "40 g dry", M(40, 100, [389, 16.9, 66.3, 6.9], "good", "Beta-Glucan Fiber, Exceptional Heart Recovery")),
  ]],
  ["Dals & Sabzi", [
    food("dal", "Dal / varan", "🥣", "1 waati", "150 g", M(150, 100, [116, 7.0, 20.0, 0.4], "good", "Water Volume Dilution, Folate Heavy")),
    food("dal-tadka", "Dal tadka", "🍲", "1 waati", "150 g", M(150, 100, [190, 6.8, 19.5, 9.2], "watch", "Added Seed Oils, Lipid Density Increase")),
    food("moong-dal", "Moong dal", "🥣", "1 waati", "150 g", M(150, 100, [105, 7.3, 19.0, 0.3], "good", "Optimal Athlete Low-Fat Recovery Carb")),
    food("masoor-dal", "Masoor dal", "🥣", "1 waati", "150 g", M(150, 100, [116, 9.0, 20.0, 0.3], "good", "Post-Training Amino/Glycogen Load")),
    food("chana-dal", "Chana dal", "🥣", "1 waati", "150 g", M(150, 100, [164, 8.9, 27.0, 2.6], "good", "Low Glycemic Index, Steady Energy")),
    food("soya-boiled", "Soya chunks, boiled", "🫘", "5 pieces", "~10 g", M(10, 10, [35, 5.2, 3.3, 0.1], "good", "High Hydration Mass, Low Density")),
    food("soya-fried", "Soya chunks, fried", "🫘", "5 pieces", "~10 g", M(10, 10, [115, 5.1, 4.0, 9.0], "avoid", "Extreme Fat Spike, Oxidized Lipids")),
    food("bhendi", "Bhendi bhaji", "🥬", "1 waati", null),
    food("mixed-sabzi", "Mixed sabzi", "🥗", "1 waati", null),
    food("aloo-bhaji", "Aloo bhaji", "🥔", "1 waati", null),
    food("paneer-sabzi", "Paneer sabzi", "🧀", "1 waati", null),
    food("chana", "Chana / chole", "🫘", "1 waati", null),
  ]],
  ["Vegetables & Salad", [
    food("potato-boiled", "Potato, boiled", "🥔", "1 waati", "150 g", M(150, 100, [87, 2.0, 20.0, 0.1], "good", "Clean Resistant Starch, Cellular Energy")),
    food("sweet-potato", "Sweet potato, boiled", "🍠", "1 waati", "150 g", M(150, 100, [90, 2.0, 21.0, 0.1], "good", "Highly Bioavailable Vit A, Antioxidants")),
    food("arbi-boiled", "Arbi, boiled", "🥔", "1 waati", "150 g", M(150, 100, [116, 1.6, 27.5, 0.1], "good", "Viscous Soluble Fiber, Gastro-Safe")),
    food("potato-fried", "Potato fried / chips", "🍟", "1 waati", "100 g", M(100, 100, [312, 3.4, 41.0, 15.0], "avoid", "Extreme Glycemic Index, Trans Fat Hazard")),
    food("arbi-fried", "Arbi, fried", "🍟", "1 waati", "100 g", M(100, 100, [280, 2.1, 38.0, 13.5], "avoid", "Dense Caloric Trap, Stripped Micronutrients")),
    food("cucumber", "Cucumber", "🥒", "1 waati", "100 g", M(100, 100, [15, 0.7, 3.6, 0.1], "good", "Maximum Electrolyte Hydration, Silica")),
    food("tomato", "Tomato", "🍅", "1 waati", "100 g", M(100, 100, [18, 0.9, 3.9, 0.2], "good", "Lycopene (Cardio and Prostate Support)")),
    food("carrot", "Carrot", "🥕", "1 waati", "100 g", M(100, 100, [41, 0.9, 9.6, 0.2], "good", "Beta-Carotene, High Fiber Visual Catalyst")),
    food("onion", "Onion", "🧅", "1 waati", "100 g", M(100, 100, [40, 1.1, 9.3, 0.1], "good", "Quercetin, Chromium, Anti-Inflammatory")),
    food("lettuce", "Lettuce", "🥬", "1 waati", "100 g", M(100, 100, [15, 1.4, 2.9, 0.2], "good", "Hydration Matrix, Minimal Calorie Load")),
    food("cabbage", "Cabbage", "🥬", "1 waati", "100 g", M(100, 100, [25, 1.3, 5.8, 0.1], "good", "Glucosinolates, Cancer-Protective Minerals")),
    food("spinach", "Spinach", "🥬", "1 waati", "100 g", M(100, 100, [23, 2.9, 3.6, 0.4], "good", "Non-Heme Iron, Nitrates for Endurance")),
    food("beans-boiled", "Green beans, boiled", "🫛", "1 waati", "100 g", M(100, 100, [35, 1.9, 7.9, 0.3], "good", "Low Calorie High Crunch Micronutrient")),
    food("corn", "Sweet corn", "🌽", "1 waati", "100 g", M(100, 100, [86, 3.2, 19.0, 1.2], "good", "Lutein, Zeaxanthin, Optic Pathway Fuel")),
    food("bell-pepper", "Bell pepper", "🫑", "1 waati", "100 g", M(100, 100, [20, 0.9, 4.6, 0.2], "good", "Extreme Vit C Catalyst, Immunity Base")),
    food("pumpkin", "Pumpkin", "🎃", "1 waati", "100 g", M(100, 100, [26, 1.0, 6.5, 0.1], "good", "Alpha-Carotene, Low Calorie Bulking Food")),
    food("cauliflower", "Cauliflower", "🥦", "1 waati", "100 g", M(100, 100, [25, 1.9, 5.0, 0.3], "good", "Choline, Indole-3-Carbinol, Recovery Acid")),
  ]],
  ["Rice", [
    food("plain-rice", "Plain rice", "🍚", "1 waati", "150 g", M(150, 100, [130, 2.7, 28.0, 0.3], "watch", "High Glycemic Muscle Glycogen Replenisher")),
    food("brown-rice", "Brown rice", "🍚", "1 waati", "150 g", M(150, 100, [112, 2.3, 23.5, 0.8], "good", "Sustained Low-GI Fuel Release Profile")),
    food("khichadi", "Khichadi", "🍚", "1 waati", null),
    food("pulao", "Pulao / biryani", "🍛", "1 plate", null),
    food("curd-rice", "Curd rice", "🍚", "1 waati", null),
  ]],
  ["Dairy", [
    food("milk", "Milk", "🥛", "1 glass", "200 ml", M(200, 100, [62, 3.2, 4.8, 3.3], "good", "Vit D, Calcium, Riboflavin")),
    food("skimmed-milk", "Milk, skimmed", "🥛", "1 glass", "200 ml", M(200, 100, [35, 3.4, 5.0, 0.1], "good", "Isolated Protein, Low Lipids")),
    food("taak", "Buttermilk / taak", "🥛", "1 glass", "200 ml", M(200, 100, [40, 3.3, 4.8, 0.9], "good", "Hydration Matrix, Potassium, Calcium")),
    food("curd", "Curd / dahi", "🍶", "1 waati", "150 g", M(150, 100, [61, 3.5, 4.7, 3.3], "good", "B12, Active Probiotics, Gut Health")),
    food("greek-yoghurt", "Greek yoghurt", "🍶", "1 waati", "150 g", M(150, 100, [97, 9.0, 4.0, 5.0], "good", "Concentrated Amino Acids, Calcium")),
    food("paneer", "Paneer", "🧀", "100 g", null, M(100, 100, [260, 18.0, 3.2, 19.5], "good", "Moisture Retained, Sodium Leached")),
    food("paneer-fried", "Paneer, fried", "🧀", "100 g", null, M(100, 100, [410, 17.2, 2.8, 36.0], "watch", "Conjugated Fat Spike, Saturated Content")),
    food("ghee", "Ghee", "🧈", "1 tsp", "5 g", M(5, 100, [897, 0.0, 0.0, 99.5], "watch", "Pure Butyric Acid, Vit A, Extreme Density")),
    food("cheese-slice", "Cheese slice", "🧀", "1 piece", null),
  ]],
  ["Nuts & Seeds", [
    food("almonds", "Almonds", "🌰", "5 pieces", "~6 g", M(6, 6, [35, 1.3, 1.2, 3.0], "good", "Vit E, Magnesium, High Satiety")),
    food("pistachios", "Pistachios", "🌰", "5 pieces", "~4 g", M(4, 4, [20, 0.7, 1.0, 1.6], "good", "Vit B6, Potassium, Low Calorie")),
    food("cashews", "Cashews", "🌰", "5 pieces", "~8 g", M(8, 8, [45, 1.4, 2.4, 3.5], "good", "Zinc, Iron, Copper")),
    food("peanuts", "Peanuts", "🥜", "5 pieces", "~5 g", M(5, 5, [30, 1.3, 0.8, 2.5], "good", "Niacin, Biotin, Protein Dense")),
    food("walnuts", "Walnuts", "🌰", "5 pieces", "~10 g", M(10, 10, [65, 1.5, 1.4, 6.5], "good", "Omega-3 ALA, Brain Health, Copper")),
  ]],
  ["Fruits", [
    food("banana", "Banana", "🍌", "1 piece", "~100 g", M(100, 100, [89, 1.1, 22.8, 0.3], "good", "Potassium Energy Catalyst, Instant Glycogen")),
    food("apple", "Apple", "🍎", "1 piece", "~100 g", M(100, 100, [52, 0.3, 13.8, 0.2], "good", "Pectin Soluble Fiber, Steady Blood Sugar")),
    food("mango", "Mango", "🥭", "1 piece", "~100 g", M(100, 100, [60, 0.8, 15.0, 0.4], "good", "Vit C, Vit A, Fructose Spurt Energy")),
    food("orange", "Orange", "🍊", "1 piece", "~100 g", M(100, 100, [47, 0.9, 11.8, 0.1], "good", "High Bioavailable Vit C, Electrolyte Balance")),
    food("papaya", "Papaya", "🍈", "1 waati", "150 g", M(150, 100, [43, 0.5, 10.8, 0.3], "good", "Papain Enzyme (Protein Digestion Optimizer)")),
    food("watermelon", "Watermelon", "🍉", "1 waati", "150 g", M(150, 100, [30, 0.6, 7.6, 0.2], "good", "L-Citrulline (Nitric Oxide Vasodilation), Hydration")),
    food("jackfruit", "Jackfruit", "🍈", "1 waati", "150 g", M(150, 100, [95, 1.7, 23.2, 0.6], "good", "Vit B6, Potassium, Complex Plant Energy")),
    food("grapes", "Grapes", "🍇", "1 waati", "150 g", M(150, 100, [69, 0.7, 18.1, 0.2], "good", "Resveratrol, Quick Hydrating Muscle Sugar")),
    food("pineapple", "Pineapple", "🍍", "1 waati", "150 g", M(150, 100, [50, 0.5, 13.1, 0.1], "good", "Bromelain Enzyme (Muscle Anti-Inflammatory)")),
    food("mixed-fruit", "Mixed fruit", "🍇", "1 waati", null),
  ]],
  ["Non-Veg", [
    food("egg-boiled", "Egg, boiled", "🥚", "1 piece", null),
    food("egg-omelette", "Egg, omelette", "🍳", "1 piece", null),
    food("egg-scrambled", "Egg, scrambled", "🍳", "1 waati", null),
    // Merged (D15): the old "Chicken grilled, 1 piece ~100 g" tile.
    food("chicken-grilled", "Chicken breast (skinless)", "🍗", "100 g", null, M(100, 100, [165, 31.0, 0.0, 3.6], "good", "Pure Lean Muscle Block, Selenium, B6")),
    food("chicken-skin", "Chicken (with skin)", "🍗", "100 g", null, M(100, 100, [215, 27.0, 0.0, 15.0], "watch", "High Saturated Fat Density Payload")),
    food("chicken-fried", "Chicken, fried", "🍗", "100 g", null, M(100, 100, [290, 28.5, 0.0, 18.5], "avoid", "Trans/Saturated Fat Matrix Infusion")),
    food("chicken-curry", "Chicken curry", "🍗", "1 waati", null),
    food("mutton-curry", "Mutton curry", "🥩", "1 waati", null),
    food("fish-curry", "Fish curry", "🐟", "1 waati", null),
    food("fish-fried", "Fish grilled / fried", "🐟", "1 piece", null),
    food("prawns", "Prawns", "🦐", "1 waati", null),
    food("tandoori", "Tandoori chicken", "🍗", "1 piece", null),
    food("pork-lean", "Pork, lean", "🥩", "100 g", null, M(100, 100, [145, 21.0, 0.0, 6.0], "good", "Thiamine (B1) Super Engine Catalyst")),
    food("pork-fat", "Pork, with fat", "🥩", "100 g", null, M(100, 100, [295, 17.0, 0.0, 25.0], "watch", "High Caloric Loading, Saturated Stress")),
    food("beef-lean", "Beef, lean", "🥩", "100 g", null, M(100, 100, [250, 26.0, 0.0, 15.0], "watch", "Heme Iron, Zinc, Highly Bioavailable Creatine")),
    food("buff-lean", "Buff, lean", "🥩", "100 g", null, M(100, 100, [130, 22.4, 0.0, 2.4], "good", "Ultra-Lean Competitor Beef, High Iron Base")),
  ]],
  ["Beverages", [
    food("water", "Water", "💧", "1 glass", "200 ml", WATER),
    food("tea", "Tea / chai", "🍵", "1 cup", "100 ml", M(100, 100, [50, 1.6, 8.5, 1.8], "watch", "Simple Sugar Spike Profile")),
    food("black-tea", "Black tea", "🍵", "1 cup", "100 ml", M(100, 100, [1, 0.1, 0.2, 0.0], "good", "Theaflavins, L-Theanine Cognitive Focus")),
    food("coffee", "Coffee", "☕", "1 cup", "100 ml", M(100, 100, [45, 1.5, 7.0, 1.5], "watch", "Hidden Insulin Spiker Framework")),
    food("black-coffee", "Black coffee", "☕", "1 cup", "100 ml", M(100, 100, [1, 0.1, 0.0, 0.0], "good", "Caffeine Ergogenic Aid, Chlorogenic Acid")),
    food("juice", "Juice", "🧃", "1 glass", null),
    food("coconut-water", "Coconut water", "🥥", "1 glass", null),
    food("lassi", "Lassi", "🥛", "1 glass", null),
    food("soft-drink", "Soft drink / cola", "🥤", "1 glass", "200 ml", M(200, 100, [42, 0.0, 10.6, 0.0], "avoid", "High Fructose Corn Syrup Damage, Acidity")),
    food("diet-soda", "Diet / zero soda", "🥤", "1 glass", "200 ml", M(200, 100, [0, 0.0, 0.0, 0.0], "watch", "Artificial Sweeteners (Non-Caloric Matrix)")),
    food("sports-drink", "Sports drink", "🍶", "1 bottle", "1 L"),
  ]],
  ["Supplements", [
    // Per-scoop source; the gram weight is a placeholder and cancels out (D14).
    food("whey-shake", "Whey shake", "🥤", "1 scoop", "in water", M(30, 30, [120, 24.0, 2.0, 1.5], "good", "Immediate Leucine Recovery BCAA Spike")),
    food("mass-gainer", "Mass gainer", "🥤", "1 scoop", "in water", M(100, 100, [380, 20.0, 70.0, 3.0], "watch", "Maltodextrin Overload, Fast Glycemic Load")),
  ]],
  ["Snacks", [
    food("poha", "Poha", "🍚", "1 waati", null),
    food("upma", "Upma", "🥣", "1 waati", null),
    // Email says fat "<1.0g"; stored as the upper bound 1.0.
    food("idli", "Idli", "🍙", "1 piece", "~40 g", E(40, 100, [120, 6.0, 28.0, 1.0], "good", "Excellent Choice. High bioavailability via fermentation.")),
    food("dosa", "Dosa, plain", "🥞", "1 piece", "~80 g", E(80, 100, [165, 4.0, 29.0, 3.5], "good", "Safe, clean complex carbs if prepared without excess butter/ghee.")),
    food("masala-dosa", "Masala dosa", "🥞", "1 piece", "~150 g", E(150, 100, [250, 5.0, 40.0, 8.0], "watch", "Hidden Trap. Added oil and high-glycemic potato mash.")),
    food("vada", "Medu vada", "🍩", "1 piece", null),
    food("wada-pav", "Wada pav", "🍔", "1 piece", null, E(150, 150, [300, 6.7, 30.7, 16.7], "avoid", "~450mg Sodium. Massive trans-fat spike from deep frying.", 450)),
    food("samosa", "Samosa", "🥟", "1 piece", null),
    food("sandwich", "Sandwich", "🥪", "1 piece", null),
    food("biscuits", "Glucose biscuits", "🍪", "1 piece", "~6 g", E(6, 100, [450, 6.5, 77.0, 12.5], "avoid", "High in Refined Palm Oil and processed sugar syrups.")),
    food("cream-biscuits", "Cream biscuits", "🍪", "1 piece", "~12 g", E(12, 100, [480, 5.0, 70.0, 20.0], "avoid", "Pure hydrogenated fats. Causes instant insulin crashes.")),
    food("maggi", "Maggi / noodles", "🍜", "1 waati", null),
    food("chivda", "Chivda / namkeen", "🥜", "1 waati", "50 g", E(50, 100, [450, 8.0, 55.0, 22.0], "avoid", "High glycemic spike combined with heavy processing lipids.")),
    food("sev", "Sev / shev", "🥨", "1 waati", "50 g", E(50, 100, [480, 11.5, 42.0, 29.5], "avoid", "~500mg+ Sodium. Fried chickpea flour; extreme caloric density.", 500)),
  ]],
  ["Sweets", [
    food("sugar", "Sugar", "🍬", "1 tsp", "4 g", M(4, 4, [16, 0.0, 4.2, 0.0], "avoid", "100% Sucrose, Immediate Blood Glucose Shock")),
    food("jaggery", "Jaggery / gul", "🍯", "1 tsp", "5 g", M(5, 5, [19, 0.0, 4.8, 0.0], "watch", "Trace Iron, Potassium, Slower Fructose Link")),
    food("modak", "Modak", "🍡", "1 piece", null),
    food("laddu", "Laddu", "🍡", "1 piece", "~50 g", M(50, 50, [185, 2.0, 28.0, 8.0], "avoid", "Gram Flour Fried in Ghee, Extreme Fat/Carb")),
    food("barfi", "Barfi", "🍬", "1 piece", null),
    food("jalebi", "Jalebi", "🥨", "1 piece", null),
    food("gulab-jamun", "Gulab jamun", "🍡", "1 piece", "~50 g", M(50, 50, [175, 2.5, 26.0, 7.0], "avoid", "Deep Fried Dairy, Heavy Sugar Syrup Lock")),
    food("kheer", "Kheer", "🥣", "1 waati", null),
    food("shrikhand", "Shrikhand", "🍶", "1 waati", null),
    food("ice-cream", "Ice cream", "🍨", "1 scoop", null),
    food("chocolate", "Chocolate", "🍫", "1 piece", null),
    food("chocolate-cake", "Chocolate cake", "🍰", "1 slice", "~60 g", M(60, 60, [235, 3.2, 32.0, 10.5], "avoid", "Refined Flour, Trans-Fat Frosting Matrix")),
  ]],
];

export const SECTION_ORDER = SECTIONS.map(([section]) => section);

export const NUTRITION_SEED: SeedFood[] = SECTIONS.flatMap(([section, rows]) =>
  rows.map((r) => ({ ...r, section })),
);

const round2 = (x: number) => Math.round(x * 100) / 100;
const round1 = (x: number) => Math.round(x * 10) / 10;

/** Convert source values (per basisG) to per-100 g, rounded as the DB stores them. */
export function per100g(n: SeedNutrition) {
  const f = 100 / n.basisG;
  return {
    kcal: round2(n.kcal * f),
    protein: round2(n.protein * f),
    carbs: round2(n.carbs * f),
    fat: round2(n.fat * f),
    sodiumMg: n.sodiumMg === null ? null : round1(n.sodiumMg * f),
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- src/lib/diet/nutrition-seed.test.ts`
Expected: PASS (all round-trip cases green).

**Step 5: Check every number against the PDFs by hand**

Open both PDFs and tick each counted row off against the source. This is the one manual check in the plan; the test only proves the conversion, not the typing.

**Step 6: Commit**

```bash
git add src/lib/diet/nutrition-seed.ts src/lib/diet/nutrition-seed.test.ts
git commit -m "feat(diet): KFANDRA nutrition seed data with round-trip test"
```

---

### Task 2: SQL renderer and the migration

**Files:**
- Create: `src/lib/diet/nutrition-seed-sql.ts`
- Create: `supabase/migrations/20261016120000_diet_nutrition.sql`
- Test: `src/lib/diet/nutrition-seed-sql.test.ts`

**Step 1: Write the failing test**

```ts
// src/lib/diet/nutrition-seed-sql.test.ts
/**
 * Contract test: the generated block in the migration must equal what
 * renderNutritionSeedSql(NUTRITION_SEED) produces. Pure: reads the migration
 * off disk (same pattern as src/lib/klcsra/config-contract.test.ts).
 *
 * To regenerate after editing nutrition-seed.ts:
 *   WRITE_NUTRITION_SEED=1 npm run test -- src/lib/diet/nutrition-seed-sql.test.ts
 */
import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NUTRITION_SEED, type SeedFood } from "./nutrition-seed";
import { BEGIN_MARKER, END_MARKER, renderNutritionSeedSql, sqlString } from "./nutrition-seed-sql";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = resolve(HERE, "..", "..", "..", "supabase/migrations/20261016120000_diet_nutrition.sql");

describe("sqlString", () => {
  it("quotes and escapes single quotes", () => {
    expect(sqlString("KFANDRA's")).toBe("'KFANDRA''s'");
  });
  it("renders null as NULL", () => {
    expect(sqlString(null)).toBe("null");
  });
});

describe("renderNutritionSeedSql", () => {
  const white: SeedFood = NUTRITION_SEED.find((f) => f.key === "white-bread")!;
  const paratha: SeedFood = NUTRITION_SEED.find((f) => f.key === "paratha")!;

  it("renders a counted food with per-100 g values and a source comment", () => {
    const sql = renderNutritionSeedSql([white]);
    expect(sql).toContain("-- white-bread: 67 kcal, P 2, C 12, F 0.8 per 25 g (matrix_v2)");
    expect(sql).toContain(
      "('white-bread', 'White bread', '🍞', '1 slice', '25 g', 'Grains & Bread', 1, true, 25, 268, 8, 48, 3.2, null, 'watch', 'High GI Processing, Low Dietary Fiber', 'matrix_v2', now())",
    );
  });

  it("renders an uncounted food with null nutrition", () => {
    const sql = renderNutritionSeedSql([paratha]);
    expect(sql).toContain(
      "('paratha', 'Paratha', '🫓', '1 piece', null, 'Grains & Bread', 1, true, null, null, null, null, null, null, null, null, null, null)",
    );
  });

  it("numbers sort_order from the list position", () => {
    const sql = renderNutritionSeedSql([white, paratha]);
    expect(sql).toMatch(/'paratha', 'Paratha', '🫓', '1 piece', null, 'Grains & Bread', 2,/);
  });
});

describe("migration contract", () => {
  it("contains exactly the rendered seed block", () => {
    const rendered = renderNutritionSeedSql(NUTRITION_SEED);
    let sql = readFileSync(MIGRATION, "utf8");
    const start = sql.indexOf(BEGIN_MARKER);
    const end = sql.indexOf(END_MARKER);
    expect(start, "BEGIN marker missing").toBeGreaterThanOrEqual(0);
    expect(end, "END marker missing").toBeGreaterThan(start);

    if (process.env.WRITE_NUTRITION_SEED) {
      sql = sql.slice(0, start) + rendered + sql.slice(end + END_MARKER.length);
      writeFileSync(MIGRATION, sql);
    }

    const block = sql.slice(start, sql.indexOf(END_MARKER) + END_MARKER.length);
    expect(block).toBe(rendered);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/diet/nutrition-seed-sql.test.ts`
Expected: FAIL, "Failed to resolve import ./nutrition-seed-sql".

**Step 3: Write the renderer**

```ts
// src/lib/diet/nutrition-seed-sql.ts
/**
 * Renders NUTRITION_SEED as the SQL upsert block that lives between the
 * markers in supabase/migrations/20261016120000_diet_nutrition.sql. Pure.
 */
import { per100g, type SeedFood } from "./nutrition-seed";

export const BEGIN_MARKER = "-- BEGIN GENERATED: diet nutrition seed";
export const END_MARKER = "-- END GENERATED: diet nutrition seed";

export function sqlString(v: string | null): string {
  return v === null ? "null" : `'${v.replace(/'/g, "''")}'`;
}

const num = (v: number | null) => (v === null ? "null" : String(v));

const COLUMNS = [
  "key", "name", "emoji", "unit", "unit_detail", "section_label", "sort_order", "is_active",
  "grams_per_unit", "kcal_per_100g", "protein_g_per_100g", "carbs_g_per_100g", "fat_g_per_100g",
  "sodium_mg_per_100g", "verdict", "nutrition_note", "nutrition_source", "nutrition_updated_at",
];

function renderRow(f: SeedFood, sortOrder: number): string[] {
  const head = [
    sqlString(f.key), sqlString(f.name), sqlString(f.emoji), sqlString(f.unit),
    sqlString(f.unitDetail), sqlString(f.section), String(sortOrder), "true",
  ];
  const n = f.nutrition;
  if (!n) return [`  (${[...head, ...Array(10).fill("null")].join(", ")})`];
  const p = per100g(n);
  const comment =
    `  -- ${f.key}: ${n.kcal} kcal, P ${n.protein}, C ${n.carbs}, F ${n.fat}` +
    (n.sodiumMg === null ? "" : `, Na ${n.sodiumMg} mg`) +
    ` per ${n.basisG} g (${n.source})`;
  const values = [
    ...head,
    num(n.gramsPerUnit), num(p.kcal), num(p.protein), num(p.carbs), num(p.fat), num(p.sodiumMg),
    sqlString(n.verdict), sqlString(n.note), sqlString(n.source), "now()",
  ];
  return [comment, `  (${values.join(", ")})`];
}

export function renderNutritionSeedSql(foods: SeedFood[]): string {
  const rows = foods.map((f, i) => renderRow(f, i + 1));
  // Commas go after each value tuple except the last; comment lines carry none.
  const body = rows
    .map((lines, i) => {
      const last = lines.length - 1;
      lines[last] += i === rows.length - 1 ? "" : ",";
      return lines.join("\n");
    })
    .join("\n");
  const updates = COLUMNS.filter((c) => c !== "key").map((c) => `  ${c} = excluded.${c}`).join(",\n");
  return [
    BEGIN_MARKER,
    "-- Generated from src/lib/diet/nutrition-seed.ts. Do not edit by hand. Regenerate with:",
    "--   WRITE_NUTRITION_SEED=1 npm run test -- src/lib/diet/nutrition-seed-sql.test.ts",
    `insert into public.food_catalog (${COLUMNS.join(", ")})`,
    "values",
    body,
    "on conflict (key) do update set",
    `${updates};`,
    END_MARKER,
  ].join("\n");
}
```

**Step 4: Write the migration's hand-written part with empty markers**

```sql
-- supabase/migrations/20261016120000_diet_nutrition.sql
-- ============================================================================
-- 20261016120000 — Diet nutrition (spec 2026-10-16-diet-nutrition-design.md)
-- ----------------------------------------------------------------------------
--   * food_catalog: per-100 g macros, grams per unit, verdict + KFANDRA note
--   * diet_logs.recap_seen_at: the once-only end-of-day recap (D11)
--   * app_config.diet_nutrition_start_date: nutrition counts from here (D12)
--   * the whole catalogue re-seeded from src/lib/diet/nutrition-seed.ts (D13)
-- ============================================================================

alter table public.food_catalog
  add column grams_per_unit       numeric(7,2) check (grams_per_unit > 0),
  add column kcal_per_100g        numeric(7,2) check (kcal_per_100g >= 0),
  add column protein_g_per_100g   numeric(6,2) check (protein_g_per_100g >= 0),
  add column carbs_g_per_100g     numeric(6,2) check (carbs_g_per_100g >= 0),
  add column fat_g_per_100g       numeric(6,2) check (fat_g_per_100g >= 0),
  add column sodium_mg_per_100g   numeric(7,1) check (sodium_mg_per_100g >= 0),
  add column verdict              text check (verdict in ('good', 'watch', 'avoid')),
  add column nutrition_note       text,
  add column nutrition_source     text check (nutrition_source in ('matrix_v2', 'email_2026_10_02', 'app_default', 'kfandra')),
  add column nutrition_updated_at timestamptz,
  add column nutrition_updated_by uuid references public.players(id) on delete set null;

-- A food is either fully counted or not counted at all: no half-counted rows.
alter table public.food_catalog
  add constraint food_catalog_nutrition_all_or_none check (
    num_nulls(grams_per_unit, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g) in (0, 5)
  );

comment on column public.food_catalog.grams_per_unit is
  'Weight in g (ml for drinks) of one `unit`. Null = not counted.';

alter table public.diet_logs add column recap_seen_at timestamptz;

comment on column public.diet_logs.recap_seen_at is
  'When the player dismissed the recap for this day. Null = not seen yet.';

-- Nutrition counts from the IST day this migration runs (D12). Edit the value
-- to move the start date; a missing/invalid value turns nutrition off.
insert into public.app_config (key, value, description)
values (
  'diet_nutrition_start_date',
  to_jsonb(to_char((now() at time zone 'Asia/Kolkata')::date, 'YYYY-MM-DD')),
  'Diet nutrition totals count diet logs on or after this IST date (YYYY-MM-DD).'
)
on conflict (key) do nothing;

-- BEGIN GENERATED: diet nutrition seed
-- END GENERATED: diet nutrition seed
```

**Step 5: Generate the block, then run the tests**

Run: `WRITE_NUTRITION_SEED=1 npm run test -- src/lib/diet/nutrition-seed-sql.test.ts`
Then: `npm run test -- src/lib/diet/nutrition-seed-sql.test.ts`
Expected: PASS both times. Open the migration and eyeball a few rows.

**Step 6: Commit**

```bash
git add src/lib/diet/nutrition-seed-sql.ts src/lib/diet/nutrition-seed-sql.test.ts supabase/migrations/20261016120000_diet_nutrition.sql
git commit -m "feat(diet): nutrition migration with generated catalogue seed"
```

---

### Task 3: Apply the migration and regenerate DB types

**Files:**
- Modify: `src/lib/supabase/database.types.ts` (generated)

**Step 1: Apply locally**

Run: `npx supabase migration up`
Expected: `Applying migration 20261016120000_diet_nutrition.sql...` with no errors.

**Step 2: Verify in SQL**

Run:
```bash
psql postgres://postgres:postgres@127.0.0.1:54322/postgres -c "select count(*) filter (where kcal_per_100g is not null) counted, count(*) total from food_catalog;" -c "select value from app_config where key='diet_nutrition_start_date';" -c "select key, name, unit, section_label from food_catalog where key in ('chicken-grilled','roti','vada');"
```
Expected: 83 counted of 122 total, a date string for today, and the renamed rows.

**Step 3: Regenerate types**

Run: `npx supabase gen types typescript --local > src/lib/supabase/database.types.ts`
Then: `npx tsc --noEmit`
Expected: no errors.

**Step 4: Commit**

```bash
git add src/lib/supabase/database.types.ts
git commit -m "chore(diet): regenerate Supabase types for nutrition columns"
```

---

### Task 4: Types, start date and date helpers

**Files:**
- Modify: `src/lib/diet/types.ts`
- Create: `src/lib/diet/nutrition-start.ts`
- Modify: `src/lib/diet/dates.ts`
- Test: `src/lib/diet/nutrition-start.test.ts`, `src/lib/diet/dates.test.ts` (create)

**Step 1: Write the failing tests**

```ts
// src/lib/diet/nutrition-start.test.ts
import { describe, it, expect } from "vitest";
import { parseStartDate } from "./nutrition-start";

describe("parseStartDate", () => {
  it("accepts a YYYY-MM-DD string", () => expect(parseStartDate("2026-10-16")).toBe("2026-10-16"));
  it("rejects a non-date string", () => expect(parseStartDate("soon")).toBeNull());
  it("rejects an impossible date", () => expect(parseStartDate("2026-02-30")).toBeNull());
  it("rejects null and non-strings", () => {
    expect(parseStartDate(null)).toBeNull();
    expect(parseStartDate(20261016)).toBeNull();
  });
});
```

```ts
// src/lib/diet/dates.test.ts
import { describe, it, expect } from "vitest";
import { shiftDateKey } from "./dates";

describe("shiftDateKey", () => {
  it("moves within a month", () => expect(shiftDateKey("2026-10-16", -6)).toBe("2026-10-10"));
  it("crosses a month", () => expect(shiftDateKey("2026-10-02", -3)).toBe("2026-09-29"));
  it("crosses a year forwards", () => expect(shiftDateKey("2026-12-29", 7)).toBe("2027-01-05"));
});
```

**Step 2: Run to verify they fail**

Run: `npm run test -- src/lib/diet/nutrition-start.test.ts src/lib/diet/dates.test.ts`
Expected: FAIL (missing module / missing export).

**Step 3: Implement**

```ts
// src/lib/diet/nutrition-start.ts
import { isValidDateKey } from "./dates";

/** app_config key holding the IST date nutrition starts counting from (D12). */
export const NUTRITION_START_KEY = "diet_nutrition_start_date";

/** Coerce the raw app_config JSON value; null turns nutrition off. */
export function parseStartDate(value: unknown): string | null {
  return typeof value === "string" && isValidDateKey(value) ? value : null;
}
```

Append to `src/lib/diet/dates.ts`:

```ts
/** Shift a YYYY-MM-DD key by whole days (UTC arithmetic, no DST drift). */
export function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
```

In `src/lib/diet/types.ts`, add above `FoodItemInfo`:

```ts
/** KFANDRA's guidance tag for a food (spec D6). */
export type Verdict = "good" | "watch" | "avoid";

/** Per-100 g macros plus the weight of one unit. All-or-nothing (D5). */
export interface FoodNutrition {
  gramsPerUnit: number;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
}
```

Add to `FoodItemInfo` (optional so existing fixtures still compile):

```ts
  /** Null/absent = not counted. */
  nutrition?: FoodNutrition | null;
  verdict?: Verdict | null;
  /** KFANDRA's note, shown with watch/avoid flags. */
  note?: string | null;
```

Add to `DietCatalog`:

```ts
  /** Inactive foods: not shown as tiles, but still used to total past logs. */
  inactive?: FoodItemInfo[];
```

Change `indexFoods`:

```ts
export function indexFoods(catalog: DietCatalog): Record<string, FoodItemInfo> {
  return Object.fromEntries(
    [...catalog.sections.flatMap((s) => s.items), ...(catalog.inactive ?? [])].map((i) => [i.key, i]),
  );
}
```

**Step 4: Run to verify they pass**

Run: `npm run test -- src/lib/diet`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/diet/types.ts src/lib/diet/nutrition-start.ts src/lib/diet/nutrition-start.test.ts src/lib/diet/dates.ts src/lib/diet/dates.test.ts
git commit -m "feat(diet): nutrition types, start-date parser, shiftDateKey"
```

---

### Task 5: Pure nutrition calculation

**Files:**
- Create: `src/lib/diet/nutrition.ts`
- Test: `src/lib/diet/nutrition.test.ts`

**Step 1: Write the failing test**

```ts
// src/lib/diet/nutrition.test.ts
import { describe, it, expect } from "vitest";
import {
  itemNutrition, mealNutrition, dayNutrition, formatKcal, formatGrams,
  isNutritionDay, mealItemsChanged,
} from "./nutrition";
import type { DietDraft, FoodItemInfo, LoggedItem } from "./types";

const FOODS: Record<string, FoodItemInfo> = {
  "white-bread": {
    key: "white-bread", name: "White bread", emoji: null, unit: "1 slice", unitDetail: "25 g",
    nutrition: { gramsPerUnit: 25, kcalPer100g: 268, proteinPer100g: 8, carbsPer100g: 48, fatPer100g: 3.2 },
    verdict: "watch", note: "High GI Processing, Low Dietary Fiber",
  },
  dal: {
    key: "dal", name: "Dal / varan", emoji: null, unit: "1 waati", unitDetail: "150 g",
    nutrition: { gramsPerUnit: 150, kcalPer100g: 116, proteinPer100g: 7, carbsPer100g: 20, fatPer100g: 0.4 },
    verdict: "good", note: null,
  },
  paratha: { key: "paratha", name: "Paratha", emoji: null, unit: "1 piece", unitDetail: null, nutrition: null },
  samosa: { key: "samosa", name: "Samosa", emoji: null, unit: "1 piece", unitDetail: null, nutrition: null, verdict: "avoid", note: "Fried" },
};

const tap = (foodKey: string, count: number, id = foodKey): LoggedItem => ({ id, foodKey, count });
const custom: LoggedItem = { id: "c1", foodKey: null, customName: "Shake", customUnit: "glass", count: 1 };

describe("itemNutrition", () => {
  it("scales per-100 g by grams per unit and count", () => {
    expect(itemNutrition(tap("white-bread", 2), FOODS)).toEqual({ kcal: 134, protein: 4, carbs: 24, fat: 1.6 });
  });
  it("handles half portions", () => {
    expect(itemNutrition(tap("dal", 0.5), FOODS)!.kcal).toBeCloseTo(87);
  });
  it("returns null for uncounted, unknown and custom items", () => {
    expect(itemNutrition(tap("paratha", 1), FOODS)).toBeNull();
    expect(itemNutrition(tap("mystery", 1), FOODS)).toBeNull();
    expect(itemNutrition(custom, FOODS)).toBeNull();
  });
});

describe("mealNutrition", () => {
  it("sums counted items and counts the rest", () => {
    const s = mealNutrition({ skipped: false, items: [tap("white-bread", 1), tap("dal", 1), tap("paratha", 2), custom] }, FOODS);
    expect(s.totals.kcal).toBeCloseTo(67 + 174);
    expect(s.counted).toBe(2);
    expect(s.total).toBe(4);
  });
  it("flags watch/avoid foods once, counted or not, with the note", () => {
    const s = mealNutrition({ skipped: false, items: [tap("white-bread", 1, "a"), tap("white-bread", 1, "b"), tap("samosa", 1)] }, FOODS);
    expect(s.flagged).toEqual([
      { foodKey: "white-bread", name: "White bread", verdict: "watch", note: "High GI Processing, Low Dietary Fiber" },
      { foodKey: "samosa", name: "Samosa", verdict: "avoid", note: "Fried" },
    ]);
  });
  it("is empty for a skipped or missing meal", () => {
    expect(mealNutrition({ skipped: true, items: [] }, FOODS)).toMatchObject({ counted: 0, total: 0, flagged: [] });
    expect(mealNutrition(undefined, FOODS).total).toBe(0);
  });
});

describe("dayNutrition", () => {
  it("sums non-skipped meals and de-duplicates flags across the day", () => {
    const draft: DietDraft = {
      narration: "",
      meals: {
        breakfast: { skipped: false, items: [tap("white-bread", 2)] },
        lunch: { skipped: false, items: [tap("dal", 1), tap("white-bread", 1)] },
        supper: { skipped: true, items: [] },
      },
    };
    const s = dayNutrition(draft, FOODS);
    expect(s.totals.kcal).toBeCloseTo(134 + 174 + 67);
    expect(s.counted).toBe(3);
    expect(s.flagged).toHaveLength(1);
  });
});

describe("formatting", () => {
  it("shows a dash when nothing is counted", () => {
    expect(formatKcal({ totals: { kcal: 0, protein: 0, carbs: 0, fat: 0 }, counted: 0, total: 2, flagged: [] })).toBe("—");
  });
  it("rounds kcal to an integer", () => {
    expect(formatKcal({ totals: { kcal: 241.6, protein: 0, carbs: 0, fat: 0 }, counted: 1, total: 1, flagged: [] })).toBe("242 kcal");
  });
  it("shows grams to one decimal", () => {
    expect(formatGrams(12.345)).toBe("12.3 g");
    expect(formatGrams(4)).toBe("4.0 g");
  });
});

describe("isNutritionDay", () => {
  it("is on from the start date, off before it, off with no start date", () => {
    expect(isNutritionDay("2026-10-16", "2026-10-16")).toBe(true);
    expect(isNutritionDay("2026-10-15", "2026-10-16")).toBe(false);
    expect(isNutritionDay("2026-10-16", null)).toBe(false);
  });
});

describe("mealItemsChanged", () => {
  it("is false for the same items in a different order", () => {
    expect(mealItemsChanged([tap("dal", 1), tap("white-bread", 2)], [tap("white-bread", 2), tap("dal", 1)])).toBe(false);
  });
  it("is false when a change nets to zero", () => {
    expect(mealItemsChanged([tap("dal", 1)], [tap("dal", 1)])).toBe(false);
  });
  it("is true for a count change, an added item or a removed item", () => {
    expect(mealItemsChanged([tap("dal", 1)], [tap("dal", 1.5)])).toBe(true);
    expect(mealItemsChanged([], [custom])).toBe(true);
    expect(mealItemsChanged([tap("dal", 1)], [])).toBe(true);
  });
});
```

**Step 2: Run to verify it fails**

Run: `npm run test -- src/lib/diet/nutrition.test.ts`
Expected: FAIL, module not found.

**Step 3: Implement**

```ts
// src/lib/diet/nutrition.ts
import type { DietDraft, FoodItemInfo, LoggedItem, MealLog, Verdict } from "./types";

/**
 * Pure nutrition maths for Diet (spec §4). Works on the same DietDraft the
 * player form and the admin pages already use, plus a key → food lookup, so
 * there is exactly one calculation. Sums are unrounded; round only to display.
 */

export interface Macros { kcal: number; protein: number; carbs: number; fat: number }

export interface FlaggedItem {
  foodKey: string;
  name: string;
  verdict: Exclude<Verdict, "good">;
  note: string | null;
}

export interface NutritionSummary {
  totals: Macros;
  /** Logged rows that had values. */
  counted: number;
  /** All logged rows. */
  total: number;
  flagged: FlaggedItem[];
}

const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

export function itemNutrition(item: LoggedItem, foods: Record<string, FoodItemInfo>): Macros | null {
  if (item.foodKey === null) return null;
  const n = foods[item.foodKey]?.nutrition;
  if (!n) return null;
  const grams = n.gramsPerUnit * item.count;
  return {
    kcal: (n.kcalPer100g * grams) / 100,
    protein: (n.proteinPer100g * grams) / 100,
    carbs: (n.carbsPer100g * grams) / 100,
    fat: (n.fatPer100g * grams) / 100,
  };
}

function flagFor(item: LoggedItem, foods: Record<string, FoodItemInfo>): FlaggedItem | null {
  if (item.foodKey === null) return null;
  const f = foods[item.foodKey];
  if (!f || (f.verdict !== "watch" && f.verdict !== "avoid")) return null;
  return { foodKey: f.key, name: f.name, verdict: f.verdict, note: f.note ?? null };
}

function summarise(items: LoggedItem[], foods: Record<string, FoodItemInfo>): NutritionSummary {
  const totals = { ...ZERO };
  let counted = 0;
  const flagged: FlaggedItem[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const m = itemNutrition(it, foods);
    if (m) {
      totals.kcal += m.kcal;
      totals.protein += m.protein;
      totals.carbs += m.carbs;
      totals.fat += m.fat;
      counted += 1;
    }
    const flag = flagFor(it, foods);
    if (flag && !seen.has(flag.foodKey)) {
      seen.add(flag.foodKey);
      flagged.push(flag);
    }
  }
  return { totals, counted, total: items.length, flagged };
}

export function mealNutrition(meal: MealLog | undefined, foods: Record<string, FoodItemInfo>): NutritionSummary {
  return summarise(!meal || meal.skipped ? [] : meal.items, foods);
}

export function dayNutrition(draft: DietDraft, foods: Record<string, FoodItemInfo>): NutritionSummary {
  const items = Object.values(draft.meals).filter((m) => !m.skipped).flatMap((m) => m.items);
  return summarise(items, foods);
}

/** "242 kcal", or "—" when nothing in the set has values (spec §10.2). */
export function formatKcal(s: NutritionSummary): string {
  return s.counted === 0 ? "—" : `${Math.round(s.totals.kcal)} kcal`;
}

export function formatGrams(g: number): string {
  return `${(Math.round(g * 10) / 10).toFixed(1)} g`;
}

/** Nutrition shows only for days on/after the start date (D12). */
export function isNutritionDay(dateKey: string, startDate: string | null): boolean {
  return startDate !== null && dateKey >= startDate;
}

function itemIdentity(it: LoggedItem): string {
  return it.foodKey ?? `custom:${it.customName ?? ""}|${it.customUnit ?? ""}`;
}

function tally(items: LoggedItem[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) m.set(itemIdentity(it), (m.get(itemIdentity(it)) ?? 0) + it.count);
  return m;
}

/** Did the meal's contents change? Order and net-zero edits don't count (§10.3). */
export function mealItemsChanged(before: LoggedItem[], after: LoggedItem[]): boolean {
  const a = tally(before);
  const b = tally(after);
  if (a.size !== b.size) return true;
  for (const [k, v] of a) if (b.get(k) !== v) return true;
  return false;
}
```

**Step 4: Run to verify it passes**

Run: `npm run test -- src/lib/diet/nutrition.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/diet/nutrition.ts src/lib/diet/nutrition.test.ts
git commit -m "feat(diet): pure nutrition calculation (meal, day, flags, change detection)"
```

---

### Task 6: Row mappers shared by player and admin loaders

**Files:**
- Create: `src/lib/diet/rows.ts`
- Test: `src/lib/diet/rows.test.ts`
- Modify: `src/lib/diet/repository.ts:32-71` (use `mealRowsToMeals`)
- Modify: `src/lib/diet/config.ts` (select nutrition columns, keep inactive foods, add `loadNutritionStartDate`)

**Step 1: Write the failing test**

```ts
// src/lib/diet/rows.test.ts
import { describe, it, expect } from "vitest";
import { foodRowToInfo, mealRowsToMeals, type FoodCatalogRow, type MealRow } from "./rows";

const base: FoodCatalogRow = {
  key: "dal", name: "Dal / varan", emoji: "🥣", unit: "1 waati", unit_detail: "150 g",
  grams_per_unit: 150, kcal_per_100g: 116, protein_g_per_100g: 7, carbs_g_per_100g: 20, fat_g_per_100g: 0.4,
  verdict: "good", nutrition_note: "Folate",
};

describe("foodRowToInfo", () => {
  it("maps a counted row", () => {
    expect(foodRowToInfo(base)).toEqual({
      key: "dal", name: "Dal / varan", emoji: "🥣", unit: "1 waati", unitDetail: "150 g",
      nutrition: { gramsPerUnit: 150, kcalPer100g: 116, proteinPer100g: 7, carbsPer100g: 20, fatPer100g: 0.4 },
      verdict: "good", note: "Folate",
    });
  });
  it("maps a row with any missing value as not counted", () => {
    expect(foodRowToInfo({ ...base, kcal_per_100g: null }).nutrition).toBeNull();
  });
  it("drops an unknown verdict", () => {
    expect(foodRowToInfo({ ...base, verdict: "great" }).verdict).toBeNull();
  });
});

describe("mealRowsToMeals", () => {
  it("builds a sparse draft keyed by slot, items in sort order", () => {
    const rows: MealRow[] = [
      {
        skipped: false,
        meal_slots: { key: "breakfast" },
        diet_log_items: [
          { id: "2", custom_name: null, custom_unit: null, custom_notes: null, count: "1.5", sort_order: 1, food_catalog: [{ key: "dal" }] },
          { id: "1", custom_name: "Shake", custom_unit: "glass", custom_notes: null, count: 1, sort_order: 0, food_catalog: null },
        ],
      },
      { skipped: true, meal_slots: [{ key: "lunch" }], diet_log_items: [] },
      { skipped: false, meal_slots: null, diet_log_items: [] },
    ];
    expect(mealRowsToMeals(rows)).toEqual({
      breakfast: {
        skipped: false,
        items: [
          { id: "1", foodKey: null, customName: "Shake", customUnit: "glass", customNotes: undefined, count: 1 },
          { id: "2", foodKey: "dal", customName: undefined, customUnit: undefined, customNotes: undefined, count: 1.5 },
        ],
      },
      lunch: { skipped: true, items: [] },
    });
  });
});
```

**Step 2: Run to verify it fails**

Run: `npm run test -- src/lib/diet/rows.test.ts`
Expected: FAIL, module not found.

**Step 3: Implement `rows.ts`**

```ts
// src/lib/diet/rows.ts
import type { FoodItemInfo, LoggedItem, MealLog, Verdict } from "./types";

/**
 * Pure mappers from PostgREST rows to the diet domain shapes. Shared by the
 * player loader (repository.ts) and the admin pages (activity-repository.ts)
 * so both feed the same DietDraft into nutrition.ts.
 */

/** PostgREST embeds a to-one relation as an object or a one-element array. */
type One<T> = T | T[] | null;
function one<T>(v: One<T>): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const VERDICTS: readonly Verdict[] = ["good", "watch", "avoid"];
export function isVerdict(v: unknown): v is Verdict {
  return VERDICTS.includes(v as Verdict);
}

export interface FoodCatalogRow {
  key: string;
  name: string;
  emoji: string | null;
  unit: string;
  unit_detail: string | null;
  grams_per_unit: number | null;
  kcal_per_100g: number | null;
  protein_g_per_100g: number | null;
  carbs_g_per_100g: number | null;
  fat_g_per_100g: number | null;
  verdict: string | null;
  nutrition_note: string | null;
}

export const FOOD_CATALOG_COLUMNS =
  "key, name, emoji, unit, unit_detail, section_label, sort_order, is_active, grams_per_unit, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, verdict, nutrition_note";

export function foodRowToInfo(r: FoodCatalogRow): FoodItemInfo {
  const vals = [r.grams_per_unit, r.kcal_per_100g, r.protein_g_per_100g, r.carbs_g_per_100g, r.fat_g_per_100g];
  const counted = vals.every((v) => v !== null);
  return {
    key: r.key,
    name: r.name,
    emoji: r.emoji,
    unit: r.unit,
    unitDetail: r.unit_detail,
    nutrition: counted
      ? {
          gramsPerUnit: Number(r.grams_per_unit),
          kcalPer100g: Number(r.kcal_per_100g),
          proteinPer100g: Number(r.protein_g_per_100g),
          carbsPer100g: Number(r.carbs_g_per_100g),
          fatPer100g: Number(r.fat_g_per_100g),
        }
      : null,
    verdict: isVerdict(r.verdict) ? r.verdict : null,
    note: r.nutrition_note,
  };
}

export interface ItemRow {
  id: string;
  custom_name: string | null;
  custom_unit: string | null;
  custom_notes: string | null;
  count: number | string;
  sort_order: number | null;
  food_catalog: One<{ key: string }>;
}

export interface MealRow {
  skipped: boolean;
  meal_slots: One<{ key: string }>;
  diet_log_items: ItemRow[] | null;
}

/** The select fragment that yields MealRow (embed under diet_log_meals). */
export const MEAL_ROW_SELECT =
  "skipped, meal_slots(key), diet_log_items(id, custom_name, custom_unit, custom_notes, count, sort_order, food_catalog(key))";

export function mealRowsToMeals(rows: MealRow[]): Record<string, MealLog> {
  const meals: Record<string, MealLog> = {};
  for (const m of rows) {
    const slotKey = one(m.meal_slots)?.key;
    if (!slotKey) continue;
    const items: LoggedItem[] = (m.diet_log_items ?? [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((it) => ({
        id: it.id,
        foodKey: one(it.food_catalog)?.key ?? null,
        customName: it.custom_name ?? undefined,
        customUnit: it.custom_unit ?? undefined,
        customNotes: it.custom_notes ?? undefined,
        count: Number(it.count),
      }));
    meals[slotKey] = { skipped: m.skipped, items };
  }
  return meals;
}
```

**Step 4: Use it in `repository.ts`**

In `loadDietLog`, change the select to `` `id, ${MEAL_ROW_SELECT}` `` is not type-safe with supabase-js string parsing, so keep the select literal as it is and replace the loop (lines 46–68) with:

```ts
  const meals = mealRowsToMeals((mealRows ?? []) as unknown as MealRow[]);
  return { meals, narration: log.narration ?? "" };
```

Import `mealRowsToMeals, type MealRow` from `./rows` and drop the now-unused `LoggedItem`/`MealLog` imports.

**Step 5: Update `config.ts`**

Replace the foods query and grouping in `loadDietCatalog`:

```ts
    admin
      .from("food_catalog")
      .select(FOOD_CATALOG_COLUMNS)
      .order("sort_order", { ascending: true }),
```

```ts
  // Active foods become tiles, grouped by section in first-seen order. Inactive
  // foods are kept only for the lookup, so past logs still total (spec §10.1).
  const sections: FoodSection[] = [];
  const byLabel = new Map<string, FoodSection>();
  const inactive: FoodItemInfo[] = [];
  for (const r of foodsRes.data ?? []) {
    const info = foodRowToInfo(r as FoodCatalogRow);
    if (!r.is_active) {
      inactive.push(info);
      continue;
    }
    let section = byLabel.get(r.section_label);
    if (!section) {
      section = { label: r.section_label, items: [] };
      byLabel.set(r.section_label, section);
      sections.push(section);
    }
    section.items.push(info);
  }

  return { slots, sections, inactive };
```

Append the start-date loader:

```ts
/** The IST date nutrition counts from, or null when unset/invalid (D12). */
export async function loadNutritionStartDate(): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_config")
    .select("value")
    .eq("key", NUTRITION_START_KEY)
    .maybeSingle();
  return parseStartDate(data?.value ?? null);
}
```

Imports: `FoodItemInfo` from `./types`; `foodRowToInfo, FOOD_CATALOG_COLUMNS, type FoodCatalogRow` from `./rows`; `NUTRITION_START_KEY, parseStartDate` from `./nutrition-start`.

**Step 6: Verify**

Run: `npm run test -- src/lib/diet && npx tsc --noEmit && npm run lint`
Expected: all PASS, no type errors.

**Step 7: Commit**

```bash
git add src/lib/diet/rows.ts src/lib/diet/rows.test.ts src/lib/diet/repository.ts src/lib/diet/config.ts
git commit -m "refactor(diet): shared row mappers; catalogue loads nutrition and inactive foods"
```

---

### Task 7: Strings and shared nutrition UI pieces

**Files:**
- Modify: `src/content/strings.ts` (add a `dietNutrition` block just above the `/** Admin section chrome` comment)
- Create: `src/app/diet/nutrition-ui.tsx`
- Test: `src/app/diet/nutrition-ui.test.tsx`

**Step 1: Add the strings**

```ts
  /** Diet nutrition (calories & macros), shown after logging food. */
  dietNutrition: {
    dayCardTitle: "Nutrition",
    of: "of",
    itemsCounted: "items counted",
    protein: "P",
    carbs: "C",
    fat: "F",
    flaggedHeading: "KFANDRA says",
    disclaimer: "Guidance only. Values are approximate, from KFANDRA’s food charts.",
    done: "Done",
    recapTitle: "Your day",
    recapMealsHeading: "By meal",
    verdictGood: "Good choice",
    verdictWatch: "Watch",
    verdictAvoid: "Avoid",
  },
```

**Step 2: Write the failing component test**

```tsx
// src/app/diet/nutrition-ui.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DayNutritionCard, MealSummarySheet } from "./nutrition-ui";
import type { NutritionSummary } from "@/lib/diet/nutrition";

const summary: NutritionSummary = {
  totals: { kcal: 241.6, protein: 11.04, carbs: 54, fat: 2.2 },
  counted: 2,
  total: 3,
  flagged: [{ foodKey: "white-bread", name: "White bread", verdict: "watch", note: "High GI" }],
};

describe("DayNutritionCard", () => {
  it("shows kcal, macros and the counted ratio", () => {
    render(<DayNutritionCard summary={summary} />);
    expect(screen.getByText("242 kcal")).toBeInTheDocument();
    expect(screen.getByText("P 11.0 g")).toBeInTheDocument();
    expect(screen.getByText("2 of 3 items counted")).toBeInTheDocument();
  });
  it("renders nothing when nothing is logged", () => {
    const { container } = render(<DayNutritionCard summary={{ ...summary, counted: 0, total: 0, flagged: [] }} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("MealSummarySheet", () => {
  it("shows the meal title, flags and calls onDone", () => {
    const onDone = vi.fn();
    render(<MealSummarySheet slotName="Breakfast" summary={summary} onDone={onDone} />);
    expect(screen.getByText("Breakfast · 242 kcal")).toBeInTheDocument();
    expect(screen.getByText("High GI")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onDone).toHaveBeenCalled();
  });
});
```

**Step 3: Run to verify it fails**

Run: `npm run test -- src/app/diet/nutrition-ui.test.tsx`
Expected: FAIL, module not found.

**Step 4: Implement**

```tsx
// src/app/diet/nutrition-ui.tsx
"use client";

import { motion } from "framer-motion";
import { strings } from "@/content/strings";
import { formatGrams, formatKcal, type FlaggedItem, type NutritionSummary } from "@/lib/diet/nutrition";
import type { Verdict } from "@/lib/diet/types";

/**
 * Presentational pieces for Diet nutrition (spec §5). No data loading here:
 * callers pass NutritionSummary values computed by src/lib/diet/nutrition.ts.
 */

const t = strings.dietNutrition;

const DOT: Record<Verdict, string> = {
  good: "bg-emerald-500",
  watch: "bg-amber-500",
  avoid: "bg-red-500",
};
const VERDICT_LABEL: Record<Verdict, string> = {
  good: t.verdictGood,
  watch: t.verdictWatch,
  avoid: t.verdictAvoid,
};

export function VerdictDot({ verdict }: { verdict: Verdict | null | undefined }) {
  if (!verdict) return null;
  return (
    <span
      role="img"
      aria-label={VERDICT_LABEL[verdict]}
      title={VERDICT_LABEL[verdict]}
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT[verdict]}`}
    />
  );
}

export function countedLine(s: NutritionSummary): string {
  return `${s.counted} ${t.of} ${s.total} ${t.itemsCounted}`;
}

export function MacroChips({ summary }: { summary: NutritionSummary }) {
  if (summary.counted === 0) return null;
  const chips: Array<[string, number]> = [
    [t.protein, summary.totals.protein],
    [t.carbs, summary.totals.carbs],
    [t.fat, summary.totals.fat],
  ];
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {chips.map(([label, grams]) => (
        <span key={label} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-gray-700">
          {label} {formatGrams(grams)}
        </span>
      ))}
    </div>
  );
}

export function FlaggedList({ flagged }: { flagged: FlaggedItem[] }) {
  if (flagged.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-600">{t.flaggedHeading}</p>
      <ul className="space-y-1.5">
        {flagged.map((f) => (
          <li key={f.foodKey} className="flex items-start gap-2 text-[13px] text-gray-800">
            <span className="mt-1.5"><VerdictDot verdict={f.verdict} /></span>
            <span>
              <span className="font-semibold">{f.name}</span>
              {f.note ? <span className="block text-[12px] text-gray-600">{f.note}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DayNutritionCard({ summary }: { summary: NutritionSummary }) {
  if (summary.total === 0) return null;
  return (
    <section data-testid="day-nutrition-card" className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">{t.dayCardTitle}</p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-black tabular-nums tracking-tight text-gray-900">
        {formatKcal(summary)}
      </p>
      <MacroChips summary={summary} />
      <p className="mt-1.5 text-[11px] text-gray-600">{countedLine(summary)}</p>
    </section>
  );
}

/**
 * Bottom sheet shell. Same pattern as CustomItemSheet in diet-entry.tsx:
 * rendered conditionally with no AnimatePresence (an exit-animated overlay
 * lingers and intercepts clicks in this React 19 / framer-motion stack).
 */
function Sheet({ testId, onClose, children }: { testId: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] flex items-end bg-black/40"
      onClick={onClose}
    >
      <motion.div
        data-testid={testId}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
        {children}
        <p className="mt-4 text-[10px] italic text-gray-600">{t.disclaimer}</p>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-3 text-sm font-bold text-white"
        >
          {t.done}
        </button>
      </motion.div>
    </motion.div>
  );
}

export function MealSummarySheet({ slotName, summary, onDone }: { slotName: string; summary: NutritionSummary; onDone: () => void }) {
  return (
    <Sheet testId="meal-summary-sheet" onClose={onDone}>
      <h3 className="text-base font-bold text-gray-900">{`${slotName} · ${formatKcal(summary)}`}</h3>
      <MacroChips summary={summary} />
      <p className="mt-1.5 text-[11px] text-gray-600">{countedLine(summary)}</p>
      <FlaggedList flagged={summary.flagged} />
    </Sheet>
  );
}

export function RecapSheet({
  dateLabel, day, meals, onClose,
}: {
  dateLabel: string;
  day: NutritionSummary;
  meals: Array<{ key: string; name: string; summary: NutritionSummary }>;
  onClose: () => void;
}) {
  return (
    <Sheet testId="recap-sheet" onClose={onClose}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600">{t.recapTitle}</p>
      <h3 className="text-base font-bold text-gray-900">{dateLabel}</h3>
      <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-black tabular-nums text-gray-900">
        {formatKcal(day)}
      </p>
      <MacroChips summary={day} />
      <p className="mt-1.5 text-[11px] text-gray-600">{countedLine(day)}</p>
      <p className="mb-1.5 mt-4 text-[10px] font-bold uppercase tracking-widest text-gray-600">{t.recapMealsHeading}</p>
      <ul className="divide-y divide-gray-100 text-[13px]">
        {meals.map((m) => (
          <li key={m.key} className="flex justify-between py-1.5">
            <span className="text-gray-800">{m.name}</span>
            <span className="tabular-nums text-gray-700">{formatKcal(m.summary)}</span>
          </li>
        ))}
      </ul>
      <FlaggedList flagged={day.flagged} />
    </Sheet>
  );
}
```

**Step 5: Run to verify it passes**

Run: `npm run test -- src/app/diet/nutrition-ui.test.tsx`
Expected: PASS. (If the motion import misbehaves under jsdom, check `src/test/setup.ts`; other diet sheets already render under jsdom.)

**Step 6: Commit**

```bash
git add src/content/strings.ts src/app/diet/nutrition-ui.tsx src/app/diet/nutrition-ui.test.tsx
git commit -m "feat(diet): nutrition strings and UI pieces (dot, chips, day card, sheets)"
```

---

### Task 8: Player page: verdict dots, day card, meal summary sheet

**Files:**
- Modify: `src/app/diet/page.tsx`
- Modify: `src/app/diet/diet-entry.tsx`

**Step 1: Load the start date in `page.tsx`**

```ts
import { loadDietCatalog, loadNutritionStartDate } from "@/lib/diet/config";
// ...
  const [catalog, draft, personalFoods, nutritionStart] = await Promise.all([
    loadDietCatalog(),
    loadDietLog(player.id, dateKey),
    loadPlayerFoods(player.id),
    loadNutritionStartDate(),
  ]);
// pass to <DietEntry ... nutritionStart={nutritionStart} recap={null} />
```

(`recap` is wired in Task 9; pass `null` for now.)

**Step 2: Wire `diet-entry.tsx`**

1. Props: add `nutritionStart: string | null;` and `recap: { dateKey: string; draft: DietDraft } | null;` to the component's props type and destructuring.
2. Imports: `import { dayNutrition, isNutritionDay, mealItemsChanged, mealNutrition } from "@/lib/diet/nutrition";` and `import { DayNutritionCard, MealSummarySheet, VerdictDot } from "./nutrition-ui";`. Add `LoggedItem` to the types import.
3. State in `DietEntry`, after `openSlot`:

```ts
  const nutritionOn = isNutritionDay(dateKey, nutritionStart);
  // Items in the open meal when it was opened, to decide whether closing it
  // should show the summary sheet (spec §10.3).
  const openedItems = useRef<LoggedItem[]>([]);
  const [summarySlot, setSummarySlot] = useState<string | null>(null);

  const openMealSlot = useCallback(
    (slotKey: string) => {
      openedItems.current = getMeal(draft, slotKey).items;
      setOpenSlot(slotKey);
    },
    [draft],
  );

  const closeMeal = useCallback(() => {
    if (openSlot) {
      const meal = getMeal(draft, openSlot);
      if (nutritionOn && !meal.skipped && meal.items.length > 0 && mealItemsChanged(openedItems.current, meal.items)) {
        setSummarySlot(openSlot);
      }
    }
    setOpenSlot(null);
  }, [draft, openSlot, nutritionOn]);
```

4. `MealDetail onBack={closeMeal}` (replaces `() => setOpenSlot(null)`). `DietHub onOpen={openMealSlot}`.
5. Pass `nutrition={nutritionOn ? dayNutrition(draft, foodById) : null}` to `DietHub`; add `nutrition: NutritionSummary | null` to its props (import the type from `@/lib/diet/nutrition`). Inside `DietHub`, render right after the header `<div>` and before `<Breadcrumb label="Diet" />`:

```tsx
      {nutrition && <DayNutritionCard summary={nutrition} />}
```

6. In the catalogue tile (inside `MealDetail`, the `section.items.map` button), put the dot next to the name:

```tsx
                        <p className="flex items-center gap-1.5 text-[12px] font-semibold leading-tight text-gray-900">
                          {item.name}
                          <VerdictDot verdict={item.verdict} />
                        </p>
```

7. At the end of the root `<div className="mx-auto max-w-md">`, after the view ternary:

```tsx
      {summarySlot && (
        <MealSummarySheet
          slotName={catalog.slots.find((s) => s.key === summarySlot)?.name ?? ""}
          summary={mealNutrition(getMeal(draft, summarySlot), foodById)}
          onDone={() => setSummarySlot(null)}
        />
      )}
```

8. In `switchDate`, also `setSummarySlot(null)`.

**Step 3: Verify manually**

Run: `npm run dev`, sign in as a player, open Diet:
- Tap Breakfast, add White bread ×2, press Done → the sheet reads "Breakfast · 134 kcal", "1 of 1 items counted", and shows White bread's note.
- Open Breakfast again and press Back without changes → no sheet.
- The day card shows 134 kcal. Pick yesterday's date (before the start date) → no day card.
- Tiles show green/amber/red dots.

**Step 4: Lint, types, tests**

Run: `npm run lint && npx tsc --noEmit && npm run test`
Expected: all pass.

**Step 5: Commit**

```bash
git add src/app/diet/page.tsx src/app/diet/diet-entry.tsx
git commit -m "feat(diet): verdict dots, day nutrition card and meal summary sheet"
```

---

### Task 9: Recap (latest unseen day, once)

**Files:**
- Modify: `src/lib/diet/repository.ts` (add `findDueRecap`, `markRecapSeen`)
- Modify: `src/lib/diet/actions.ts` (add `markRecapSeenAction`)
- Modify: `src/app/diet/page.tsx`, `src/app/diet/diet-entry.tsx`

**Step 1: Repository functions**

```ts
/**
 * The recap due for a player (spec D11, §3.3): their LATEST diet day before
 * today, on/after the nutrition start date, with at least one item. Due only
 * if not yet seen; older unseen days are deliberately ignored.
 */
export async function findDueRecap(
  playerId: string,
  todayKey: string,
  startDate: string | null,
): Promise<{ dateKey: string; draft: DietDraft } | null> {
  if (!startDate) return null;
  const admin = createAdminClient();
  // !inner joins drop days with no items (a skipped-only day has no recap).
  const { data } = await admin
    .from("diet_logs")
    .select("log_date, recap_seen_at, diet_log_meals!inner(diet_log_items!inner(id))")
    .eq("player_id", playerId)
    .lt("log_date", todayKey)
    .gte("log_date", startDate)
    .order("log_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data || data.recap_seen_at) return null;
  return { dateKey: data.log_date, draft: await loadDietLog(playerId, data.log_date) };
}

/** Stamp the recap for (player, day) as seen. Idempotent. */
export async function markRecapSeen(playerId: string, dateKey: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("diet_logs")
    .update({ recap_seen_at: new Date().toISOString() })
    .eq("player_id", playerId)
    .eq("log_date", dateKey)
    .is("recap_seen_at", null);
  if (error) throw new Error(`Failed to mark recap seen: ${error.message}`);
}
```

**Step 2: Server action**

```ts
/** Dismiss the recap for a day (spec §5.4). */
export async function markRecapSeenAction(dateKey: string): Promise<ActionResult> {
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };
  if (!isValidDateKey(dateKey)) return { ok: false, error: BAD_DATE };
  try {
    await markRecapSeen(player.id, dateKey);
    return { ok: true, data: undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Save failed." };
  }
}
```

**Step 3: Page**

```ts
  const recap = await findDueRecap(player.id, dateKey, nutritionStart);
  // ...
  <DietEntry ... recap={recap} />
```

**Step 4: Client**

In `DietEntry`:

```ts
  const [recapOpen, setRecapOpen] = useState(recap !== null);
  const closeRecap = useCallback(() => {
    setRecapOpen(false);
    if (recap) void markRecapSeenAction(recap.dateKey);
  }, [recap]);
```

Render after the summary sheet:

```tsx
      {recap && recapOpen && (
        <RecapSheet
          dateLabel={dateLabel(recap.dateKey)}
          day={dayNutrition(recap.draft, foodById)}
          meals={catalog.slots
            .filter((s) => {
              const m = recap.draft.meals[s.key];
              return m && !m.skipped && m.items.length > 0;
            })
            .map((s) => ({ key: s.key, name: s.name, summary: mealNutrition(recap.draft.meals[s.key], foodById) }))}
          onClose={closeRecap}
        />
      )}
```

Import `RecapSheet` and `markRecapSeenAction`. `dateLabel` is already imported.

**Step 5: Verify manually**

With the dev server: in psql, set `diet_nutrition_start_date` to a week ago and insert a log for yesterday for your player (or log one via the date picker). Reload `/diet` → the recap appears; press Done → `select recap_seen_at from diet_logs ...` is set; reload → no recap.

**Step 6: Lint, types, tests, commit**

```bash
npm run lint && npx tsc --noEmit && npm run test
git add src/lib/diet/repository.ts src/lib/diet/actions.ts src/app/diet/page.tsx src/app/diet/diet-entry.tsx
git commit -m "feat(diet): once-only recap of the latest logged day"
```

---

### Task 10: Admin by-date and by-player totals

**Files:**
- Modify: `src/lib/admin/activity-repository.ts:52-94,138-160`
- Modify: `src/app/admin/diet/page.tsx`

**Step 1: Repository**

Add imports:

```ts
import { loadDietCatalog, loadNutritionStartDate } from "@/lib/diet/config";
import { indexFoods, type DietDraft, type FoodItemInfo } from "@/lib/diet/types";
import { mealRowsToMeals, type MealRow } from "@/lib/diet/rows";
import { dayNutrition, isNutritionDay, mealNutrition, type NutritionSummary } from "@/lib/diet/nutrition";
```

Add helpers:

```ts
/** Foods lookup + start date, loaded once per admin page. */
export async function loadNutritionContext(): Promise<{ foods: Record<string, FoodItemInfo>; startDate: string | null }> {
  const [catalog, startDate] = await Promise.all([loadDietCatalog(), loadNutritionStartDate()]);
  return { foods: indexFoods(catalog), startDate };
}

function toDraft(mealRows: unknown): DietDraft {
  return { meals: mealRowsToMeals((mealRows ?? []) as MealRow[]), narration: "" };
}
```

Rewrite `getPlayerDiet`. The select gains `meal_slots(key, …)` and the item fields `mealRowsToMeals` needs:

```ts
export type DietItem = { name: string; count: number };
export type DietMeal = { slot: string; skipped: boolean; items: DietItem[]; nutrition: NutritionSummary | null };
export type DietDay = { date: string; narration: string | null; meals: DietMeal[]; nutrition: NutritionSummary | null };

export async function getPlayerDiet(playerId: string): Promise<DietDay[]> {
  const admin = createAdminClient();
  const [{ data }, ctx] = await Promise.all([
    admin
      .from("diet_logs")
      .select(
        "log_date, narration, diet_log_meals(skipped, meal_slots(key, name, sort_order), diet_log_items(id, count, custom_name, custom_unit, custom_notes, sort_order, food_catalog(key, name)))",
      )
      .eq("player_id", playerId)
      .order("log_date", { ascending: false }),
    loadNutritionContext(),
  ]);

  return (data ?? []).map((d) => {
    const on = isNutritionDay(d.log_date, ctx.startDate);
    const draft = toDraft(d.diet_log_meals);
    return {
      date: d.log_date,
      narration: d.narration,
      nutrition: on ? dayNutrition(draft, ctx.foods) : null,
      meals: ((d.diet_log_meals as Array<Record<string, unknown>>) ?? [])
        .map((m) => {
          const slot = m.meal_slots as { key: string; name: string; sort_order: number } | null;
          return {
            slot: slot?.name ?? "Meal",
            slotOrder: slot?.sort_order ?? 0,
            skipped: Boolean(m.skipped),
            nutrition: on && slot ? mealNutrition(draft.meals[slot.key], ctx.foods) : null,
            items: ((m.diet_log_items as Array<Record<string, unknown>>) ?? []).map((it) => {
              const food = it.food_catalog as { name: string } | null;
              return { name: (it.custom_name as string) ?? food?.name ?? "Item", count: Number(it.count) };
            }),
          };
        })
        .sort((a, b) => a.slotOrder - b.slotOrder)
        .map(({ slotOrder: _o, ...m }) => m),
    };
  });
}
```

(If lint flags `_o` as unused, map explicitly to `{ slot, skipped, items, nutrition }` as the old code did.)

Rewrite `getDietDay`:

```ts
export type DietDayRow = { playerId: string; displayName: string; meals: number; nutrition: NutritionSummary | null };

export async function getDietDay(date: string): Promise<DietDayRow[]> {
  const admin = createAdminClient();
  const [res, names, ctx] = await Promise.all([
    admin
      .from("diet_logs")
      .select(
        "player_id, diet_log_meals(skipped, meal_slots(key), diet_log_items(id, custom_name, custom_unit, custom_notes, count, sort_order, food_catalog(key)))",
      )
      .eq("log_date", date),
    activePlayerNames(),
    loadNutritionContext(),
  ]);
  const on = isNutritionDay(date, ctx.startDate);
  return (res.data ?? [])
    .map((r) => ({
      playerId: r.player_id,
      displayName: names.get(r.player_id) ?? "Unknown",
      meals: ((r.diet_log_meals as unknown[]) ?? []).length,
      nutrition: on ? dayNutrition(toDraft(r.diet_log_meals), ctx.foods) : null,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}
```

**Step 2: Pages**

In `src/app/admin/diet/page.tsx`, import `formatKcal` from `@/lib/diet/nutrition`.

By date: add headers `kcal`, `P / C / F`, `Counted`, `⚑`, and cells:

```tsx
<td className="px-3 py-2 text-right tabular-nums">{r.nutrition ? formatKcal(r.nutrition) : "—"}</td>
<td className="px-3 py-2 text-right tabular-nums">
  {r.nutrition && r.nutrition.counted > 0
    ? `${Math.round(r.nutrition.totals.protein)} / ${Math.round(r.nutrition.totals.carbs)} / ${Math.round(r.nutrition.totals.fat)}`
    : "—"}
</td>
<td className="px-3 py-2 text-right tabular-nums">{r.nutrition ? `${r.nutrition.counted}/${r.nutrition.total}` : "—"}</td>
<td className="px-3 py-2 text-right tabular-nums">
  {r.nutrition && r.nutrition.flagged.length > 0 ? (
    <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[11px] font-bold text-red-700">{r.nutrition.flagged.length}</span>
  ) : null}
</td>
```

Wrap the table in `<div className="overflow-x-auto">` so it scrolls at phone width.

By player: give each day card `id={d.date}` (the team grid links to it). Under the date line, when `d.nutrition`:

```tsx
{d.nutrition && (
  <p className="text-[12px] text-gray-700">
    {formatKcal(d.nutrition)}
    {d.nutrition.counted > 0 &&
      ` · P ${Math.round(d.nutrition.totals.protein)} g · C ${Math.round(d.nutrition.totals.carbs)} g · F ${Math.round(d.nutrition.totals.fat)} g`}
    {` · ${d.nutrition.counted}/${d.nutrition.total} counted`}
  </p>
)}
```

After each meal's item list, append `{m.nutrition && m.nutrition.counted > 0 ? <span className="text-gray-600"> · {formatKcal(m.nutrition)}</span> : null}`. After the meals list:

```tsx
{d.nutrition && d.nutrition.flagged.length > 0 && (
  <details className="mt-1.5 text-[12px]">
    <summary className="cursor-pointer font-semibold text-red-700">{d.nutrition.flagged.length} flagged</summary>
    <ul className="mt-1 space-y-0.5">
      {d.nutrition.flagged.map((f) => (
        <li key={f.foodKey}><span className="font-medium">{f.name}</span> ({f.verdict}){f.note ? ` — ${f.note}` : ""}</li>
      ))}
    </ul>
  </details>
)}
```

On the index, add two links above "By date":

```tsx
<div className="flex gap-2">
  <Link href="/admin/diet/nutrition" className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50">Team nutrition grid</Link>
  <Link href="/admin/diet/foods" className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50">Food values</Link>
</div>
```

**Step 3: Verify**

Run: `npm run lint && npx tsc --noEmit && npm run test`, then open `/admin/diet?date=<today>` and `/admin/diet?player=<id>` as a kfandra user.

**Step 4: Commit**

```bash
git add src/lib/admin/activity-repository.ts src/app/admin/diet/page.tsx
git commit -m "feat(admin): nutrition totals and flags on diet by-date and by-player"
```

---

### Task 11: Admin team grid

**Files:**
- Modify: `src/lib/admin/activity-repository.ts` (add `getTeamNutritionGrid`)
- Create: `src/app/admin/diet/nutrition/page.tsx`

**Step 1: Repository**

```ts
import { listPlayers } from "./submissions-repository";
import { shiftDateKey } from "@/lib/diet/dates";

export type TeamGridCell = { nutrition: NutritionSummary | null } | null; // null = nothing logged
export type TeamGrid = {
  days: string[];
  rows: Array<{ playerId: string; displayName: string; cells: TeamGridCell[] }>;
  silentPlayers: number;
};

/** Players × the 7 IST days ending on `endDate` (spec §6.3). */
export async function getTeamNutritionGrid(endDate: string): Promise<TeamGrid> {
  const days = Array.from({ length: 7 }, (_, i) => shiftDateKey(endDate, i - 6));
  const admin = createAdminClient();
  const [res, players, ctx] = await Promise.all([
    admin
      .from("diet_logs")
      .select(
        "player_id, log_date, diet_log_meals(skipped, meal_slots(key), diet_log_items(id, custom_name, custom_unit, custom_notes, count, sort_order, food_catalog(key)))",
      )
      .gte("log_date", days[0])
      .lte("log_date", endDate),
    listPlayers(),
    loadNutritionContext(),
  ]);

  const byPlayer = new Map<string, Map<string, TeamGridCell>>();
  for (const r of res.data ?? []) {
    const cells = byPlayer.get(r.player_id) ?? new Map<string, TeamGridCell>();
    cells.set(r.log_date, {
      nutrition: isNutritionDay(r.log_date, ctx.startDate) ? dayNutrition(toDraft(r.diet_log_meals), ctx.foods) : null,
    });
    byPlayer.set(r.player_id, cells);
  }

  const rows = players
    .filter((p) => byPlayer.has(p.id))
    .map((p) => ({ playerId: p.id, displayName: p.displayName, cells: days.map((d) => byPlayer.get(p.id)!.get(d) ?? null) }));
  return { days, rows, silentPlayers: players.length - rows.length };
}
```

(`listPlayers` already returns active non-KFANDRA players sorted by name.)

**Step 2: Page**

```tsx
// src/app/admin/diet/nutrition/page.tsx
import Link from "next/link";
import { getTeamNutritionGrid } from "@/lib/admin/activity-repository";
import { isValidDateKey, shiftDateKey, todayKey } from "@/lib/diet/dates";
import { formatKcal } from "@/lib/diet/nutrition";

export const dynamic = "force-dynamic";

function dayHead(key: string): string {
  return new Date(`${key}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
}

export default async function TeamNutritionPage({ searchParams }: { searchParams: Promise<{ end?: string }> }) {
  const { end } = await searchParams;
  const today = todayKey();
  const endDate = end && isValidDateKey(end) && end <= today ? end : today;
  const grid = await getTeamNutritionGrid(endDate);
  const next = shiftDateKey(endDate, 7);

  return (
    <div className="space-y-4">
      <Link href="/admin/diet" className="text-[12px] text-gray-600 hover:underline">← All diet logs</Link>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Team nutrition</h2>
        <div className="flex gap-2 text-sm">
          <Link href={`/admin/diet/nutrition?end=${shiftDateKey(endDate, -7)}`} className="rounded-full border border-gray-200 bg-white px-3 py-1 hover:bg-gray-50">← Week</Link>
          {next <= today && (
            <Link href={`/admin/diet/nutrition?end=${next}`} className="rounded-full border border-gray-200 bg-white px-3 py-1 hover:bg-gray-50">Week →</Link>
          )}
        </div>
      </div>
      {grid.rows.length === 0 ? (
        <p className="text-sm text-gray-600">No diet logs this week.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-300 bg-white">
          <table className="w-full text-[12px]">
            <thead className="bg-amber-100 text-[11px] uppercase tracking-wide text-amber-900">
              <tr>
                <th className="sticky left-0 bg-amber-100 px-2 py-2 text-left font-semibold">Player</th>
                {grid.days.map((d) => <th key={d} className="px-2 py-2 text-center font-semibold">{dayHead(d)}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {grid.rows.map((row) => (
                <tr key={row.playerId}>
                  <td className="sticky left-0 bg-white px-2 py-2 font-semibold text-gray-900">{row.displayName}</td>
                  {row.cells.map((cell, i) => (
                    <td key={grid.days[i]} className="px-1 py-1 text-center">
                      {cell && (
                        <Link href={`/admin/diet?player=${row.playerId}#${grid.days[i]}`} className="block rounded-lg px-1 py-1 hover:bg-amber-50">
                          <span className="block font-semibold tabular-nums text-gray-900">{cell.nutrition ? formatKcal(cell.nutrition) : "logged"}</span>
                          {cell.nutrition && cell.nutrition.counted > 0 && (
                            <span className="block tabular-nums text-gray-600">P {Math.round(cell.nutrition.totals.protein)} g</span>
                          )}
                          {cell.nutrition && cell.nutrition.flagged.length > 0 && (
                            <span className="mt-0.5 inline-block rounded-full bg-red-100 px-1.5 text-[10px] font-bold text-red-700">{cell.nutrition.flagged.length}</span>
                          )}
                        </Link>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {grid.silentPlayers > 0 && (
        <p className="text-[11px] text-gray-600">{grid.silentPlayers} players logged nothing this week.</p>
      )}
    </div>
  );
}
```

**Step 3: Verify**

Run: `npm run lint && npx tsc --noEmit`, then open `/admin/diet/nutrition`, step back a week and forward again, and tap a cell; it should land on that player's day.

**Step 4: Commit**

```bash
git add src/lib/admin/activity-repository.ts src/app/admin/diet/nutrition/page.tsx
git commit -m "feat(admin): team nutrition grid (players x 7 days)"
```

---

### Task 12: Food editor: pure validation and conversion

**Files:**
- Create: `src/lib/diet/nutrition-edit.ts`
- Test: `src/lib/diet/nutrition-edit.test.ts`

**Step 1: Write the failing test**

```ts
// src/lib/diet/nutrition-edit.test.ts
import { describe, it, expect } from "vitest";
import { perUnitView, toFoodPatch, validateFoodEdit, type FoodEditInput } from "./nutrition-edit";

const milk: FoodEditInput = {
  gramsPerUnit: 200, kcal: 124, protein: 6.4, carbs: 9.6, fat: 6.6, sodiumMg: null,
  verdict: "good", note: "Vit D", isActive: true,
};

describe("validateFoodEdit", () => {
  it("accepts a full row", () => expect(validateFoodEdit(milk)).toBeNull());
  it("accepts an all-empty row (not counted)", () => {
    expect(validateFoodEdit({ ...milk, gramsPerUnit: null, kcal: null, protein: null, carbs: null, fat: null })).toBeNull();
  });
  it("rejects a half-filled row", () => {
    expect(validateFoodEdit({ ...milk, fat: null })).toMatch(/all of/i);
  });
  it("rejects zero grams and negative values", () => {
    expect(validateFoodEdit({ ...milk, gramsPerUnit: 0 })).toMatch(/grams/i);
    expect(validateFoodEdit({ ...milk, protein: -1 })).toMatch(/negative/i);
  });
  it("rejects a long note", () => {
    expect(validateFoodEdit({ ...milk, note: "x".repeat(301) })).toMatch(/note/i);
  });
});

describe("toFoodPatch", () => {
  it("converts per-unit values to per 100 g", () => {
    expect(toFoodPatch(milk)).toMatchObject({
      grams_per_unit: 200, kcal_per_100g: 62, protein_g_per_100g: 3.2, carbs_g_per_100g: 4.8, fat_g_per_100g: 3.3,
      sodium_mg_per_100g: null, verdict: "good", nutrition_note: "Vit D", is_active: true,
    });
  });
  it("writes all-null for a cleared row and trims an empty note to null", () => {
    expect(toFoodPatch({ ...milk, gramsPerUnit: null, kcal: null, protein: null, carbs: null, fat: null, note: "  " }))
      .toMatchObject({ grams_per_unit: null, kcal_per_100g: null, nutrition_note: null });
  });
});

describe("perUnitView", () => {
  it("is the inverse of toFoodPatch for display", () => {
    expect(perUnitView({ grams_per_unit: 200, kcal_per_100g: 62, protein_g_per_100g: 3.2, carbs_g_per_100g: 4.8, fat_g_per_100g: 3.3, sodium_mg_per_100g: null }))
      .toEqual({ gramsPerUnit: 200, kcal: 124, protein: 6.4, carbs: 9.6, fat: 6.6, sodiumMg: null });
  });
});
```

**Step 2: Run to verify it fails**

Run: `npm run test -- src/lib/diet/nutrition-edit.test.ts`
Expected: FAIL, module not found.

**Step 3: Implement**

```ts
// src/lib/diet/nutrition-edit.ts
import type { Verdict } from "./types";

/**
 * The food editor works PER UNIT (what KFANDRA thinks in: "one glass of milk
 * is 124 kcal") and stores PER 100 G (spec D1). Pure; unit-tested.
 */

export interface FoodEditInput {
  gramsPerUnit: number | null;
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  sodiumMg: number | null;
  verdict: Verdict | null;
  note: string;
  isActive: boolean;
}

export interface Per100Row {
  grams_per_unit: number | null;
  kcal_per_100g: number | null;
  protein_g_per_100g: number | null;
  carbs_g_per_100g: number | null;
  fat_g_per_100g: number | null;
  sodium_mg_per_100g: number | null;
}

export interface FoodPatch extends Per100Row {
  verdict: Verdict | null;
  nutrition_note: string | null;
  is_active: boolean;
}

const round2 = (x: number) => Math.round(x * 100) / 100;
const round1 = (x: number) => Math.round(x * 10) / 10;

export function validateFoodEdit(i: FoodEditInput): string | null {
  const core = [i.gramsPerUnit, i.kcal, i.protein, i.carbs, i.fat];
  const filled = core.filter((v) => v !== null).length;
  if (filled !== 0 && filled !== core.length) return "Fill in all of grams, kcal, protein, carbs and fat, or clear them all.";
  if (i.gramsPerUnit !== null && (i.gramsPerUnit <= 0 || i.gramsPerUnit > 2000)) return "Grams per unit must be between 0 and 2000.";
  for (const v of [i.kcal, i.protein, i.carbs, i.fat, i.sodiumMg]) {
    if (v !== null && (!Number.isFinite(v) || v < 0)) return "Values cannot be negative.";
  }
  if (i.kcal !== null && i.kcal > 5000) return "kcal per unit looks too high (max 5000).";
  if (i.note.trim().length > 300) return "Note too long (max 300 characters).";
  return null;
}

export function toFoodPatch(i: FoodEditInput): FoodPatch {
  const g = i.gramsPerUnit;
  const per100 = (v: number | null, r: (x: number) => number) => (v === null || g === null ? null : r((v * 100) / g));
  return {
    grams_per_unit: g,
    kcal_per_100g: per100(i.kcal, round2),
    protein_g_per_100g: per100(i.protein, round2),
    carbs_g_per_100g: per100(i.carbs, round2),
    fat_g_per_100g: per100(i.fat, round2),
    sodium_mg_per_100g: per100(i.sodiumMg, round1),
    verdict: i.verdict,
    nutrition_note: i.note.trim() || null,
    is_active: i.isActive,
  };
}

/** Per-100 g row → per-unit numbers for the form (rounded for display). */
export function perUnitView(r: Per100Row) {
  const g = r.grams_per_unit === null ? null : Number(r.grams_per_unit);
  const unit = (v: number | null) => (v === null || g === null ? null : round1((Number(v) * g) / 100));
  return {
    gramsPerUnit: g,
    kcal: unit(r.kcal_per_100g),
    protein: unit(r.protein_g_per_100g),
    carbs: unit(r.carbs_g_per_100g),
    fat: unit(r.fat_g_per_100g),
    sodiumMg: unit(r.sodium_mg_per_100g),
  };
}
```

**Step 4: Run to verify it passes**

Run: `npm run test -- src/lib/diet/nutrition-edit.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/diet/nutrition-edit.ts src/lib/diet/nutrition-edit.test.ts
git commit -m "feat(diet): per-unit food edit validation and conversion"
```

---

### Task 13: Food editor: repository, action, page

**Files:**
- Create: `src/lib/admin/food-repository.ts`
- Create: `src/lib/admin/food-actions.ts`
- Create: `src/app/admin/diet/foods/page.tsx`
- Create: `src/app/admin/diet/foods/food-editor.tsx`

**Step 1: Repository**

```ts
// src/lib/admin/food-repository.ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isVerdict } from "@/lib/diet/rows";
import type { Per100Row } from "@/lib/diet/nutrition-edit";
import type { Verdict } from "@/lib/diet/types";

export type FoodEditRow = Per100Row & {
  id: string;
  key: string;
  name: string;
  emoji: string | null;
  unit: string;
  unitDetail: string | null;
  section: string;
  isActive: boolean;
  verdict: Verdict | null;
  note: string | null;
  source: string | null;
  updatedAt: string | null;
};

export async function listFoodsForEdit(): Promise<FoodEditRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("food_catalog")
    .select(
      "id, key, name, emoji, unit, unit_detail, section_label, is_active, grams_per_unit, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, sodium_mg_per_100g, verdict, nutrition_note, nutrition_source, nutrition_updated_at",
    )
    .order("sort_order");
  return (data ?? []).map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    emoji: r.emoji,
    unit: r.unit,
    unitDetail: r.unit_detail,
    section: r.section_label,
    isActive: r.is_active,
    grams_per_unit: r.grams_per_unit,
    kcal_per_100g: r.kcal_per_100g,
    protein_g_per_100g: r.protein_g_per_100g,
    carbs_g_per_100g: r.carbs_g_per_100g,
    fat_g_per_100g: r.fat_g_per_100g,
    sodium_mg_per_100g: r.sodium_mg_per_100g,
    verdict: isVerdict(r.verdict) ? r.verdict : null,
    note: r.nutrition_note,
    source: r.nutrition_source,
    updatedAt: r.nutrition_updated_at,
  }));
}
```

**Step 2: Action**

```ts
// src/lib/admin/food-actions.ts
"use server";
import { requireEditor } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { toFoodPatch, validateFoodEdit, type FoodEditInput } from "@/lib/diet/nutrition-edit";

type Result = { ok: true } | { ok: false; error: string };

/** Save a food's nutrition (editor-gated). Stamps source = 'kfandra' (spec §6.4). */
export async function updateFoodNutrition(id: string, input: FoodEditInput): Promise<Result> {
  try {
    const player = await requireEditor();
    const err = validateFoodEdit(input);
    if (err) return { ok: false, error: err };
    const admin = createAdminClient();
    const { error } = await admin
      .from("food_catalog")
      .update({
        ...toFoodPatch(input),
        nutrition_source: "kfandra",
        nutrition_updated_at: new Date().toISOString(),
        nutrition_updated_by: player.id,
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
```

**Step 3: Page (server)**

```tsx
// src/app/admin/diet/foods/page.tsx
import Link from "next/link";
import { requireStaff } from "@/lib/auth/guard";
import { isEditorRole } from "@/lib/auth/roles";
import { listFoodsForEdit } from "@/lib/admin/food-repository";
import FoodEditor from "./food-editor";

export const dynamic = "force-dynamic";

export default async function FoodsPage({ searchParams }: { searchParams: Promise<{ uncounted?: string }> }) {
  const [player, foods, { uncounted }] = await Promise.all([requireStaff("/admin/diet/foods"), listFoodsForEdit(), searchParams]);
  const uncountedOnly = uncounted === "1";
  const shown = uncountedOnly ? foods.filter((f) => f.kcal_per_100g === null) : foods;
  return (
    <div className="space-y-4">
      <Link href="/admin/diet" className="text-[12px] text-gray-600 hover:underline">← All diet logs</Link>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Food values</h2>
        <Link
          href={uncountedOnly ? "/admin/diet/foods" : "/admin/diet/foods?uncounted=1"}
          className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm hover:bg-gray-50"
        >
          {uncountedOnly ? "Show all" : "Uncounted only"}
        </Link>
      </div>
      <p className="text-[11px] text-gray-600">
        Values are per unit (e.g. one glass). Changes apply to every day since nutrition started.
      </p>
      <FoodEditor foods={shown} canEdit={isEditorRole(player.role)} />
    </div>
  );
}
```

**Step 4: Editor (client)**

```tsx
// src/app/admin/diet/foods/food-editor.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateFoodNutrition } from "@/lib/admin/food-actions";
import { perUnitView, type FoodEditInput } from "@/lib/diet/nutrition-edit";
import type { FoodEditRow } from "@/lib/admin/food-repository";
import type { Verdict } from "@/lib/diet/types";

const DOT: Record<Verdict, string> = { good: "bg-emerald-500", watch: "bg-amber-500", avoid: "bg-red-500" };

export default function FoodEditor({ foods, canEdit }: { foods: FoodEditRow[]; canEdit: boolean }) {
  const sections: Array<[string, FoodEditRow[]]> = [];
  for (const f of foods) {
    const last = sections.at(-1);
    if (last && last[0] === f.section) last[1].push(f);
    else sections.push([f.section, [f]]);
  }
  return (
    <div className="space-y-5">
      {sections.map(([section, rows]) => (
        <section key={section}>
          <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-600">{section}</h3>
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {rows.map((f) => <FoodRow key={f.id} food={f} canEdit={canEdit} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function FoodRow({ food, canEdit }: { food: FoodEditRow; canEdit: boolean }) {
  const view = perUnitView(food);
  const [open, setOpen] = useState(false);
  return (
    <div data-testid={`food-row-${food.key}`} className="p-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">{food.emoji ?? "🍴"}</span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            {food.name}
            {food.verdict && <span className={`inline-block h-2 w-2 rounded-full ${DOT[food.verdict]}`} />}
            {!food.isActive && <span className="text-[10px] font-normal text-gray-600">(hidden)</span>}
          </p>
          <p className="text-[11px] text-gray-600">
            {food.unit}
            {view.kcal === null ? " · not counted" : ` · ${view.kcal} kcal · P ${view.protein} · C ${view.carbs} · F ${view.fat}`}
          </p>
        </div>
        {canEdit && (
          <button onClick={() => setOpen((o) => !o)} className="rounded-lg border border-gray-200 px-2.5 py-1 text-[12px] font-semibold text-gray-700 hover:bg-gray-50">
            {open ? "Close" : "Edit"}
          </button>
        )}
      </div>
      {open && <EditForm food={food} onDone={() => setOpen(false)} />}
    </div>
  );
}

const toNum = (s: string): number | null => (s.trim() === "" ? null : Number(s));
const toStr = (n: number | null): string => (n === null ? "" : String(n));

function EditForm({ food, onDone }: { food: FoodEditRow; onDone: () => void }) {
  const router = useRouter();
  const view = perUnitView(food);
  const [vals, setVals] = useState({
    gramsPerUnit: toStr(view.gramsPerUnit), kcal: toStr(view.kcal), protein: toStr(view.protein),
    carbs: toStr(view.carbs), fat: toStr(view.fat), sodiumMg: toStr(view.sodiumMg),
  });
  const [verdict, setVerdict] = useState<Verdict | "">(food.verdict ?? "");
  const [note, setNote] = useState(food.note ?? "");
  const [isActive, setIsActive] = useState(food.isActive);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fields: Array<[keyof typeof vals, string]> = [
    ["gramsPerUnit", `Grams per ${food.unit}`], ["kcal", "kcal per unit"], ["protein", "Protein g per unit"],
    ["carbs", "Carbs g per unit"], ["fat", "Fat g per unit"], ["sodiumMg", "Sodium mg per unit"],
  ];

  async function save() {
    setSaving(true);
    setError(null);
    const input: FoodEditInput = {
      gramsPerUnit: toNum(vals.gramsPerUnit), kcal: toNum(vals.kcal), protein: toNum(vals.protein),
      carbs: toNum(vals.carbs), fat: toNum(vals.fat), sodiumMg: toNum(vals.sodiumMg),
      verdict: verdict || null, note, isActive,
    };
    const res = await updateFoodNutrition(food.id, input);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    onDone();
    router.refresh();
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {fields.map(([k, label]) => (
          <label key={k} className="text-[11px] text-gray-600">
            {label}
            <input
              aria-label={label}
              inputMode="decimal"
              value={vals[k]}
              onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))}
              className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-900"
            />
          </label>
        ))}
      </div>
      <label className="block text-[11px] text-gray-600">
        Verdict
        <select aria-label="Verdict" value={verdict} onChange={(e) => setVerdict(e.target.value as Verdict | "")} className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-900">
          <option value="">None</option>
          <option value="good">Good</option>
          <option value="watch">Watch</option>
          <option value="avoid">Avoid</option>
        </select>
      </label>
      <label className="block text-[11px] text-gray-600">
        KFANDRA’s note
        <textarea aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-900" />
      </label>
      <label className="flex items-center gap-2 text-[12px] text-gray-700">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Show to players
      </label>
      {error && <p className="text-[12px] text-red-700">{error}</p>}
      <button onClick={save} disabled={saving} className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
```

**Step 5: Verify**

Run: `npm run lint && npx tsc --noEmit && npm run test`. Then as a kfandra user open `/admin/diet/foods`: edit Milk's kcal from 124 to 130, save, and check `select kcal_per_100g, nutrition_source from food_catalog where key='milk'` returns `65, kfandra`. Set it back to 124. Try "Uncounted only". Clear all five values on a food and save; it should show "not counted".

**Step 6: Commit**

```bash
git add src/lib/admin/food-repository.ts src/lib/admin/food-actions.ts src/app/admin/diet/foods
git commit -m "feat(admin): food values editor (per-unit input, per-100 g storage)"
```

---

### Task 14: End-to-end spec

**Files:**
- Modify: `e2e/helpers/db.ts` (diet helpers)
- Create: `e2e/diet-nutrition.spec.ts`

**Step 1: DB helpers** (append to `e2e/helpers/db.ts`)

```ts
// ── diet nutrition ──────────────────────────────────────────────────────────

const START_KEY = "diet_nutrition_start_date";

export async function getNutritionStart(): Promise<unknown> {
  const rows = await sql<{ value: unknown }>("select value from app_config where key = $1", [START_KEY]);
  return rows[0]?.value ?? null;
}

/** Move the start date to N IST days ago, so "yesterday" counts. */
export async function setNutritionStartDaysAgo(days: number): Promise<void> {
  await sql(
    `insert into app_config (key, value) values ($1, to_jsonb(to_char((now() at time zone 'Asia/Kolkata')::date - $2::int, 'YYYY-MM-DD')))
     on conflict (key) do update set value = excluded.value`,
    [START_KEY, days],
  );
}

export async function restoreNutritionStart(value: unknown): Promise<void> {
  if (value === null) await sql("delete from app_config where key = $1", [START_KEY]);
  else await sql("update app_config set value = $2::jsonb where key = $1", [START_KEY, JSON.stringify(value)]);
}

/** Insert yesterday's (IST) diet log with one catalogue item in one slot. */
export async function insertYesterdayDietItem(playerId: string, slotKey: string, foodKey: string, count: number): Promise<void> {
  await sql(
    `with log as (
       insert into diet_logs (player_id, log_date)
       values ($1, (now() at time zone 'Asia/Kolkata')::date - 1)
       returning id
     ), meal as (
       insert into diet_log_meals (diet_log_id, meal_slot_id)
       select log.id, s.id from log, meal_slots s where s.key = $2
       returning id
     )
     insert into diet_log_items (diet_log_meal_id, food_item_id, count)
     select meal.id, f.id, $4 from meal, food_catalog f where f.key = $3`,
    [playerId, slotKey, foodKey, count],
  );
}

export async function getYesterdayRecapSeenAt(playerId: string): Promise<string | null> {
  const rows = await sql<{ recap_seen_at: string | null }>(
    `select recap_seen_at from diet_logs where player_id = $1 and log_date = (now() at time zone 'Asia/Kolkata')::date - 1`,
    [playerId],
  );
  return rows[0]?.recap_seen_at ?? null;
}

export type FoodSnapshot = Record<string, unknown>;

export async function snapshotFood(key: string): Promise<FoodSnapshot> {
  const rows = await sql(
    `select grams_per_unit, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g,
            sodium_mg_per_100g, verdict, nutrition_note, nutrition_source, nutrition_updated_at, nutrition_updated_by, is_active
     from food_catalog where key = $1`,
    [key],
  );
  return rows[0];
}

export async function restoreFood(key: string, s: FoodSnapshot): Promise<void> {
  await sql(
    `update food_catalog set grams_per_unit = $2, kcal_per_100g = $3, protein_g_per_100g = $4, carbs_g_per_100g = $5,
       fat_g_per_100g = $6, sodium_mg_per_100g = $7, verdict = $8, nutrition_note = $9, nutrition_source = $10,
       nutrition_updated_at = $11, nutrition_updated_by = $12, is_active = $13
     where key = $1`,
    [key, s.grams_per_unit, s.kcal_per_100g, s.protein_g_per_100g, s.carbs_g_per_100g, s.fat_g_per_100g,
      s.sodium_mg_per_100g, s.verdict, s.nutrition_note, s.nutrition_source, s.nutrition_updated_at,
      s.nutrition_updated_by, s.is_active],
  );
}

export async function getFoodKcalPer100g(key: string): Promise<number> {
  const rows = await sql<{ kcal_per_100g: string }>("select kcal_per_100g from food_catalog where key = $1", [key]);
  return Number(rows[0].kcal_per_100g);
}
```

**Step 2: The spec**

```ts
// e2e/diet-nutrition.spec.ts
import { test, expect, expectNoErrors } from "./fixtures";
import { seedPlayer, signIn, signInAs } from "./helpers/auth";
import * as db from "./helpers/db";

/**
 * Diet nutrition: meal summary, recap once, and the food editor feeding the
 * totals. Every spec seeds its own players; afterAll restores the start date
 * and the milk row and deletes the seeded players (cascading their logs).
 */

let startSnapshot: unknown;
let milkSnapshot: db.FoodSnapshot;

test.beforeAll(async () => {
  startSnapshot = await db.getNutritionStart();
  milkSnapshot = await db.snapshotFood("milk");
  await db.setNutritionStartDaysAgo(7);
});

test.afterAll(async () => {
  await db.restoreNutritionStart(startSnapshot);
  await db.restoreFood("milk", milkSnapshot);
  await db.deleteSeededPlayers();
});

test("logging a meal shows its summary and the day card", async ({ page, context, errors }) => {
  await signInAs(context, "user", "E2E Diet Eater");
  await page.goto("/diet");
  await page.getByRole("button", { name: /Breakfast/ }).first().click();
  const bread = page.getByRole("button", { name: /White bread/ });
  await bread.click();
  await bread.click();
  await page.getByRole("button", { name: /^Done ·/ }).click();

  const sheet = page.getByTestId("meal-summary-sheet");
  await expect(sheet).toContainText("Breakfast · 134 kcal");
  await expect(sheet).toContainText("1 of 1 items counted");
  await expect(sheet).toContainText("High GI Processing");
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(sheet).toBeHidden();

  await expect(page.getByTestId("day-nutrition-card")).toContainText("134 kcal");
  expectNoErrors(errors);
});

test("yesterday's recap shows once", async ({ page, context, errors }) => {
  const player = await signInAs(context, "user", "E2E Recap Player");
  await db.insertYesterdayDietItem(player.id, "breakfast", "milk", 1);

  await page.goto("/diet");
  const recap = page.getByTestId("recap-sheet");
  await expect(recap).toContainText("124 kcal");
  await recap.getByRole("button", { name: "Done" }).click();
  await expect.poll(() => db.getYesterdayRecapSeenAt(player.id)).not.toBeNull();

  await page.reload();
  await expect(page.getByTestId("day-nutrition-card").or(page.getByText("Breakfast").first())).toBeVisible();
  await expect(page.getByTestId("recap-sheet")).toBeHidden();
  expectNoErrors(errors);
});

test("editing a food in the editor changes the team totals", async ({ page, context, errors }) => {
  const eater = await seedPlayer("user", "E2E Grid Player");
  await db.insertYesterdayDietItem(eater.id, "breakfast", "milk", 1);
  const kfandra = await seedPlayer("kfandra", "E2E KFANDRA");
  await signIn(context, kfandra);

  await page.goto("/admin/diet/foods");
  const row = page.getByTestId("food-row-milk");
  await row.getByRole("button", { name: "Edit" }).click();
  const kcal = row.getByLabel("kcal per unit");
  await kcal.fill("130");
  await row.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => db.getFoodKcalPer100g("milk")).toBe(65);

  await page.goto("/admin/diet/nutrition");
  await expect(page.locator("tr", { hasText: "E2E Grid Player" })).toContainText("130 kcal");
  expectNoErrors(errors);
});
```

**Step 3: Run**

Run: `npm run test:e2e -- e2e/diet-nutrition.spec.ts`
Expected: 3 passed. If the recap test's reload assertion is flaky, assert directly on `page.getByRole("button", { name: /Breakfast/ }).first()` being visible instead.

**Step 4: Run the whole suite to check nothing else broke**

Run: `npm run test:e2e`
Expected: all pass.

**Step 5: Commit**

```bash
git add e2e/helpers/db.ts e2e/diet-nutrition.spec.ts
git commit -m "test(e2e): diet nutrition summary, recap and food editor"
```

---

### Task 15: Guides

**Files:**
- Modify: `docs/usage-guide.md` (§5 Diet)
- Modify: `docs/admin-guide.md` (§5 Diet)
- Regenerate: `docs/usage-guide.pdf`, `docs/admin-guide.pdf`

**Step 1: Usage guide.** Append to §5:

```markdown
**Nutrition.** When you finish a meal (tap **Done**), a sheet shows its calories
and protein / carbs / fat, how many of the items have values, and KFANDRA's note
on any food marked *watch* (amber dot) or *avoid* (red dot). Green dots are good
choices. The card at the top of Diet shows the day so far. The next time you open
Diet, you'll see a one-time recap of your last logged day. Foods without values
yet, and your own custom foods, are logged but not counted. Numbers are guidance
only.
```

**Step 2: Admin guide.** Append to §5:

```markdown
- **Totals** → every day now shows kcal, protein / carbs / fat, how many items
  were counted, and a red badge for foods marked *watch* or *avoid*. Days before
  nutrition started show no totals.
- **Team nutrition grid** → players down the side, the last 7 days across. Each
  cell shows kcal and protein; tap it to open that player's day. Use **← Week** /
  **Week →** to move.
- **Food values** → change any food's numbers **per unit** (e.g. one glass of
  milk), its verdict (good / watch / avoid), its note, or hide it from players.
  Clear all the numbers to make a food "not counted". **Uncounted only** lists the
  foods still waiting for values. Changes apply to every day since nutrition
  started.
```

**Step 3: Regenerate PDFs**

Run: `npm run docs:pdf && npm run docs:pdf:admin`
Expected: both PDFs rewritten without errors.

**Step 4: Commit**

```bash
git add docs/usage-guide.md docs/usage-guide.pdf docs/admin-guide.md docs/admin-guide.pdf
git commit -m "docs: usage and admin guides for diet nutrition"
```

---

### Task 16: Final verification and push

**Step 1: Quality gates**

Run: `npm run lint && npx tsc --noEmit && npm run test && npm run build && npm run test:e2e`
Expected: all green. Use @superpowers:verification-before-completion: paste the actual output and don't claim success without it.

**Step 2: Review**

Use @superpowers:requesting-code-review on the branch.

**Step 3: Deploy note for the PR description**

- The migration seeds `diet_nutrition_start_date` with the IST date it runs on production. Confirm that's the intended go-live date, or update the `app_config` row afterwards.
- KFANDRA's open questions (spec §8) are not blocking; answers come in through the food editor, not code.

**Step 4: Close beads and push** (per CLAUDE.md session completion)

```bash
bd close <ids>
git pull --rebase && bd dolt push && git push
git status   # must show "up to date with origin"
```
