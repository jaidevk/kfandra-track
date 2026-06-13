import { describe, it, expect } from "vitest";
import { EDITABLE_PATHS, getByPath, setByPath } from "./string-paths";
import { strings } from "./strings";

describe("string paths", () => {
  it("every editable path resolves to a string in defaults", () => {
    expect(EDITABLE_PATHS.length).toBeGreaterThan(0);
    for (const p of EDITABLE_PATHS) {
      expect(typeof getByPath(strings, p)).toBe("string");
    }
  });

  it("includes a known nested path", () => {
    expect(EDITABLE_PATHS).toContain("home.mmg.title");
    expect(EDITABLE_PATHS).toContain("admin.submissionsCard.title");
  });

  it("setByPath returns a deep clone with the path replaced, leaving the original untouched", () => {
    const next = setByPath(strings, "home.mmg.title", "Games");
    expect(getByPath(next, "home.mmg.title")).toBe("Games");
    expect(getByPath(strings, "home.mmg.title")).toBe("MMG"); // original intact
  });
});
