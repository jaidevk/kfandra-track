import type { Verdict } from "./types";

/**
 * The food editor works PER UNIT (what KFANDRA thinks in: "one glass of milk
 * is 124 kcal") and stores PER 100 G (spec D1). Inputs arrive as the raw
 * strings typed in the form and are parsed here, so the server action never
 * hands the database something it can't store. Pure; unit-tested.
 */

export const NUMBER_FIELDS = ["gramsPerUnit", "kcal", "protein", "carbs", "fat", "sodiumMg"] as const;
export type NumberField = (typeof NUMBER_FIELDS)[number];
export type RawNumbers = Record<NumberField, string>;

export interface FoodEditInput {
  /** Raw per-unit strings, or null when no number field was changed. */
  numbers: RawNumbers | null;
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

export type FoodPatch = Partial<Per100Row> & {
  verdict: Verdict | null;
  nutrition_note: string | null;
  is_active: boolean;
};

const round2 = (x: number) => Math.round(x * 100) / 100;
const round1 = (x: number) => Math.round(x * 10) / 10;

/** "12" / "0.5" / "1,5" → number; "" → null; anything else → "invalid". */
export function parseDecimal(raw: string): number | null | "invalid" {
  const s = raw.trim().replace(",", ".");
  if (s === "") return null;
  return /^\d+(\.\d)?$/.test(s) ? Number(s) : "invalid";
}

type Parsed = Record<NumberField, number | null>;

function parseAll(raw: RawNumbers): Parsed | null {
  const out = {} as Parsed;
  for (const k of NUMBER_FIELDS) {
    const v = parseDecimal(raw[k]);
    if (v === "invalid") return null;
    out[k] = v;
  }
  return out;
}

const CAPS: Array<[Exclude<NumberField, "gramsPerUnit">, number, string]> = [
  ["kcal", 900, "kcal"],
  ["protein", 100, "Protein"],
  ["carbs", 100, "Carbs"],
  ["fat", 100, "Fat"],
  ["sodiumMg", 5000, "Sodium"],
];

export function validateFoodEdit(i: FoodEditInput): string | null {
  if (i.note.trim().length > 300) return "Note too long (max 300 characters).";
  if (i.numbers === null) return null;
  const p = parseAll(i.numbers);
  if (!p) return "Use numbers with at most one decimal, e.g. 0.5 or 12.";
  const core = [p.gramsPerUnit, p.kcal, p.protein, p.carbs, p.fat];
  const filled = core.filter((v) => v !== null).length;
  if (filled === 0) return p.sodiumMg === null ? null : "Sodium needs the other values too.";
  if (filled !== core.length) return "Fill in all of grams, kcal, protein, carbs and fat, or clear them all.";
  const g = p.gramsPerUnit!;
  if (g <= 0) return "Grams per unit must be more than 0.";
  for (const [k, cap, label] of CAPS) {
    const v = p[k];
    if (v !== null && (v * 100) / g > cap) {
      return `${label} is more than ${cap} per 100 g. Check you entered the amount for one unit, not per 100 g.`;
    }
  }
  return null;
}

/** Build the DB update. Call only after validateFoodEdit returned null. */
export function toFoodPatch(i: FoodEditInput): FoodPatch {
  const base = { verdict: i.verdict, nutrition_note: i.note.trim() || null, is_active: i.isActive };
  if (i.numbers === null) return base;
  const p = parseAll(i.numbers)!;
  const g = p.gramsPerUnit;
  const per100 = (v: number | null, r: (x: number) => number) => (v === null || g === null ? null : r((v * 100) / g));
  return {
    grams_per_unit: g,
    kcal_per_100g: per100(p.kcal, round2),
    protein_g_per_100g: per100(p.protein, round2),
    carbs_g_per_100g: per100(p.carbs, round2),
    fat_g_per_100g: per100(p.fat, round2),
    sodium_mg_per_100g: per100(p.sodiumMg, round1),
    ...base,
  };
}

/** Per-100 g row → per-unit numbers for display, to one decimal. */
export function perUnitView(r: Per100Row): Record<NumberField, number | null> {
  const g = r.grams_per_unit === null ? null : Number(r.grams_per_unit);
  const unit = (v: number | null) => (v === null || g === null ? null : round1((Number(v) * g) / 100));
  return {
    gramsPerUnit: g === null ? null : round1(g),
    kcal: unit(r.kcal_per_100g),
    protein: unit(r.protein_g_per_100g),
    carbs: unit(r.carbs_g_per_100g),
    fat: unit(r.fat_g_per_100g),
    sodiumMg: unit(r.sodium_mg_per_100g),
  };
}
