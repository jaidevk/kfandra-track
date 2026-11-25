import { describe, it, expect } from "vitest";
import {
  computePlayerValues, formatChange, formatKr, isCountedForValues, rankValues,
  type RegisterPlayer, type ValueChange,
} from "./player-values";
import { DEFAULT_VALUE_RULES, type ValueRules } from "./value-rules";
import type { StatKey } from "./stat-rates";
import type { MatchDraft, MatchStatus, SideKey } from "./types";

const RULES = DEFAULT_VALUE_RULES;
const NO_SMALL: ValueRules = { ...RULES, smallSided: { ...RULES.smallSided, enabled: false } };

const P1: RegisterPlayer = {
  playerId: "p1", displayName: "Pat", klcName: "Patrick", clubId: "ca", clubName: "Club A",
  baseValue: 200, manyClubs: false,
};

let seq = 0;
interface Mk {
  id?: string; date: string;
  home?: number; away?: number;
  me?: SideKey;
  stats?: Partial<Record<StatKey, number>>;
  /** Other players in the match (default 13, so 14 in total: not small-sided). */
  others?: number;
  friendly?: boolean; official?: boolean;
  combined?: boolean; half2?: [number, number];
  noAway?: boolean;
  status?: MatchStatus; submittedAt?: string | null;
}
function mk(o: Mk): MatchDraft {
  const id = o.id ?? `m${++seq}`;
  const side = (s: SideKey, clubId: string | null, clubName: string | null, score: number) =>
    ({ id: `${id}-${s}`, side: s, clubId, clubName, score });
  const halves = [{
    id: `${id}-h1`, halfNo: 1,
    sides: [
      side("home", "ca", "Club A", o.home ?? 1),
      o.noAway ? side("away", null, null, 0) : side("away", "cb", "Club B", o.away ?? 0),
    ],
  }];
  if (o.half2) {
    halves.push({ id: `${id}-h2`, halfNo: 2, sides: [
      side("home", "ca", "Club A", o.half2[0]), side("away", "cb", "Club B", o.half2[1]),
    ] });
  }
  const me = {
    id: `${id}-me`, playerId: "p1", displayName: "Pat", side: o.me ?? "home", slot: 1,
    stats: o.stats ? { 1: o.stats } : {},
  };
  const others = Array.from({ length: o.others ?? 13 }, (_, i) => ({
    id: `${id}-o${i}`, playerId: `x${i}`, displayName: `X${i}`,
    side: (i % 2 ? "home" : "away") as SideKey, slot: i + 2, stats: {},
  }));
  return {
    id, entryDate: o.date, sport: "football",
    isFriendly: o.friendly ?? false, isCombined: o.combined ?? false,
    isOfficialFriendly: o.official ?? false, durationMinutes: null,
    status: o.status ?? "submitted",
    submittedAt: o.submittedAt === undefined ? `${o.date}T10:00:00Z` : o.submittedAt,
    homeSentAt: null, awaySentAt: null,
    seasonId: o.friendly ? null : "s2", seasonName: null, createdBy: null,
    halves, appearances: [me, ...others],
  };
}
const change = (c: Partial<ValueChange> & { effectiveDate: string; amount: number }): ValueChange => ({
  id: `c-${c.effectiveDate}-${c.amount}`, playerId: "p1", note: "note",
  createdAt: `${c.effectiveDate}T00:00:00Z`, voidedAt: null, voidNote: null, ...c,
});
const run = (matches: MatchDraft[], opts: { changes?: ValueChange[]; rules?: ValueRules; player?: RegisterPlayer } = {}) =>
  computePlayerValues({
    players: [opts.player ?? P1], matches, changes: opts.changes ?? [], rules: opts.rules ?? RULES,
  })[0];

describe("computePlayerValues", () => {
  it("Sir's worked example: 200 → 223 → 203", () => {
    const v = run([
      mk({ date: "2026-12-01", home: 2, away: 1, stats: { goal: 1, assist: 1 } }),
      mk({ date: "2026-12-03", home: 0, away: 1, friendly: true, official: true, stats: { yellowCard: 1 } }),
    ]);
    expect(v.sessions.map((s) => s.valueAfter)).toEqual([223, 203]);
    expect(v.current).toBe(203);
    expect(v.lastSession).toEqual({ date: "2026-12-03", change: -20 });
  });

  it("win, draw and loss", () => {
    expect(run([mk({ date: "2026-12-01", home: 1, away: 0 })]).current).toBe(220);
    expect(run([mk({ date: "2026-12-01", home: 1, away: 1 })]).current).toBe(205);
    expect(run([mk({ date: "2026-12-01", home: 0, away: 1 })]).current).toBe(190);
    expect(run([mk({ date: "2026-12-01", home: 0, away: 1, me: "away" })]).current).toBe(220);
  });

  it("every rated stat and card, summed over halves", () => {
    const v = run([mk({
      date: "2026-12-01", home: 1, away: 1,
      stats: {
        goal: 1, mainGoal: 1, reboundGoal: 1, try: 1, conversion: 1,
        assist: 1, preAssist: 1, save: 1, yellowCard: 1, redCard: 1, blueCard: 1,
      },
    })]);
    // draw +5; stats 2*5 + 1 + 0.5 + 2 - 10 - 20 - 50 = -66.5
    expect(v.sessions[0].total).toBe(-61.5);
    expect(v.current).toBe(138.5);
    expect(v.sessions[0].matches[0].stats.map((s) => s.statKey)).toEqual([
      "goal", "try", "conversion", "mainGoal", "reboundGoal", "assist", "preAssist", "save",
      "yellowCard", "redCard", "blueCard",
    ]);
  });

  it("an unrated stat (tackle) counts 0 and shows no line", () => {
    const v = run([mk({ date: "2026-12-01", home: 1, away: 1, stats: { tackle: 4, lateChallenge: 1 } })]);
    expect(v.current).toBe(205);
    expect(v.sessions[0].matches[0].stats).toEqual([]);
  });

  it("a combined match is one result over both halves", () => {
    const v = run([mk({ date: "2026-12-01", combined: true, home: 2, away: 0, half2: [0, 3] })]);
    expect(v.sessions[0].matches[0].result).toBe("loss");
    expect(v.current).toBe(190);
  });

  it("an incomplete match changes stats only", () => {
    const v = run([mk({ date: "2026-12-01", noAway: true, stats: { goal: 1 } })]);
    expect(v.sessions[0].matches[0].result).toBeNull();
    expect(v.current).toBe(202);
  });

  it("counts official friendlies, not unofficial ones or unsubmitted matches", () => {
    const v = run([
      mk({ date: "2026-12-01", friendly: true, official: true }),
      mk({ date: "2026-12-02", friendly: true, official: false }),
      mk({ date: "2026-12-03", status: "sent" }),
    ]);
    expect(v.sessions.map((s) => s.date)).toEqual(["2026-12-01"]);
    expect(v.sessions[0].matches[0].kind).toBe("official_friendly");
  });

  it("small-sided: the first 5 are free, the 6th counts, in date then submit order", () => {
    const small = [
      mk({ id: "s6", date: "2026-12-06", others: 3 }),
      mk({ id: "s5b", date: "2026-12-05", others: 3, submittedAt: "2026-12-05T11:00:00Z" }),
      mk({ id: "s5a", date: "2026-12-05", others: 3, submittedAt: "2026-12-05T09:00:00Z" }),
      mk({ id: "s3", date: "2026-12-03", others: 3 }),
      mk({ id: "s2", date: "2026-12-02", others: 3 }),
      mk({ id: "s1", date: "2026-12-01", others: 3 }),
    ];
    const v = run(small);
    const lines = v.sessions.flatMap((s) => s.matches);
    expect(lines.map((l) => [l.matchId, l.smallSidedFree])).toEqual([
      ["s1", 1], ["s2", 2], ["s3", 3], ["s5a", 4], ["s5b", 5], ["s6", null],
    ]);
    expect(lines.map((l) => l.total)).toEqual([0, 0, 0, 0, 0, 20]);
    expect(v.current).toBe(220);
  });

  it("small-sided: a 7-player match is never free, and the switch turns the rule off", () => {
    expect(run([mk({ date: "2026-12-01", others: 6 })]).current).toBe(220);
    expect(run([mk({ date: "2026-12-01", others: 3 })], { rules: NO_SMALL }).current).toBe(220);
  });

  it("the floor applies after each session day, not per match", () => {
    const low = { ...P1, baseValue: 15 };
    const v = run([
      mk({ date: "2026-12-01", home: 0, away: 1 }),            // -10
      mk({ date: "2026-12-01", home: 0, away: 1 }),            // -10 → 15 - 20 → 0
      mk({ date: "2026-12-02", home: 1, away: 0 }),            // +20 → 20
    ], { player: low });
    expect(v.sessions.map((s) => [s.total, s.valueAfter, s.hitFloor])).toEqual([
      [-20, 0, true], [20, 20, false],
    ]);
    expect(v.lastSession).toEqual({ date: "2026-12-02", change: 20 });
  });

  it("KFANDRA changes join their date's session, or make their own; voided ones are ignored", () => {
    const v = run([mk({ date: "2026-12-01", home: 1, away: 0 })], {
      changes: [
        change({ effectiveDate: "2026-12-01", amount: -50, note: "Ill" }),
        change({ effectiveDate: "2026-12-04", amount: 10 }),
        change({ effectiveDate: "2026-12-05", amount: 999, voidedAt: "2026-12-06T00:00:00Z", voidNote: "typo" }),
      ],
    });
    expect(v.sessions.map((s) => [s.date, s.total, s.valueAfter])).toEqual([
      ["2026-12-01", -30, 170], ["2026-12-04", 10, 180],
    ]);
    expect(v.sessions[0].changes).toEqual([{ id: "c-2026-12-01--50", amount: -50, note: "Ill" }]);
  });

  it("a player with no base value is not valued but is flagged once they play", () => {
    const v = run([mk({ date: "2026-12-01" })], { player: { ...P1, baseValue: null } });
    expect(v.current).toBeNull();
    expect(v.sessions).toEqual([]);
    expect(v.playedWithoutBase).toBe(true);
    expect(run([], { player: { ...P1, baseValue: null } }).playedWithoutBase).toBe(false);
  });

  it("with no counted matches the value is the base value", () => {
    const v = run([]);
    expect(v.current).toBe(200);
    expect(v.lastSession).toBeNull();
  });

  it("labels a match with its clubs", () => {
    const v = run([mk({ date: "2026-12-01" })]);
    expect(v.sessions[0].matches[0].label).toBe("Club A v Club B");
  });
});

describe("isCountedForValues", () => {
  it("is submitted league matches and submitted official friendlies", () => {
    expect(isCountedForValues(mk({ date: "2026-12-01" }))).toBe(true);
    expect(isCountedForValues(mk({ date: "2026-12-01", friendly: true, official: true }))).toBe(true);
    expect(isCountedForValues(mk({ date: "2026-12-01", friendly: true }))).toBe(false);
    expect(isCountedForValues(mk({ date: "2026-12-01", status: "draft" }))).toBe(false);
  });
});

describe("rankValues", () => {
  it("drops unvalued players and ranks by value, then name", () => {
    const vals = computePlayerValues({
      players: [
        { ...P1, playerId: "a", klcName: null, displayName: "Zed", baseValue: 100 },
        { ...P1, playerId: "b", klcName: "Amy", displayName: "x", baseValue: 100 },
        { ...P1, playerId: "c", baseValue: 300 },
        { ...P1, playerId: "d", baseValue: null },
      ],
      matches: [], changes: [], rules: RULES,
    });
    expect(rankValues(vals).map((v) => v.playerId)).toEqual(["c", "b", "a"]);
  });
});

describe("formatting", () => {
  it("formats Kroopies and signed changes", () => {
    expect(formatKr(1234.5)).toBe("1,234.5 KR");
    expect(formatChange(20)).toBe("+20 KR");
    expect(formatChange(-10)).toBe("−10 KR");
    expect(formatChange(0)).toBe("0 KR");
  });
});
