import { test, expect, expectNoErrors, type Page } from "./fixtures";
import { openAs, seedPlayer, signIn, signInAs, type TestPlayer } from "./helpers/auth";
import * as db from "./helpers/db";
import * as rec from "./helpers/recorder";
import { DEFAULT_STAT_RATES } from "../src/lib/klcsra/stat-rates";
import { DEFAULT_SPORT_STATS } from "../src/lib/klcsra/sport-stats";

/**
 * The KLCSRA match recorder, end to end.
 *
 * Every KR/MMG number asserted here is derived by `expectedPayout()` — count x
 * rate straight off `DEFAULT_STAT_RATES` — and never hardcoded. The first test
 * checks the rate card stored in `app_config` still IS that card, so a tuned
 * rate fails with an explanation instead of six mystery numbers.
 *
 * The suite owns its data: it seeds its own players, deletes every match it
 * makes, and restores `klc_seasons` to the state it found.
 */

const SEASON = "KLCFERRSXVSG2";
/** Inside Season 2's window (it starts 2026-08-22). */
const MATCH_DATE = "2026-08-23";

const LOCKED = "This match is locked. Reopen it first.";
const NO_ACTIVE_SEASON = "No active season. Start one in Seasons first.";
const NOT_KFANDRA = "Only KFANDRA can reopen a submitted match.";

let seasonsBefore: db.SeasonRow[];

test.beforeEach(async () => {
  seasonsBefore = await db.snapshotSeasons();
  await db.resetKlcsraData();
  // Most tests need a live season; the one that does not closes it explicitly.
  await db.activateSeason(SEASON);
});

test.afterEach(async () => {
  await db.resetKlcsraData();
  await db.restoreSeasons(seasonsBefore);
});

/** Seed `n` ordinary members to fill the squads with. */
async function seedMembers(n: number): Promise<TestPlayer[]> {
  const players: TestPlayer[] = [];
  for (let i = 1; i <= n; i += 1) {
    players.push(await seedPlayer("user", `E2E Player ${i}`));
  }
  return players;
}

/**
 * The smallest submittable match: both sides have a club, one player is in the
 * squad. Used by the tests that are about the lock rather than the arithmetic.
 */
async function minimalMatch(
  page: Page,
  opts: { friendly?: boolean } = {},
): Promise<{ matchId: string; member: TestPlayer }> {
  const [member] = await seedMembers(1);
  const clubs = await db.listClubs(2);
  const matchId = await rec.createMatch(page, {
    date: MATCH_DATE,
    sport: "football",
    friendly: opts.friendly,
  });
  await rec.pickClub(page, 1, "home", clubs[0].id);
  await rec.pickClub(page, 1, "away", clubs[1].id);
  await rec.addPlayer(page, "home", member.id);
  return { matchId, member };
}

test.describe("KLCSRA recorder", () => {
  test("the stored rate card is the one every hand-calculation here assumes", async () => {
    // If this fails, someone tuned `app_config.klcsra_stat_rates`. The totals
    // below are derived from DEFAULT_STAT_RATES, so they would be wrong too.
    expect(await db.loadStoredStatRates()).toEqual(DEFAULT_STAT_RATES);
  });

  test("records a football match and pays the hand-calculated KR and MMG", async ({
    page,
    errors,
  }) => {
    await signInAs(page.context(), "admin");
    const members = await seedMembers(6);
    const clubs = await db.listClubs(2);

    // Six players, both sides, positive and negative stats.
    const home: rec.StatCounts[] = [
      { goal: 2, assist: 1 },
      { assist: 1, preAssist: 1 },
      { save: 1, yellowCard: 1 },
    ];
    const away: rec.StatCounts[] = [
      { goal: 1 },
      { ownGoal: 1 },
      { redCard: 1, lateChallenge: 1 },
    ];

    const matchId = await rec.createMatch(page, { date: MATCH_DATE, sport: "football" });

    await rec.pickClub(page, 1, "home", clubs[0].id);
    await rec.pickClub(page, 1, "away", clubs[1].id);
    await rec.setScore(page, 1, "home", 3);
    await rec.setScore(page, 1, "away", 1);

    for (let i = 0; i < 3; i += 1) {
      await rec.addPlayer(page, "home", members[i].id);
      await rec.addPlayer(page, "away", members[i + 3].id);
    }

    // The sport allow-list reaches the UI: football offers no `try` or `tackle`.
    expect(await rec.offeredStats(page, "home", members[0].id)).toEqual([
      ...DEFAULT_SPORT_STATS.football,
    ]);

    for (let i = 0; i < 3; i += 1) {
      await rec.recordStats(page, "home", members[i].id, home[i]);
      await rec.recordStats(page, "away", members[i + 3].id, away[i]);
    }

    const total = rec.expectedTotal([...home, ...away]);
    // Sanity: a match that nets zero would make the assertions meaningless.
    expect(total).toEqual({ kr: 35, mmg: 900 });

    // The running preview must already agree before anything is locked.
    await rec.expectTotals(page, total);

    await rec.submitMatch(page);
    await expect(page.getByTestId("match-status")).toHaveText("submitted");
    await rec.expectTotals(page, total);

    // Per player, so a compensating pair of errors cannot hide in the total.
    for (let i = 0; i < 3; i += 1) {
      await rec.expectPlayerPayout(page, members[i].id, rec.expectedPayout(home[i]));
      await rec.expectPlayerPayout(page, members[i + 3].id, rec.expectedPayout(away[i]));
    }

    // The submitted match carries the ACTIVE season's tag.
    const season = await db.findSeason(SEASON);
    const stored = await db.getMatchRow(matchId);
    expect(stored?.status).toBe("submitted");
    expect(stored?.season_id).toBe(season.id);

    await page.goto("/admin/klc/matches");
    const row = rec.matchRow(page, matchId);
    await expect(row.getByTestId("tag-season")).toHaveText(SEASON);
    await expect(row.getByTestId("match-status")).toHaveText("submitted");
    await expect(row.getByTestId("match-score")).toContainText("3 - 1");

    expectNoErrors(errors);
  });

  test("a friendly credits zero KR, leaves MMG intact and carries no season", async ({
    page,
  }) => {
    await signInAs(page.context(), "admin");
    const members = await seedMembers(2);
    const clubs = await db.listClubs(2);

    const line: rec.StatCounts = { goal: 1, assist: 1 };
    const asLeague = rec.expectedPayout(line);
    // The test is only meaningful if these stats WOULD have paid Kroopies.
    expect(asLeague.kr).toBeGreaterThan(0);

    const matchId = await rec.createMatch(page, {
      date: MATCH_DATE,
      sport: "football",
      friendly: true,
    });
    await expect(page.getByTestId("flag-friendly")).toBeVisible();

    await rec.pickClub(page, 1, "home", clubs[0].id);
    await rec.pickClub(page, 1, "away", clubs[1].id);
    await rec.addPlayer(page, "home", members[0].id);
    await rec.addPlayer(page, "away", members[1].id);
    await rec.recordStats(page, "home", members[0].id, line);

    const friendly = { kr: 0, mmg: asLeague.mmg };
    await rec.expectTotals(page, friendly);

    await rec.submitMatch(page);
    await rec.expectTotals(page, friendly);
    await rec.expectPlayerPayout(page, members[0].id, friendly);

    // No season tag, in the database and on the list.
    const stored = await db.getMatchRow(matchId);
    expect(stored?.status).toBe("submitted");
    expect(stored?.is_friendly).toBe(true);
    expect(stored?.season_id).toBeNull();

    await page.goto("/admin/klc/matches");
    const row = rec.matchRow(page, matchId);
    await expect(row.getByTestId("tag-friendly")).toBeVisible();
    await expect(row.getByTestId("tag-season")).toHaveCount(0);
  });

  test("refuses to submit a league match while no season is active", async ({ page }) => {
    await signInAs(page.context(), "admin");
    // KFANDRA's own starting state: Season 2 exists but nobody pressed Start.
    await db.deactivateAllSeasons();

    const { matchId } = await minimalMatch(page);
    expect(await rec.submitExpectingError(page)).toBe(NO_ACTIVE_SEASON);

    expect((await db.getMatchRow(matchId))?.status).toBe("draft");
    await expect(page.getByTestId("lock-banner")).toHaveCount(0);
  });

  test("a submitted match refuses edits from a tab that still thinks it is a draft", async ({
    page,
    context,
  }) => {
    await signInAs(page.context(), "admin");
    const { matchId, member } = await minimalMatch(page);
    await rec.recordStat(page, "home", member.id, "goal", 1);

    // A second tab, rendered while the match was still editable. This is the
    // only way to reach the lock through the UI: once a match is submitted the
    // recorder stops rendering its steppers at all.
    const stale = await context.newPage();
    await rec.openMatch(stale, matchId);
    await expect(rec.statCell(stale, "home", member.id, "goal")).toBeVisible();

    await rec.submitMatch(page);

    await rec.statCell(stale, "home", member.id, "goal").getByTestId("stat-inc").click();
    await expect(
      rec.playerRow(stale, "home", member.id).getByTestId("player-error"),
    ).toHaveText(LOCKED);

    // The refusal is real: nothing was written.
    const stats = await db.listStatRows(matchId);
    expect(stats).toEqual([
      { player_id: member.id, half_no: 1, stat_key: "goal", stat_count: 1 },
    ]);

    // And a fresh render of the locked match offers no way in.
    await stale.reload();
    await expect(stale.getByTestId("lock-banner")).toBeVisible();
    await expect(stale.getByTestId("submit-match")).toHaveCount(0);
    await expect(stale.getByTestId("stat-inc")).toHaveCount(0);
    await stale.close();
  });

  test("a plain admin cannot reopen a submitted match; KFANDRA can", async ({
    page,
    browser,
  }) => {
    const admin = await signInAs(page.context(), "admin");
    const { matchId, member } = await minimalMatch(page);
    await rec.recordStat(page, "home", member.id, "goal", 1);
    await rec.submitMatch(page);

    const before = rec.expectedPayout({ goal: 1 });
    await rec.expectTotals(page, before);

    // The admin is not offered the button at all.
    await expect(page.getByTestId("reopen-match")).toHaveCount(0);
    await expect(page.getByText("Only KFANDRA can reopen a match.")).toBeVisible();

    const kfandra = await openAs(browser, "kfandra");
    try {
      await rec.openMatch(kfandra.page, matchId);
      await expect(kfandra.page.getByTestId("reopen-match")).toBeVisible();

      // Swap the session cookie for the admin's without reloading: the button
      // is still on screen, but `reopenMatchAction` re-resolves the caller and
      // must refuse. A rendered button is never permission.
      await signIn(kfandra.context, admin);
      await kfandra.page.getByTestId("reopen-match").click();
      await expect(kfandra.page.getByTestId("reopen-error")).toHaveText(NOT_KFANDRA);
      expect((await db.getMatchRow(matchId))?.status).toBe("submitted");

      // Same button, same page, back as KFANDRA — now it works.
      await signIn(kfandra.context, kfandra.player);
      await kfandra.page.getByTestId("reopen-match").click();
      await expect(kfandra.page.getByTestId("submit-match")).toBeVisible();
      await expect(kfandra.page.getByTestId("match-status")).toHaveText("draft");

      const reopened = await db.getMatchRow(matchId);
      expect(reopened?.status).toBe("draft");
      // Reopening un-tags the season — it is re-stamped on the next Submit.
      expect(reopened?.season_id).toBeNull();
      expect(reopened?.submitted_at).toBeNull();

      // Edit, then re-submit.
      await rec.recordStat(kfandra.page, "home", member.id, "assist", 1);
      const after = rec.expectedPayout({ goal: 1, assist: 1 });
      expect(after.kr).toBeGreaterThan(before.kr);
      await rec.expectTotals(kfandra.page, after);

      await rec.submitMatch(kfandra.page);
      await rec.expectTotals(kfandra.page, after);

      const resubmitted = await db.getMatchRow(matchId);
      expect(resubmitted?.status).toBe("submitted");
      expect(resubmitted?.season_id).toBe((await db.findSeason(SEASON)).id);
    } finally {
      await kfandra.context.close();
    }
  });

  test("a combined match keeps each half's stats separate", async ({ page }) => {
    await signInAs(page.context(), "admin");
    const members = await seedMembers(2);
    const clubs = await db.listClubs(2);

    const matchId = await rec.createMatch(page, {
      date: MATCH_DATE,
      sport: "football",
      combined: true,
    });

    for (const halfNo of [1, 2]) {
      await rec.pickClub(page, halfNo, "home", clubs[0].id);
      await rec.pickClub(page, halfNo, "away", clubs[1].id);
    }
    await rec.setScore(page, 1, "home", 2);
    await rec.setScore(page, 1, "away", 1);
    await rec.setScore(page, 2, "home", 1);
    await rec.setScore(page, 2, "away", 1);

    await rec.addPlayer(page, "home", members[0].id);
    await rec.addPlayer(page, "away", members[1].id);

    const goal = rec.statCell(page, "home", members[0].id, "goal");
    const assist = rec.statCell(page, "home", members[0].id, "assist");

    // Half 1: one goal.
    await rec.selectHalf(page, 1);
    await rec.recordStat(page, "home", members[0].id, "goal", 1);

    // Half 2 starts empty — the toggle changes which half is being written to,
    // it does not carry half 1's tallies across.
    await rec.selectHalf(page, 2);
    await expect(goal).toHaveAttribute("data-stat-count", "0");
    await rec.recordStat(page, "home", members[0].id, "assist", 2);

    // Back to half 1: still one goal, still no assists.
    await rec.selectHalf(page, 1);
    await expect(goal).toHaveAttribute("data-stat-count", "1");
    await expect(assist).toHaveAttribute("data-stat-count", "0");

    // A player earns independently in each half, so the halves are added.
    const total = rec.expectedPayout({ goal: 1, assist: 2 });
    await rec.expectTotals(page, total);
    await rec.submitMatch(page);
    await rec.expectTotals(page, total);
    await rec.expectPlayerPayout(page, members[0].id, total);

    // Stored per half, not merged.
    expect(await db.listStatRows(matchId)).toEqual([
      { player_id: members[0].id, half_no: 1, stat_key: "goal", stat_count: 1 },
      { player_id: members[0].id, half_no: 2, stat_key: "assist", stat_count: 2 },
    ]);

    await page.goto("/admin/klc/matches");
    const row = rec.matchRow(page, matchId);
    await expect(row.getByTestId("tag-combined")).toBeVisible();
    await expect(row.getByTestId("match-score")).toContainText("3 - 2");
  });
});
