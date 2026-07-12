import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TestMetric } from "./types";

/**
 * Server-side loader for the admin-editable gym catalogue (body parts,
 * equipment, preset schemes, S&C tests). Lives in the DB so it can be tuned
 * without a deploy. Gym logging is unscored — this is purely descriptive
 * reference data.
 */

export interface BodyPartOption {
  value: string;
  icon: string | null;
}

export interface EquipmentOption {
  value: string;
  supportsWeight: boolean;
}

export interface TestOption {
  value: string;
  /** Spelled-out name shown under the (often acronym) label; null hides it. */
  fullName: string | null;
  icon: string | null;
  /** Drives the entry sheet: `time` → TIME TAKEN, `reps` → REPS. */
  metric: TestMetric;
}

export interface GymCatalog {
  bodyParts: BodyPartOption[];
  equipment: EquipmentOption[];
  schemes: string[];
  tests: TestOption[];
}

export async function loadGymCatalog(): Promise<GymCatalog> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("gym_catalog")
    .select("kind, value, icon, supports_weight, metric, full_name, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const rows = data ?? [];

  return {
    bodyParts: rows
      .filter((r) => r.kind === "body_part")
      .map((r) => ({ value: r.value, icon: r.icon })),
    equipment: rows
      .filter((r) => r.kind === "equipment")
      .map((r) => ({ value: r.value, supportsWeight: r.supports_weight })),
    schemes: rows.filter((r) => r.kind === "scheme").map((r) => r.value),
    tests: rows
      .filter((r) => r.kind === "test")
      .map((r) => ({
        value: r.value,
        fullName: r.full_name,
        icon: r.icon,
        // Non-test rows have null metric; test rows always carry one. Default
        // to 'reps' defensively so a mis-seeded row still renders.
        metric: (r.metric as TestMetric | null) ?? "reps",
      })),
  };
}
