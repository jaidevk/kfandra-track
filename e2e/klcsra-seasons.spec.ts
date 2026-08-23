import { test, expect, type Page } from "./fixtures";
import { signInAs } from "./helpers/auth";
import * as db from "./helpers/db";

/**
 * Seasons — the first screen KFANDRA touches.
 *
 * League Submit refuses without an ACTIVE season, and the database allows
 * exactly one, so these two facts are what this spec pins down: Start makes a
 * season active, and starting another one takes the badge off the first.
 *
 * The page has no test ids (it predates them), so it is driven by the text a
 * human sees. Every control is two clicks: the button, then the confirm.
 */

const SEASON_TWO = "KLCFERRSXVSG2";
const NEW_SEASON = "E2E Season Under Test";

/** One season's row in the "All seasons" list. */
function seasonRow(page: Page, name: string) {
  return page.locator("li").filter({ hasText: name });
}

/**
 * The green "Active season" / red "No active season" banner.
 *
 * `exact` matters: `getByText` is a case-insensitive SUBSTRING match by
 * default, so a bare "Active season" also matches the page's own explanatory
 * line ("...tagged with the active season when they are submitted").
 */
function banner(page: Page, text: "Active season" | "No active season") {
  return page.getByText(text, { exact: true });
}

let seasonsBefore: db.SeasonRow[];

test.beforeEach(async () => {
  // Snapshot first, then clear: a season cannot be deleted while a match
  // points at it (klc_matches.season_id is ON DELETE RESTRICT).
  seasonsBefore = await db.snapshotSeasons();
  await db.resetKlcsraData();
  await db.deactivateAllSeasons();
});

test.afterEach(async () => {
  await db.resetKlcsraData();
  await db.restoreSeasons(seasonsBefore);
});

test.describe("KLCSRA seasons", () => {
  test("Start turns an upcoming season into the active one", async ({ page }) => {
    await signInAs(page.context(), "admin");
    await page.goto("/admin/klc/seasons");

    // Nothing active is a loud, red state — league Submit is blocked here.
    await expect(banner(page, "No active season")).toBeVisible();

    const row = seasonRow(page, SEASON_TWO);
    await row.getByRole("button", { name: "Start", exact: true }).click();
    await row.getByRole("button", { name: "Yes, start", exact: true }).click();

    await expect(banner(page, "Active season")).toBeVisible();
    await expect(page.getByText(`S2 · ${SEASON_TWO}`).first()).toBeVisible();

    const active = await db.activeSeason();
    expect(active?.name).toBe(SEASON_TWO);
  });

  test("starting a second season closes the first — only one is ever active", async ({
    page,
  }) => {
    await signInAs(page.context(), "admin");
    const seasonTwo = await db.activateSeason(SEASON_TWO);

    await page.goto("/admin/klc/seasons");
    await expect(banner(page, "Active season")).toBeVisible();

    // Create a fresh season. New seasons are born `upcoming`, never active.
    const createPanel = page.locator("section").filter({ hasText: "Create a season" });
    await createPanel.getByPlaceholder("KLCFERRSXVSG3").fill(NEW_SEASON);
    await createPanel.locator('input[type="date"]').fill("2026-09-01");
    await createPanel.getByRole("button", { name: "Create season", exact: true }).click();

    const created = seasonRow(page, NEW_SEASON);
    await expect(created).toBeVisible();
    await expect(created.getByText("upcoming", { exact: true })).toBeVisible();
    expect((await db.findSeason(NEW_SEASON)).status).toBe("upcoming");

    // Starting it must say out loud which season it is about to close…
    await created.getByRole("button", { name: "Start", exact: true }).click();
    await expect(created).toContainText(
      `This will CLOSE the current active season, S2 · ${SEASON_TWO}`,
    );
    await created.getByRole("button", { name: "Close it and start", exact: true }).click();

    // …and then actually close it.
    await expect(page.getByText(NEW_SEASON).first()).toBeVisible();
    await expect(
      seasonRow(page, SEASON_TWO).getByText("closed", { exact: true }),
    ).toBeVisible();

    const active = await db.activeSeason();
    expect(active?.name).toBe(NEW_SEASON);

    const statuses = (await db.listSeasons()).map((s) => `${s.name}:${s.status}`);
    expect(statuses.filter((s) => s.endsWith(":active"))).toEqual([`${NEW_SEASON}:active`]);
    expect((await db.findSeason(SEASON_TWO)).status).toBe("closed");
    expect(seasonTwo.status).toBe("active"); // it really was the active one to begin with
  });
});
