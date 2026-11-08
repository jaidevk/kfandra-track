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

import { matchPermissions, ownedSides, type PermissionMatch } from "./access";

const pm = (over: Partial<PermissionMatch> = {}): PermissionMatch => ({
  status: "draft", isFriendly: false, createdBy: null,
  homeSentAt: null, awaySentAt: null,
  halves: [{ id: "h1", sides: [{ side: "home", clubId: "A" }, { side: "away", clubId: "B" }] }],
  appearances: [],
  ...over,
});
const userV = { id: "u", role: "user" as const };
const adminV = { id: "s", role: "admin" as const };
const kfandraV = { id: "k", role: "kfandra" as const };
const A = new Set(["A"]);

describe("ownedSides", () => {
  it("is every side led by a managed club in any half", () => {
    const halves = [
      { id: "h1", sides: [{ side: "home" as const, clubId: "A" }, { side: "away" as const, clubId: "B" }] },
      { id: "h2", sides: [{ side: "home" as const, clubId: "C" }, { side: "away" as const, clubId: "D" }] },
    ];
    expect(ownedSides(halves, new Set(["D"]))).toEqual(["away"]);
    expect(ownedSides(halves, new Set(["A", "D"]))).toEqual(["home", "away"]);
    expect(ownedSides(halves, new Set())).toEqual([]);
  });
});

describe("matchPermissions — manager", () => {
  it("edits only their own team, and no league score", () => {
    const p = matchPermissions(userV, pm(), A);
    expect(p.team).toEqual({ home: true, away: false });
    expect(p.times).toEqual({ home: true, away: false });
    expect(p.score).toBe(false);
    expect(p.details).toBe(true);
    expect(p.send).toEqual(["home"]);
    expect(p.makeOfficial).toBe(false);
  });

  it("can set the opponent's club only while that team is empty", () => {
    expect(matchPermissions(userV, pm(), A).clubs).toEqual({ home: true, away: true });
    const withAway = pm({ appearances: [{ side: "away" }] });
    expect(matchPermissions(userV, withAway, A).clubs.away).toBe(false);
  });

  it("enters a friendly score until a team is sent", () => {
    expect(matchPermissions(userV, pm({ isFriendly: true }), A).score).toBe(true);
    const sent = pm({ isFriendly: true, awaySentAt: "t" });
    expect(matchPermissions(userV, sent, A).score).toBe(false);
  });

  it("after sending, their team, details and send are closed", () => {
    const p = matchPermissions(userV, pm({ homeSentAt: "t" }), A);
    expect(p.team.home).toBe(false);
    expect(p.details).toBe(false);
    expect(p.deleteDraft).toBe(false);
    expect(p.send).toEqual([]);
    expect(p.clubs.home).toBe(false);
  });

  it("the other manager keeps their own team while one team is sent", () => {
    const p = matchPermissions(userV, pm({ awaySentAt: "t" }), A);
    expect(p.team.home).toBe(true);
    expect(p.send).toEqual(["home"]);
    expect(p.details).toBe(false);
  });

  it("the away manager's club is fixed once the home team is sent", () => {
    const p = matchPermissions(userV, pm({ homeSentAt: "t" }), new Set(["B"]));
    expect(p.clubs).toEqual({ home: false, away: false });
    expect(p.team.away).toBe(true);
    expect(p.send).toEqual(["away"]);
  });

  it("with nothing sent, the home manager sets the away club only while it is empty", () => {
    expect(matchPermissions(userV, pm(), A).clubs).toEqual({ home: true, away: true });
    const withAway = pm({ appearances: [{ side: "away" }] });
    expect(matchPermissions(userV, withAway, A).clubs).toEqual({ home: true, away: false });
  });

  it("a manager of both clubs controls both teams", () => {
    const p = matchPermissions(userV, pm(), new Set(["A", "B"]));
    expect(p.team).toEqual({ home: true, away: true });
    expect(p.send).toEqual(["home", "away"]);
  });

  it("can change nothing once the match is sent or official", () => {
    for (const status of ["sent", "submitted"] as const) {
      const p = matchPermissions(userV, pm({ status }), A);
      expect(p.team).toEqual({ home: false, away: false });
      expect(p.times).toEqual({ home: false, away: false });
      expect(p.reopen).toBe(false);
    }
  });

  it("an unrelated manager gets nothing", () => {
    const p = matchPermissions(userV, pm(), new Set(["Z"]));
    expect(p.details).toBe(false);
    expect(p.team).toEqual({ home: false, away: false });
  });

  it("a creator who manages nothing keeps the details but has no team", () => {
    const p = matchPermissions(userV, pm({ createdBy: "u" }), new Set());
    expect(p.details).toBe(true);
    expect(p.team).toEqual({ home: false, away: false });
  });
});

describe("matchPermissions — staff", () => {
  it("edit everything before official, and make official", () => {
    for (const status of ["draft", "sent"] as const) {
      const p = matchPermissions(adminV, pm({ status }), new Set());
      expect(p.team).toEqual({ home: true, away: true });
      expect(p.score).toBe(true);
      expect(p.details).toBe(true);
      expect(p.makeOfficial).toBe(true);
      expect(p.send).toEqual([]);
    }
  });

  it("send back only when a team has been sent", () => {
    expect(matchPermissions(adminV, pm(), new Set()).sendBack).toBe(false);
    expect(matchPermissions(adminV, pm({ homeSentAt: "t" }), new Set()).sendBack).toBe(true);
    expect(matchPermissions(adminV, pm({ status: "sent" }), new Set()).sendBack).toBe(true);
  });

  it("on an official match: goal times only; only KFANDRA reopens", () => {
    const admin = matchPermissions(adminV, pm({ status: "submitted" }), new Set());
    expect(admin.times).toEqual({ home: true, away: true });
    expect(admin.team).toEqual({ home: false, away: false });
    expect(admin.score).toBe(false);
    expect(admin.reopen).toBe(false);
    expect(matchPermissions(kfandraV, pm({ status: "submitted" }), new Set()).reopen).toBe(true);
  });

  it("on an official match staff change no details, clubs or status", () => {
    for (const v of [adminV, { id: "x", role: "super_admin" as const }]) {
      const p = matchPermissions(v, pm({ status: "submitted" }), new Set());
      expect(p.details).toBe(false);
      expect(p.clubs).toEqual({ home: false, away: false });
      expect(p.makeOfficial).toBe(false);
      expect(p.sendBack).toBe(false);
      expect(p.times).toEqual({ home: true, away: true });
    }
    expect(matchPermissions({ id: "x", role: "super_admin" }, pm({ status: "submitted" }), new Set()).reopen).toBe(true);
  });
});
