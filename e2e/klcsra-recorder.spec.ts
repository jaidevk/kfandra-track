import { test, expect, expectNoErrors, type Page } from "./fixtures";
import { openAs, seedPlayer, signIn, signInAs, type TestPlayer } from "./helpers/auth";
import * as db from "./helpers/db";
import * as rec from "./helpers/recorder";
import { DEFAULT_STAT_RATES, STAT_KEYS } from "../src/lib/klcsra/stat-rates";
import { DEFAULT_SPORT_STATS, type Sport } from "../src/lib/klcsra/sport-stats";

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

/** The one club in the real seed with no manager account. */
const NO_MANAGER_CLUB = "Deep Waters";

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
  // Deleting the seeded players also clears any club that was pointed at one
  // (`clubs.manager_player_id` is ON DELETE SET NULL), so the manager test
  // needs no teardown of its own.
  await db.resetKlcsraData();
  await db.restoreSeasons(seasonsBefore);
});

/**
 * The stat keys a sport should offer, in canonical `STAT_KEYS` order.
 *
 * Re-derived here rather than by calling `statsForSport()`, which is the code
 * under test — the popup's order comes from that function, so asking it what
 * to expect would prove nothing. `DEFAULT_SPORT_STATS` declares rugby as
 * `try, tackle, assist, …`; canonical order is `try, assist, preAssist,
 * tackle, …`, which is why this cannot just be the declared array.
 */
function allowList(sport: Sport): string[] {
  const allowed = new Set<string>(DEFAULT_SPORT_STATS[sport]);
  return STAT_KEYS.filter((k) => allowed.has(k));
}

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
 *
 * The clubs it picks have no manager account in the seed, so nothing is
 * auto-added to the squad and `member` is the only player in the match.
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
    // A league match shows the season it WILL be tagged with, before submitting.
    await expect(page.getByTestId("flag-season")).toHaveText(SEASON);

    await rec.pickClub(page, 1, "home", clubs[0].id);
    await rec.pickClub(page, 1, "away", clubs[1].id);
    await rec.setScore(page, 1, "home", 3);
    await rec.setScore(page, 1, "away", 1);

    for (let i = 0; i < 3; i += 1) {
      await rec.addPlayer(page, "home", members[i].id);
      await rec.addPlayer(page, "away", members[i + 3].id);
    }

    // The sport allow-list reaches the popup: football offers no `try` or `tackle`.
    await rec.openStats(page, "home", members[0].id);
    expect(await rec.offeredStats(page)).toEqual(allowList("football"));
    await rec.closeStats(page, { saved: false });

    for (let i = 0; i < 3; i += 1) {
      await rec.recordStats(page, "home", members[i].id, home[i]);
      await rec.recordStats(page, "away", members[i + 3].id, away[i]);
    }

    const total = rec.expectedTotal([...home, ...away]);
    // Sanity: a match that nets zero would make the assertions meaningless.
    expect(total).toEqual({ kr: 35, mmg: 900 });

    // The running preview must already agree before anything is locked.
    await rec.expectTotals(page, total);
    // Every pre-submit check is green, so the refusal path below is about the
    // action and not about a half-built match.
    await expect(page.getByTestId("submit-check")).toHaveCount(3);
    await expect(
      page.locator('[data-testid="submit-check"][data-ok="false"]'),
    ).toHaveCount(0);

    await rec.submitMatch(page);
    await expect(page.getByTestId("match-status")).toHaveText("submitted");
    await expect(page.getByTestId("audit-line")).toContainText("E2E Admin");
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
    await expect(row.getByTestId("match-sport")).toHaveText("Football");
    // Grouped under its own date heading.
    await expect(
      page.locator(`[data-testid="match-date-group"][data-date="${MATCH_DATE}"]`),
    ).toContainText("3 - 1");

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
    // A friendly is never season-tagged, so it shows neither flag.
    await expect(page.getByTestId("flag-season")).toHaveCount(0);

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

    // The header and the checklist both say so before Submit is ever pressed…
    await expect(page.getByTestId("flag-no-season")).toBeVisible();
    // `toContainText`, not `toHaveText`: the line is prefixed with its own
    // bullet glyph. The wording after it must still be the action's, verbatim.
    await expect(
      page.locator('[data-testid="submit-check"][data-ok="false"]'),
    ).toContainText(NO_ACTIVE_SEASON);

    // …but the checks are advisory, and the refusal is the action's own wording.
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
    await rec.recordStats(page, "home", member.id, { goal: 1 });

    // A second tab, rendered while the match was still editable, with the stats
    // popup already open. This is the only way to reach the lock through the
    // UI: once a match is submitted the popup stops rendering its steppers.
    const stale = await context.newPage();
    await rec.openMatch(stale, matchId);
    await rec.openStats(stale, "home", member.id);
    await expect(rec.statCell(stale, "goal")).toHaveAttribute("data-stat-count", "1");

    await rec.submitMatch(page);

    await rec.statCell(stale, "goal").getByTestId("stat-inc").click();
    await expect(stale.getByTestId("stats-error")).toHaveText(LOCKED);
    // The same refusal is on the squad slot behind the popup.
    await expect(
      rec.playerRow(stale, "home", member.id).getByTestId("player-error"),
    ).toHaveText(LOCKED);
    // The optimistic 2 rolls back to stored truth rather than lying.
    await expect(rec.statCell(stale, "goal")).toHaveAttribute("data-stat-count", "1");

    // The refusal is real: nothing was written.
    const stats = await db.listStatRows(matchId);
    expect(stats).toEqual([
      { player_id: member.id, half_no: 1, stat_key: "goal", stat_count: 1 },
    ]);

    // And a fresh render of the locked match offers no way in. The popup still
    // opens — a locked match is a record you can read — but it has no steppers.
    await stale.reload();
    await expect(stale.getByTestId("lock-banner")).toBeVisible();
    await expect(stale.getByTestId("submit-match")).toHaveCount(0);
    await expect(stale.getByTestId("remove-player")).toHaveCount(0);
    await expect(stale.getByTestId("member-select-home")).toHaveCount(0);
    await rec.openStats(stale, "home", member.id);
    await expect(rec.statCell(stale, "goal")).toHaveAttribute("data-stat-count", "1");
    await expect(stale.getByTestId("stat-inc")).toHaveCount(0);
    await expect(stale.getByTestId("stat-dec")).toHaveCount(0);
    await stale.close();
  });

  test("a plain admin cannot reopen a submitted match; KFANDRA can", async ({
    page,
    browser,
  }) => {
    const admin = await signInAs(page.context(), "admin");
    const { matchId, member } = await minimalMatch(page);
    await rec.recordStats(page, "home", member.id, { goal: 1 });
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

      // Reopen is a two-step: the button only opens a warning. Backing out of
      // that warning must leave the match exactly as locked as it was.
      const dialog = await rec.openReopenDialog(kfandra.page);
      await kfandra.page.getByTestId("reopen-cancel").click();
      await expect(dialog).toHaveCount(0);
      await expect(kfandra.page.getByTestId("lock-banner")).toBeVisible();
      await expect(kfandra.page.getByTestId("submit-match")).toHaveCount(0);
      expect((await db.getMatchRow(matchId))?.status).toBe("submitted");

      // Swap the session cookie for the admin's without reloading: the dialog
      // is still on screen, but `reopenMatchAction` re-resolves the caller and
      // must refuse. A rendered button is never permission.
      await rec.openReopenDialog(kfandra.page);
      await signIn(kfandra.context, admin);
      await kfandra.page.getByTestId("reopen-confirm").click();
      await expect(
        kfandra.page.getByTestId("reopen-dialog").getByTestId("reopen-error"),
      ).toHaveText(NOT_KFANDRA);
      expect((await db.getMatchRow(matchId))?.status).toBe("submitted");

      // Same button, same dialog, back as KFANDRA — now it works.
      await signIn(kfandra.context, kfandra.player);
      await kfandra.page.getByTestId("reopen-confirm").click();
      await expect(kfandra.page.getByTestId("submit-match")).toBeVisible();
      await expect(kfandra.page.getByTestId("match-status")).toHaveText("draft");
      await expect(kfandra.page.getByTestId("lock-banner")).toHaveCount(0);

      const reopened = await db.getMatchRow(matchId);
      expect(reopened?.status).toBe("draft");
      // Reopening un-tags the season — it is re-stamped on the next Submit.
      expect(reopened?.season_id).toBeNull();
      expect(reopened?.submitted_at).toBeNull();

      // Edit, then re-submit.
      await rec.recordStats(kfandra.page, "home", member.id, { assist: 1 });
      const after = rec.expectedPayout({ goal: 1, assist: 1 });
      expect(after.kr).toBeGreaterThan(before.kr);
      await rec.expectTotals(kfandra.page, after);

      await rec.submitMatch(kfandra.page);
      await rec.expectTotals(kfandra.page, after);
      await expect(kfandra.page.getByTestId("audit-line")).toContainText("E2E KFANDRA");

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
    await expect(page.getByTestId("flag-combined")).toBeVisible();

    // Only the ACTIVE half's card is rendered, so each half is set up in turn.
    await rec.pickClub(page, 1, "home", clubs[0].id);
    await rec.pickClub(page, 1, "away", clubs[1].id);
    await rec.setScore(page, 1, "home", 2);
    await rec.setScore(page, 1, "away", 1);

    await rec.selectHalf(page, 2);
    // Half 2 opens with no clubs, so the recorder offers to swap them over.
    // Picking half 2's clubs by hand answers the prompt and dismisses it.
    await expect(page.getByTestId("swap-prompt")).toBeVisible();
    await rec.pickClub(page, 2, "home", clubs[0].id);
    await rec.pickClub(page, 2, "away", clubs[1].id);
    await expect(page.getByTestId("swap-prompt")).toHaveCount(0);
    await rec.setScore(page, 2, "home", 1);
    await rec.setScore(page, 2, "away", 1);

    // The squad is match-level: added once, it carries across both halves.
    await rec.addPlayer(page, "home", members[0].id);
    await rec.addPlayer(page, "away", members[1].id);

    // Half 1: one goal.
    await rec.selectHalf(page, 1);
    await rec.recordStats(page, "home", members[0].id, { goal: 1 });

    // Half 2 starts empty — the toggle changes which half is being written to,
    // it does not carry half 1's tallies across.
    await rec.selectHalf(page, 2);
    await rec.openStats(page, "home", members[0].id);
    await expect(rec.statCell(page, "goal")).toHaveAttribute("data-stat-count", "0");
    await rec.recordStat(page, "assist", 2);
    await rec.closeStats(page);

    // Back to half 1: still one goal, still no assists.
    await rec.selectHalf(page, 1);
    await rec.openStats(page, "home", members[0].id);
    await expect(rec.statCell(page, "goal")).toHaveAttribute("data-stat-count", "1");
    await expect(rec.statCell(page, "assist")).toHaveAttribute("data-stat-count", "0");
    await rec.closeStats(page, { saved: false });

    // The aggregate reads both halves' STORED scores.
    await expect(page.getByTestId("aggregate-line")).toContainText("Aggregate 3 – 2");

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

  test("picking a club puts its manager in the squad; a club with no manager adds nobody", async ({
    page,
  }) => {
    await signInAs(page.context(), "admin");
    const manager = await seedPlayer("user", "E2E Club Manager");
    const [led] = await db.listClubs(1);
    const unmanaged = await db.findClub(NO_MANAGER_CLUB);
    // The seed ships exactly one club with no manager account, and this is it.
    // If that ever changes, the second half of this test stops meaning anything.
    expect(unmanaged.manager_player_id).toBeNull();
    await db.setClubManager(led.id, manager.id);

    await rec.createMatch(page, { date: MATCH_DATE, sport: "football" });

    // Slot 1 fills itself — nobody was added by hand.
    await rec.pickClub(page, 1, "home", led.id);
    await expect(rec.playerRow(page, "home", manager.id)).toBeVisible();
    await expect(rec.playerRows(page, "home")).toHaveCount(1);

    // A club with no manager account adds nobody, and does not fail trying.
    await rec.pickClub(page, 1, "away", unmanaged.id);
    await expect(rec.playerRows(page, "away")).toHaveCount(0);
    await expect(page.getByTestId("squad-error-away")).toHaveCount(0);

    // The auto-added manager is an ordinary appearance: removable.
    await rec.removePlayer(page, "home", manager.id);
    await expect(rec.playerRows(page, "home")).toHaveCount(0);
  });

  test("scores autosave with no Save button and survive a reload", async ({ page }) => {
    await signInAs(page.context(), "admin");
    const clubs = await db.listClubs(2);
    const matchId = await rec.createMatch(page, { date: MATCH_DATE, sport: "football" });

    await rec.pickClub(page, 1, "home", clubs[0].id);
    await rec.pickClub(page, 1, "away", clubs[1].id);

    // There is no `score-save-*` any more: typing IS the save, and the badge is
    // the only thing that says so.
    await expect(page.getByTestId("score-save-1-home")).toHaveCount(0);
    await rec.setScore(page, 1, "home", 4);
    await rec.setScore(page, 1, "away", 2);

    // The badge is a claim; the database is the proof.
    expect(await db.listSideRows(matchId)).toEqual([
      { half_no: 1, side: "away", club_id: clubs[1].id, score: 2 },
      { half_no: 1, side: "home", club_id: clubs[0].id, score: 4 },
    ]);

    // …and a reload serves the stored values, not the local input state.
    await page.reload();
    await expect(page.getByTestId("score-input-1-home")).toHaveValue("4");
    await expect(page.getByTestId("score-input-1-away")).toHaveValue("2");
  });

  test("switching sport re-filters the stats the popup offers", async ({ page }) => {
    await signInAs(page.context(), "admin");
    const { member } = await minimalMatch(page);

    await rec.openStats(page, "home", member.id);
    expect(await rec.offeredStats(page)).toEqual(allowList("football"));
    await rec.closeStats(page, { saved: false });

    // Sport is a chip group now, not a `<select>`, and it saves immediately so
    // the next server render re-filters the allow-list. The badge says the
    // write landed; the re-render arrives with the refresh just behind it,
    // hence the poll.
    await rec.pickSport(page, "rugby");
    await rec.openStats(page, "home", member.id);
    await expect.poll(() => rec.offeredStats(page)).toEqual(allowList("rugby"));

    // Rugby is the only sport with `tackle`, and it has no `save` — so this is
    // a real re-filter and not the football list in a different order.
    const rugby = await rec.offeredStats(page);
    expect(rugby).toContain("tackle");
    expect(rugby).not.toContain("save");
    await rec.closeStats(page, { saved: false });
  });
});
