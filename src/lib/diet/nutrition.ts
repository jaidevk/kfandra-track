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
