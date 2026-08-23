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

  it("clears noise on negative sums too", () => {
    expect(round4(-0.2 - 0.1)).toBe(-0.3);
  });

  it("returns -0 for a magnitude below the fourth decimal (documented)", () => {
    // Object.is(-0, 0) is false, so a downstream `toBe(0)` would fail. Not
    // reachable with the default rules (every negative is -1 or larger), but
    // pinned here so the next person meets it in this test rather than in a
    // confusing failure elsewhere.
    expect(Object.is(round4(-0.00001), -0)).toBe(true);
  });
});
