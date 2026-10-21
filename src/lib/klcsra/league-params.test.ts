import { describe, it, expect } from "vitest";
import { defaultSeasonId, leagueHref, newestFirstSeasons, parseLeagueParams } from "./league-params";
import { DEFAULT_TABLE_GROUPS as G } from "./table-groups";
import type { Season } from "./types";

const s = (id: string, seasonNo: number, status: Season["status"]): Season => ({
  id, seasonNo, name: `S${seasonNo}`, startDate: "2026-01-01", endDate: null, status,
});

describe("defaultSeasonId", () => {
  it("prefers active, then the newest closed, else null", () => {
    expect(defaultSeasonId([s("1", 1, "closed"), s("2", 2, "active")])).toBe("2");
    expect(defaultSeasonId([s("1", 1, "closed"), s("2", 2, "closed"), s("3", 3, "upcoming")])).toBe("2");
    expect(defaultSeasonId([s("3", 3, "upcoming")])).toBeNull();
  });
});

describe("parseLeagueParams", () => {
  const seasons = [s("1", 1, "closed"), s("2", 2, "active")];
  it("defaults everything", () => {
    expect(parseLeagueParams({}, seasons, G)).toEqual({ tab: "table", seasonId: "2", group: "all" });
  });
  it("accepts valid values", () => {
    expect(parseLeagueParams({ tab: "leaders", season: "1", group: "rugby_sox" }, seasons, G))
      .toEqual({ tab: "leaders", seasonId: "1", group: "rugby_sox" });
  });
  it("falls back on unknown values and takes the first of repeated params", () => {
    expect(parseLeagueParams({ tab: "nope", season: "zzz", group: ["x", "y"] }, seasons, G))
      .toEqual({ tab: "table", seasonId: "2", group: "all" });
  });
});

describe("leagueHref", () => {
  it("builds a URL with a patch applied", () => {
    expect(leagueHref({ tab: "table", seasonId: "2", group: "all" }, { group: "rugby_sox" }))
      .toBe("/klc/league?tab=table&season=2&group=rugby_sox");
    expect(leagueHref({ tab: "table", seasonId: null, group: "all" }, { tab: "scoring" }))
      .toBe("/klc/league?tab=scoring&group=all");
  });
});

describe("newestFirstSeasons", () => {
  it("sorts by season number, highest first, without mutating the input", () => {
    const input = [s("1", 1, "closed"), s("3", 3, "upcoming"), s("2", 2, "active")];
    expect(newestFirstSeasons(input).map((x) => x.id)).toEqual(["3", "2", "1"]);
    expect(input.map((x) => x.id)).toEqual(["1", "3", "2"]);
  });
  it("defaultSeasonId takes the newest closed even when the list is unsorted", () => {
    expect(defaultSeasonId([s("2", 2, "closed"), s("1", 1, "closed"), s("3", 3, "closed")])).toBe("3");
  });
});
