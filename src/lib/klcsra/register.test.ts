import { describe, it, expect } from "vitest";
import { buildRegister, playersWithoutClub } from "./register";

const clubs = [
  { id: "c2", name: "Bravo", sortOrder: 2, managerPlayerId: "p1" },
  { id: "c1", name: "Alpha", sortOrder: 1, managerPlayerId: "p2" },
  { id: "c3", name: "Charlie", sortOrder: 3, managerPlayerId: "p1" },
];
const players = [
  { id: "p1", displayName: "Pat", klcName: "Patrick" },
  { id: "p2", displayName: "Sam", klcName: null },
];

describe("buildRegister", () => {
  it("has one row per manager, in club order, with base values", () => {
    const r = buildRegister(clubs, players, [{ playerId: "p2", baseValue: 150 }]);
    expect(r.map((x) => [x.playerId, x.clubName, x.baseValue])).toEqual([
      ["p2", "Alpha", 150],
      ["p1", "Bravo", null],
    ]);
  });

  it("uses the lowest sort_order club for a manager of two clubs and flags it", () => {
    const r = buildRegister(clubs, players, []);
    const pat = r.find((x) => x.playerId === "p1")!;
    expect(pat.clubId).toBe("c2");
    expect(pat.manyClubs).toBe(true);
    expect(r.find((x) => x.playerId === "p2")!.manyClubs).toBe(false);
  });

  it("skips a club whose manager isn't a known player", () => {
    const r = buildRegister([{ id: "c9", name: "Ghost", sortOrder: 0, managerPlayerId: "zz" }], players, []);
    expect(r).toEqual([]);
  });
});

describe("playersWithoutClub", () => {
  it("lists everyone not in the register, by app name", () => {
    const people = [
      { id: "p1", displayName: "Pat", klcName: "Patrick" },
      { id: "p3", displayName: "zed", klcName: null },
      { id: "p4", displayName: "Abe", klcName: "Abraham" },
    ];
    const r = buildRegister(clubs, players, []);
    expect(playersWithoutClub(people, r).map((p) => p.id)).toEqual(["p4", "p3"]);
  });
});
