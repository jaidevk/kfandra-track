import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "./env";
import type { Database } from "./database.types";

/**
 * Server (Server Component / Route Handler / Server Action) Supabase
 * client, wired to Next.js cookies so auth sessions persist. Uses the
 * public anon key + RLS — privileged operations must use the admin client.
 */
export async function createClient() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // setAll called from a Server Component — safe to ignore when
          // session refresh is handled by middleware.
        }
      },
    },
  });
}
