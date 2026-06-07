import { describe, it, expect } from "vitest";
import { hashPin, verifyPin, isValidPin } from "./pin";

describe("isValidPin", () => {
  it("accepts exactly four digits", () => {
    expect(isValidPin("0000")).toBe(true);
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("9999")).toBe(true);
  });
  it("rejects wrong length or non-digits", () => {
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("12345")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
    expect(isValidPin("")).toBe(false);
    expect(isValidPin(" 123")).toBe(false);
  });
});

describe("hashPin", () => {
  it("produces a self-describing scrypt string", async () => {
    const h = await hashPin("1234");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(h.split("$")).toHaveLength(6);
  });
  it("uses a random salt (two hashes of the same PIN differ)", async () => {
    const a = await hashPin("1234");
    const b = await hashPin("1234");
    expect(a).not.toBe(b);
  });
  it("rejects an invalid PIN", async () => {
    await expect(hashPin("12")).rejects.toThrow(/4 digits/);
  });
});

describe("verifyPin", () => {
  it("verifies the correct PIN", async () => {
    const h = await hashPin("4821");
    expect(await verifyPin("4821", h)).toBe(true);
  });
  it("rejects the wrong PIN", async () => {
    const h = await hashPin("4821");
    expect(await verifyPin("4820", h)).toBe(false);
  });
  it("returns false (no throw) for an invalid PIN input", async () => {
    const h = await hashPin("4821");
    expect(await verifyPin("abcd", h)).toBe(false);
  });
  it("returns false for a malformed stored hash", async () => {
    expect(await verifyPin("1234", "not-a-hash")).toBe(false);
    expect(await verifyPin("1234", "scrypt$bad")).toBe(false);
    expect(await verifyPin("1234", "")).toBe(false);
  });
});
