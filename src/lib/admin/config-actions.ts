"use server";
import { requireEditor } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { validatePoints, validateGameTypeName } from "./config-validate";

type Result = { ok: true } | { ok: false; error: string };

/** Update a point rule's value (editor-gated). */
export async function updatePointRulePoints(id: string, points: number): Promise<Result> {
  try {
    await requireEditor();
    const err = validatePoints(points);
    if (err) return { ok: false, error: err };
    const admin = createAdminClient();
    const { error } = await admin
      .from("point_rules")
      .update({ points, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}

/** Rename a game type (editor-gated). */
export async function updateGameTypeName(id: string, name: string): Promise<Result> {
  try {
    await requireEditor();
    const err = validateGameTypeName(name);
    if (err) return { ok: false, error: err };
    const admin = createAdminClient();
    const { error } = await admin
      .from("game_types")
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed." };
  }
}
