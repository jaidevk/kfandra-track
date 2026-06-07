import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { readSession } from "./cookie";

export type CurrentPlayer = {
  id: string;
  phone: string;
  displayName: string;
  role: "super_admin" | "coach" | "admin" | "user";
};

/**
 * Resolve the signed-in player from the session cookie, re-reading the live
 * row so role changes / deactivation take effect without forcing a re-login.
 * Returns null when there is no valid session or the player is inactive.
 */
export async function getCurrentPlayer(): Promise<CurrentPlayer | null> {
  const session = await readSession();
  if (!session) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("players")
    .select("id, phone, display_name, role, is_active")
    .eq("id", session.playerId)
    .maybeSingle();

  if (error || !data || !data.is_active) return null;

  return {
    id: data.id,
    phone: data.phone,
    displayName: data.display_name,
    role: data.role,
  };
}
