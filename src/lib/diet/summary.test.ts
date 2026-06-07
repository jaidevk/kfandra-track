import { describe, it, expect } from "vitest";
import {
  describeLogged,
  compactSummary,
  totalUnits,
  dayTotalUnits,
  loggedMealCount,
  currentMealKey,
} from "./summary";
import { emptyDraft, type DietDraft, type FoodItemInfo, type LoggedItem, type MealSlotInfo } from "./types";

const FOODS: Record<string, FoodItemInfo> = {
  roti: { key: "roti", name: "Roti / phulka", emoji: "🫓", unit: "1 piece", unitDetail: null },
  dal: { key: "dal", name: "Dal / varan", emoji: "🥣", unit: "1 waati", unitDetail: "150 g" },
  milk: { key: "milk", name: "Milk", emoji: "🥛", unit: "1 glass", unitDetail: "200 ml" },
};

const tap = (foodKey: string, count: number): LoggedItem => ({
  id: `${foodKey}-1`,
  foodKey,
  count,
});

describe("describeLogged", () => {
  it("resolves a catalogue tap to its name and unit", () => {
    expect(describeLogged(tap("roti", 2), FOODS)).toEqual({
      name: "Roti / phulka",
      unit: "1 piece",
    });
  });

  it("falls back to the key when the food is unknown", () => {
    expect(describeLogged(tap("mystery", 1), FOODS)).toEqual({
      name: "mystery",
      unit: "1 unit",
    });
  });

  it("describes a custom entry from its custom fields", () => {
    const custom: LoggedItem = {
      id: "c1",
      foodKey: null,
      customName: "Protein shake",
      customUnit: "glass",
      count: 1,
    };
    expect(describeLogged(custom, FOODS)).toEqual({
      name: "Protein shake",
      unit: "1 glass",
    });
  });

  it("uses safe defaults for a bare custom entry", () => {
    const custom: LoggedItem = { id: "c2", foodKey: null, count: 1 };
    expect(describeLogged(custom, FOODS)).toEqual({
      name: "Custom item",
      unit: "1 unit",
    });
  });
});

describe("compactSummary", () => {
  it("is empty for an untouched or item-less meal", () => {
    expect(compactSummary(undefined, FOODS)).toBe("");
    expect(compactSummary({ skipped: false, items: [] }, FOODS)).toBe("");
  });

  it("reports a skipped meal", () => {
    expect(compactSummary({ skipped: true, items: [] }, FOODS)).toBe("Skipped");
  });

  it("lists items with counts and truncates past the max", () => {
    const meal = {
      skipped: false,
      items: [tap("roti", 2), tap("dal", 1), tap("milk", 1), tap("mystery", 3)],
    };
    expect(compactSummary(meal, FOODS, 3)).toBe(
      "Roti / phulka × 2, Dal / varan × 1, Milk × 1, +1 more",
    );
  });
});

describe("totalUnits / dayTotalUnits", () => {
  it("sums counts in a meal, ignoring skipped", () => {
    expect(totalUnits({ skipped: false, items: [tap("roti", 2), tap("dal", 1)] })).toBe(3);
    expect(totalUnits({ skipped: true, items: [] })).toBe(0);
    expect(totalUnits(undefined)).toBe(0);
  });

  it("sums across the whole day", () => {
    const draft: DietDraft = {
      ...emptyDraft(),
      meals: {
        breakfast: { skipped: false, items: [tap("roti", 2)] },
        lunch: { skipped: false, items: [tap("dal", 1), tap("milk", 1)] },
        supper: { skipped: true, items: [] },
      },
    };
    expect(dayTotalUnits(draft)).toBe(4);
  });
});

describe("loggedMealCount", () => {
  it("counts touched slots (items or skipped), not untouched ones", () => {
    const draft: DietDraft = {
      ...emptyDraft(),
      meals: {
        breakfast: { skipped: false, items: [tap("roti", 2)] },
        lunch: { skipped: true, items: [] },
        midday: { skipped: false, items: [] }, // touched then emptied — not counted
      },
    };
    expect(loggedMealCount(draft)).toBe(2);
  });

  it("is zero for an empty draft", () => {
    expect(loggedMealCount(emptyDraft())).toBe(0);
  });
});

describe("currentMealKey", () => {
  const slots: MealSlotInfo[] = [
    { key: "midnight", name: "Midnight Snack", windowLabel: "10 pm – 2 am", emoji: "🌙", startMin: 22 * 60, endMin: 26 * 60 },
    { key: "breakfast", name: "Breakfast", windowLabel: "6 am – 9 am", emoji: "🌅", startMin: 6 * 60, endMin: 9 * 60 },
    { key: "lunch", name: "Lunch", windowLabel: "12 pm – 2 pm", emoji: "🍱", startMin: 12 * 60, endMin: 14 * 60 },
  ];

  const at = (h: number, m = 0) => new Date(2026, 5, 7, h, m, 0);

  it("matches a normal time window", () => {
    expect(currentMealKey(slots, at(7, 30))).toBe("breakfast");
    expect(currentMealKey(slots, at(13))).toBe("lunch");
  });

  it("matches the wrapping midnight slot before and after midnight", () => {
    expect(currentMealKey(slots, at(23))).toBe("midnight");
    expect(currentMealKey(slots, at(1))).toBe("midnight");
  });

  it("returns null when no slot is active", () => {
    expect(currentMealKey(slots, at(10))).toBeNull();
  });
});
