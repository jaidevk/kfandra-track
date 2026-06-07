import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv, getServiceRoleKey } from "./env";

/**
 * Server-only admin client using the service-role key. Bypasses RLS, so
 * it is required for our custom phone + 4-digit PIN auth (verifying PINs,
 * provisioning player rows) and any privileged server operation.
 *
 * NEVER import this into a Client Component — the `server-only` guard above
 * makes such an import a build-time error.
 */
export function createAdminClient() {
  const { url } = getSupabaseEnv();
  return createSupabaseClient(url, getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
