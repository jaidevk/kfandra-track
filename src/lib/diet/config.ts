import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DietCatalog, FoodSection, MealSlotInfo } from "./types";

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
      .select("key, name, emoji, unit, unit_detail, section_label, sort_order")
      .eq("is_active", true)
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

  // Group foods by section_label, keeping first-seen order (rows already sorted).
  const sections: FoodSection[] = [];
  const byLabel = new Map<string, FoodSection>();
  for (const r of foodsRes.data ?? []) {
    let section = byLabel.get(r.section_label);
    if (!section) {
      section = { label: r.section_label, items: [] };
      byLabel.set(r.section_label, section);
      sections.push(section);
    }
    section.items.push({
      key: r.key,
      name: r.name,
      emoji: r.emoji,
      unit: r.unit,
      unitDetail: r.unit_detail,
    });
  }

  return { slots, sections };
}
