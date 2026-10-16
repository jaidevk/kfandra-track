import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DietCatalog, FoodItemInfo, FoodSection, MealSlotInfo } from "./types";
import { FOOD_CATALOG_COLUMNS, foodRowToInfo, type FoodCatalogRow } from "./rows";
import { NUTRITION_START_KEY, parseStartDate } from "./nutrition-start";

/**
 * Server-side loader for the admin-editable diet catalogue (meal slots + food
 * list). Lives in the DB so staff can prune/extend without a deploy. Diet
 * logging is unscored — this is purely descriptive reference data.
 *
 * Food items are grouped into sections by section_label, preserving the
 * sort_order in which they were seeded (sections in order, items within).
 */
export async function loadDietCatalog(): Promise<DietCatalog> {
  const admin = createAdminClient();

  const [slotsRes, foodsRes] = await Promise.all([
    admin
      .from("meal_slots")
      .select("key, name, window_label, emoji, start_min, end_min, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    admin
      .from("food_catalog")
      .select(FOOD_CATALOG_COLUMNS)
      .order("sort_order", { ascending: true }),
  ]);

  const slots: MealSlotInfo[] = (slotsRes.data ?? []).map((r) => ({
    key: r.key,
    name: r.name,
    windowLabel: r.window_label,
    emoji: r.emoji,
    startMin: r.start_min,
    endMin: r.end_min,
  }));

  // Active foods become tiles, grouped by section in first-seen order. Inactive
  // foods are kept only for the lookup, so past logs still total (spec §10.1).
  const sections: FoodSection[] = [];
  const byLabel = new Map<string, FoodSection>();
  const inactive: FoodItemInfo[] = [];
  for (const r of foodsRes.data ?? []) {
    const info = foodRowToInfo(r as FoodCatalogRow);
    if (!r.is_active) {
      inactive.push(info);
      continue;
    }
    let section = byLabel.get(r.section_label);
    if (!section) {
      section = { label: r.section_label, items: [] };
      byLabel.set(r.section_label, section);
      sections.push(section);
    }
    section.items.push(info);
  }

  return { slots, sections, inactive };
}

/** The IST date nutrition counts from, or null when unset/invalid (D12). */
export async function loadNutritionStartDate(): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_config")
    .select("value")
    .eq("key", NUTRITION_START_KEY)
    .maybeSingle();
  return parseStartDate(data?.value ?? null);
}
