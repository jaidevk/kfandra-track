import { describe, it, expect } from "vitest";
import { fmtDate, fmtDay, fmtDayDate } from "./format-date";

describe("fmtDay", () => {
  it("formats weekday, day and short month", () => {
    expect(fmtDay("2026-08-27")).toBe("Thu 27 Aug");
    expect(fmtDay("2026-01-01")).toBe("Thu 1 Jan");
  });
});

describe("fmtDate", () => {
  it("formats day, short month and year", () => {
    expect(fmtDate("2026-08-01")).toBe("1 Aug 2026");
    expect(fmtDate("2026-12-31")).toBe("31 Dec 2026");
  });
  it("ignores a time part and never shifts the day", () => {
    expect(fmtDate("2026-08-01T23:30:00+05:30")).toBe("1 Aug 2026");
  });
});

describe("fmtDayDate", () => {
  it("formats weekday, day, short month and year", () => {
    expect(fmtDayDate("2026-10-01")).toBe("Thu, 1 Oct 2026");
  });
});
