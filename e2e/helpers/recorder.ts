import { expect, type Locator, type Page } from "@playwright/test";
import { DEFAULT_STAT_RATES, type StatKey } from "../../src/lib/klcsra/stat-rates";
import type { Sport } from "../../src/lib/klcsra/sport-stats";

/**
 * A small page object for the Phase 2 recorder.
 *
 * One rule shapes all of it: **every mutation round-trips to the server and
 * re-renders**, disabling the controls mid-flight. So each action here ends by
 * asserting the RESULTING state (`data-stat-count`, the input's value, the row
 * appearing) rather than firing the next click straight away. Chaining clicks
 * without that wait is the one way to make this suite flaky.
 */

export type SideKey = "home" | "away";

/** Per-stat tallies for one player, as a spec writes them. */
export type StatCounts = Partial<Record<StatKey, number>>;

/**
 * The hand-calculation the plan asks for: count x rate, straight off the rate
 * card, with no reference to `computePlayerPayout`.
 *
 * Deliberately independent of the implementation — it knows nothing about
 * sport allow-lists or friendlies, so a spec must state those expectations
 * itself (a friendly asserts `kr: 0`). If this ever agreed with a buggy
 * `computePlayerPayout` it would be worthless.
 */
export function expectedPayout(counts: StatCounts): { kr: number; mmg: number } {
  let kr = 0;
  let mmg = 0;
  for (const [key, n] of Object.entries(counts) as [StatKey, number][]) {
    const rate = DEFAULT_STAT_RATES[key];
    if (!rate) throw new Error(`Unknown stat key in a hand-calculation: ${key}`);
    kr += n * rate.kr;
    mmg += n * rate.mmg;
  }
  return { kr, mmg };
}

/** Sum several players' hand-calculations into the match total. */
export function expectedTotal(all: StatCounts[]): { kr: number; mmg: number } {
  return all.reduce(
    (acc, counts) => {
      const p = expectedPayout(counts);
      return { kr: acc.kr + p.kr, mmg: acc.mmg + p.mmg };
    },
    { kr: 0, mmg: 0 },
  );
}

// ── list page ───────────────────────────────────────────────────────────────

export interface NewMatch {
  date: string;
  sport?: Sport;
  combined?: boolean;
  friendly?: boolean;
}

const MATCH_URL = /\/admin\/klc\/matches\/[0-9a-f-]{36}$/;

/**
 * Create a match from the list page and land on its detail page.
 *
 * @returns the new match id (taken from the URL it navigated to).
 */
export async function createMatch(page: Page, match: NewMatch): Promise<string> {
  await page.goto("/admin/klc/matches");
  await page.getByTestId("new-match-date").fill(match.date);
  await page.getByTestId("new-match-sport").selectOption(match.sport ?? "football");
  if (match.combined) await page.getByTestId("new-match-combined").check();
  if (match.friendly) await page.getByTestId("new-match-friendly").check();
  await page.getByTestId("new-match-submit").click();
  await page.waitForURL(MATCH_URL);
  const id = page.url().split("/").pop();
  if (!id) throw new Error(`Could not read a match id out of ${page.url()}`);
  return id;
}

/** The row for one match on the list page. */
export function matchRow(page: Page, matchId: string): Locator {
  return page.locator(`[data-testid="match-row"][data-match-id="${matchId}"]`);
}

export async function openMatch(page: Page, matchId: string): Promise<void> {
  await page.goto(`/admin/klc/matches/${matchId}`);
  await expect(page.getByTestId("match-header")).toBeVisible();
}

// ── clubs and scores ────────────────────────────────────────────────────────

/**
 * Pick the club leading one side of one half.
 *
 * The side row does not exist in the database until this happens
 * (`club_id` is NOT NULL), so the select re-renders from stored state — which
 * is exactly what the assertion waits for.
 */
export async function pickClub(
  page: Page,
  halfNo: number,
  side: SideKey,
  clubId: string,
): Promise<void> {
  const select = page.getByTestId(`club-select-${halfNo}-${side}`);
  await select.selectOption(clubId);
  await expect(select).toHaveValue(clubId);
}

/** Enter a score and press its Save; the input remounts with the stored value. */
export async function setScore(
  page: Page,
  halfNo: number,
  side: SideKey,
  score: number,
): Promise<void> {
  await page.getByTestId(`score-input-${halfNo}-${side}`).fill(String(score));
  await page.getByTestId(`score-save-${halfNo}-${side}`).click();
  await expect(page.getByTestId(`score-input-${halfNo}-${side}`)).toHaveValue(String(score));
}

// ── squads and stats ────────────────────────────────────────────────────────

/**
 * Add a player to a side.
 *
 * Selected by VALUE (the player id), never by label: once a player is in the
 * match their option gains a " (home)" / " (away)" suffix.
 */
export async function addPlayer(page: Page, side: SideKey, playerId: string): Promise<void> {
  await page.getByTestId(`member-select-${side}`).selectOption(playerId);
  await page.getByTestId(`add-player-${side}`).click();
  await expect(playerRow(page, side, playerId)).toBeVisible();
}

export function playerRow(page: Page, side: SideKey, playerId: string): Locator {
  return page
    .getByTestId(`squad-${side}`)
    .locator(`[data-testid="player-row"][data-player-id="${playerId}"]`);
}

export function statCell(
  page: Page,
  side: SideKey,
  playerId: string,
  statKey: StatKey,
): Locator {
  return playerRow(page, side, playerId).locator(
    `[data-testid="stat-cell"][data-stat-key="${statKey}"]`,
  );
}

/** The stat keys the recorder offers for a player — i.e. the sport allow-list. */
export async function offeredStats(
  page: Page,
  side: SideKey,
  playerId: string,
): Promise<string[]> {
  return playerRow(page, side, playerId)
    .locator('[data-testid="stat-cell"]')
    .evaluateAll((cells) => cells.map((c) => c.getAttribute("data-stat-key") ?? ""));
}

/**
 * Tap `+` until the stored tally reaches `count`.
 *
 * One click at a time, each confirmed against `data-stat-count` before the
 * next — the stepper sends `count + 1` read off the rendered row, so firing
 * two clicks back to back would send the same number twice.
 */
export async function recordStat(
  page: Page,
  side: SideKey,
  playerId: string,
  statKey: StatKey,
  count: number,
): Promise<void> {
  const cell = statCell(page, side, playerId, statKey);
  for (let n = 1; n <= count; n += 1) {
    await cell.getByTestId("stat-inc").click();
    await expect(cell).toHaveAttribute("data-stat-count", String(n));
  }
}

/** Record a whole line of stats for one player. */
export async function recordStats(
  page: Page,
  side: SideKey,
  playerId: string,
  counts: StatCounts,
): Promise<void> {
  for (const [key, n] of Object.entries(counts) as [StatKey, number][]) {
    await recordStat(page, side, playerId, key, n);
  }
}

/** Switch which half the stat steppers write to (combined matches only). */
export async function selectHalf(page: Page, halfNo: number): Promise<void> {
  await page.getByTestId(`half-toggle-${halfNo}`).click();
}

// ── payouts ─────────────────────────────────────────────────────────────────

export function payoutRow(page: Page, playerId: string): Locator {
  return page.locator(`[data-testid="payout-row"][data-player-id="${playerId}"]`);
}

export async function expectPlayerPayout(
  page: Page,
  playerId: string,
  payout: { kr: number; mmg: number },
): Promise<void> {
  const row = payoutRow(page, playerId);
  await expect(row.getByTestId("payout-kr")).toHaveText(String(payout.kr));
  await expect(row.getByTestId("payout-mmg")).toHaveText(String(payout.mmg));
}

export async function expectTotals(
  page: Page,
  totals: { kr: number; mmg: number },
): Promise<void> {
  await expect(page.getByTestId("payout-total-kr")).toHaveText(String(totals.kr));
  await expect(page.getByTestId("payout-total-mmg")).toHaveText(String(totals.mmg));
}

// ── submit / reopen ─────────────────────────────────────────────────────────

/** Press Submit and wait for the lock to land. */
export async function submitMatch(page: Page): Promise<void> {
  await page.getByTestId("submit-match").click();
  await expect(page.getByTestId("lock-banner")).toBeVisible();
}

/** Press Submit expecting a refusal, and return the message shown. */
export async function submitExpectingError(page: Page): Promise<string> {
  await page.getByTestId("submit-match").click();
  const note = page.getByTestId("submit-error");
  await expect(note).toBeVisible();
  return (await note.textContent())?.trim() ?? "";
}
