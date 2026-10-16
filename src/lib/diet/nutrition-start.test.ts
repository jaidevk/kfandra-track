import { describe, it, expect } from "vitest";
import { parseStartDate } from "./nutrition-start";

describe("parseStartDate", () => {
  it("accepts a YYYY-MM-DD string", () => expect(parseStartDate("2026-10-16")).toBe("2026-10-16"));
  it("rejects a non-date string", () => expect(parseStartDate("soon")).toBeNull());
  it("rejects an impossible date", () => expect(parseStartDate("2026-02-30")).toBeNull());
  it("rejects null and non-strings", () => {
    expect(parseStartDate(null)).toBeNull();
    expect(parseStartDate(20261016)).toBeNull();
  });
});
