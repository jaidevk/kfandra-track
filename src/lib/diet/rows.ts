import type { FoodItemInfo, LoggedItem, MealLog, Verdict } from "./types";

/**
 * Pure mappers from PostgREST rows to the diet domain shapes. Shared by the
 * player loader (repository.ts) and the admin pages (activity-repository.ts)
 * so both feed the same DietDraft into nutrition.ts.
 */

/** PostgREST embeds a to-one relation as an object or a one-element array. */
type One<T> = T | T[] | null;
function one<T>(v: One<T>): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const VERDICTS: readonly Verdict[] = ["good", "watch", "avoid"];
export function isVerdict(v: unknown): v is Verdict {
  return VERDICTS.includes(v as Verdict);
}

export interface FoodCatalogRow {
  key: string;
  name: string;
  emoji: string | null;
  unit: string;
  unit_detail: string | null;
  grams_per_unit: number | null;
  kcal_per_100g: number | null;
  protein_g_per_100g: number | null;
  carbs_g_per_100g: number | null;
  fat_g_per_100g: number | null;
  verdict: string | null;
  nutrition_note: string | null;
}

export const FOOD_CATALOG_COLUMNS =
  "key, name, emoji, unit, unit_detail, section_label, sort_order, is_active, grams_per_unit, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, verdict, nutrition_note";

export function foodRowToInfo(r: FoodCatalogRow): FoodItemInfo {
  const vals = [r.grams_per_unit, r.kcal_per_100g, r.protein_g_per_100g, r.carbs_g_per_100g, r.fat_g_per_100g];
  const counted = vals.every((v) => v !== null);
  return {
    key: r.key,
    name: r.name,
    emoji: r.emoji,
    unit: r.unit,
    unitDetail: r.unit_detail,
    nutrition: counted
      ? {
          gramsPerUnit: Number(r.grams_per_unit),
          kcalPer100g: Number(r.kcal_per_100g),
          proteinPer100g: Number(r.protein_g_per_100g),
          carbsPer100g: Number(r.carbs_g_per_100g),
          fatPer100g: Number(r.fat_g_per_100g),
        }
      : null,
    verdict: isVerdict(r.verdict) ? r.verdict : null,
    note: r.nutrition_note,
  };
}

export interface ItemRow {
  id: string;
  custom_name: string | null;
  custom_unit: string | null;
  custom_notes: string | null;
  count: number | string;
  sort_order: number | null;
  food_catalog: One<{ key: string }>;
}

export interface MealRow {
  skipped: boolean;
  meal_slots: One<{ key: string }>;
  diet_log_items: ItemRow[] | null;
}

/** The select fragment that yields MealRow (embed under diet_log_meals). */
export const MEAL_ROW_SELECT =
  "skipped, meal_slots(key), diet_log_items(id, custom_name, custom_unit, custom_notes, count, sort_order, food_catalog(key))";

export function mealRowsToMeals(rows: MealRow[]): Record<string, MealLog> {
  const meals: Record<string, MealLog> = {};
  for (const m of rows) {
    const slotKey = one(m.meal_slots)?.key;
    if (!slotKey) continue;
    const items: LoggedItem[] = (m.diet_log_items ?? [])
      .slice()
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((it) => ({
        id: it.id,
        foodKey: one(it.food_catalog)?.key ?? null,
        customName: it.custom_name ?? undefined,
        customUnit: it.custom_unit ?? undefined,
        customNotes: it.custom_notes ?? undefined,
        count: Number(it.count),
      }));
    meals[slotKey] = { skipped: m.skipped, items };
  }
  return meals;
}
