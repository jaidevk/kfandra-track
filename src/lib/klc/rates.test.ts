import { describe, it, expect } from "vitest";
import { parseKlcRates, DEFAULT_KLC_RATES } from "./rates";

describe("parseKlcRates", () => {
  it("reads valid values", () => {
    expect(parseKlcRates({ playedToKfandra: 10, wonFromKfandra: 20, loaneePerShare: 10 }))
      .toEqual({ playedToKfandra: 10, wonFromKfandra: 20, loaneePerShare: 10 });
  });

  it("falls back to defaults for missing or non-numeric fields", () => {
    expect(parseKlcRates(null)).toEqual(DEFAULT_KLC_RATES);
    expect(parseKlcRates({ playedToKfandra: "x", wonFromKfandra: 5 }))
      .toEqual({ ...DEFAULT_KLC_RATES, wonFromKfandra: 5 });
  });
});
