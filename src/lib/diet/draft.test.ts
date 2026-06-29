import { describe, it, expect } from "vitest";
import { emptyDraft } from "./types";
import { tapFood, adjustLogged, addCustomItem } from "./draft";

describe("tapFood", () => {
  it("adds a catalogue item at count 1, then merges on re-tap", () => {
    let d = tapFood(emptyDraft(), "lunch", "roti");
    expect(d.meals.lunch.items).toHaveLength(1);
    expect(d.meals.lunch.items[0].count).toBe(1);
    d = tapFood(d, "lunch", "roti");
    expect(d.meals.lunch.items).toHaveLength(1);
    expect(d.meals.lunch.items[0].count).toBe(2);
  });
});

describe("adjustLogged", () => {
  it("removes an item once its count drops to 0", () => {
    const start = tapFood(emptyDraft(), "lunch", "roti");
    const id = start.meals.lunch.items[0].id;
    const out = adjustLogged(start, "lunch", id, -1);
    expect(out.meals.lunch.items).toHaveLength(0);
  });
});

describe("addCustomItem", () => {
  it("appends a custom item carrying name/unit/notes/quantity", () => {
    const out = addCustomItem(emptyDraft(), "lunch", {
      name: "Protein shake",
      quantity: 1,
      unit: "glass",
      notes: "post workout",
    });
    const item = out.meals.lunch.items[0];
    expect(item.foodKey).toBeNull();
    expect(item.customName).toBe("Protein shake");
    expect(item.count).toBe(1);
  });
});
