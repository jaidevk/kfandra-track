import { describe, it, expect } from "vitest";
import { shiftDateKey } from "./dates";

describe("shiftDateKey", () => {
  it("moves within a month", () => expect(shiftDateKey("2026-10-16", -6)).toBe("2026-10-10"));
  it("crosses a month", () => expect(shiftDateKey("2026-10-02", -3)).toBe("2026-09-29"));
  it("crosses a year forwards", () => expect(shiftDateKey("2026-12-29", 7)).toBe("2027-01-05"));
});
