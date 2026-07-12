import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import type {
  EntryType,
  ExerciseRow,
  GymDraft,
  TestMetric,
  WeightUnit,
} from "./types";
import { emptyDraft } from "./types";
import { buildSchemeSummary } from "./summary";

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
    .select(
      "id, entry_type, body_part, equipment, weight, weight_unit, test_name, test_metric, scheme, sets, notes, sort_order",
    )
    .eq("gym_log_id", log.id)
    .order("sort_order", { ascending: true });

  const rows: ExerciseRow[] = (exRows ?? []).map((r) => {
    const entryType = (r.entry_type as EntryType) ?? "exercise";
    const weightUnit = (r.weight_unit as WeightUnit) ?? "kg";
    // For tests the `sets` jsonb holds attempts ({mins,seconds,reps}); for
    // exercises it holds sets ({reps,weight}).
    const raw = Array.isArray(r.sets) ? (r.sets as Array<Record<string, unknown>>) : [];

    if (entryType === "test") {
      return {
        id: r.id,
        entryType: "test",
        bodyPart: r.body_part,
        equipment: null,
        weightUnit,
        sets: [],
        testName: r.test_name ?? null,
        testMetric: (r.test_metric as TestMetric | null) ?? "reps",
        attempts: raw.map((a) => ({
          mins: typeof a.mins === "number" ? a.mins : 0,
          seconds: typeof a.seconds === "number" ? a.seconds : 0,
          reps: typeof a.reps === "number" ? a.reps : 0,
        })),
        scheme: r.scheme ?? "",
        notes: r.notes ?? "",
      };
    }

    return {
      id: r.id,
      entryType: "exercise",
      bodyPart: r.body_part,
      equipment: r.equipment,
      weightUnit,
      sets: raw.map((s) => ({
        reps: typeof s.reps === "number" ? s.reps : 0,
        weight: typeof s.weight === "number" ? s.weight : 0,
      })),
      testName: null,
      testMetric: null,
      attempts: [],
      // Legacy rows (no sets yet) keep their old scheme text for display.
      scheme: r.scheme ?? "",
      notes: r.notes ?? "",
    };
  });

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
    // Skip rows with nothing performed: an exercise needs a body part + a set;
    // a test needs a selected test + an attempt.
    .filter((r) =>
      r.entryType === "test"
        ? (r.testName?.length ?? 0) > 0 && r.attempts.length > 0
        : r.bodyPart.length > 0 && r.sets.length > 0,
    )
    .map((r, i) => ({
      gym_log_id: log.id,
      entry_type: r.entryType,
      body_part: r.bodyPart,
      equipment: r.entryType === "test" ? null : r.equipment,
      // Per-exercise weight is superseded by per-set weights; left null.
      weight: null,
      weight_unit: r.weightUnit,
      test_name: r.entryType === "test" ? r.testName : null,
      test_metric: r.entryType === "test" ? r.testMetric : null,
      scheme: buildSchemeSummary(r) || null,
      // `sets` jsonb carries attempts for tests, sets for exercises.
      sets: (r.entryType === "test" ? r.attempts : r.sets) as unknown as Json,
      notes: r.notes.trim() || null,
      sort_order: i,
    }));

  if (exerciseRows.length > 0) {
    const { error: exErr } = await admin
      .from("gym_log_exercises")
      .insert(exerciseRows);
    if (exErr) throw new Error(`Failed to save gym exercises: ${exErr.message}`);
  }
}
