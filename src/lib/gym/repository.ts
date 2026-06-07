import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ExerciseRow, GymDraft, WeightUnit } from "./types";
import { emptyDraft } from "./types";

/**
 * Persistence for a single player's gym log for one day (continuous log). The
 * whole draft is the unit of save: the parent gym_logs row is upserted on
 * (player_id, log_date) and the child exercise rows are replaced wholesale.
 * Keeps autosave idempotent with no per-row diffing.
 */

/** Load a player's gym draft for a day. Returns an empty draft if none. */
export async function loadGymLog(
  playerId: string,
  dateKey: string,
): Promise<GymDraft> {
  const admin = createAdminClient();

  const { data: log } = await admin
    .from("gym_logs")
    .select("id, body_weight, body_weight_unit, narration")
    .eq("player_id", playerId)
    .eq("log_date", dateKey)
    .maybeSingle();

  if (!log) return emptyDraft();

  const { data: exRows } = await admin
    .from("gym_log_exercises")
    .select("id, body_part, equipment, weight, weight_unit, scheme, notes, sort_order")
    .eq("gym_log_id", log.id)
    .order("sort_order", { ascending: true });

  const rows: ExerciseRow[] = (exRows ?? []).map((r) => ({
    id: r.id,
    bodyPart: r.body_part,
    equipment: r.equipment,
    weight: r.weight ?? 0,
    weightUnit: (r.weight_unit as WeightUnit) ?? "kg",
    scheme: r.scheme ?? "",
    notes: r.notes ?? "",
  }));

  return {
    rows,
    bodyWeight: log.body_weight == null ? "" : String(log.body_weight),
    bodyWeightUnit: (log.body_weight_unit as WeightUnit) ?? "kg",
    narration: log.narration ?? "",
  };
}

/**
 * Upsert a player's gym draft for a day. The parent row is upserted on
 * (player_id, log_date); child exercises are deleted and re-inserted.
 */
export async function saveGymLog(
  playerId: string,
  dateKey: string,
  draft: GymDraft,
): Promise<void> {
  const admin = createAdminClient();

  const bodyWeightNum =
    draft.bodyWeight.trim() === "" ? null : Number(draft.bodyWeight);

  const { data: log, error: upsertErr } = await admin
    .from("gym_logs")
    .upsert(
      {
        player_id: playerId,
        log_date: dateKey,
        body_weight:
          bodyWeightNum != null && Number.isFinite(bodyWeightNum)
            ? bodyWeightNum
            : null,
        body_weight_unit: draft.bodyWeightUnit,
        narration: draft.narration.trim() || null,
      },
      { onConflict: "player_id,log_date" },
    )
    .select("id")
    .single();

  if (upsertErr || !log) {
    throw new Error(`Failed to save gym log: ${upsertErr?.message ?? "unknown"}`);
  }

  // Replace children wholesale.
  await admin.from("gym_log_exercises").delete().eq("gym_log_id", log.id);

  const exerciseRows = draft.rows
    .map((r, i) => ({
      gym_log_id: log.id,
      body_part: r.bodyPart,
      equipment: r.equipment,
      weight: r.weight > 0 ? r.weight : null,
      weight_unit: r.weightUnit,
      scheme: r.scheme.trim() || null,
      notes: r.notes.trim() || null,
      sort_order: i,
    }))
    // Skip blank rows (no body part is meaningless to store).
    .filter((r) => r.body_part.length > 0);

  if (exerciseRows.length > 0) {
    const { error: exErr } = await admin
      .from("gym_log_exercises")
      .insert(exerciseRows);
    if (exErr) throw new Error(`Failed to save gym exercises: ${exErr.message}`);
  }
}
