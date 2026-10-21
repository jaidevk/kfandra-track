import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentPlayer: vi.fn() }));
vi.mock("./repository", () => ({
  getMatch: vi.fn(),
  listManagedClubIds: vi.fn(),
  createMatch: vi.fn(),
  setSideClub: vi.fn(),
  updateMatchMeta: vi.fn(),
  deleteMatch: vi.fn(),
  submitMatch: vi.fn(),
  reopenMatch: vi.fn(),
  getActiveSeason: vi.fn(),
}));
vi.mock("./config", () => ({
  loadStatRates: vi.fn(),
  loadSportStats: vi.fn(),
}));

import { getCurrentPlayer, type CurrentPlayer } from "@/lib/auth/current-user";
import * as repo from "./repository";
import { loadSportStats, loadStatRates } from "./config";
import { DEFAULT_SPORT_STATS } from "./sport-stats";
import { DEFAULT_STAT_RATES } from "./stat-rates";
import {
  createMatchAction,
  deleteMatchAction,
  reopenMatchAction,
  setSideClubAction,
  submitMatchAction,
  updateMatchMetaAction,
} from "./actions";
import type { MatchDraft, SideKey } from "./types";

const NOT_STAFF = "You do not have permission to do that.";
const LOCKED = "This match is locked. Reopen it first.";
const NOT_KFANDRA = "Only KFANDRA can reopen a submitted match.";

const as = (role: CurrentPlayer["role"], id = `${role}-id`): CurrentPlayer => ({
  id, phone: "0", displayName: id, role,
});
const signIn = (p: CurrentPlayer) => vi.mocked(getCurrentPlayer).mockResolvedValue(p);
const manages = (...ids: string[]) =>
  vi.mocked(repo.listManagedClubIds).mockResolvedValue(new Set(ids));

const side = (s: SideKey, clubId: string) =>
  ({ id: `${s}-${clubId}`, side: s, clubId, clubName: clubId, score: 0 });

/** Draft single-half match: A (home) v B (away), created by nobody. */
function draft(overrides: Partial<MatchDraft> = {}): MatchDraft {
  return {
    id: "m1", entryDate: "2026-10-01", sport: "football",
    isFriendly: false, isCombined: false, durationMinutes: null,
    status: "draft", submittedAt: null, seasonId: null, seasonName: null,
    createdBy: null,
    halves: [{ id: "h1", halfNo: 1, sides: [side("home", "A"), side("away", "B")] }],
    appearances: [],
    ...overrides,
  } as MatchDraft;
}

const newMatch = { entryDate: "2026-10-01", sport: "football" as const, isCombined: false, isFriendly: false };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(repo.createMatch).mockResolvedValue("new-id");
  vi.mocked(repo.getMatch).mockResolvedValue(draft());
  manages();
});

describe("createMatchAction", () => {
  it("a plain user with no managed clubs is refused, nothing written", async () => {
    signIn(as("user"));
    expect(await createMatchAction({ ...newMatch, homeClubId: "A" }))
      .toEqual({ ok: false, error: NOT_STAFF });
    expect(repo.createMatch).not.toHaveBeenCalled();
  });

  it("a manager without homeClubId is refused", async () => {
    signIn(as("user"));
    manages("A");
    expect(await createMatchAction(newMatch)).toEqual({ ok: false, error: NOT_STAFF });
    expect(repo.createMatch).not.toHaveBeenCalled();
  });

  it("a manager with their own club creates with createdBy + homeClubId", async () => {
    signIn(as("user", "mgr"));
    manages("A");
    expect(await createMatchAction({ ...newMatch, homeClubId: "A" }))
      .toEqual({ ok: true, data: "new-id" });
    expect(repo.createMatch).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: "mgr", homeClubId: "A" }),
    );
  });

  it("staff need no homeClubId", async () => {
    signIn(as("admin", "staff"));
    expect(await createMatchAction(newMatch)).toEqual({ ok: true, data: "new-id" });
    expect(repo.createMatch).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: "staff", homeClubId: null }),
    );
    expect(repo.listManagedClubIds).not.toHaveBeenCalled();
  });
});

describe("setSideClubAction", () => {
  it("an unrelated manager is refused, nothing written", async () => {
    signIn(as("user"));
    manages("Z");
    expect(await setSideClubAction("m1", "h1", "away", "C"))
      .toEqual({ ok: false, error: NOT_STAFF });
    expect(repo.setSideClub).not.toHaveBeenCalled();
  });

  it("a club already on the other slot is refused", async () => {
    signIn(as("admin"));
    vi.mocked(repo.getMatch).mockResolvedValue(draft({
      isCombined: true,
      halves: [
        { id: "h1", halfNo: 1, sides: [side("home", "A"), side("away", "B")] },
        { id: "h2", halfNo: 2, sides: [] },
      ],
    }));
    expect(await setSideClubAction("m1", "h2", "away", "A"))
      .toEqual({ ok: false, error: "That club is already on the other side of this match." });
    expect(repo.setSideClub).not.toHaveBeenCalled();
  });

  it("a manager replacing their last club is refused", async () => {
    signIn(as("user"));
    manages("A");
    expect(await setSideClubAction("m1", "h1", "home", "C"))
      .toEqual({ ok: false, error: "Keep your own club on this match." });
    expect(repo.setSideClub).not.toHaveBeenCalled();
  });

  it("a creator replacing their last club is refused too", async () => {
    signIn(as("user", "mgr"));
    manages("A");
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ createdBy: "mgr" }));
    expect(await setSideClubAction("m1", "h1", "home", "C"))
      .toEqual({ ok: false, error: "Keep your own club on this match." });
    expect(repo.setSideClub).not.toHaveBeenCalled();
  });

  it("staff replacing a club are exempt from the keep-your-club rule", async () => {
    signIn(as("admin"));
    expect(await setSideClubAction("m1", "h1", "home", "C")).toEqual({ ok: true, data: undefined });
    expect(repo.setSideClub).toHaveBeenCalledWith("h1", "home", "C");
    expect(repo.listManagedClubIds).not.toHaveBeenCalled();
  });

  it("a failed managed-clubs lookup is an error, not a refusal or a pass", async () => {
    signIn(as("user"));
    vi.mocked(repo.listManagedClubIds).mockRejectedValue(new Error("Failed to load your clubs: db down"));
    expect(await setSideClubAction("m1", "h1", "away", "C"))
      .toEqual({ ok: false, error: "Failed to load your clubs: db down" });
    expect(repo.setSideClub).not.toHaveBeenCalled();
  });

  it("a valid change writes the side", async () => {
    signIn(as("user"));
    manages("A");
    expect(await setSideClubAction("m1", "h1", "away", "C")).toEqual({ ok: true, data: undefined });
    expect(repo.setSideClub).toHaveBeenCalledWith("h1", "away", "C");
  });
});

describe("submitMatchAction", () => {
  it("a submitted match is locked", async () => {
    signIn(as("admin"));
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ status: "submitted" }));
    expect(await submitMatchAction("m1")).toEqual({ ok: false, error: LOCKED });
    expect(repo.submitMatch).not.toHaveBeenCalled();
  });

  it("a club leading home in one half and away in the other is refused", async () => {
    signIn(as("admin"));
    vi.mocked(repo.getMatch).mockResolvedValue(draft({
      isCombined: true,
      halves: [
        { id: "h1", halfNo: 1, sides: [side("home", "A"), side("away", "B")] },
        { id: "h2", halfNo: 2, sides: [side("home", "C"), side("away", "A")] },
      ],
    }));
    expect(await submitMatchAction("m1")).toEqual({
      ok: false,
      error: "A club can't be on both sides of one match. Fix the clubs before submitting.",
    });
    expect(repo.submitMatch).not.toHaveBeenCalled();
  });

  it("a lost submit race surfaces the repository's locked message", async () => {
    signIn(as("admin"));
    vi.mocked(repo.getMatch).mockResolvedValue(draft({
      appearances: [{ id: "ap1", side: "home", slot: 1, playerId: "p1", displayName: "P1", stats: {} }],
    }));
    vi.mocked(repo.getActiveSeason).mockResolvedValue({ id: "s2" } as never);
    vi.mocked(loadStatRates).mockResolvedValue(DEFAULT_STAT_RATES);
    vi.mocked(loadSportStats).mockResolvedValue(DEFAULT_SPORT_STATS);
    vi.mocked(repo.submitMatch).mockRejectedValue(new Error(LOCKED));
    expect(await submitMatchAction("m1")).toEqual({ ok: false, error: LOCKED });
    expect(repo.submitMatch).toHaveBeenCalledWith("m1", "s2", "admin-id");
  });
});

describe("reopenMatchAction", () => {
  beforeEach(() => {
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ status: "submitted" }));
  });
  it("an admin is refused", async () => {
    signIn(as("admin"));
    expect(await reopenMatchAction("m1")).toEqual({ ok: false, error: NOT_KFANDRA });
    expect(repo.reopenMatch).not.toHaveBeenCalled();
  });
  it("KFANDRA reopens", async () => {
    signIn(as("kfandra"));
    expect(await reopenMatchAction("m1")).toEqual({ ok: true, data: undefined });
    expect(repo.reopenMatch).toHaveBeenCalledWith("m1");
  });
});

describe("createMatchAction lookup failure", () => {
  it("a failed managed-clubs lookup is an error, not a refusal or a pass", async () => {
    signIn(as("user"));
    vi.mocked(repo.listManagedClubIds).mockRejectedValue(new Error("Failed to load your clubs: db down"));
    const res = await createMatchAction({ ...newMatch, homeClubId: "A" });
    expect(res).toEqual({ ok: false, error: "Failed to load your clubs: db down" });
    expect(repo.createMatch).not.toHaveBeenCalled();
  });
});

describe("deleteMatchAction", () => {
  it("an unrelated manager is refused", async () => {
    signIn(as("user"));
    manages("Z");
    expect(await deleteMatchAction("m1")).toEqual({ ok: false, error: NOT_STAFF });
    expect(repo.deleteMatch).not.toHaveBeenCalled();
  });
});

describe("updateMatchMetaAction", () => {
  it("an unrelated manager is refused", async () => {
    signIn(as("user"));
    manages("Z");
    expect(await updateMatchMetaAction("m1", { isFriendly: true }))
      .toEqual({ ok: false, error: NOT_STAFF });
    expect(repo.updateMatchMeta).not.toHaveBeenCalled();
  });

  it("rejects a non-boolean isFriendly", async () => {
    signIn(as("admin"));
    expect(await updateMatchMetaAction("m1", { isFriendly: "yes" as unknown as boolean }))
      .toEqual({ ok: false, error: "Pick League or Friendly." });
    expect(repo.updateMatchMeta).not.toHaveBeenCalled();
  });
});
