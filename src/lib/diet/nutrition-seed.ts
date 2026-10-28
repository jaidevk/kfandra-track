// src/lib/diet/nutrition-seed.ts
/**
 * KFANDRA's nutrition numbers, typed ONCE, exactly as the source gives them.
 *
 * This is the single source for the food catalogue seed (spec D13): the SQL
 * block in supabase/migrations/20261028120100_diet_catalog_additions.sql
 * (first seeded by 20261016120000_diet_nutrition.sql) is generated
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
export type SeedSource = "matrix_v2" | "email_2026_10_02" | "app_default" | "reference";

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
  /** Null = KFANDRA has not given guidance yet (set it in the food editor). */
  verdict: SeedVerdict | null;
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

/**
 * Standard food-table values per 100 g (IFCT 2017 / USDA, as eaten), added
 * for the players' requests of 2026-10-28. No verdict or note: those are
 * KFANDRA's guidance, set in the food editor.
 */
function R(gramsPerUnit: number, v: Values): SeedNutrition {
  const [kcal, protein, carbs, fat] = v;
  return { gramsPerUnit, source: "reference", basisG: 100, kcal, protein, carbs, fat, sodiumMg: null, verdict: null, note: null };
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
    food("paratha", "Paratha", "🫓", "1 piece", "~60 g", R(60, [300, 6.5, 45, 11])),
    food("naan", "Naan", "🫓", "1 piece", "~90 g", R(90, [290, 9, 50, 5.5])),
    food("bhakri", "Bhakri", "🫓", "1 piece", "~60 g", R(60, [245, 7, 50, 2])),
    food("bhakri-jowar", "Bhakri, jowar", "🫓", "1 piece", "~60 g", R(60, [245, 7, 50, 2])),
    food("bhakri-bajra", "Bhakri, bajra", "🫓", "1 piece", "~60 g", R(60, [255, 8, 48, 3.5])),
    food("pav", "Pav", "🍞", "1 piece", "~40 g", R(40, [275, 8.5, 52, 3.5])),
    food("oats", "Oats (dry)", "🥣", "1 waati", "40 g dry", M(40, 100, [389, 16.9, 66.3, 6.9], "good", "Beta-Glucan Fiber, Exceptional Heart Recovery")),
  ]],
  ["Dals & Sabzi", [
    food("dal", "Dal / varan", "🥣", "1 waati", "100 g", M(100, 100, [116, 7.0, 20.0, 0.4], "good", "Water Volume Dilution, Folate Heavy")),
    food("dal-tadka", "Dal tadka", "🍲", "1 waati", "100 g", M(100, 100, [190, 6.8, 19.5, 9.2], "watch", "Added Seed Oils, Lipid Density Increase")),
    food("moong-dal", "Moong dal", "🥣", "1 waati", "100 g", M(100, 100, [105, 7.3, 19.0, 0.3], "good", "Optimal Athlete Low-Fat Recovery Carb")),
    food("masoor-dal", "Masoor dal", "🥣", "1 waati", "100 g", M(100, 100, [116, 9.0, 20.0, 0.3], "good", "Post-Training Amino/Glycogen Load")),
    food("chana-dal", "Chana dal", "🥣", "1 waati", "100 g", M(100, 100, [164, 8.9, 27.0, 2.6], "good", "Low Glycemic Index, Steady Energy")),
    food("soya-boiled", "Soya chunks, boiled", "🫘", "5 pieces", "~10 g", M(10, 10, [35, 5.2, 3.3, 0.1], "good", "High Hydration Mass, Low Density")),
    food("soya-fried", "Soya chunks, fried", "🫘", "5 pieces", "~10 g", M(10, 10, [115, 5.1, 4.0, 9.0], "avoid", "Extreme Fat Spike, Oxidized Lipids")),
    food("bhendi", "Bhendi bhaji", "🥬", "1 waati", "100 g", R(100, [100, 2.2, 8, 7])),
    food("mixed-sabzi", "Mixed sabzi", "🥗", "1 waati", "100 g", R(100, [90, 2.5, 9, 5])),
    food("aloo-bhaji", "Aloo bhaji", "🥔", "1 waati", "100 g", R(100, [130, 2, 17, 6])),
    food("paneer-sabzi", "Paneer sabzi", "🧀", "1 waati", "100 g", R(100, [200, 9, 7, 15])),
    food("chana", "Chana / chole", "🫘", "1 waati", "100 g", R(100, [150, 7, 20, 5])),
    food("sambar", "Sambar", "🍲", "1 waati", "100 g", R(100, [65, 3, 9, 2])),
    food("sprouts-salad", "Sprouts, raw salad", "🌱", "1 waati", "100 g", R(100, [30, 3, 5.9, 0.2])),
    food("sprouts-usal", "Sprouts usal / bhaji (matki, moong, val, masoor)", "🌱", "1 waati", "100 g", R(100, [120, 7, 15, 4])),
    food("soup", "Soup, veg", "🍲", "1 waati", "100 g", R(100, [35, 1.5, 6, 0.8])),
  ]],
  ["Vegetables & Salad", [
    food("potato-boiled", "Potato, boiled", "🥔", "1 waati", "100 g", M(100, 100, [87, 2.0, 20.0, 0.1], "good", "Clean Resistant Starch, Cellular Energy")),
    food("sweet-potato", "Sweet potato, boiled", "🍠", "1 waati", "100 g", M(100, 100, [90, 2.0, 21.0, 0.1], "good", "Highly Bioavailable Vit A, Antioxidants")),
    food("arbi-boiled", "Arbi, boiled", "🥔", "1 waati", "100 g", M(100, 100, [116, 1.6, 27.5, 0.1], "good", "Viscous Soluble Fiber, Gastro-Safe")),
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
    food("doodhi", "Doodhi (bottle gourd), cooked", "🥒", "1 waati", "100 g", R(100, [15, 0.6, 3.7, 0])),
    food("sponge-gourd", "Sponge gourd (turai), cooked", "🥒", "1 waati", "100 g", R(100, [20, 1, 4.4, 0.1])),
    food("bitter-gourd", "Bitter gourd (karela), cooked", "🥒", "1 waati", "100 g", R(100, [19, 0.8, 4.3, 0.2])),
    food("grilled-veggies", "Mixed veggies, grilled / boiled", "🥗", "1 waati", "100 g", R(100, [55, 2.5, 9, 1.5])),
  ]],
  ["Rice", [
    food("plain-rice", "Plain rice", "🍚", "1 waati", "100 g", M(100, 100, [130, 2.7, 28.0, 0.3], "watch", "High Glycemic Muscle Glycogen Replenisher")),
    food("brown-rice", "Brown rice", "🍚", "1 waati", "100 g", M(100, 100, [112, 2.3, 23.5, 0.8], "good", "Sustained Low-GI Fuel Release Profile")),
    food("khichadi", "Khichadi", "🍚", "1 waati", "100 g", R(100, [120, 4.5, 20, 2.5])),
    food("pulao", "Pulao", "🍛", "1 plate", "~200 g", R(200, [150, 3, 25, 4])),
    food("curd-rice", "Curd rice", "🍚", "1 waati", "100 g", R(100, [110, 3, 17, 3])),
    food("chicken-biryani", "Chicken biryani", "🍛", "1 plate", "~250 g", R(250, [170, 8, 20, 6.5])),
  ]],
  ["Porridge (in milk)", [
    food("porridge-oats", "Oatmeal porridge", "🥣", "1 waati", "100 g", R(100, [110, 4.5, 15, 3.5])),
    food("porridge-ragi", "Ragi porridge", "🥣", "1 waati", "100 g", R(100, [95, 3.5, 14, 3])),
    food("porridge-dalia", "Broken wheat (dalia) porridge", "🥣", "1 waati", "100 g", R(100, [105, 4, 16, 3])),
    food("porridge-jowar", "Jowar porridge", "🥣", "1 waati", "100 g", R(100, [100, 3.8, 15, 3])),
    food("porridge-cornmeal", "Corn meal porridge", "🥣", "1 waati", "100 g", R(100, [100, 3.5, 16, 2.8])),
  ]],
  ["Dairy", [
    food("milk", "Milk", "🥛", "1 glass", "200 ml", M(200, 100, [62, 3.2, 4.8, 3.3], "good", "Vit D, Calcium, Riboflavin")),
    food("skimmed-milk", "Milk, skimmed", "🥛", "1 glass", "200 ml", M(200, 100, [35, 3.4, 5.0, 0.1], "good", "Isolated Protein, Low Lipids")),
    food("taak", "Buttermilk / taak", "🥛", "1 glass", "200 ml", M(200, 100, [40, 3.3, 4.8, 0.9], "good", "Hydration Matrix, Potassium, Calcium")),
    food("curd", "Curd / dahi", "🍶", "1 waati", "100 g", M(100, 100, [61, 3.5, 4.7, 3.3], "good", "B12, Active Probiotics, Gut Health")),
    food("greek-yoghurt", "Greek yoghurt", "🍶", "1 waati", "100 g", M(100, 100, [97, 9.0, 4.0, 5.0], "good", "Concentrated Amino Acids, Calcium")),
    food("paneer", "Paneer", "🧀", "100 g", null, M(100, 100, [260, 18.0, 3.2, 19.5], "good", "Moisture Retained, Sodium Leached")),
    food("paneer-fried", "Paneer, fried", "🧀", "100 g", null, M(100, 100, [410, 17.2, 2.8, 36.0], "watch", "Conjugated Fat Spike, Saturated Content")),
    food("ghee", "Ghee", "🧈", "1 tsp", "5 g", M(5, 100, [897, 0.0, 0.0, 99.5], "watch", "Pure Butyric Acid, Vit A, Extreme Density")),
    food("cheese-slice", "Cheese slice", "🧀", "1 piece", "~20 g", R(20, [310, 18, 6, 24])),
  ]],
  ["Nuts & Seeds", [
    food("almonds", "Almonds", "🌰", "5 pieces", "~6 g", M(6, 6, [35, 1.3, 1.2, 3.0], "good", "Vit E, Magnesium, High Satiety")),
    food("pistachios", "Pistachios", "🌰", "5 pieces", "~4 g", M(4, 4, [20, 0.7, 1.0, 1.6], "good", "Vit B6, Potassium, Low Calorie")),
    food("cashews", "Cashews", "🌰", "5 pieces", "~8 g", M(8, 8, [45, 1.4, 2.4, 3.5], "good", "Zinc, Iron, Copper")),
    food("peanuts", "Peanuts", "🥜", "5 pieces", "~5 g", M(5, 5, [30, 1.3, 0.8, 2.5], "good", "Niacin, Biotin, Protein Dense")),
    food("walnuts", "Walnuts", "🌰", "5 pieces", "~10 g", M(10, 10, [65, 1.5, 1.4, 6.5], "good", "Omega-3 ALA, Brain Health, Copper")),
    food("futana", "Futana (roasted chana)", "🫘", "1 tbsp", "10 g", R(10, [369, 22.5, 58, 5.2])),
    food("pumpkin-seeds", "Pumpkin seeds", "🎃", "1 tbsp", "10 g", R(10, [559, 30, 10.7, 49])),
    food("sunflower-seeds", "Sunflower seeds", "🌻", "1 tbsp", "10 g", R(10, [584, 21, 20, 51])),
    food("flax-seeds", "Flax seeds", "🌾", "1 tbsp", "10 g", R(10, [534, 18.3, 28.9, 42.2])),
    food("chia-seeds", "Chia seeds", "🌱", "1 tbsp", "10 g", R(10, [486, 16.5, 42.1, 30.7])),
    food("sabja-seeds", "Sabja (basil) seeds", "🌱", "1 tbsp", "10 g", R(10, [440, 14.8, 64, 13.8])),
    food("pine-nuts", "Pine nuts", "🌲", "1 tbsp", "10 g", R(10, [673, 13.7, 13.1, 68.4])),
  ]],
  ["Fruits", [
    food("banana", "Banana", "🍌", "1 piece", "~100 g", M(100, 100, [89, 1.1, 22.8, 0.3], "good", "Potassium Energy Catalyst, Instant Glycogen")),
    food("apple", "Apple", "🍎", "1 piece", "~100 g", M(100, 100, [52, 0.3, 13.8, 0.2], "good", "Pectin Soluble Fiber, Steady Blood Sugar")),
    food("mango", "Mango", "🥭", "1 piece", "~100 g", M(100, 100, [60, 0.8, 15.0, 0.4], "good", "Vit C, Vit A, Fructose Spurt Energy")),
    food("orange", "Orange", "🍊", "1 piece", "~100 g", M(100, 100, [47, 0.9, 11.8, 0.1], "good", "High Bioavailable Vit C, Electrolyte Balance")),
    food("papaya", "Papaya", "🍈", "1 waati", "100 g", M(100, 100, [43, 0.5, 10.8, 0.3], "good", "Papain Enzyme (Protein Digestion Optimizer)")),
    food("watermelon", "Watermelon", "🍉", "1 waati", "100 g", M(100, 100, [30, 0.6, 7.6, 0.2], "good", "L-Citrulline (Nitric Oxide Vasodilation), Hydration")),
    food("jackfruit", "Jackfruit", "🍈", "1 waati", "100 g", M(100, 100, [95, 1.7, 23.2, 0.6], "good", "Vit B6, Potassium, Complex Plant Energy")),
    food("grapes", "Grapes", "🍇", "1 waati", "100 g", M(100, 100, [69, 0.7, 18.1, 0.2], "good", "Resveratrol, Quick Hydrating Muscle Sugar")),
    food("pineapple", "Pineapple", "🍍", "1 waati", "100 g", M(100, 100, [50, 0.5, 13.1, 0.1], "good", "Bromelain Enzyme (Muscle Anti-Inflammatory)")),
    food("mixed-fruit", "Mixed fruit", "🍇", "1 waati", "100 g", R(100, [55, 0.7, 14, 0.2])),
    food("pear", "Pear", "🍐", "1 piece", "~150 g", R(150, [57, 0.4, 15.2, 0.1])),
    food("pomegranate", "Pomegranate", "🍎", "1 waati", "100 g", R(100, [83, 1.7, 18.7, 1.2])),
    food("avocado", "Avocado", "🥑", "1 waati", "100 g", R(100, [160, 2, 8.5, 14.7])),
    food("dates", "Dates", "🌴", "1 piece", "~8 g", R(8, [282, 2.5, 75, 0.4])),
    food("khareek", "Khareek (dry dates)", "🌴", "1 piece", "~6 g", R(6, [317, 2.4, 75.8, 0.4])),
    food("raisins", "Raisins", "🍇", "1 tbsp", "10 g", R(10, [299, 3.1, 79.2, 0.5])),
    food("black-raisins", "Black raisins / blackcurrant", "🍇", "1 tbsp", "10 g", R(10, [290, 3, 76, 0.4])),
  ]],
  ["Non-Veg", [
    food("egg-boiled", "Egg, boiled", "🥚", "1 piece", "~50 g", R(50, [155, 12.6, 1.1, 10.6])),
    food("egg-omelette", "Egg, omelette", "🍳", "1 piece", "1 egg · ~60 g", R(60, [185, 11, 1, 15])),
    food("egg-scrambled", "Egg, scrambled", "🍳", "1 waati", "100 g", R(100, [170, 11, 1.5, 13])),
    food("egg-bhurji", "Egg bhurji", "🍳", "1 waati", "100 g", R(100, [190, 11, 3, 15])),
    // Merged (D15): the old "Chicken grilled, 1 piece ~100 g" tile.
    food("chicken-grilled", "Chicken breast (skinless)", "🍗", "100 g", null, M(100, 100, [165, 31.0, 0.0, 3.6], "good", "Pure Lean Muscle Block, Selenium, B6")),
    food("chicken-skin", "Chicken (with skin)", "🍗", "100 g", null, M(100, 100, [215, 27.0, 0.0, 15.0], "watch", "High Saturated Fat Density Payload")),
    food("chicken-fried", "Chicken, fried", "🍗", "100 g", null, M(100, 100, [290, 28.5, 0.0, 18.5], "avoid", "Trans/Saturated Fat Matrix Infusion")),
    food("chicken-curry", "Chicken curry", "🍗", "1 waati", "100 g", R(100, [150, 13, 5, 9])),
    food("mutton-curry", "Mutton curry", "🥩", "1 waati", "100 g", R(100, [190, 14, 5, 13])),
    food("fish-curry", "Fish curry", "🐟", "1 waati", "100 g", R(100, [130, 13, 4, 7])),
    food("fish-fried", "Fish grilled / fried", "🐟", "1 piece", "~100 g", R(100, [200, 20, 6, 11])),
    food("prawns", "Prawns", "🦐", "1 waati", "100 g", R(100, [130, 18, 4, 5])),
    food("tandoori", "Tandoori chicken", "🍗", "1 piece", "~100 g", R(100, [150, 25, 2, 5])),
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
    food("juice", "Juice", "🧃", "1 glass", "200 ml", R(200, [45, 0.5, 11, 0.1])),
    food("coconut-water", "Coconut water", "🥥", "1 glass", "200 ml", R(200, [19, 0.7, 3.7, 0.2])),
    food("lassi", "Lassi", "🥛", "1 glass", "200 ml", R(200, [90, 3, 14, 2.5])),
    food("soft-drink", "Soft drink / cola", "🥤", "1 glass", "200 ml", M(200, 100, [42, 0.0, 10.6, 0.0], "avoid", "High Fructose Corn Syrup Damage, Acidity")),
    food("diet-soda", "Diet / zero soda", "🥤", "1 glass", "200 ml", M(200, 100, [0, 0.0, 0.0, 0.0], "watch", "Artificial Sweeteners (Non-Caloric Matrix)")),
    food("sports-drink", "Sports drink", "🍶", "1 bottle", "1 L", R(1000, [26, 0, 6.4, 0])),
  ]],
  ["Supplements", [
    // Per-scoop source; the gram weight is a placeholder and cancels out (D14).
    food("whey-shake", "Whey shake", "🥤", "1 scoop", "in water", M(30, 30, [120, 24.0, 2.0, 1.5], "good", "Immediate Leucine Recovery BCAA Spike")),
    food("mass-gainer", "Mass gainer", "🥤", "1 scoop", "in water", M(100, 100, [380, 20.0, 70.0, 3.0], "watch", "Maltodextrin Overload, Fast Glycemic Load")),
  ]],
  ["Snacks", [
    food("poha", "Poha", "🍚", "1 waati", "100 g", R(100, [130, 2.5, 23, 3.5])),
    food("upma", "Upma", "🥣", "1 waati", "100 g", R(100, [140, 3.5, 21, 4.5])),
    // Email says fat "<1.0g"; stored as the upper bound 1.0.
    food("idli", "Idli", "🍙", "1 piece", "~40 g", E(40, 100, [120, 6.0, 28.0, 1.0], "good", "Excellent Choice. High bioavailability via fermentation.")),
    food("dosa", "Dosa, plain", "🥞", "1 piece", "~80 g", E(80, 100, [165, 4.0, 29.0, 3.5], "good", "Safe, clean complex carbs if prepared without excess butter/ghee.")),
    food("masala-dosa", "Masala dosa", "🥞", "1 piece", "~150 g", E(150, 100, [250, 5.0, 40.0, 8.0], "watch", "Hidden Trap. Added oil and high-glycemic potato mash.")),
    food("vada", "Medu vada", "🍩", "1 piece", "~50 g", R(50, [300, 9, 30, 16])),
    food("wada-pav", "Wada pav", "🍔", "1 piece", null, E(150, 150, [300, 6.7, 30.7, 16.7], "avoid", "~450mg Sodium. Massive trans-fat spike from deep frying.", 450)),
    food("samosa", "Samosa", "🥟", "1 piece", "~70 g", R(70, [310, 5, 32, 18])),
    food("sandwich", "Sandwich", "🥪", "1 piece", "veg · ~120 g", R(120, [210, 7, 30, 7])),
    food("biscuits", "Glucose biscuits", "🍪", "1 piece", "~6 g", E(6, 100, [450, 6.5, 77.0, 12.5], "avoid", "High in Refined Palm Oil and processed sugar syrups.")),
    food("cream-biscuits", "Cream biscuits", "🍪", "1 piece", "~12 g", E(12, 100, [480, 5.0, 70.0, 20.0], "avoid", "Pure hydrogenated fats. Causes instant insulin crashes.")),
    food("maggi", "Maggi / noodles", "🍜", "1 waati", "100 g", R(100, [140, 3, 19, 6])),
    food("chivda", "Chivda / namkeen", "🥜", "1 waati", "100 g", E(100, 100, [450, 8.0, 55.0, 22.0], "avoid", "High glycemic spike combined with heavy processing lipids.")),
    food("sev", "Sev / shev", "🥨", "1 waati", "100 g", E(100, 100, [480, 11.5, 42.0, 29.5], "avoid", "~500mg+ Sodium. Fried chickpea flour; extreme caloric density.", 500)),
    food("peanut-butter", "Peanut butter", "🥜", "1 tbsp", "16 g", R(16, [588, 25, 20, 50])),
    food("hummus", "Hummus", "🫘", "1 tbsp", "15 g", R(15, [166, 7.9, 14.3, 9.6])),
    food("coconut-chutney", "Coconut chutney", "🥥", "1 tbsp", "15 g", R(15, [180, 2.5, 7, 16])),
  ]],
  ["Sweets", [
    food("sugar", "Sugar", "🍬", "1 tsp", "4 g", M(4, 4, [16, 0.0, 4.2, 0.0], "avoid", "100% Sucrose, Immediate Blood Glucose Shock")),
    food("jaggery", "Jaggery / gul", "🍯", "1 tsp", "5 g", M(5, 5, [19, 0.0, 4.8, 0.0], "watch", "Trace Iron, Potassium, Slower Fructose Link")),
    food("modak", "Modak", "🍡", "1 piece", "~40 g", R(40, [230, 3, 40, 7])),
    food("laddu", "Laddu", "🍡", "1 piece", "~50 g", M(50, 50, [185, 2.0, 28.0, 8.0], "avoid", "Gram Flour Fried in Ghee, Extreme Fat/Carb")),
    food("barfi", "Barfi", "🍬", "1 piece", "~30 g", R(30, [420, 9, 55, 18])),
    food("jalebi", "Jalebi", "🥨", "1 piece", "~30 g", R(30, [400, 2, 60, 17])),
    food("gulab-jamun", "Gulab jamun", "🍡", "1 piece", "~50 g", M(50, 50, [175, 2.5, 26.0, 7.0], "avoid", "Deep Fried Dairy, Heavy Sugar Syrup Lock")),
    food("kheer", "Kheer", "🥣", "1 waati", "100 g", R(100, [140, 4, 20, 5])),
    food("shrikhand", "Shrikhand", "🍶", "1 waati", "100 g", R(100, [250, 6, 40, 7])),
    food("ice-cream", "Ice cream", "🍨", "1 scoop", "~60 g", R(60, [207, 3.5, 24, 11])),
    food("chocolate", "Chocolate", "🍫", "1 piece", "~10 g", R(10, [535, 7.6, 59, 30])),
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
