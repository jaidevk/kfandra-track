import "server-only";
import { redirect } from "next/navigation";
import { getCurrentPlayer, type CurrentPlayer } from "./current-user";
import { isStaffRole, isEditorRole } from "./roles";

/** Require a signed-in staff member; redirect otherwise. Returns the player. */
export async function requireStaff(next = "/admin"): Promise<CurrentPlayer> {
  const player = await getCurrentPlayer();
  if (!player) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!isStaffRole(player.role)) redirect("/");
  return player;
}

/** Require edit rights (for server actions that mutate). Throws if not allowed. */
export async function requireEditor(): Promise<CurrentPlayer> {
  const player = await getCurrentPlayer();
  if (!player || !isEditorRole(player.role)) {
    throw new Error("Not authorized.");
  }
  return player;
}
