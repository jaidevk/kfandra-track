import { test, expect } from "./fixtures";
import { openAs, seedPlayer, signIn } from "./helpers/auth";
import * as db from "./helpers/db";
import * as rec from "./helpers/recorder";

/**
 * Friendly mark: Official / Unofficial (spec 2026-11-22 §3, Helper-3u5).
 * Local Supabase only.
 */
const SEASON = "KLCFERRSXVSG2";
const DATE = "2026-11-28";

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

async function isOfficial(id: string): Promise<boolean | undefined> {
  const rows = await db.sql<{ o: boolean }>(
    `select is_official_friendly as o from klc_matches where id = $1`, [id]);
  return rows[0]?.o;
}

test("a manager marks a friendly Official; it is logged and shown in the list", async ({ browser }) => {
  const [a, b] = await db.listClubs(2);
  const mgr = await seedPlayer("user", "E2E Mark Mgr");
  await db.setClubManager(a.id, mgr.id);
  const context = await browser.newContext();
  await signIn(context, mgr);
  const page = await context.newPage();
  try {
    const id = await rec.createMatch(page, { date: DATE, sport: "football", away: b.id, friendly: true });
    await expect(page.getByTestId("friendly-mark")).toHaveAttribute("data-official", "false");

    await page.getByTestId("mark-official").click();
    await expect(page.getByTestId("flag-official-friendly")).toBeVisible();
    await expect.poll(() => isOfficial(id)).toBe(true);
    const log = await db.sql<{ n: number }>(
      `select count(*)::int as n from audit_log where action = 'klc.friendly_mark' and entity_id = $1`, [id]);
    expect(log[0].n).toBe(1);

    await page.goto("/klc/matches");
    await expect(page.locator(`[data-match-id="${id}"] [data-testid="tag-friendly"]`))
      .toHaveText(/Official friendly/i);
  } finally {
    await context.close();
  }
});

test("KFANDRA: switching a friendly to League hides the mark and clears it", async ({ browser }) => {
  const [a, b] = await db.listClubs(2);
  const k = await openAs(browser, "kfandra", "E2E KFANDRA Mark");
  try {
    const id = await rec.createMatch(k.page, {
      date: DATE, sport: "football", home: a.id, away: b.id, friendly: true,
    });
    await k.page.getByTestId("mark-official").click();
    await expect.poll(() => isOfficial(id)).toBe(true);

    await k.page.getByTestId("type-league").click();
    await expect(k.page.getByTestId("friendly-mark")).toHaveCount(0);
    await expect.poll(() => isOfficial(id)).toBe(false);
  } finally {
    await k.context.close();
  }
});
