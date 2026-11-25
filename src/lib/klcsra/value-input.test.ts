import { describe, it, expect } from "vitest";
import { parseAmount, parseKlcName, parseNote } from "./value-input";

describe("parseAmount", () => {
  it("accepts numbers with up to 2 decimals, commas allowed", () => {
    expect(parseAmount("1,250.5")).toBe(1250.5);
    expect(parseAmount(" -20 ")).toBe(-20);
    expect(parseAmount("0")).toBe(0);
  });
  it("rejects blanks, junk, 3 decimals and huge numbers", () => {
    for (const s of ["", "abc", "1.234", "1e5", "100000000"]) expect(parseAmount(s)).toBeNull();
  });
});

describe("parseKlcName", () => {
  it("trims, empties to null, and caps at 60 characters", () => {
    expect(parseKlcName("  Patrick O. ")).toEqual({ ok: true, value: "Patrick O." });
    expect(parseKlcName("   ")).toEqual({ ok: true, value: null });
    expect(parseKlcName("x".repeat(61)).ok).toBe(false);
  });
});

describe("parseNote", () => {
  it("requires 1–200 characters after trimming", () => {
    expect(parseNote(" ill ")).toBe("ill");
    expect(parseNote("  ")).toBeNull();
    expect(parseNote("x".repeat(201))).toBeNull();
  });
});
