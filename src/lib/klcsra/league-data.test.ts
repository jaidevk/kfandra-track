import { describe, it, expect } from "vitest";
import { sideClubLabel, toLeagueMatch, toStatRows } from "./league-data";
import type { MatchDraft } from "./types";

const draft = (over: Partial<MatchDraft> = {}): MatchDraft => ({
  id: "m1", entryDate: "2026-10-18", sport: "fooba",
  isFriendly: false, isCombined: true, durationMinutes: null,
  status: "submitted", submittedAt: "2026-10-18T10:00:00Z",
  seasonId: "s2", seasonName: "KLCFERRSXVSG2", createdBy: null,
  halves: [
    { id: "h1", halfNo: 1, sides: [
      { id: "s1", side: "home", clubId: "A", clubName: "Club A", score: 2 },
      { id: "s2", side: "away", clubId: "C", clubName: "Club C", score: 1 },
    ] },
    { id: "h2", halfNo: 2, sides: [
      { id: "s3", side: "home", clubId: "B", clubName: "Club B", score: 1 },
    ] },
  ],
  appearances: [
    { id: "a1", playerId: "p1", displayName: "Jake", side: "home", slot: 1,
      stats: { 1: { mainGoal: 2 }, 2: { assist: 1, mainGoal: 0 } } },
    { id: "a2", playerId: "p2", displayName: "Mkul", side: "away", slot: 1, stats: {} },
  ],
  ...over,
});

describe("toLeagueMatch", () => {
  it("keeps only halves with both sides, counts distinct players", () => {
    const m = toLeagueMatch(draft());
    expect(m.halves).toEqual([
      { halfNo: 1, home: { clubId: "A", score: 2 }, away: { clubId: "C", score: 1 } },
    ]);
    expect(m.totalPlayers).toBe(2);
    expect(m).toMatchObject({ id: "m1", sport: "fooba", isCombined: true, isFriendly: false });
  });
});

describe("toStatRows", () => {
  it("emits one row per non-zero stat, with the club of that half's side", () => {
    expect(toStatRows(draft())).toEqual([
      { matchId: "m1", entryDate: "2026-10-18", submittedAt: "2026-10-18T10:00:00Z", halfNo: 1,
        playerId: "p1", displayName: "Jake",
        clubName: "Club A", sport: "fooba", isFriendly: false, statKey: "mainGoal", count: 2 },
      { matchId: "m1", entryDate: "2026-10-18", submittedAt: "2026-10-18T10:00:00Z", halfNo: 2,
        playerId: "p1", displayName: "Jake",
        clubName: "Club B", sport: "fooba", isFriendly: false, statKey: "assist", count: 1 },
    ]);
  });
});

describe("sideClubLabel", () => {
  it("joins distinct club names on a side with +", () => {
    expect(sideClubLabel(draft(), "home")).toBe("Club A + Club B");
    expect(sideClubLabel(draft(), "away")).toBe("Club C");
  });
});

describe("review follow-ups", () => {
  it("toStatRows gives clubName null when the half's side has no club", () => {
    const d = draft({
      halves: [{ id: "h1", halfNo: 1, sides: [
        { id: "s1", side: "home", clubId: null, clubName: null, score: 0 },
      ] }],
      appearances: [{ id: "a1", playerId: "p1", displayName: "Jake", side: "home", slot: 1,
        stats: { 1: { mainGoal: 1 } } }],
    });
    expect(toStatRows(d)[0].clubName).toBeNull();
  });

  it("sideClubLabel keeps two different clubs that share a name", () => {
    const d = draft({
      halves: [
        { id: "h1", halfNo: 1, sides: [{ id: "s1", side: "home", clubId: "X1", clubName: "Same", score: 0 }] },
        { id: "h2", halfNo: 2, sides: [{ id: "s2", side: "home", clubId: "X2", clubName: "Same", score: 0 }] },
      ],
    });
    expect(sideClubLabel(d, "home")).toBe("Same + Same");
  });

  it("sideClubLabel returns TBD with no clubs", () => {
    expect(sideClubLabel(draft({ halves: [] }), "home")).toBe("TBD");
  });
});
