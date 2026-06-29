import { describe, it, expect } from "vitest";
import { emptyDraft } from "./types";
import {
  tapFood,
  adjustLogged,
  addCustomItem,
  stepCustomQuantity,
  tapPersonalFood,
} from "./draft";

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

describe("adjustLogged — half portions", () => {
  it("steps a logged item by 0.5 and removes it at 0", () => {
    const start = addCustomItem(emptyDraft(), "lunch", {
      name: "Rice",
      quantity: 1,
      unit: "waati",
    });
    const id = start.meals.lunch.items[0].id;
    const half = adjustLogged(start, "lunch", id, -0.5);
    expect(half.meals.lunch.items[0].count).toBe(0.5);
    const gone = adjustLogged(half, "lunch", id, -0.5);
    expect(gone.meals.lunch.items).toHaveLength(0);
    const up = adjustLogged(start, "lunch", id, 0.5);
    expect(up.meals.lunch.items[0].count).toBe(1.5);
  });
});

describe("stepCustomQuantity", () => {
  it("steps by 0.5 with a floor of 0.5", () => {
    expect(stepCustomQuantity(1, 1)).toBe(1.5);
    expect(stepCustomQuantity(1, -1)).toBe(0.5);
    expect(stepCustomQuantity(0.5, -1)).toBe(0.5); // floored
  });
});

describe("tapPersonalFood", () => {
  const food = { name: "Protein shake", unit: "glass", notes: "post workout" };

  it("adds the saved custom food at count 1", () => {
    const out = tapPersonalFood(emptyDraft(), "lunch", food);
    const item = out.meals.lunch.items[0];
    expect(item.foodKey).toBeNull();
    expect(item.customName).toBe("Protein shake");
    expect(item.customUnit).toBe("glass");
    expect(item.count).toBe(1);
  });

  it("merges on re-tap of the same name+unit", () => {
    let out = tapPersonalFood(emptyDraft(), "lunch", food);
    out = tapPersonalFood(out, "lunch", food);
    expect(out.meals.lunch.items).toHaveLength(1);
    expect(out.meals.lunch.items[0].count).toBe(2);
  });
});
