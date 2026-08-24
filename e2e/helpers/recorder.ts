import { expect, type Locator, type Page } from "@playwright/test";
import { DEFAULT_STAT_RATES, type StatKey } from "../../src/lib/klcsra/stat-rates";
import type { Sport } from "../../src/lib/klcsra/sport-stats";

/**
 * A small page object for the Phase 3 recorder.
 *
 * Phase 3 replaced Save buttons with autosave and moved the stat steppers into
 * a portaled dialog, so two rules shape everything here:
 *
 *  1. **Stats live in a dialog, not in the squad card.** `stat-cell` /
 *     `stat-inc` / `stat-dec` are only in the DOM while `stats-dialog` is open,
 *     and the dialog is scoped by `data-appearance-id` / `data-player-id`. So
 *     every stat helper below either opens it or requires it open.
 *  2. **Nothing has a Save button.** Scores and stat taps write on a debounce
 *     and report through the single `sync-badge` in the header. A helper that
 *     mutates therefore ends by waiting for `data-sync-status="saved"` — the
 *     only honest signal that the write reached the server. Asserting the input
 *     value instead would prove nothing: score inputs hold LOCAL state and are
 *     never re-keyed off the server.
 *
 * Stat counts are rendered optimistically, so `data-stat-count` moves before
 * the round-trip. That makes it a safe barrier between two taps (the stepper
 * sends `count ± 1` read off the render) but NOT proof of persistence — which
 * is what the `sync-badge` wait on close is for.
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

// ── autosave ────────────────────────────────────────────────────────────────

/** The header's autosave badge. Absent on a locked match — it saves nothing. */
export function syncBadge(page: Page): Locator {
  return page.getByTestId("sync-badge");
}

/** Wait for every scheduled write to have landed. */
export async function expectSaved(page: Page): Promise<void> {
  await expect(syncBadge(page)).toHaveAttribute("data-sync-status", "saved");
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
  await expect(page.getByTestId("match-header")).toBeVisible();
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

// ── header ──────────────────────────────────────────────────────────────────

/**
 * Change the sport.
 *
 * Phase 3 turned this into a chip group (`role="group"`), so `selectOption` is
 * gone. The chip saves immediately — the stat allow-list is re-filtered by the
 * next server render — so this waits for the write, not just the chip state.
 */
export async function pickSport(page: Page, sport: Sport): Promise<void> {
  await page.locator(`[data-testid="sport-chip"][data-sport="${sport}"]`).click();
  await expect(page.getByTestId("header-sport")).toHaveAttribute("data-sport", sport);
  await expectSaved(page);
}

// ── clubs and scores ────────────────────────────────────────────────────────

/**
 * Pick the club leading one side of the ACTIVE half.
 *
 * Only the active half's card is rendered, so a combined match must
 * `selectHalf(2)` before picking half 2's clubs.
 *
 * The side row does not exist in the database until this happens
 * (`club_id` is NOT NULL), so the select re-renders from stored state — which
 * is exactly what the assertion waits for. Picking a club may also auto-add
 * the club's manager to the squad (a second round-trip); the select is
 * disabled while that runs, so Playwright's own actionability wait covers it.
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

/**
 * Enter a score.
 *
 * There is no Save button any more. The input holds local state and is never
 * re-keyed off the server, so its value proves nothing — the wait that matters
 * is the badge going `saving` → `saved`. Catching `saving` first rules out
 * reading a stale `saved` left by an earlier write; the 700ms debounce makes
 * that state long enough to observe.
 */
export async function setScore(
  page: Page,
  halfNo: number,
  side: SideKey,
  score: number,
): Promise<void> {
  const input = page.getByTestId(`score-input-${halfNo}-${side}`);
  await input.fill(String(score));
  await expect(syncBadge(page)).toHaveAttribute("data-sync-status", "saving");
  await expectSaved(page);
  await expect(input).toHaveValue(String(score));
}

// ── squads ──────────────────────────────────────────────────────────────────

/**
 * Add a player to a side.
 *
 * Selected by VALUE (the player id), never by label: once a player is in the
 * match their option gains a " (home)" / " (away)" suffix.
 *
 * Phase 3 renders those options `disabled`, so this can no longer MOVE a
 * player between sides — remove them from their current side first.
 */
export async function addPlayer(page: Page, side: SideKey, playerId: string): Promise<void> {
  await page.getByTestId(`member-select-${side}`).selectOption(playerId);
  await page.getByTestId(`add-player-${side}`).click();
  await expect(playerRow(page, side, playerId)).toBeVisible();
}

/** Take a player out of the match entirely (squads are match-level, not per-side). */
export async function removePlayer(page: Page, side: SideKey, playerId: string): Promise<void> {
  const row = playerRow(page, side, playerId);
  await row.getByTestId("remove-player").click();
  await expect(row).toHaveCount(0);
}

export function playerRow(page: Page, side: SideKey, playerId: string): Locator {
  return page
    .getByTestId(`squad-${side}`)
    .locator(`[data-testid="player-row"][data-player-id="${playerId}"]`);
}

/** Every player currently in one side's squad, in slot order. */
export function playerRows(page: Page, side: SideKey): Locator {
  return page.getByTestId(`squad-${side}`).getByTestId("player-row");
}

// ── stats (inside the popup) ────────────────────────────────────────────────

export function statsDialog(page: Page): Locator {
  return page.getByTestId("stats-dialog");
}

/**
 * Open one player's stats popup, and prove it is that player's.
 *
 * The dialog is PORTALED, so it is not inside `player-row` and must never be
 * looked for there — this is the single place the two are tied together.
 */
export async function openStats(page: Page, side: SideKey, playerId: string): Promise<Locator> {
  await playerRow(page, side, playerId).getByTestId("open-stats").click();
  const dialog = statsDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("data-player-id", playerId);
  return dialog;
}

/**
 * Close the popup.
 *
 * Done flushes every debounced tap, so `expectSaved` afterwards is what turns
 * an optimistic count into a claim about the database. Pass
 * `{ saved: false }` only when nothing was recorded (the badge would still
 * read `idle`).
 */
export async function closeStats(
  page: Page,
  opts: { saved?: boolean } = {},
): Promise<void> {
  await page.getByTestId("stats-done").click();
  await expect(statsDialog(page)).toHaveCount(0);
  if (opts.saved !== false) await expectSaved(page);
}

/** One stat's row in the OPEN popup. */
export function statCell(page: Page, statKey: StatKey): Locator {
  return statsDialog(page).locator(`[data-testid="stat-cell"][data-stat-key="${statKey}"]`);
}

/** The stat keys the popup offers — i.e. the sport allow-list. Popup must be open. */
export async function offeredStats(page: Page): Promise<string[]> {
  return statsDialog(page)
    .locator('[data-testid="stat-cell"]')
    .evaluateAll((cells) => cells.map((c) => c.getAttribute("data-stat-key") ?? ""));
}

/**
 * Tap `+` until the tally reaches `count`, in the OPEN popup.
 *
 * One click at a time, each confirmed against `data-stat-count` before the
 * next — the stepper sends `count + 1` read off the rendered row, so firing
 * two clicks back to back would send the same number twice.
 */
export async function recordStat(page: Page, statKey: StatKey, count: number): Promise<void> {
  const cell = statCell(page, statKey);
  for (let n = 1; n <= count; n += 1) {
    await cell.getByTestId("stat-inc").click();
    await expect(cell).toHaveAttribute("data-stat-count", String(n));
  }
}

/**
 * Record a whole line of stats for one player: open the popup, tap, close, and
 * wait for the flushed writes to land.
 */
export async function recordStats(
  page: Page,
  side: SideKey,
  playerId: string,
  counts: StatCounts,
): Promise<void> {
  await openStats(page, side, playerId);
  for (const [key, n] of Object.entries(counts) as [StatKey, number][]) {
    await recordStat(page, key, n);
  }
  await closeStats(page);
}

/** Switch which half the scoreboard, club selects and stat popup address. */
export async function selectHalf(page: Page, halfNo: number): Promise<void> {
  const tab = page.getByTestId(`half-toggle-${halfNo}`);
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
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

/**
 * Open the reopen warning dialog.
 *
 * `reopen-match` is only the trigger in Phase 3 — it changes nothing. The real
 * action is `reopen-confirm` inside `reopen-dialog`, and `reopen-error` renders
 * in there too.
 */
export async function openReopenDialog(page: Page): Promise<Locator> {
  await page.getByTestId("reopen-match").click();
  const dialog = page.getByTestId("reopen-dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}
