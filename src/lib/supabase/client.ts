import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

/**
 * Browser (Client Component) Supabase client. Safe to use anywhere the
 * `'use client'` boundary applies. Uses the public anon key + RLS.
 */
export function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
