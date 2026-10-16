import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isVerdict } from "@/lib/diet/rows";
import type { Per100Row } from "@/lib/diet/nutrition-edit";
import type { Verdict } from "@/lib/diet/types";

export type FoodEditRow = Per100Row & {
  id: string;
  key: string;
  name: string;
  emoji: string | null;
  unit: string;
  unitDetail: string | null;
  section: string;
  isActive: boolean;
  verdict: Verdict | null;
  note: string | null;
  source: string | null;
  updatedAt: string | null;
};

export async function listFoodsForEdit(): Promise<FoodEditRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("food_catalog")
    .select(
      "id, key, name, emoji, unit, unit_detail, section_label, is_active, grams_per_unit, kcal_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, sodium_mg_per_100g, verdict, nutrition_note, nutrition_source, nutrition_updated_at",
    )
    .order("sort_order");
  return (data ?? []).map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    emoji: r.emoji,
    unit: r.unit,
    unitDetail: r.unit_detail,
    section: r.section_label,
    isActive: r.is_active,
    grams_per_unit: r.grams_per_unit,
    kcal_per_100g: r.kcal_per_100g,
    protein_g_per_100g: r.protein_g_per_100g,
    carbs_g_per_100g: r.carbs_g_per_100g,
    fat_g_per_100g: r.fat_g_per_100g,
    sodium_mg_per_100g: r.sodium_mg_per_100g,
    verdict: isVerdict(r.verdict) ? r.verdict : null,
    note: r.nutrition_note,
    source: r.nutrition_source,
    updatedAt: r.nutrition_updated_at,
  }));
}
