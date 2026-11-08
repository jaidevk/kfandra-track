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
  clearScores: vi.fn(),
  deleteMatch: vi.fn(),
  reopenMatch: vi.fn(),
  getActiveSeason: vi.fn(),
  setSideScore: vi.fn(),
  addAppearance: vi.fn(),
  removeAppearance: vi.fn(),
  setStat: vi.fn(),
  setGoalTimes: vi.fn(),
  sendTeam: vi.fn(),
  finishSending: vi.fn(),
  makeOfficial: vi.fn(),
  sendBack: vi.fn(),
  listMatches: vi.fn(),
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
  addAppearanceAction,
  createMatchAction,
  deleteMatchAction,
  makeOfficialAction,
  removeAppearanceAction,
  reopenMatchAction,
  sendBackAction,
  sendTeamAction,
  setGoalTimesAction,
  setSideClubAction,
  setSideScoreAction,
  setStatAction,
  updateMatchMetaAction,
} from "./actions";
import type { MatchDraft, SideKey } from "./types";

const NOT_STAFF = "You do not have permission to do that.";
const LOCKED = "This match is locked. Reopen it first.";
const NOT_KFANDRA = "Only KFANDRA can reopen a submitted match.";
const TEAM_SENT = "Your team has been sent. Ask KFANDRA to send it back if something needs fixing.";
const NOT_YOUR_TEAM = "You can only edit your own team.";
const WAITING = "Waiting for KFANDRA to make this official.";
const STAFF_SCORE = "Only KFANDRA or an admin can enter a league score.";
const DETAILS_FIXED = "A team has been sent, so the match details are fixed. Ask KFANDRA to send it back if something needs fixing.";
const withPlayers = {
  appearances: [
    { id: "ap1", side: "home", slot: 1, playerId: "p1", displayName: "P1", stats: {} },
    { id: "ap2", side: "away", slot: 1, playerId: "p2", displayName: "P2", stats: {} },
  ],
} as Partial<MatchDraft>;

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
    status: "draft", submittedAt: null, homeSentAt: null, awaySentAt: null, seasonId: null, seasonName: null,
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

describe("per-team edits (manager of A = home)", () => {
  beforeEach(() => { signIn(as("user")); manages("A"); });

  it("adds a player to their own team", async () => {
    expect(await addAppearanceAction("m1", "p9", "home")).toEqual({ ok: true, data: undefined });
    expect(repo.addAppearance).toHaveBeenCalledWith("m1", "p9", "home");
  });

  it("can't touch the other team", async () => {
    vi.mocked(repo.getMatch).mockResolvedValue(draft(withPlayers));
    expect(await addAppearanceAction("m1", "p9", "away")).toEqual({ ok: false, error: NOT_YOUR_TEAM });
    expect(await removeAppearanceAction("m1", "ap2")).toEqual({ ok: false, error: NOT_YOUR_TEAM });
    expect(await setStatAction("m1", "ap2", 1, "goal", 1)).toEqual({ ok: false, error: NOT_YOUR_TEAM });
    expect(repo.addAppearance).not.toHaveBeenCalled();
    expect(repo.removeAppearance).not.toHaveBeenCalled();
    expect(repo.setStat).not.toHaveBeenCalled();
  });

  it("can't pull a player out of the other team by re-adding them", async () => {
    vi.mocked(repo.getMatch).mockResolvedValue(draft(withPlayers));
    expect(await addAppearanceAction("m1", "p2", "home"))
      .toEqual({ ok: false, error: "That player is already in the other team." });
  });

  it("after sending, their team is closed", async () => {
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ ...withPlayers, homeSentAt: "t" }));
    expect(await setStatAction("m1", "ap1", 1, "goal", 1)).toEqual({ ok: false, error: TEAM_SENT });
    expect(await updateMatchMetaAction("m1", { sport: "rugby" })).toEqual({ ok: false, error: DETAILS_FIXED });
  });

  it("a sent match is read-only for managers", async () => {
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ ...withPlayers, status: "sent" }));
    expect(await setStatAction("m1", "ap1", 1, "goal", 1)).toEqual({ ok: false, error: WAITING });
  });

  it("enters no league score, but can enter a friendly's", async () => {
    expect(await setSideScoreAction("m1", "h1", "home", 2)).toEqual({ ok: false, error: STAFF_SCORE });
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ isFriendly: true }));
    expect(await setSideScoreAction("m1", "h1", "home", 2)).toEqual({ ok: true, data: undefined });
  });

  it("can set the opponent's club only while that team has no players", async () => {
    expect(await setSideClubAction("m1", "h1", "away", "C")).toEqual({ ok: true, data: undefined });
    vi.mocked(repo.getMatch).mockResolvedValue(draft(withPlayers));
    expect(await setSideClubAction("m1", "h1", "away", "C")).toEqual({
      ok: false, error: "That side belongs to the other club now. Ask their manager or KFANDRA.",
    });
  });

  it("lowering a count trims that stat's goal times", async () => {
    vi.mocked(repo.getMatch).mockResolvedValue(draft({
      appearances: [{
        id: "ap1", side: "home", slot: 1, playerId: "p1", displayName: "P1",
        stats: { 1: { mainGoal: 2 } }, times: { 1: { mainGoal: [12, 34] } },
      }],
    }));
    await setStatAction("m1", "ap1", 1, "mainGoal", 1);
    expect(repo.setStat).toHaveBeenCalledWith("ap1", 1, "mainGoal", 1, [12]);
  });
});

describe("staff edit both teams before official", () => {
  it("sets any score and stat on a sent match", async () => {
    signIn(as("admin"));
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ ...withPlayers, status: "sent" }));
    expect(await setSideScoreAction("m1", "h1", "away", 3)).toEqual({ ok: true, data: undefined });
    expect(await setStatAction("m1", "ap2", 1, "goal", 1)).toEqual({ ok: true, data: undefined });
  });
});

describe("createMatchAction", () => {
  beforeEach(() => { vi.mocked(repo.listMatches).mockResolvedValue([]); });

  it("a plain user with no managed clubs is refused, nothing written", async () => {
    signIn(as("user"));
    expect(await createMatchAction({ ...newMatch, homeClubId: "A", awayClubId: "B" }))
      .toEqual({ ok: false, error: NOT_STAFF });
    expect(repo.createMatch).not.toHaveBeenCalled();
  });

  it("a manager must pick their own club and an opponent", async () => {
    signIn(as("user"));
    manages("A");
    expect(await createMatchAction({ ...newMatch, homeClubId: "A" }))
      .toEqual({ ok: false, error: "Pick the other club." });
    expect(await createMatchAction({ ...newMatch, homeClubId: "A", awayClubId: "A" }))
      .toEqual({ ok: false, error: "Pick two different clubs." });
    expect(repo.createMatch).not.toHaveBeenCalled();
  });

  it("a manager creates with both clubs", async () => {
    signIn(as("user", "mgr"));
    manages("A");
    expect(await createMatchAction({ ...newMatch, homeClubId: "A", awayClubId: "B" }))
      .toEqual({ ok: true, data: { kind: "created", id: "new-id" } });
    expect(repo.createMatch).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: "mgr", homeClubId: "A", awayClubId: "B" }),
    );
  });

  it("a duplicate is returned, not created, unless allowed", async () => {
    signIn(as("user"));
    manages("A");
    const dup = {
      id: "m0", entryDate: newMatch.entryDate, status: "draft", isFriendly: false,
      homeSentAt: null, awaySentAt: null, homeLabel: "B", awayLabel: "A",
      sideClubs: [{ side: "home", clubId: "B" }, { side: "away", clubId: "A" }],
    };
    // The summary's score line never goes back to the form.
    vi.mocked(repo.listMatches).mockResolvedValue([{ ...dup, scoreLine: "3 - 1" } as never]);
    const res = await createMatchAction({ ...newMatch, homeClubId: "A", awayClubId: "B" });
    expect(res).toEqual({ ok: true, data: { kind: "duplicates", matches: [dup] } });
    expect(repo.listMatches).toHaveBeenCalledWith({ entryDate: newMatch.entryDate });
    expect(repo.createMatch).not.toHaveBeenCalled();

    await createMatchAction({ ...newMatch, homeClubId: "A", awayClubId: "B", allowDuplicate: true });
    expect(repo.createMatch).toHaveBeenCalled();
  });

  it("staff need no clubs and skip the duplicate check without both", async () => {
    signIn(as("admin", "staff"));
    expect(await createMatchAction(newMatch)).toEqual({ ok: true, data: { kind: "created", id: "new-id" } });
    expect(repo.createMatch).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: "staff", homeClubId: null, awayClubId: null }),
    );
    expect(repo.listManagedClubIds).not.toHaveBeenCalled();
    expect(repo.listMatches).not.toHaveBeenCalled();
  });
});

describe("createMatchAction lookup failure", () => {
  it("a failed managed-clubs lookup is an error, not a refusal or a pass", async () => {
    signIn(as("user"));
    vi.mocked(repo.listManagedClubIds).mockRejectedValue(new Error("Failed to load your clubs: db down"));
    const res = await createMatchAction({ ...newMatch, homeClubId: "A", awayClubId: "B" });
    expect(res).toEqual({ ok: false, error: "Failed to load your clubs: db down" });
    expect(repo.createMatch).not.toHaveBeenCalled();
  });
});

describe("sendTeamAction", () => {
  beforeEach(() => {
    signIn(as("user", "mgr"));
    manages("A");
    vi.mocked(repo.getMatch).mockResolvedValue(draft(withPlayers));
    vi.mocked(repo.finishSending).mockResolvedValue("draft");
  });

  it("sends the manager's own team and returns the status after", async () => {
    expect(await sendTeamAction("m1", "home")).toEqual({ ok: true, data: "draft" });
    expect(repo.sendTeam).toHaveBeenCalledWith("m1", "home");
    expect(repo.finishSending).toHaveBeenCalledWith("m1", "mgr");
  });

  it("refuses the other team, and an empty own team", async () => {
    expect(await sendTeamAction("m1", "away")).toEqual({ ok: false, error: NOT_YOUR_TEAM });
    vi.mocked(repo.getMatch).mockResolvedValue(draft());
    expect(await sendTeamAction("m1", "home"))
      .toEqual({ ok: false, error: "Add at least one player to your team before sending." });
    expect(repo.sendTeam).not.toHaveBeenCalled();
  });

  it("refuses a match with a club missing", async () => {
    vi.mocked(repo.getMatch).mockResolvedValue(draft({
      ...withPlayers,
      halves: [{ id: "h1", halfNo: 1, sides: [side("home", "A")] }],
    }));
    expect(await sendTeamAction("m1", "home"))
      .toEqual({ ok: false, error: "Pick a club for both sides before sending." });
  });

  it("refuses a team already sent", async () => {
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ ...withPlayers, homeSentAt: "t" }));
    expect(await sendTeamAction("m1", "home")).toEqual({ ok: false, error: TEAM_SENT });
  });
});

describe("makeOfficialAction", () => {
  beforeEach(() => {
    vi.mocked(repo.getActiveSeason).mockResolvedValue({ id: "s2" } as never);
    vi.mocked(loadStatRates).mockResolvedValue(DEFAULT_STAT_RATES);
    vi.mocked(loadSportStats).mockResolvedValue(DEFAULT_SPORT_STATS);
  });

  it("a manager can't", async () => {
    signIn(as("user"));
    manages("A");
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ ...withPlayers, status: "sent" }));
    expect(await makeOfficialAction("m1")).toEqual({ ok: false, error: WAITING });
    expect(repo.makeOfficial).not.toHaveBeenCalled();
  });

  it("staff make a sent league match official in the active season", async () => {
    signIn(as("admin"));
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ ...withPlayers, status: "sent" }));
    const res = await makeOfficialAction("m1");
    expect(res.ok).toBe(true);
    expect(repo.makeOfficial).toHaveBeenCalledWith("m1", "s2", "admin-id");
  });

  it("a friendly carries no season", async () => {
    signIn(as("admin"));
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ ...withPlayers, isFriendly: true }));
    await makeOfficialAction("m1");
    expect(repo.makeOfficial).toHaveBeenCalledWith("m1", null, "admin-id");
  });

  it("an official match is locked", async () => {
    signIn(as("admin"));
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ status: "submitted" }));
    expect(await makeOfficialAction("m1")).toEqual({ ok: false, error: LOCKED });
  });

  it("a club leading home in one half and away in the other is refused", async () => {
    signIn(as("admin"));
    vi.mocked(repo.getMatch).mockResolvedValue(draft({
      ...withPlayers,
      isCombined: true,
      halves: [
        { id: "h1", halfNo: 1, sides: [side("home", "A"), side("away", "B")] },
        { id: "h2", halfNo: 2, sides: [side("home", "C"), side("away", "A")] },
      ],
    }));
    expect(await makeOfficialAction("m1")).toEqual({
      ok: false,
      error: "A club can't be on both sides of one match. Fix the clubs before submitting.",
    });
  });

  it("a lost race surfaces the repository's locked message", async () => {
    signIn(as("admin"));
    vi.mocked(repo.getMatch).mockResolvedValue(draft(withPlayers));
    vi.mocked(repo.makeOfficial).mockRejectedValue(new Error(LOCKED));
    expect(await makeOfficialAction("m1")).toEqual({ ok: false, error: LOCKED });
  });
});

describe("sendBackAction", () => {
  it("staff send a sent match back", async () => {
    signIn(as("admin"));
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ status: "sent", homeSentAt: "t", awaySentAt: "t" }));
    expect(await sendBackAction("m1")).toEqual({ ok: true, data: undefined });
    expect(repo.sendBack).toHaveBeenCalledWith("m1");
  });
  it("a manager can't", async () => {
    signIn(as("user"));
    manages("A");
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ status: "sent" }));
    expect(await sendBackAction("m1")).toEqual({ ok: false, error: WAITING });
  });
  it("nothing to send back on an unsent draft", async () => {
    signIn(as("admin"));
    expect(await sendBackAction("m1")).toEqual({ ok: false, error: "No team has been sent yet." });
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
  it("KFANDRA reopens a league match to Sent, a friendly to Draft", async () => {
    signIn(as("kfandra"));
    expect(await reopenMatchAction("m1")).toEqual({ ok: true, data: undefined });
    expect(repo.reopenMatch).toHaveBeenCalledWith("m1", "sent");
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ status: "submitted", isFriendly: true }));
    await reopenMatchAction("m1");
    expect(repo.reopenMatch).toHaveBeenLastCalledWith("m1", "draft");
  });
});

describe("setGoalTimesAction", () => {
  const timed = (over: Partial<MatchDraft> = {}) => draft({
    sport: "fooba",
    appearances: [{
      id: "ap1", side: "home", slot: 1, playerId: "p1", displayName: "P1",
      stats: { 1: { mainGoal: 2 } },
    }],
    ...over,
  });

  it("a manager times their own team's goals", async () => {
    signIn(as("user"));
    manages("A");
    vi.mocked(repo.getMatch).mockResolvedValue(timed());
    expect(await setGoalTimesAction("m1", "ap1", 1, "mainGoal", [12, null]))
      .toEqual({ ok: true, data: undefined });
    expect(repo.setGoalTimes).toHaveBeenCalledWith("ap1", 1, "mainGoal", [12]);
  });

  it("staff add times to an official match; a manager can't", async () => {
    vi.mocked(repo.getMatch).mockResolvedValue(timed({ status: "submitted" }));
    signIn(as("admin"));
    expect(await setGoalTimesAction("m1", "ap1", 1, "mainGoal", [12, 34])).toEqual({ ok: true, data: undefined });
    signIn(as("user"));
    manages("A");
    expect(await setGoalTimesAction("m1", "ap1", 1, "mainGoal", [12])).toEqual({ ok: false, error: LOCKED });
  });

  it("refuses untimed stats, too many times, and bad minutes", async () => {
    signIn(as("admin"));
    vi.mocked(repo.getMatch).mockResolvedValue(timed());
    expect(await setGoalTimesAction("m1", "ap1", 1, "assist", [1]))
      .toEqual({ ok: false, error: "Times are only kept for league Fooba goals and Rugby Sox tries." });
    expect(await setGoalTimesAction("m1", "ap1", 1, "mainGoal", [1, 2, 3]))
      .toEqual({ ok: false, error: "More times than goals: lower the times first." });
    expect(await setGoalTimesAction("m1", "ap1", 1, "mainGoal", [200]))
      .toEqual({ ok: false, error: "Enter whole minutes between 0 and 150." });
    expect(repo.setGoalTimes).not.toHaveBeenCalled();
  });
});

describe("league/friendly toggle can't launder a score", () => {
  const friendlyWithScore = () => draft({ isFriendly: true });

  it("a manager turning a friendly into a league match clears the scores", async () => {
    signIn(as("user"));
    manages("A");
    vi.mocked(repo.getMatch).mockResolvedValue(friendlyWithScore());
    expect(await updateMatchMetaAction("m1", { isFriendly: false })).toEqual({ ok: true, data: undefined });
    expect(repo.updateMatchMeta).toHaveBeenCalledWith("m1", { isFriendly: false });
    expect(repo.clearScores).toHaveBeenCalledWith("m1");
  });

  it("staff keep the scores when they flip it", async () => {
    signIn(as("admin"));
    vi.mocked(repo.getMatch).mockResolvedValue(friendlyWithScore());
    await updateMatchMetaAction("m1", { isFriendly: false });
    expect(repo.updateMatchMeta).toHaveBeenCalled();
    expect(repo.clearScores).not.toHaveBeenCalled();
  });

  it("a manager turning a league match into a friendly clears nothing", async () => {
    signIn(as("user"));
    manages("A");
    await updateMatchMetaAction("m1", { isFriendly: true });
    expect(repo.updateMatchMeta).toHaveBeenCalled();
    expect(repo.clearScores).not.toHaveBeenCalled();
  });
});

describe("more gate checks", () => {
  it("make official with no active season is refused, nothing written", async () => {
    signIn(as("admin"));
    vi.mocked(repo.getActiveSeason).mockResolvedValue(null);
    vi.mocked(repo.getMatch).mockResolvedValue(draft(withPlayers));
    expect(await makeOfficialAction("m1"))
      .toEqual({ ok: false, error: "No active season. Start one in Seasons first." });
    expect(repo.makeOfficial).not.toHaveBeenCalled();
  });

  it("staff can't add, remove or set stats on an official match", async () => {
    signIn(as("admin"));
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ ...withPlayers, status: "submitted" }));
    expect(await addAppearanceAction("m1", "p9", "home")).toEqual({ ok: false, error: LOCKED });
    expect(await setStatAction("m1", "ap1", 1, "goal", 1)).toEqual({ ok: false, error: LOCKED });
    expect(repo.addAppearance).not.toHaveBeenCalled();
    expect(repo.setStat).not.toHaveBeenCalled();
  });

  it("staff can't send an official match back", async () => {
    signIn(as("admin"));
    vi.mocked(repo.getMatch).mockResolvedValue(draft({ status: "submitted" }));
    expect(await sendBackAction("m1")).toEqual({ ok: false, error: LOCKED });
    expect(repo.sendBack).not.toHaveBeenCalled();
  });

  describe("goal times as a manager of A", () => {
    const app = (side: SideKey) => ({
      id: "ap1", side, slot: 1, playerId: "p1", displayName: "P1", stats: { 1: { mainGoal: 2 } },
    });
    beforeEach(() => { signIn(as("user")); manages("A"); });

    it("the other team's goals are off limits", async () => {
      vi.mocked(repo.getMatch).mockResolvedValue(draft({ sport: "fooba", appearances: [app("away")] } as never));
      expect(await setGoalTimesAction("m1", "ap1", 1, "mainGoal", [12])).toEqual({ ok: false, error: NOT_YOUR_TEAM });
      expect(repo.setGoalTimes).not.toHaveBeenCalled();
    });

    it("their own team once sent is closed", async () => {
      vi.mocked(repo.getMatch).mockResolvedValue(
        draft({ sport: "fooba", homeSentAt: "t", appearances: [app("home")] } as never),
      );
      expect(await setGoalTimesAction("m1", "ap1", 1, "mainGoal", [12])).toEqual({ ok: false, error: TEAM_SENT });
      expect(repo.setGoalTimes).not.toHaveBeenCalled();
    });

    it("a friendly keeps no times", async () => {
      vi.mocked(repo.getMatch).mockResolvedValue(
        draft({ sport: "fooba", isFriendly: true, appearances: [app("home")] } as never),
      );
      expect((await setGoalTimesAction("m1", "ap1", 1, "mainGoal", [12])).ok).toBe(false);
      expect(repo.setGoalTimes).not.toHaveBeenCalled();
    });
  });

  describe("once one team is sent, a manager's details are fixed", () => {
    beforeEach(() => {
      signIn(as("user"));
      manages("A");
      vi.mocked(repo.getMatch).mockResolvedValue(draft({ awaySentAt: "t" }));
    });

    it("meta and delete are refused", async () => {
      expect(await updateMatchMetaAction("m1", { isFriendly: true })).toEqual({ ok: false, error: DETAILS_FIXED });
      expect(await deleteMatchAction("m1")).toEqual({ ok: false, error: DETAILS_FIXED });
      expect(repo.updateMatchMeta).not.toHaveBeenCalled();
      expect(repo.deleteMatch).not.toHaveBeenCalled();
    });

    it("changing their own side's club is refused", async () => {
      expect((await setSideClubAction("m1", "h1", "home", "C")).ok).toBe(false);
      expect(repo.setSideClub).not.toHaveBeenCalled();
    });
  });
});
