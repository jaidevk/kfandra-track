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
