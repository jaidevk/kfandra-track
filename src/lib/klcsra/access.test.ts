import { describe, it, expect } from "vitest";
import {
  canEditMatch, canRecordMatches, canReopenMatch, clubOnBothSlots, clubOnOtherSide, hasOwnDraft,
  keepsManagedClub, matchClubIds,
} from "./access";

const none = new Set<string>();
const managesA = new Set(["A"]);
const match = { createdBy: "creator", clubIds: ["A", "B"] };

describe("canEditMatch", () => {
  it("staff can edit any draft", () => {
    for (const role of ["super_admin", "kfandra", "admin"] as const) {
      expect(canEditMatch({ id: "x", role }, match, none)).toBe(true);
    }
  });
  it("the creator can edit", () => {
    expect(canEditMatch({ id: "creator", role: "user" }, match, none)).toBe(true);
  });
  it("the manager of a club on either side can edit", () => {
    expect(canEditMatch({ id: "m", role: "user" }, match, managesA)).toBe(true);
    expect(canEditMatch({ id: "m", role: "user" }, { createdBy: null, clubIds: ["C", "A"] }, managesA)).toBe(true);
  });
  it("an unrelated manager or a plain player cannot", () => {
    expect(canEditMatch({ id: "m", role: "user" }, { createdBy: null, clubIds: ["C", "D"] }, managesA)).toBe(false);
    expect(canEditMatch({ id: "p", role: "user" }, match, none)).toBe(false);
  });
});

describe("canRecordMatches", () => {
  it("staff or anyone managing a club", () => {
    expect(canRecordMatches({ id: "x", role: "admin" }, none)).toBe(true);
    expect(canRecordMatches({ id: "m", role: "user" }, managesA)).toBe(true);
    expect(canRecordMatches({ id: "p", role: "user" }, none)).toBe(false);
  });
});

describe("canReopenMatch", () => {
  it("only KFANDRA and super_admin", () => {
    expect(canReopenMatch({ id: "x", role: "kfandra" })).toBe(true);
    expect(canReopenMatch({ id: "x", role: "super_admin" })).toBe(true);
    expect(canReopenMatch({ id: "x", role: "admin" })).toBe(false);
  });
});

describe("matchClubIds", () => {
  it("collects distinct non-null club ids across halves", () => {
    expect(matchClubIds([
      { sides: [{ clubId: "A" }, { clubId: "B" }] },
      { sides: [{ clubId: "A" }, { clubId: null }] },
    ])).toEqual(["A", "B"]);
  });
});

describe("clubOnOtherSide", () => {
  const halves = [
    { sides: [{ side: "home" as const, clubId: "A" }, { side: "away" as const, clubId: "B" }] },
    { sides: [] },
  ];
  it("home in H1, then picking it as away in H2 is refused", () => {
    expect(clubOnOtherSide(halves, "away", "A")).toBe(true);
  });
  it("the same slot in both halves is fine", () => {
    expect(clubOnOtherSide(halves, "home", "A")).toBe(false);
  });
  it("a different club is fine", () => {
    expect(clubOnOtherSide(halves, "away", "C")).toBe(false);
  });
});

describe("keepsManagedClub", () => {
  const managed = new Set(["A"]);
  const h1 = { id: "h1", sides: [{ side: "home" as const, clubId: "A" }, { side: "away" as const, clubId: "B" }] };
  it("replacing your only club is refused", () => {
    expect(keepsManagedClub([h1], "h1", "home", "C", managed)).toBe(false);
  });
  it("replacing it while your club is still in the other half is fine", () => {
    const h2 = { id: "h2", sides: [{ side: "home" as const, clubId: "A" }] };
    expect(keepsManagedClub([h1, h2], "h1", "home", "C", managed)).toBe(true);
  });
  it("replacing an opponent is fine", () => {
    expect(keepsManagedClub([h1], "h1", "away", "C", managed)).toBe(true);
  });
  it("picking your club for an empty side is fine", () => {
    const empty = { id: "h1", sides: [{ side: "away" as const, clubId: "B" }] };
    expect(keepsManagedClub([empty], "h1", "home", "A", managed)).toBe(true);
  });
});

describe("clubOnBothSlots", () => {
  const h = (home: string | null, away: string | null) => ({
    sides: [{ side: "home" as const, clubId: home }, { side: "away" as const, clubId: away }],
  });
  it("null when each club keeps one slot", () => {
    expect(clubOnBothSlots([h("A", "B"), h("A", "C")])).toBeNull();
  });
  it("the club that leads home in H1 and away in H2", () => {
    expect(clubOnBothSlots([h("A", "B"), h("B", "A")])).toBe("A");
  });
  it("ignores empty sides and empty halves", () => {
    expect(clubOnBothSlots([h("A", null), { sides: [] }])).toBeNull();
  });
});

describe("hasOwnDraft", () => {
  const me = { id: "me", role: "user" as const };
  it("true for a draft I created", () => {
    expect(hasOwnDraft(me, [{ status: "draft", createdBy: "me" }])).toBe(true);
  });
  it("false for my submitted match or someone else's draft", () => {
    expect(hasOwnDraft(me, [
      { status: "submitted", createdBy: "me" },
      { status: "draft", createdBy: "other" },
      { status: "draft", createdBy: null },
    ])).toBe(false);
  });
});
