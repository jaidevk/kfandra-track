import { describe, it, expect } from "vitest";
import { validatePoints, validateGameTypeName } from "./config-validate";

describe("validatePoints", () => {
  it("accepts whole numbers including negatives (penalties)", () => {
    expect(validatePoints(500)).toBeNull();
    expect(validatePoints(-200)).toBeNull();
    expect(validatePoints(0)).toBeNull();
  });
  it("rejects non-integers and out-of-range values", () => {
    expect(validatePoints(1.5)).toMatch(/whole number/);
    expect(validatePoints(NaN)).toMatch(/whole number/);
    expect(validatePoints(999999)).toMatch(/range/);
  });
});

describe("validateGameTypeName", () => {
  it("accepts a trimmed non-empty name", () => {
    expect(validateGameTypeName("Football short")).toBeNull();
  });
  it("rejects empty / whitespace / overly long names", () => {
    expect(validateGameTypeName("   ")).toMatch(/empty/);
    expect(validateGameTypeName("x".repeat(61))).toMatch(/too long/);
  });
});
