import { describe, it, expect } from "vitest";
import { monthTabTitle, sessionColumnLabel, buildSheetMatrix } from "./layout";

describe("monthTabTitle", () => {
  it("formats month + year", () => {
    expect(monthTabTitle(2026, 6)).toBe("Jun 2026");
    expect(monthTabTitle(2026, 1)).toBe("Jan 2026");
  });
});

describe("sessionColumnLabel", () => {
  it("formats a date as weekday + d/m", () => {
    expect(sessionColumnLabel("2026-06-02")).toBe("Tue 2/6");
    expect(sessionColumnLabel("2026-06-13")).toBe("Sat 13/6");
  });
});

describe("buildSheetMatrix", () => {
  const sessions = [
    { id: "s2", date: "2026-06-04" },
    { id: "s1", date: "2026-06-02" }, // out of order on purpose
  ];
  const players = [
    { id: "a", displayName: "Abe" },
    { id: "b", displayName: "Baz" },
  ];
  const totals = {
    s1: { a: 1500, b: 300 },
    s2: { a: 1000 },
  };

  it("lays out a header + a row per player, chronological columns, with a TOTAL", () => {
    const m = buildSheetMatrix(sessions, players, totals);
    expect(m[0]).toEqual(["", "PLAYERS", "Tue 2/6", "Thu 4/6", "TOTAL"]);
    // Abe: 1500 (2/6) + 1000 (4/6) = 2500
    expect(m[1]).toEqual([1, "Abe", 1500, 1000, 2500]);
    // Baz: 300 (2/6) + 0 (4/6) = 300
    expect(m[2]).toEqual([2, "Baz", 300, 0, 300]);
  });
});
