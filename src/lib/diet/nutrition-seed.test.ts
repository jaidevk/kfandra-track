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

describe("players' additions (2026-10-28)", () => {
  const NEW_KEYS = [
    "pav", "bhakri-jowar", "bhakri-bajra",
    "porridge-oats", "porridge-ragi", "porridge-dalia", "porridge-jowar", "porridge-cornmeal",
    "sambar", "sprouts-salad", "sprouts-usal", "soup",
    "doodhi", "sponge-gourd", "bitter-gourd", "grilled-veggies",
    "chicken-biryani",
    "avocado", "pear", "pomegranate", "dates", "raisins", "black-raisins", "khareek",
    "futana", "pumpkin-seeds", "sunflower-seeds", "flax-seeds", "chia-seeds", "sabja-seeds", "pine-nuts",
    "peanut-butter", "hummus", "coconut-chutney",
    "egg-bhurji",
  ];

  it("adds every requested food", () => {
    for (const key of NEW_KEYS) expect(byKey[key], key).toBeDefined();
  });

  it("counts every food: none is left without nutrition", () => {
    expect(NUTRITION_SEED.filter((f) => !f.nutrition).map((f) => f.key)).toEqual([]);
  });

  it("makes 1 waati 100 g everywhere, except dry oats", () => {
    for (const f of NUTRITION_SEED.filter((f) => f.unit === "1 waati" && f.key !== "oats")) {
      expect(f.nutrition!.gramsPerUnit, f.key).toBe(100);
      expect(f.unitDetail, f.key).toBe("100 g");
    }
  });

  it("splits chicken biryani out of pulao", () => {
    expect(byKey["pulao"].name).toBe("Pulao");
    expect(byKey["chicken-biryani"].section).toBe("Rice");
  });

  it("leaves the verdict to KFANDRA for reference-table values", () => {
    for (const f of NUTRITION_SEED.filter((f) => f.nutrition?.source === "reference")) {
      expect(f.nutrition!.verdict, f.key).toBeNull();
      expect(f.nutrition!.note, f.key).toBeNull();
    }
  });
});
