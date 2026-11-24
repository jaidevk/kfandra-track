import { describe, it, expect } from "vitest";
import { seasonForDate } from "./season-status";
import type { Season } from "./types";

const s = (no: number, start: string, end: string | null, status: Season["status"]): Season => ({
  id: `s${no}`, seasonNo: no, name: `S${no}`, startDate: start, endDate: end, status,
});
const S1 = s(1, "2026-04-01", "2026-09-30", "closed");
const S2 = s(2, "2026-11-01", null, "active");

describe("seasonForDate", () => {
  it("finds the season whose window holds the date, ends inclusive", () => {
    expect(seasonForDate([S1, S2], "2026-04-01")?.id).toBe("s1");
    expect(seasonForDate([S1, S2], "2026-09-30")?.id).toBe("s1");
    expect(seasonForDate([S1, S2], "2026-12-25")?.id).toBe("s2");
  });
  it("is null between seasons and before the first", () => {
    expect(seasonForDate([S1, S2], "2026-10-15")).toBeNull();
    expect(seasonForDate([S1, S2], "2026-01-01")).toBeNull();
  });
  it("an open-ended season runs on for ever", () => {
    expect(seasonForDate([S2], "2030-01-01")?.id).toBe("s2");
  });
});
