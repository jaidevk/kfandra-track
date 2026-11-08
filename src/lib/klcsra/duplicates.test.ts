import { describe, it, expect } from "vitest";
import { asCandidate, findDuplicates, sideClubsOf, type DuplicateCandidate } from "./duplicates";

const cand = (id: string, sideClubs: DuplicateCandidate["sideClubs"], entryDate = "2026-11-08"): DuplicateCandidate => ({
  id, entryDate, status: "draft", isFriendly: false, homeSentAt: null, awaySentAt: null,
  sideClubs, homeLabel: "H", awayLabel: "A",
});
const target = (home: string, away: string, id: string | null = null) => ({
  id, entryDate: "2026-11-08",
  sideClubs: [{ side: "home" as const, clubId: home }, { side: "away" as const, clubId: away }],
});

describe("findDuplicates", () => {
  it("finds the same pair on the same date, either way round", () => {
    const same = cand("m1", [{ side: "home", clubId: "A" }, { side: "away", clubId: "B" }]);
    const reversed = cand("m2", [{ side: "home", clubId: "B" }, { side: "away", clubId: "A" }]);
    expect(findDuplicates(target("A", "B"), [same, reversed]).map((d) => d.id)).toEqual(["m1", "m2"]);
  });

  it("a club of a combined pair counts", () => {
    const combined = cand("m1", [
      { side: "home", clubId: "A" }, { side: "away", clubId: "B" },
      { side: "home", clubId: "C" }, { side: "away", clubId: "D" },
    ]);
    expect(findDuplicates(target("C", "B"), [combined])).toHaveLength(1);
  });

  it("ignores another date, the match itself, and clubs on the same side", () => {
    const otherDay = cand("m1", [{ side: "home", clubId: "A" }, { side: "away", clubId: "B" }], "2026-11-09");
    const itself = cand("m2", [{ side: "home", clubId: "A" }, { side: "away", clubId: "B" }]);
    const sameSide = cand("m3", [{ side: "home", clubId: "A" }, { side: "home", clubId: "B" }]);
    expect(findDuplicates(target("A", "B", "m2"), [otherDay, itself, sameSide])).toEqual([]);
  });

  it("needs a club on both sides of the target", () => {
    const m = cand("m1", [{ side: "home", clubId: "A" }, { side: "away", clubId: "B" }]);
    expect(findDuplicates({ id: null, entryDate: "2026-11-08", sideClubs: [{ side: "home", clubId: "A" }] }, [m])).toEqual([]);
  });
});

describe("sideClubsOf", () => {
  it("lists every (side, club) with a club", () => {
    expect(sideClubsOf([{ sides: [{ side: "home", clubId: "A" }, { side: "away", clubId: null }] }]))
      .toEqual([{ side: "home", clubId: "A" }]);
  });
});

describe("asCandidate", () => {
  it("keeps only what the warning shows (no score line)", () => {
    const c = cand("m1", [{ side: "home", clubId: "A" }]);
    expect(asCandidate({ ...c, sport: "fooba", scoreLine: "3 - 1", clubIds: ["A"] } as never)).toEqual(c);
  });
});
