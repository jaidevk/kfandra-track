import { describe, it, expect } from "vitest";
import { selectEvicteeId, MAX_PERSONAL_FOODS } from "./personal-foods";

const row = (id: string, useCount: number, lastUsedAt: string) => ({
  id,
  useCount,
  lastUsedAt,
});

function nRows(n: number) {
  return Array.from({ length: n }, (_, i) =>
    row(`id${i}`, 5, "2026-06-29T00:00:00Z"),
  );
}

describe("selectEvicteeId", () => {
  it("returns null when at or under the cap", () => {
    expect(selectEvicteeId(nRows(MAX_PERSONAL_FOODS))).toBeNull();
  });

  it("evicts the lowest use_count when over the cap", () => {
    const rows = [
      ...nRows(MAX_PERSONAL_FOODS),
      row("victim", 1, "2026-06-29T10:00:00Z"),
    ];
    expect(selectEvicteeId(rows)).toBe("victim");
  });

  it("breaks use_count ties by oldest last_used_at", () => {
    const rows = [
      ...nRows(MAX_PERSONAL_FOODS - 1),
      row("newer", 1, "2026-06-29T10:00:00Z"),
      row("older", 1, "2026-06-01T10:00:00Z"),
    ];
    expect(selectEvicteeId(rows)).toBe("older");
  });
});
