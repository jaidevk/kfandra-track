import type { Browser } from "@playwright/test";
import { test, expect, type Page } from "./fixtures";
import { seedPlayer, signIn, signInAs } from "./helpers/auth";
import * as db from "./helpers/db";
import * as rec from "./helpers/recorder";
import { DEFAULT_STANDINGS_RULES } from "../src/lib/klcsra/standings-rules";

/**
 * KLC match workflow end to end (spec 2026-11-08 §11). Local Supabase only.
 * Each club enters its own team on one shared match; KFANDRA enters the
 * official score and makes it official.
 */

const SEASON = "KLCFERRSXVSG2";
const MATCH_DATE = "2026-08-23";
const DRAW = String(DEFAULT_STANDINGS_RULES.draw["2to3"]);

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

/** A club manager in their own browser. Close `context` when done. */
async function managerOf(browser: Browser, club: db.ClubRow, name: string) {
  const player = await seedPlayer("user", name);
  await db.setClubManager(club.id, player.id);
  const context = await browser.newContext();
  await signIn(context, player);
  return { player, context, page: await context.newPage() };
}

async function pts(page: Page, clubId: string): Promise<string | null> {
  await page.goto("/klc/league");
  await expect(page.getByTestId("league-table").or(page.getByTestId("league-table-empty"))).toBeVisible();
  const ids = await page
    .locator('[data-testid="table-row"]')
    .evaluateAll((rows) => rows.map((r) => r.getAttribute("data-club-id")));
  const idx = ids.indexOf(clubId);
  return idx < 0 ? null : (await page.locator('[data-col="Pts"]').nth(idx).innerText()).trim();
}

test.describe("KLC match workflow", () => {
  test("two managers fill one shared match; KFANDRA makes it official and adds goal times", async ({
    page,
    browser,
  }) => {
    const [a, b] = await db.listClubs(2);
    const mA = await managerOf(browser, a, "E2E Mgr A");
    const mB = await managerOf(browser, b, "E2E Mgr B");
    const pA = await seedPlayer("user", "E2E PA");
    const pB = await seedPlayer("user", "E2E PB");
    try {
      // 1. A creates the match against B, records A's team and sends it.
      const id = await rec.createMatch(mA.page, { date: MATCH_DATE, sport: "fooba", away: b.id });
      await expect(mA.page.getByTestId("score-by-kfandra")).toBeVisible();
      await expect(mA.page.getByTestId("member-select-away")).toHaveCount(0);
      await rec.addPlayer(mA.page, "home", pA.id);
      await rec.recordStats(mA.page, "home", pA.id, { mainGoal: 2 });
      await rec.sendTeam(mA.page, "home");
      await expect(mA.page.getByTestId("member-select-home")).toHaveCount(0);

      // 2. B starts the same match, is warned, and opens A's instead.
      await rec.startMatch(mB.page, { date: MATCH_DATE, sport: "fooba", away: a.id });
      await expect(mB.page.getByTestId("duplicate-warning")).toContainText("1 of 2 teams sent");
      await mB.page.getByTestId("duplicate-open").first().click();
      await mB.page.waitForURL(new RegExp(`/klc/matches/${id}$`));
      await rec.addPlayer(mB.page, "away", pB.id);
      await rec.recordStats(mB.page, "away", pB.id, { mainGoal: 1 });
      await rec.sendTeam(mB.page, "away");
      await expect(mB.page.getByTestId("waiting-banner")).toBeVisible();
      expect((await db.getMatchRow(id))?.status).toBe("sent");
      const [{ n }] = await db.sql<{ n: number }>(`select count(*)::int as n from klc_matches`);
      expect(n).toBe(1);

      // 3. KFANDRA finds it waiting, enters a score that differs from the tally, makes it official.
      await signInAs(page.context(), "kfandra");
      await page.goto("/klc/matches");
      await expect(
        page.getByTestId("waiting-for-kfandra").locator(`[data-match-id="${id}"]`),
      ).toBeVisible();
      await rec.openMatch(page, id);
      await expect(page.getByTestId("tally-line")).toContainText("2 – 1");
      await rec.setScore(page, 1, "home", 2);
      await rec.setScore(page, 1, "away", 2);
      await expect(page.getByTestId("tally")).toHaveAttribute("data-mismatch", "true");
      await expect(page.getByTestId("tally-mismatch")).toBeVisible();
      // A manager still sees no league score before it is official.
      await rec.openMatch(mA.page, id);
      await expect(mA.page.getByTestId("score-by-kfandra")).toBeVisible();
      await expect(mA.page.getByTestId("score-hidden").first()).toBeVisible();
      await rec.submitMatch(page);
      const official = await db.getMatchRow(id);
      expect(official?.status).toBe("submitted");
      expect(official?.season_id).toBe((await db.findSeason(SEASON)).id);
      // KFANDRA's 2–2 is used, not the recorded 2–1.
      expect(await pts(page, a.id)).toBe(DRAW);
      expect(await pts(page, b.id)).toBe(DRAW);

      // 4. KFANDRA adds the goal times to the official match.
      await rec.openMatch(page, id);
      await rec.openStats(page, "home", pA.id);
      await expect(rec.statCell(page, "mainGoal").getByTestId("stat-inc")).toHaveCount(0);
      await rec.setMinute(page, "mainGoal", 0, 34);
      await rec.setMinute(page, "mainGoal", 1, 12);
      await rec.closeStats(page);
      await expect(page.getByTestId("scorers-home")).toContainText("E2E PA ×2 (12', 34')");
      const [row] = await db.sql<{ minutes: number[] }>(
        `select s.minutes from klc_player_stats s
           join klc_match_appearances a on a.id = s.appearance_id
          where a.match_id = $1 and a.player_id = $2`,
        [id, pA.id],
      );
      expect(row.minutes).toEqual([34, 12]);
    } finally {
      await mA.context.close();
      await mB.context.close();
    }
  });

  test("a friendly is submitted once both managers have sent their teams", async ({ browser }) => {
    const [a, b] = await db.listClubs(2);
    const mA = await managerOf(browser, a, "E2E Mgr FA");
    const mB = await managerOf(browser, b, "E2E Mgr FB");
    const pA = await seedPlayer("user", "E2E FPA");
    const pB = await seedPlayer("user", "E2E FPB");
    try {
      const id = await rec.createMatch(mA.page, {
        date: MATCH_DATE, sport: "football", friendly: true, away: b.id,
      });
      await rec.addPlayer(mA.page, "home", pA.id);
      await rec.setScore(mA.page, 1, "home", 1);
      await rec.sendTeam(mA.page, "home");

      await rec.openMatch(mB.page, id);
      await rec.addPlayer(mB.page, "away", pB.id);
      await rec.sendTeam(mB.page, "away");
      await expect(mB.page.getByTestId("lock-banner")).toBeVisible();
      const row = await db.getMatchRow(id);
      expect(row?.status).toBe("submitted");
      expect(row?.season_id).toBeNull();
    } finally {
      await mA.context.close();
      await mB.context.close();
    }
  });

  test("KFANDRA sends a sent match back and the managers can edit again", async ({
    page,
    browser,
  }) => {
    const [a, b] = await db.listClubs(2);
    const mA = await managerOf(browser, a, "E2E Mgr SA");
    const mB = await managerOf(browser, b, "E2E Mgr SB");
    try {
      const id = await rec.createMatch(mA.page, { date: MATCH_DATE, sport: "football", away: b.id });
      await rec.addPlayer(mA.page, "home", mA.player.id);
      await rec.sendTeam(mA.page, "home");
      await rec.openMatch(mB.page, id);
      await rec.addPlayer(mB.page, "away", mB.player.id);
      await rec.sendTeam(mB.page, "away");
      expect((await db.getMatchRow(id))?.status).toBe("sent");

      await signInAs(page.context(), "kfandra");
      await rec.openMatch(page, id);
      await page.getByTestId("send-back").click();
      await expect(page.getByTestId("send-back")).toHaveCount(0);
      const row = await db.getMatchRow(id);
      expect(row?.status).toBe("draft");
      expect(row?.home_sent_at).toBeNull();
      expect(row?.away_sent_at).toBeNull();

      await rec.openMatch(mA.page, id);
      await expect(mA.page.getByTestId("send-team-home")).toBeVisible();
      await expect(mA.page.getByTestId("member-select-home")).toBeVisible();
    } finally {
      await mA.context.close();
      await mB.context.close();
    }
  });

  test("the recorder warns about a duplicate until dismissed", async ({ page }) => {
    await signInAs(page.context(), "admin");
    const [a, b] = await db.listClubs(2);
    const first = await rec.createMatch(page, { date: MATCH_DATE, sport: "football", home: a.id, away: b.id });
    await rec.startMatch(page, { date: MATCH_DATE, sport: "football", home: b.id, away: a.id });
    await expect(page.getByTestId("duplicate-warning")).toBeVisible();
    await page.getByTestId("duplicate-create-anyway").click();
    await page.waitForURL(/\/klc\/matches\/[0-9a-f-]{36}$/);
    expect(page.url()).not.toContain(first);

    const banner = page.getByTestId("duplicate-banner");
    await expect(banner).toBeVisible();
    await banner.getByTestId("duplicate-dismiss").click();
    await expect(banner).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("match-header")).toBeVisible();
    await expect(page.getByTestId("duplicate-banner")).toHaveCount(0);
  });
});
