import { test, expect, type Page } from "./fixtures";
import { openAs, seedPlayer, signIn } from "./helpers/auth";
import * as db from "./helpers/db";
import * as rec from "./helpers/recorder";

/**
 * KLC player register and values (spec 2026-11-22 §8, Helper-bsr.18).
 * Local Supabase only. Every match here has 2 players, so the small-sided
 * rule is switched off for the suite and restored afterwards.
 */
const SEASON = "KLCFERRSXVSG2";
const DATE = "2026-08-23"; // inside Season 2's window (starts 2026-08-22)

let seasonsBefore: db.SeasonRow[];
let rulesBefore: unknown;
/** Clubs whose manager a test changed, with the original manager. */
let managersBefore: db.ClubRow[] = [];

/** Point `club` at `playerId`, remembering who managed it before. */
async function makeManager(club: db.ClubRow, playerId: string): Promise<void> {
  managersBefore.push(club);
  await db.setClubManager(club.id, playerId);
}

test.beforeEach(async () => {
  seasonsBefore = await db.snapshotSeasons();
  await db.resetKlcsraData();
  await db.activateSeason(SEASON);
  rulesBefore = (await db.sql<{ v: unknown }>(`select value as v from app_config where key = 'klc_value_rules'`))[0]?.v;
  await db.sql(`update app_config set value = jsonb_set(value, '{smallSided,enabled}', 'false') where key = 'klc_value_rules'`);
});

test.afterEach(async () => {
  for (const c of managersBefore) await db.setClubManager(c.id, c.manager_player_id);
  managersBefore = [];
  await db.sql(`update app_config set value = $1::jsonb where key = 'klc_value_rules'`, [JSON.stringify(rulesBefore)]);
  await db.resetKlcsraData();
  await db.restoreSeasons(seasonsBefore);
});

async function seasonId(): Promise<string> {
  return (await db.findSeason(SEASON)).id;
}

async function setBase(playerId: string, value: number): Promise<void> {
  await db.sql(
    `insert into klc_player_base_values (season_id, player_id, base_value) values ($1, $2, $3)`,
    [await seasonId(), playerId, value]);
}

/**
 * A submitted 2–1 football league win: `mgr` plays for home and scores 2.
 * Picking a club puts its manager in the squad, so `mgr` is not added by hand.
 */
async function recordWin(page: Page, home: db.ClubRow, away: db.ClubRow, mgrId: string) {
  const other = await seedPlayer("user", "E2E V Other");
  const id = await rec.createMatch(page, { date: DATE, sport: "football" });
  await rec.pickClub(page, 1, "home", home.id);
  await rec.pickClub(page, 1, "away", away.id);
  await rec.setScore(page, 1, "home", 2);
  await rec.setScore(page, 1, "away", 1);
  await expect(rec.playerRow(page, "home", mgrId)).toBeVisible();
  await rec.addPlayer(page, "away", other.id);
  await rec.recordStats(page, "home", mgrId, { goal: 2 });
  await rec.submitMatch(page);
  return id;
}

test("KFANDRA enters a base value and name on the register; an admin is refused", async ({ browser }) => {
  const [a] = await db.listClubs(1);
  const mgr = await seedPlayer("user", "E2E V Mgr");
  await makeManager(a, mgr.id);

  const k = await openAs(browser, "kfandra", "E2E V KFANDRA");
  try {
    await k.page.goto("/admin/klc/register");
    const row = k.page.locator(`[data-testid="register-row"][data-player-id="${mgr.id}"]`);
    await expect(k.page.getByTestId("register-admin")).toHaveAttribute("data-hydrated", "true");
    await expect(row.getByTestId("register-flag-nobase")).toBeVisible();

    await row.getByTestId("base-input").fill("250");
    await row.getByTestId("base-save").click();
    await expect(row.getByTestId("register-flag-nobase")).toHaveCount(0);
    await expect(row.getByTestId("register-current")).toHaveText("250 KR");

    await row.getByTestId("name-input").fill("E2E Official");
    await row.getByTestId("name-save").click();
    await expect.poll(async () =>
      (await db.sql<{ n: string | null }>(`select klc_name as n from players where id = $1`, [mgr.id]))[0]?.n,
    ).toBe("E2E Official");

    const log = await db.sql<{ n: number }>(
      `select count(*)::int as n from audit_log where action in ('klc.base_value','klc.klc_name') and entity_id = $1`, [mgr.id]);
    expect(log[0].n).toBe(2);
  } finally {
    await k.context.close();
  }

  const admin = await openAs(browser, "admin", "E2E V Admin");
  try {
    await admin.page.goto("/admin/klc/register");
    await expect(admin.page.getByTestId("register-refused")).toBeVisible();
  } finally {
    await admin.context.close();
  }
});

test("a submitted league match changes the values on the Values tab", async ({ browser }) => {
  const [a, b] = await db.listClubs(2);
  const mgr = await seedPlayer("user", "E2E V Scorer");
  await makeManager(a, mgr.id);
  await setBase(mgr.id, 200);

  const staff = await openAs(browser, "admin", "E2E V Staff");
  try {
    await recordWin(staff.page, a, b, mgr.id);
  } finally {
    await staff.context.close();
  }

  const context = await browser.newContext();
  await signIn(context, await seedPlayer("user", "E2E V Viewer"));
  const page = await context.newPage();
  try {
    await page.goto(`/klc/league?tab=values&season=${await seasonId()}`);
    const row = page.locator(`[data-testid="values-row"][data-player-id="${mgr.id}"]`);
    // win +20, 2 goals +4
    await expect(row.getByTestId("values-current")).toHaveText("224 KR");
  } finally {
    await context.close();
  }
});

test("KFANDRA adds a dated change and the history shows it", async ({ browser }) => {
  const [a] = await db.listClubs(1);
  const mgr = await seedPlayer("user", "E2E V Changed");
  await makeManager(a, mgr.id);
  await setBase(mgr.id, 300);

  const k = await openAs(browser, "kfandra", "E2E V KFANDRA");
  try {
    await k.page.goto("/admin/klc/register");
    await expect(k.page.getByTestId("register-admin")).toHaveAttribute("data-hydrated", "true");
    const row = k.page.locator(`[data-testid="register-row"][data-player-id="${mgr.id}"]`);
    await row.getByTestId("changes-toggle").click();
    await row.getByTestId("change-date").fill(DATE);
    await row.getByTestId("change-amount").fill("-40");
    await row.getByTestId("change-note").fill("Ill for two weeks");
    await row.getByTestId("change-add").click();
    await expect(row.getByTestId("change-row")).toHaveCount(1);
    await expect(row.getByTestId("register-current")).toHaveText("260 KR");

    await k.page.goto(`/klc/league/values/${mgr.id}?season=${await seasonId()}`);
    await expect(k.page.getByTestId("value-current")).toHaveText("260 KR");
    await expect(k.page.getByTestId("value-change-line")).toContainText("Ill for two weeks");
  } finally {
    await k.context.close();
  }
});

test("KFANDRA sets the official name of a player without a club", async ({ browser }) => {
  const loner = await seedPlayer("user", "E2E V Loner");
  const k = await openAs(browser, "kfandra", "E2E V KFANDRA");
  try {
    await k.page.goto("/admin/klc/register");
    await expect(k.page.getByTestId("register-admin")).toHaveAttribute("data-hydrated", "true");
    await expect(k.page.locator(`[data-testid="register-row"][data-player-id="${loner.id}"]`)).toHaveCount(0);
    const row = k.page.locator(`[data-testid="other-row"][data-player-id="${loner.id}"]`);
    await row.getByTestId("name-input").fill("E2E Loner Official");
    await row.getByTestId("name-save").click();
    await expect.poll(async () =>
      (await db.sql<{ n: string | null }>(`select klc_name as n from players where id = $1`, [loner.id]))[0]?.n,
    ).toBe("E2E Loner Official");
  } finally {
    await k.context.close();
  }
});
