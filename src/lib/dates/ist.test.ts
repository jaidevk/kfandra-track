import { describe, expect, it } from "vitest";
import { istTodayKey } from "./ist";

describe("istTodayKey", () => {
  it("formats as YYYY-MM-DD", () => {
    expect(istTodayKey(new Date("2026-06-08T06:00:00Z"))).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });

  it("is anchored to IST, not the UTC instant", () => {
    // 2026-06-07 20:00 UTC is already 2026-06-08 01:30 in IST (+5:30).
    // A naive UTC reading would wrongly say the 7th.
    expect(istTodayKey(new Date("2026-06-07T20:00:00Z"))).toBe("2026-06-08");
  });

  it("does not roll the day forward too early", () => {
    // 2026-06-07 18:00 UTC is 2026-06-07 23:30 IST — still the 7th.
    expect(istTodayKey(new Date("2026-06-07T18:00:00Z"))).toBe("2026-06-07");
  });

  it("rolls at IST midnight (18:30 UTC)", () => {
    expect(istTodayKey(new Date("2026-06-07T18:29:00Z"))).toBe("2026-06-07");
    expect(istTodayKey(new Date("2026-06-07T18:30:00Z"))).toBe("2026-06-08");
  });

  it("handles month and year boundaries in IST", () => {
    // 2025-12-31 19:00 UTC -> 2026-01-01 00:30 IST.
    expect(istTodayKey(new Date("2025-12-31T19:00:00Z"))).toBe("2026-01-01");
  });
});
