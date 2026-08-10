import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseKlcRates, type KlcRates } from "./rates";

export type { KlcRates } from "./rates";
export { DEFAULT_KLC_RATES } from "./rates";

/** Load rates from app_config (key 'klc_rates'); defaults if absent. */
export async function loadKlcRates(): Promise<KlcRates> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_config")
    .select("value")
    .eq("key", "klc_rates")
    .maybeSingle();
  return parseKlcRates(data?.value ?? null);
}
