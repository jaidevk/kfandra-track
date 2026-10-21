import { test, expect, expectNoErrors, type Page } from "./fixtures";
import { openAs, seedPlayer, signIn, signInAs } from "./helpers/auth";
import * as db from "./helpers/db";
import * as rec from "./helpers/recorder";
import { DEFAULT_STANDINGS_RULES, TIER_LABELS } from "../src/lib/klcsra/standings-rules";
import { strings } from "../src/content/strings";

/**
 * KLC League end to end (design §8). Local Supabase only.
 *
 * Every match here has 2 players in total, so it is tier 2–3. The expected
 * points are read off DEFAULT_STANDINGS_RULES rather than hardcoded.
 *
 * The suite owns its data: it seeds its own players, deletes every match it
 * makes, and restores `klc_seasons` (local default: S1 closed, S2 upcoming).
 * Seeded managers are pointed at clubs with no manager; deleting the seeded
 * player in teardown clears `clubs.manager_player_id` (ON DELETE SET NULL).
 */

const SEASON = "KLCFERRSXVSG2";
const OTHER_SEASON = "KLCFERRSXVSG1";
/** Inside Season 2's window (it starts 2026-08-22). */
const MATCH_DATE = "2026-08-23";

const RULES = DEFAULT_STANDINGS_RULES;
const TIER = `Tier ${TIER_LABELS["2to3"]}`;
const WIN = String(RULES.win.football["2to3"]);
const LOSS = String(RULES.loss);
const DRAW = String(RULES.draw["2to3"]);


let seasonsBefore: db.SeasonRow[];

test.beforeEach(async () => {
  seasonsBefore = await db.snapshotSeasons();
  await db.resetKlcsraData();
  await db.activateSeason(SEASON);
});

test.afterEach(async () => {
  await db.resetKlcsraData();
  await db.restoreSeasons(seasonsBefore);
});

/** A submitted 2–1 football league win for `home`, one player a side. */
async function recordWin(page: Page, home: db.ClubRow, away: db.ClubRow) {
  const [p1, p2] = [await seedPlayer("user", "E2E L1"), await seedPlayer("user", "E2E L2")];
  const id = await rec.createMatch(page, { date: MATCH_DATE, sport: "football" });
  await rec.pickClub(page, 1, "home", home.id);
  await rec.pickClub(page, 1, "away", away.id);
  await rec.setScore(page, 1, "home", 2);
  await rec.setScore(page, 1, "away", 1);
  await rec.addPlayer(page, "home", p1.id);
  await rec.addPlayer(page, "away", p2.id);
  await rec.recordStats(page, "home", p1.id, { goal: 2 });
  const line = page.getByTestId("league-points-line");
  await expect(line).toContainText(TIER);
  await expect(line).toContainText("2 – 1");
  await expect(line).toContainText(`${home.name} ${WIN}`);
  await expect(line).toContainText(`${away.name} ${LOSS}`);
  await rec.submitMatch(page);
  return { id, scorer: p1 };
}

/** A draft created by a staff member in their own browser, optionally with clubs. */
async function staffDraft(
  browser: Parameters<typeof openAs>[0],
  clubs?: [db.ClubRow, db.ClubRow],
): Promise<string> {
  const staff = await openAs(browser, "admin");
  try {
    const id = await rec.createMatch(staff.page, { date: MATCH_DATE, sport: "football" });
    if (clubs) {
      await rec.pickClub(staff.page, 1, "home", clubs[0].id);
      await rec.pickClub(staff.page, 1, "away", clubs[1].id);
    }
    return id;
  } finally {
    await staff.context.close();
  }
}

/** A club's Pts cell: the pinned Pts column shares row order with the Club column. */
async function pts(page: Page, clubId: string): Promise<string | null> {
  const ids = await page
    .locator('[data-testid="table-row"]')
    .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-club-id")));
  const idx = ids.indexOf(clubId);
  return idx < 0 ? null : (await page.locator('[data-col="Pts"]').nth(idx).innerText()).trim();
}

/** Open the league table and wait for it (or its empty state) to render. */
async function gotoTable(page: Page): Promise<void> {
  await page.goto("/klc/league");
  await expect(
    page.getByTestId("league-table").or(page.getByTestId("league-table-empty")),
  ).toBeVisible();
}

/** Positive control before a 404: the match exists and is still a draft. */
async function expectDraft(id: string): Promise<void> {
  expect((await db.getMatchRow(id))?.status).toBe("draft");
}

test.describe("KLC League", () => {
  test("staff record + submit -> table, matches and leaders update", async ({ page, errors }) => {
    await signInAs(page.context(), "admin");
    const [a, b] = await db.listClubs(2);
    const { scorer } = await recordWin(page, a, b);

    await gotoTable(page);
    expect(await pts(page, a.id)).toBe(WIN);
    expect(await pts(page, b.id)).toBe(LOSS);

    await page.getByTestId("league-tab-matches").click();
    await expect(page.getByTestId("league-match-points").first()).toHaveText(
      `${WIN} · ${LOSS} pts`,
    );

    await page.getByTestId("league-tab-leaders").click();
    const goals = page.locator('[data-testid="leader-board"][data-board="goals"]');
    await expect(
      goals.locator(`[data-player-id="${scorer.id}"] [data-testid="leader-value"]`),
    ).toHaveText("2");
    expectNoErrors(errors);
  });

  test("the season picker switches seasons; table groups keep their order", async ({
    page,
    errors,
  }) => {
    await signInAs(page.context(), "admin");
    const [a, b] = await db.listClubs(2);
    await recordWin(page, a, b);

    await gotoTable(page);
    await expect(page.getByTestId("group-chip")).toHaveText(Object.values(strings.league.groups));

    await page.getByTestId("league-season-pill").click();
    const options = page.getByTestId("season-option");
    await expect(options.first()).toBeVisible();
    await expect(options).toHaveCount((await db.listSeasons()).length);
    // S1 has no matches here, so switching to it empties the table.
    const s1 = await db.findSeason(OTHER_SEASON);
    await options.filter({ hasText: OTHER_SEASON }).click();
    await expect(page.getByTestId("league-table-empty")).toBeVisible();
    await expect(page.getByTestId("league-season-pill")).toContainText(`S${s1.season_no}`);
    expectNoErrors(errors);
  });

  test("the old admin recorder path redirects staff to /klc/matches", async ({ page }) => {
    await signInAs(page.context(), "admin");
    await page.goto("/admin/klc/matches");
    await expect(page).toHaveURL(/\/klc\/matches$/);
    await expect(page.getByTestId("new-match-form")).toBeVisible();
  });

  test("a draft switches League -> Friendly and drops out of the table", async ({ page }) => {
    await signInAs(page.context(), "admin");
    const [a, b] = await db.listClubs(2);
    const [p1, p2] = [await seedPlayer("user", "E2E F1"), await seedPlayer("user", "E2E F2")];
    const id = await rec.createMatch(page, { date: MATCH_DATE, sport: "football" });
    await rec.pickClub(page, 1, "home", a.id);
    await rec.pickClub(page, 1, "away", b.id);
    await rec.setScore(page, 1, "home", 1);
    await rec.addPlayer(page, "home", p1.id);
    await rec.addPlayer(page, "away", p2.id);
    expect((await db.getMatchRow(id))?.is_friendly).toBe(false);

    await page.getByTestId("type-friendly").click();
    await expect.poll(async () => (await db.getMatchRow(id))?.is_friendly).toBe(true);
    await rec.expectSaved(page);
    await rec.submitMatch(page);
    const row = await db.getMatchRow(id);
    expect(row?.status).toBe("submitted");
    expect(row?.season_id).toBeNull();

    await gotoTable(page);
    expect(await pts(page, a.id)).toBeNull();
    expect(await pts(page, b.id)).toBeNull();
  });

  test("KFANDRA reopens, edits and resubmits -> table changes", async ({ page }) => {
    await signInAs(page.context(), "kfandra");
    const [a, b] = await db.listClubs(2);
    const { id } = await recordWin(page, a, b);

    await gotoTable(page);
    expect(await pts(page, a.id)).toBe(WIN);

    await rec.openMatch(page, id);
    const dialog = await rec.openReopenDialog(page);
    await dialog.getByTestId("reopen-confirm").click();
    await expect(page.getByTestId("submit-match")).toBeVisible();
    await rec.setScore(page, 1, "away", 2); // now 2–2
    await expect(page.getByTestId("league-points-line")).toContainText(`${a.name} ${DRAW}`);
    await rec.submitMatch(page);

    await gotoTable(page);
    expect(await pts(page, a.id)).toBe(DRAW);
    expect(await pts(page, b.id)).toBe(DRAW);
  });

  test("a club manager records their own club's match but not another club's draft", async ({
    page,
    browser,
  }) => {
    const [mine, theirs, other] = await db.listClubs(3);
    const manager = await seedPlayer("user", "E2E Manager");
    await db.setClubManager(mine.id, manager.id);

    // Someone else's draft between two other clubs.
    const foreign = await staffDraft(browser, [theirs, other]);

    await signIn(page.context(), manager);
    await page.goto("/");
    await expect(page.getByTestId("home-record-match")).toBeVisible();

    await page.goto("/klc/matches");
    await expect(page.getByTestId("new-match-club")).toHaveValue(mine.id);
    const id = await rec.createMatch(page, { date: MATCH_DATE, sport: "football" });
    // The action put the manager's club on half 1 home.
    await expect(page.getByTestId("club-select-1-home")).toHaveValue(mine.id);
    await expect(page.getByTestId("swap-hint")).toHaveText("To swap sides, ask KFANDRA or an admin.");

    // The picker greys out what the server would refuse (the refusals
    // themselves are unit-tested in actions.test.ts). A club cannot lead both
    // slots, not even the manager's own.
    const option = (side: "home" | "away", clubId: string) =>
      page.getByTestId(`club-select-1-${side}`).locator(`option[value="${clubId}"]`);
    await expect(option("away", mine.id)).toBeDisabled();
    await expect(option("away", mine.id)).toHaveText(`${mine.name} (other side)`);

    await rec.pickClub(page, 1, "away", theirs.id);

    // Replacing their only club would take the manager off their own match.
    await expect(option("home", other.id)).toBeDisabled();
    await expect(option("home", other.id)).toHaveText(`${other.name} (keep your club)`);
    await expect(option("home", mine.id)).toBeEnabled();
    expect(
      (await db.listSideRows(id)).map((s) => [s.side, s.club_id]),
    ).toEqual([["away", theirs.id], ["home", mine.id]]);

    // The home side was created by the action, so the recorder's "auto-add the
    // manager on pickClub" never ran: add them by hand.
    await expect(rec.playerRows(page, "home")).toHaveCount(0);
    await rec.addPlayer(page, "home", manager.id);
    await rec.setScore(page, 1, "home", 1);
    await rec.submitMatch(page);
    expect((await db.getMatchRow(id))?.status).toBe("submitted");
    await expect(page.getByTestId("reopen-match")).toHaveCount(0);

    await expectDraft(foreign);
    const res = await page.goto(`/klc/matches/${foreign}`);
    expect(res?.status()).toBe(404);
  });

  test("a creator who no longer manages a club keeps their draft on the matches list", async ({
    page,
  }) => {
    const [mine] = await db.listClubs(1);
    const creator = await seedPlayer("user", "E2E Ex-manager");
    await db.setClubManager(mine.id, creator.id);
    await signIn(page.context(), creator);
    await page.goto("/klc/matches");
    const id = await rec.createMatch(page, { date: MATCH_DATE, sport: "football" });

    // No longer a manager: the draft (theirs via created_by) keeps the list open.
    await db.setClubManager(mine.id, null);
    await page.goto("/klc/matches");
    await expect(page.locator(`[data-testid="match-row"][data-match-id="${id}"]`)).toBeVisible();
    await expect(page.getByTestId("new-match-submit")).toHaveCount(0);

    // Once the draft is gone, so is the list.
    await db.deleteAllMatches();
    await page.goto("/klc/matches");
    await page.waitForURL(/\/klc\/league/);
  });

  test("a plain player sees the league and submitted matches read-only, but not drafts", async ({
    page,
    browser,
  }) => {
    const [a, b] = await db.listClubs(2);
    const draft = await staffDraft(browser);
    const staff = await openAs(browser, "admin");
    let submitted: string;
    try {
      ({ id: submitted } = await recordWin(staff.page, a, b));
    } finally {
      await staff.context.close();
    }

    const player = await seedPlayer("user", "E2E Viewer");
    await signIn(page.context(), player);
    await page.goto("/");
    await expect(page.getByTestId("home-record-match")).toHaveCount(0);
    await page.getByTestId("home-league").click();

    const content: Record<string, ReturnType<Page["getByTestId"]>> = {
      table: page.getByTestId("league-table").or(page.getByTestId("league-table-empty")),
      matches: page
        .getByTestId("league-match")
        .first()
        .or(page.getByTestId("league-matches-empty")),
      leaders: page
        .getByTestId("leader-board")
        .first()
        .or(page.getByTestId("league-leaders-empty")),
      seasons: page.getByTestId("season-row").first(),
      scoring: page.getByTestId("scoring-table"),
    };
    for (const [t, locator] of Object.entries(content)) {
      await page.getByTestId(`league-tab-${t}`).click();
      await expect(page).toHaveURL(new RegExp(`tab=${t}`));
      await expect(locator).toBeVisible();
    }

    // A submitted match is a public record, but read-only.
    await rec.openMatch(page, submitted);
    await expect(page.getByTestId("lock-banner")).toBeVisible();
    await expect(page.getByTestId("submit-match")).toHaveCount(0);
    await expect(page.getByTestId("reopen-match")).toHaveCount(0);
    await expect(page.getByText("Only KFANDRA can reopen a match.")).toHaveCount(0);

    await expectDraft(draft);
    const res = await page.goto(`/klc/matches/${draft}`);
    expect(res?.status()).toBe(404);
    await page.goto("/klc/matches");
    await expect(page).toHaveURL(/\/klc\/league\?tab=matches/);
  });
});
