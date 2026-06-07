import { describe, it, expect } from "vitest";
import { normalizePhone, isValidPhone } from "./phone";

describe("normalizePhone", () => {
  it("normalizes a bare 10-digit mobile to E.164", () => {
    expect(normalizePhone("9876543210")).toBe("+919876543210");
  });
  it("accepts +91, 91, and leading-0 prefixes", () => {
    expect(normalizePhone("+919876543210")).toBe("+919876543210");
    expect(normalizePhone("919876543210")).toBe("+919876543210");
    expect(normalizePhone("09876543210")).toBe("+919876543210");
  });
  it("ignores spaces, dashes and parens", () => {
    expect(normalizePhone(" 98765-43210 ")).toBe("+919876543210");
    expect(normalizePhone("+91 98765 43210")).toBe("+919876543210");
  });
  it("rejects numbers that don't start 6-9", () => {
    expect(normalizePhone("1234567890")).toBeNull();
    expect(normalizePhone("5876543210")).toBeNull();
  });
  it("rejects wrong-length input", () => {
    expect(normalizePhone("98765")).toBeNull();
    expect(normalizePhone("98765432101")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("isValidPhone", () => {
  it("mirrors normalizePhone success", () => {
    expect(isValidPhone("9876543210")).toBe(true);
    expect(isValidPhone("12345")).toBe(false);
  });
});
