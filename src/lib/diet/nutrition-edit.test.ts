import { describe, it, expect } from "vitest";
import {
  parseDecimal, perUnitView, toFoodPatch, validateFoodEdit,
  type FoodEditInput, type RawNumbers,
} from "./nutrition-edit";

const milkNumbers: RawNumbers = { gramsPerUnit: "200", kcal: "124", protein: "6.4", carbs: "9.6", fat: "6.6", sodiumMg: "" };
const milk: FoodEditInput = { numbers: milkNumbers, verdict: "good", note: "Vit D", isActive: true };
const cleared: RawNumbers = { gramsPerUnit: "", kcal: "", protein: "", carbs: "", fat: "", sodiumMg: "" };

describe("parseDecimal", () => {
  it("reads integers and one decimal", () => {
    expect(parseDecimal("12")).toBe(12);
    expect(parseDecimal("0.5")).toBe(0.5);
    expect(parseDecimal(" 4.5 ")).toBe(4.5);
  });
  it("reads a comma as a decimal point", () => expect(parseDecimal("1,5")).toBe(1.5));
  it("treats empty as null", () => expect(parseDecimal("  ")).toBeNull());
  it("rejects text, negatives and two decimals", () => {
    expect(parseDecimal("abc")).toBe("invalid");
    expect(parseDecimal("-1")).toBe("invalid");
    expect(parseDecimal("1.25")).toBe("invalid");
  });
});

describe("validateFoodEdit", () => {
  it("accepts a full row", () => expect(validateFoodEdit(milk)).toBeNull());
  it("accepts an all-empty row (not counted)", () => {
    expect(validateFoodEdit({ ...milk, numbers: cleared })).toBeNull();
  });
  it("accepts a save with unchanged numbers", () => {
    expect(validateFoodEdit({ ...milk, numbers: null })).toBeNull();
  });
  it("rejects text and too many decimals with a plain message", () => {
    expect(validateFoodEdit({ ...milk, numbers: { ...milkNumbers, gramsPerUnit: "abc" } })).toMatch(/one decimal/i);
    expect(validateFoodEdit({ ...milk, numbers: { ...milkNumbers, fat: "6.66" } })).toMatch(/one decimal/i);
  });
  it("rejects a half-filled row", () => {
    expect(validateFoodEdit({ ...milk, numbers: { ...milkNumbers, fat: "" } })).toMatch(/all of/i);
  });
  it("rejects zero grams", () => {
    expect(validateFoodEdit({ ...milk, numbers: { ...milkNumbers, gramsPerUnit: "0" } })).toMatch(/grams/i);
  });
  it("rejects impossible per-100 g values (a chart figure typed per unit)", () => {
    // 5 g tsp of ghee typed as 897 kcal per tsp = 17940 kcal per 100 g.
    const ghee: RawNumbers = { gramsPerUnit: "5", kcal: "897", protein: "0", carbs: "0", fat: "5", sodiumMg: "" };
    expect(validateFoodEdit({ ...milk, numbers: ghee })).toMatch(/kcal/i);
    expect(validateFoodEdit({ ...milk, numbers: { ...milkNumbers, protein: "201" } })).toMatch(/protein/i);
  });
  it("rejects a long note", () => {
    expect(validateFoodEdit({ ...milk, note: "x".repeat(301) })).toMatch(/note/i);
  });
});

describe("toFoodPatch", () => {
  it("converts per-unit values to per 100 g", () => {
    expect(toFoodPatch(milk)).toEqual({
      grams_per_unit: 200, kcal_per_100g: 62, protein_g_per_100g: 3.2, carbs_g_per_100g: 4.8, fat_g_per_100g: 3.3,
      sodium_mg_per_100g: null, verdict: "good", nutrition_note: "Vit D", is_active: true,
    });
  });
  it("writes all-null for a cleared row and trims an empty note to null", () => {
    expect(toFoodPatch({ ...milk, numbers: cleared, note: "  " }))
      .toMatchObject({ grams_per_unit: null, kcal_per_100g: null, nutrition_note: null });
  });
  it("leaves the numbers out when they were not changed", () => {
    expect(toFoodPatch({ ...milk, numbers: null, verdict: "watch" })).toEqual({
      verdict: "watch", nutrition_note: "Vit D", is_active: true,
    });
  });
});

describe("perUnitView", () => {
  it("shows per-unit values to one decimal", () => {
    expect(perUnitView({ grams_per_unit: 5, kcal_per_100g: 897, protein_g_per_100g: 0, carbs_g_per_100g: 0, fat_g_per_100g: 99.5, sodium_mg_per_100g: null }))
      .toEqual({ gramsPerUnit: 5, kcal: 44.9, protein: 0, carbs: 0, fat: 5, sodiumMg: null });
  });
});
