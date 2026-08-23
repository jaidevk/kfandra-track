import { describe, it, expect } from "vitest";
import { round4 } from "./round";

describe("round4", () => {
  it("clears binary-float noise", () => {
    expect(round4(0.2 + 0.1)).toBe(0.3);
    expect(round4(0.05 + 0.05)).toBe(0.1);
  });

  it("leaves clean numbers alone", () => {
    expect(round4(3)).toBe(3);
    expect(round4(-1)).toBe(-1);
    expect(round4(0)).toBe(0);
  });

  it("keeps four decimal places", () => {
    expect(round4(0.12345)).toBe(0.1235);
  });
});
