import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type SheetsConfig = { spreadsheetId: string | null; enabled: boolean };

/** Read the Sheets-export settings from app_config. */
export async function getSheetsConfig(): Promise<SheetsConfig> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_config")
    .select("key, value")
    .in("key", ["sheets_export_spreadsheet_id", "sheets_export_enabled"]);
  const map = new Map((data ?? []).map((r) => [r.key, r.value as unknown]));
  const id = map.get("sheets_export_spreadsheet_id");
  return {
    spreadsheetId: typeof id === "string" && id.length > 0 ? id : null,
    enabled: map.get("sheets_export_enabled") === true,
  };
}
