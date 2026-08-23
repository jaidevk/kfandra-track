import { describe, it, expect } from "vitest";
import {
  DEFAULT_STAT_RATES,
  STAT_KEYS,
  STAT_LABELS,
  parseStatRates,
} from "./stat-rates";

describe("DEFAULT_STAT_RATES", () => {
  it("has all 16 stats with the agreed KR/MMG values", () => {
    expect(STAT_KEYS).toHaveLength(16);
    expect(DEFAULT_STAT_RATES.goal).toEqual({ kr: 20, mmg: 500 });
    expect(DEFAULT_STAT_RATES.try).toEqual({ kr: 25, mmg: 500 });
    expect(DEFAULT_STAT_RATES.save).toEqual({ kr: 5, mmg: 200 });
    expect(DEFAULT_STAT_RATES.blueCard).toEqual({ kr: -30, mmg: -1000 });
    expect(DEFAULT_STAT_RATES.ownPreAssist).toEqual({ kr: -5, mmg: -100 });
  });

  it("has the three Fooba stats", () => {
    expect(DEFAULT_STAT_RATES.mainGoal).toEqual({ kr: 20, mmg: 500 });
    expect(DEFAULT_STAT_RATES.reboundGoal).toEqual({ kr: 10, mmg: 300 });
    expect(DEFAULT_STAT_RATES.switchover).toEqual({ kr: 5, mmg: 100 });
  });

  it("labels every key", () => {
    for (const key of STAT_KEYS) {
      expect(STAT_LABELS[key]).toBeTruthy();
    }
    expect(STAT_LABELS.mainGoal).toBe("Main Goal");
    expect(STAT_LABELS.reboundGoal).toBe("Rebound Goal");
    expect(STAT_LABELS.switchover).toBe("Switchover");
  });
});

describe("parseStatRates", () => {
  it("returns defaults for null/garbage input", () => {
    expect(parseStatRates(null)).toEqual(DEFAULT_STAT_RATES);
    expect(parseStatRates("nope")).toEqual(DEFAULT_STAT_RATES);
  });

  it("overrides only the provided stats, keeping defaults for the rest", () => {
    const r = parseStatRates({ goal: { kr: 99, mmg: 1000 } });
    expect(r.goal).toEqual({ kr: 99, mmg: 1000 });
    expect(r.assist).toEqual({ kr: 10, mmg: 200 }); // untouched default
  });

  it("ignores non-numeric fields and falls back per field", () => {
    const r = parseStatRates({ goal: { kr: "x", mmg: 700 } });
    expect(r.goal).toEqual({ kr: 20, mmg: 700 }); // kr falls back, mmg kept
  });
});
