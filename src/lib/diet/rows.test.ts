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
