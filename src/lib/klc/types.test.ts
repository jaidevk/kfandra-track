import { describe, it, expect } from "vitest";
import { emptyBalanceDraft } from "./types";

describe("emptyBalanceDraft", () => {
  it("zeroes all fields and starts with no loanee rows", () => {
    expect(emptyBalanceDraft()).toEqual({
      asOfDate: null,
      matchesPlayed: 0,
      matchesWon: 0,
      matchesDrawn: 0,
      matchesLost: 0,
      clubBonus: 0,
      shares: [],
    });
  });
});
