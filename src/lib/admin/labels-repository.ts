import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** All overrides as a {key: value} map. */
export async function loadLabelOverrides(): Promise<Record<string, string>> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("label_overrides").select("key, value");
  if (error || !data) return {};
  return Object.fromEntries(data.map((r) => [r.key, r.value]));
}

export async function upsertLabelOverride(
  key: string,
  value: string,
  updatedBy: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("label_overrides")
    .upsert({ key, value, updated_by: updatedBy, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function deleteLabelOverride(key: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("label_overrides").delete().eq("key", key);
  if (error) throw new Error(error.message);
}
