import { describe, it, expect } from "vitest";
import { isStaffRole, isEditorRole } from "./roles";

describe("role predicates", () => {
  it("treats super_admin, coach, admin as staff; user is not", () => {
    expect(isStaffRole("super_admin")).toBe(true);
    expect(isStaffRole("coach")).toBe(true);
    expect(isStaffRole("admin")).toBe(true);
    expect(isStaffRole("user")).toBe(false);
  });

  it("treats the same staff set as editors (admins included, per decision)", () => {
    expect(isEditorRole("super_admin")).toBe(true);
    expect(isEditorRole("coach")).toBe(true);
    expect(isEditorRole("admin")).toBe(true);
    expect(isEditorRole("user")).toBe(false);
  });
});
