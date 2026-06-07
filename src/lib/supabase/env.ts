/**
 * Centralised, validated access to Supabase environment variables.
 * Throwing here (rather than letting `undefined` flow into the client)
 * gives a clear, early failure when env wiring is missing.
 */

export type SupabasePublicEnv = {
  url: string;
  anonKey: string;
};

export function getSupabaseEnv(): SupabasePublicEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error("Missing env NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) throw new Error("Missing env NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return { url, anonKey };
}

/**
 * Server-only. The service-role key bypasses RLS, so it must never be
 * imported into a Client Component or exposed to the browser.
 */
export function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing env SUPABASE_SERVICE_ROLE_KEY");
  return key;
}
