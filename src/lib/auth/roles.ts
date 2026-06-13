import type { CurrentPlayer } from "./current-user";

export type Role = CurrentPlayer["role"];

const STAFF: ReadonlySet<Role> = new Set(["super_admin", "coach", "admin"]);

/** Can view the admin section. */
export function isStaffRole(role: Role): boolean {
  return STAFF.has(role);
}

/**
 * Can perform admin edits. Currently identical to staff (admins included),
 * kept separate so the edit set can be tightened later without touching callers.
 */
export function isEditorRole(role: Role): boolean {
  return STAFF.has(role);
}
