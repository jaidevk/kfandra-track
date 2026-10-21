import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * A minimal Supabase fake. Each `from(table)` starts a query that records its
 * table and every chained call; awaiting it resolves to `respond(query)`,
 * which a test can override to return data or an error per query.
 */
type Call = [string, unknown[]];
interface FakeQuery { table: string; calls: Call[] }
type Result = { data: unknown[] | null; error: { message: string } | null };

const queries: FakeQuery[] = [];
let respond: (q: FakeQuery) => Result = () => ({ data: [], error: null });

function fakeQuery(table: string) {
  const q: FakeQuery = { table, calls: [] };
  queries.push(q);
  const proxy: Record<string, unknown> = new Proxy({}, {
    get(_t, prop: string | symbol) {
      if (typeof prop === "symbol") return undefined;
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(respond(q));
      }
      return (...args: unknown[]) => { q.calls.push([prop, args]); return proxy; };
    },
  });
  return proxy;
}
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: (table: string) => fakeQuery(table) }),
}));

import { listSubmittedMatchDrafts } from "./league-repository";
import type { MatchDraftRow } from "./repository";
import type { Season } from "./types";

const season = (endDate: string | null): Season => ({
  id: "s2", seasonNo: 2, name: "S2", startDate: "2026-08-22", endDate, status: "active",
});
const hasCall = (q: FakeQuery, name: string, ...args: unknown[]) =>
  q.calls.some(([n, a]) => n === name && JSON.stringify(a) === JSON.stringify(args));

/** Identify queries by their filters, not by creation order. */
const isLeague = (q: FakeQuery) => hasCall(q, "eq", "season_id", "s2");
const isFriendlies = (q: FakeQuery) => hasCall(q, "eq", "is_friendly", true);
const leagueQuery = () => {
  const found = queries.filter(isLeague);
  expect(found).toHaveLength(1);
  return found[0];
};
const friendliesQuery = () => {
  const found = queries.filter(isFriendlies);
  expect(found).toHaveLength(1);
  return found[0];
};

const row = (
  id: string,
  entryDate: string,
  submittedAt: string | null,
  isFriendly = false,
): MatchDraftRow => ({
  id, entry_date: entryDate, sport: "football",
  is_friendly: isFriendly, is_combined: false, duration_minutes: null,
  status: "submitted", submitted_at: submittedAt, season_id: isFriendly ? null : "s2",
  created_by: null,
  klc_seasons: null, klc_match_halves: [], klc_match_appearances: [],
});

beforeEach(() => {
  queries.length = 0;
  respond = () => ({ data: [], error: null });
});

describe("listSubmittedMatchDrafts", () => {
  it("runs exactly two queries, both on klc_matches", async () => {
    await listSubmittedMatchDrafts(season(null));
    expect(queries).toHaveLength(2);
    for (const q of queries) expect(q.table).toBe("klc_matches");
  });

  it("every query filters status = submitted", async () => {
    await listSubmittedMatchDrafts(season(null));
    expect(queries).toHaveLength(2);
    for (const q of queries) expect(hasCall(q, "eq", "status", "submitted")).toBe(true);
  });

  it("league query is by season; friendly query is by date window", async () => {
    await listSubmittedMatchDrafts(season("2026-12-31"));
    const friendlies = friendliesQuery();
    expect(leagueQuery()).not.toBe(friendlies);
    expect(hasCall(friendlies, "gte", "entry_date", "2026-08-22")).toBe(true);
    expect(hasCall(friendlies, "lte", "entry_date", "2026-12-31")).toBe(true);
  });

  it("an open season has no upper date bound", async () => {
    await listSubmittedMatchDrafts(season(null));
    expect(friendliesQuery().calls.some(([n]) => n === "lte")).toBe(false);
  });

  it("merges both queries newest first (date, then submitted_at, then id)", async () => {
    respond = (q) => ({
      data: isLeague(q)
        ? [
            row("old", "2026-09-01", "2026-09-01T10:00:00Z"),
            row("b-same-day", "2026-09-10", "2026-09-10T10:00:00Z"),
            row("no-submit-time", "2026-09-10", null),
          ]
        : [
            row("newest", "2026-09-20", "2026-09-20T10:00:00Z", true),
            row("a-same-day", "2026-09-10", "2026-09-10T10:00:00Z", true),
            row("later-same-day", "2026-09-10", "2026-09-10T18:00:00Z", true),
          ],
      error: null,
    });
    const drafts = await listSubmittedMatchDrafts(season(null));
    expect(drafts.map((d) => d.id)).toEqual([
      "newest", "later-same-day", "a-same-day", "b-same-day", "no-submit-time", "old",
    ]);
  });

  it("throws when the league query errors", async () => {
    respond = (q) =>
      isLeague(q) ? { data: null, error: { message: "boom" } } : { data: [], error: null };
    await expect(listSubmittedMatchDrafts(season(null))).rejects.toThrow(/league matches: boom/);
  });

  it("throws when the friendlies query errors", async () => {
    respond = (q) =>
      isFriendlies(q) ? { data: null, error: { message: "boom" } } : { data: [], error: null };
    await expect(listSubmittedMatchDrafts(season(null))).rejects.toThrow(/friendlies: boom/);
  });
});
