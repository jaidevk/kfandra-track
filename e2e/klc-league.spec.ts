import { test, expect, expectNoErrors, type Page } from "./fixtures";
import { seedPlayer, signIn, signInAs } from "./helpers/auth";
import * as db from "./helpers/db";
import * as rec from "./helpers/recorder";

/**
 * KLC League end to end (design §8). Local Supabase only.
 *
 * Points expected here come from DEFAULT_STANDINGS_RULES: 2 players total is
 * tier 2–3, so a football win is 0.5 / 0 and a draw is 0.1 / 0.1.
 *
 * The suite owns its data: it seeds its own players, deletes every match it
 * makes, and restores `klc_seasons` (local default: S1 closed, S2 upcoming).
 * Seeded managers are pointed at clubs with no manager; deleting the seeded
 * player in teardown clears `clubs.manager_player_id` (ON DELETE SET NULL).
 */

const SEASON = "KLCFERRSXVSG2";
/** Inside Season 2's window (it starts 2026-08-22). */
const MATCH_DATE = "2026-08-23";

const OTHER_SIDE = "That club is already on the other side of this match.";
const KEEP_OWN_CLUB = "Keep your own club on this match.";

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
  await expect(line).toContainText("Tier 2–3");
  await expect(line).toContainText("2 – 1");
  await expect(line).toContainText(`${home.name} 0.5`);
  await expect(line).toContainText(`${away.name} 0`);
  await rec.submitMatch(page);
  return { id, scorer: p1 };
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

test.describe("KLC League", () => {
  test("staff record + submit -> table, matches and leaders update", async ({ page, errors }) => {
    await signInAs(page.context(), "admin");
    const [a, b] = await db.listClubs(2);
    const { scorer } = await recordWin(page, a, b);

    await gotoTable(page);
    expect(await pts(page, a.id)).toBe("0.5");
    expect(await pts(page, b.id)).toBe("0");

    // Table groups keep their configured order.
    await expect(page.getByTestId("group-chip")).toHaveText([
      "All", /Football|Fooba/, "Rugby Sox", "Rugby Var.", "Short Game Var.",
    ]);

    await page.getByTestId("league-tab-matches").click();
    await expect(page.getByTestId("league-match-points").first()).toHaveText("0.5 · 0 pts");

    await page.getByTestId("league-tab-leaders").click();
    const goals = page.locator('[data-testid="leader-board"][data-board="goals"]');
    await expect(
      goals.locator(`[data-player-id="${scorer.id}"] [data-testid="leader-value"]`),
    ).toHaveText("2");

    // The season picker lists seasons and switches the table.
    await page.getByTestId("league-tab-table").click();
    await expect(page).toHaveURL(/tab=table/);
    await page.getByTestId("league-season-pill").click();
    const options = page.getByTestId("season-option");
    await expect(options.first()).toBeVisible();
    await expect(options).toHaveCount((await db.listSeasons()).length);
    // S1 has no matches here, so switching to it empties the table.
    await options.filter({ hasText: "KLCFERRSXVSG1" }).click();
    await expect(page.getByTestId("league-table-empty")).toBeVisible();
    await expect(page.getByTestId("league-season-pill")).toContainText("S1");

    // The old admin recorder path still lands staff on the new one.
    await page.goto("/admin/klc/matches");
    await expect(page).toHaveURL(/\/klc\/matches$/);
    await expect(page.getByTestId("new-match-form")).toBeVisible();
    expectNoErrors(errors);
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
    expect(await pts(page, a.id)).toBe("0.5");

    await rec.openMatch(page, id);
    const dialog = await rec.openReopenDialog(page);
    await dialog.getByTestId("reopen-confirm").click();
    await expect(page.getByTestId("submit-match")).toBeVisible();
    await rec.setScore(page, 1, "away", 2); // now 2–2
    await expect(page.getByTestId("league-points-line")).toContainText(`${a.name} 0.1`);
    await rec.submitMatch(page);

    await gotoTable(page);
    expect(await pts(page, a.id)).toBe("0.1");
    expect(await pts(page, b.id)).toBe("0.1");
  });

  test("a club manager records their own club's match but not another club's draft", async ({
    page,
    browser,
  }) => {
    const [mine, theirs, other] = await db.listClubs(3);
    const manager = await seedPlayer("user", "E2E Manager");
    await db.setClubManager(mine.id, manager.id);

    // Someone else's draft between two other clubs.
    const staffCtx = await browser.newContext();
    let foreign: string;
    try {
      const staffPage = await staffCtx.newPage();
      await signInAs(staffCtx, "admin");
      foreign = await rec.createMatch(staffPage, { date: MATCH_DATE, sport: "football" });
      await rec.pickClub(staffPage, 1, "home", theirs.id);
      await rec.pickClub(staffPage, 1, "away", other.id);
    } finally {
      await staffCtx.close();
    }

    await signIn(page.context(), manager);
    await page.goto("/");
    await expect(page.getByTestId("home-record-match")).toBeVisible();

    await page.goto("/klc/matches");
    await expect(page.getByTestId("new-match-club")).toHaveValue(mine.id);
    const id = await rec.createMatch(page, { date: MATCH_DATE, sport: "football" });
    // The action put the manager's club on half 1 home.
    await expect(page.getByTestId("club-select-1-home")).toHaveValue(mine.id);
    await expect(page.getByTestId("swap-hint")).toHaveText("To swap sides, ask KFANDRA or an admin.");

    // A club cannot lead both slots — not even the manager's own.
    await page.getByTestId("club-select-1-away").selectOption(mine.id);
    await expect(page.getByTestId("half-error-1")).toHaveText(OTHER_SIDE);
    await expect(page.getByTestId("club-select-1-away")).toHaveValue("");

    await rec.pickClub(page, 1, "away", theirs.id);

    // Replacing their only club would take the manager off their own match.
    await page.getByTestId("club-select-1-home").selectOption(other.id);
    await expect(page.getByTestId("half-error-1")).toHaveText(KEEP_OWN_CLUB);
    await expect(page.getByTestId("club-select-1-home")).toHaveValue(mine.id);
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

    const res = await page.goto(`/klc/matches/${foreign}`);
    expect(res?.status()).toBe(404);
  });

  test("a plain player sees the league and submitted matches read-only, but not drafts", async ({
    page,
    browser,
  }) => {
    const [a, b] = await db.listClubs(2);
    const staffCtx = await browser.newContext();
    let draft: string;
    let submitted: string;
    try {
      const staffPage = await staffCtx.newPage();
      await signInAs(staffCtx, "admin");
      draft = await rec.createMatch(staffPage, { date: MATCH_DATE, sport: "football" });
      ({ id: submitted } = await recordWin(staffPage, a, b));
    } finally {
      await staffCtx.close();
    }

    const player = await seedPlayer("user", "E2E Viewer");
    await signIn(page.context(), player);
    await page.goto("/");
    await expect(page.getByTestId("home-record-match")).toHaveCount(0);
    await page.getByTestId("home-league").click();
    for (const t of ["table", "matches", "leaders", "seasons", "scoring"]) {
      await page.getByTestId(`league-tab-${t}`).click();
      await expect(page).toHaveURL(new RegExp(`tab=${t}`));
    }
    await expect(page.getByTestId("scoring-table")).toBeVisible();

    // A submitted match is a public record, but read-only.
    await rec.openMatch(page, submitted);
    await expect(page.getByTestId("lock-banner")).toBeVisible();
    await expect(page.getByTestId("submit-match")).toHaveCount(0);
    await expect(page.getByTestId("reopen-match")).toHaveCount(0);
    await expect(page.getByText("Only KFANDRA can reopen a match.")).toHaveCount(0);

    const res = await page.goto(`/klc/matches/${draft}`);
    expect(res?.status()).toBe(404);
    await page.goto("/klc/matches");
    await expect(page).toHaveURL(/\/klc\/league\?tab=matches/);
  });
});
