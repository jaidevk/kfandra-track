"use server";
import { requireEditor } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { toFoodPatch, validateFoodEdit, type FoodEditInput } from "@/lib/diet/nutrition-edit";

type Result = { ok: true } | { ok: false; error: string };

/** Save a food's nutrition (editor-gated). Stamps source = 'kfandra' (spec §6.4). */
export async function updateFoodNutrition(id: string, input: FoodEditInput): Promise<Result> {
  try {
    const player = await requireEditor();
    const err = validateFoodEdit(input);
    if (err) return { ok: false, error: err };
    const admin = createAdminClient();
    const { error } = await admin
      .from("food_catalog")
      .update({
        ...toFoodPatch(input),
        nutrition_source: "kfandra",
        nutrition_updated_at: new Date().toISOString(),
        nutrition_updated_by: player.id,
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
