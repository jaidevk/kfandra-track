import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";
import type { Database } from "./database.types";

/**
 * Browser (Client Component) Supabase client. Safe to use anywhere the
 * `'use client'` boundary applies. Uses the public anon key + RLS.
 */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
