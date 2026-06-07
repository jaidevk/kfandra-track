import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server-side loader for the admin-editable gym catalogue (body parts,
 * equipment, preset schemes). Lives in the DB so it can be tuned without a
 * deploy. Gym logging is unscored — this is purely descriptive reference data.
 */

export interface BodyPartOption {
  value: string;
  icon: string | null;
}

export interface EquipmentOption {
  value: string;
  supportsWeight: boolean;
}

export interface GymCatalog {
  bodyParts: BodyPartOption[];
  equipment: EquipmentOption[];
  schemes: string[];
}

export async function loadGymCatalog(): Promise<GymCatalog> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("gym_catalog")
    .select("kind, value, icon, supports_weight, sort_order")
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
  };
}
