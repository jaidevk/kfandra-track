"use server";

import { revalidatePath } from "next/cache";
import { getCurrentPlayer, type CurrentPlayer } from "@/lib/auth/current-user";
import { isStaffRole } from "@/lib/auth/roles";
import {
  canEditMatch, canReopenMatch, clubOnBothSlots, clubOnOtherSide, keepsManagedClub, matchClubIds,
} from "./access";
import { loadSportStats, loadStatRates } from "./config";
import { computePlayerPayout } from "./payouts";
import * as repo from "./repository";
import { SPORTS, statsForSport, type Sport } from "./sport-stats";
import { STAT_KEYS, type StatKey, type StatRates } from "./stat-rates";
import type { MatchDraft, PayoutLine, Season, SideKey } from "./types";

/**
 * Server actions for the KLCSRA match recorder.
 *
 * Three rules live here and nowhere else:
 *
 *  1. **Auth.** Every action re-resolves the caller with `getCurrentPlayer()`.
 *     Season actions require staff; match actions require a match editor
 *     (`access.ts`: staff, the creator, or a manager of a club on the match).
 *     A client-supplied identity is never trusted.
 *  2. **The submit lock.** Every mutating action refuses when the match is
 *     `submitted`. RLS deliberately does not enforce this (staff have blanket
 *     write access to the KLCSRA tables), so this file is the first lock; the
 *     `*_submit_lock` DB triggers are the backstop.
 *  3. **The payout compute.** Submit composes the pure domain
 *     (`computePlayerPayout` x `statsForSport`) over the stored draft and
 *     returns the lines. Nothing is written to a balance sheet in Phase 2.
 *
 * The repository throws on every write failure; each call is wrapped and the
 * message surfaced verbatim, because two of them are already written for a
 * human ("That club is already on the other side of this half.", "Pick a club
 * for this side before entering a score.").
 */

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const OK: ActionResult = { ok: true, data: undefined };

const NOT_SIGNED_IN = "You must be signed in.";
const NOT_STAFF = "You do not have permission to do that.";
const NOT_KFANDRA = "Only KFANDRA can reopen a submitted match.";
const NO_MATCH = "Match not found.";
const KEEP_OWN_CLUB = "Keep your own club on this match.";
const LOCKED = "This match is locked. Reopen it first.";
const NO_ACTIVE_SEASON = "No active season. Start one in Seasons first.";

const MATCHES_PATH = "/klc/matches";
const LEAGUE_PATH = "/klc/league";
const SEASONS_PATH = "/admin/klc/seasons";

// ── plumbing ────────────────────────────────────────────────────────────────

/** Turn a thrown repository error into an ActionResult, message intact. */
function failed(e: unknown, fallback: string): ActionResult<never> {
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

function revalidateMatch(matchId: string): void {
  revalidatePath(MATCHES_PATH);
  revalidatePath(`${MATCHES_PATH}/${matchId}`);
  revalidatePath(LEAGUE_PATH);
}

/** Staff gate. Returns the freshly-resolved caller. */
async function requireStaff(): Promise<ActionResult<CurrentPlayer>> {
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };
  if (!isStaffRole(player.role)) return { ok: false, error: NOT_STAFF };
  return { ok: true, data: player };
}

/**
 * The clubs this player manages. A DB error is surfaced as a failed result,
 * never read as "manages nothing" (this feeds authorisation).
 */
async function loadManaged(playerId: string): Promise<ActionResult<Set<string>>> {
  try {
    return { ok: true, data: await repo.listManagedClubIds(playerId) };
  } catch (e) {
    return failed(e, "Failed to load your clubs.");
  }
}

interface EditorGate {
  player: CurrentPlayer;
  match: MatchDraft;
  /** The caller's managed clubs when looked up; null for staff or the creator. */
  managed: Set<string> | null;
}

/**
 * Signed in + the match exists + the caller may edit it: staff, the draft's
 * creator, or the manager of any club on it (design §5.1).
 */
async function requireMatchEditor(matchId: string): Promise<ActionResult<EditorGate>> {
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };
  const match = await repo.getMatch(matchId);
  if (!match) return { ok: false, error: NO_MATCH };
  // Staff and the creator are decided without a lookup.
  if (isStaffRole(player.role) || match.createdBy === player.id) {
    return { ok: true, data: { player, match, managed: null } };
  }
  const loaded = await loadManaged(player.id);
  if (!loaded.ok) return loaded;
  const ownership = { createdBy: match.createdBy, clubIds: matchClubIds(match.halves) };
  if (!canEditMatch(player, ownership, loaded.data)) return { ok: false, error: NOT_STAFF };
  return { ok: true, data: { player, match, managed: loaded.data } };
}

/**
 * Editor gate + still a draft. Every mutating match action starts here; it is
 * the first place the submit lock is checked (the DB trigger is the second).
 */
async function requireEditableMatch(matchId: string): Promise<ActionResult<EditorGate>> {
  const gate = await requireMatchEditor(matchId);
  if (!gate.ok) return gate;
  if (gate.data.match.status === "submitted") return { ok: false, error: LOCKED };
  return gate;
}

// ── input coercion ──────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const KNOWN_STATS = new Set<string>(STAT_KEYS);

function isSideKey(v: unknown): v is SideKey {
  return v === "home" || v === "away";
}
function isSport(v: unknown): v is Sport {
  return typeof v === "string" && (SPORTS as readonly string[]).includes(v);
}
/** Non-negative integer, or null when the input is not one. */
function nonNegativeInt(v: unknown): number | null {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// ── matches ─────────────────────────────────────────────────────────────────

export interface CreateMatchFields {
  entryDate: string;
  sport: Sport;
  isCombined: boolean;
  isFriendly: boolean;
  /** Required for a club manager (must be a club they manage); optional for staff. */
  homeClubId?: string | null;
}

/** Create a draft match (with its half rows). Returns the new match id. */
export async function createMatchAction(
  input: CreateMatchFields,
): Promise<ActionResult<string>> {
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };

  if (!DATE_RE.test(input?.entryDate ?? "")) {
    return { ok: false, error: "Pick a valid match date." };
  }
  if (!isSport(input.sport)) return { ok: false, error: "Pick a valid sport." };

  const homeClubId = input.homeClubId || null;
  if (!isStaffRole(player.role)) {
    const managed = await loadManaged(player.id);
    if (!managed.ok) return managed;
    if (!homeClubId || !managed.data.has(homeClubId)) return { ok: false, error: NOT_STAFF };
  }

  try {
    const id = await repo.createMatch({
      entryDate: input.entryDate,
      sport: input.sport,
      isCombined: Boolean(input.isCombined),
      isFriendly: Boolean(input.isFriendly),
      createdBy: player.id,
      homeClubId,
    });
    revalidatePath(MATCHES_PATH);
    return { ok: true, data: id };
  } catch (e) {
    return failed(e, "Failed to create the match.");
  }
}

export interface MatchMetaFields {
  entryDate?: string;
  sport?: Sport;
  durationMinutes?: number | null;
  isFriendly?: boolean;
}

/** Patch the match header. `is_combined` is fixed at creation; `is_friendly` may change on a draft. */
export async function updateMatchMetaAction(
  matchId: string,
  patch: MatchMetaFields,
): Promise<ActionResult> {
  const gate = await requireEditableMatch(matchId);
  if (!gate.ok) return gate;

  const fields: repo.MatchMetaPatch = {};
  if (patch?.entryDate !== undefined) {
    if (!DATE_RE.test(patch.entryDate)) {
      return { ok: false, error: "Pick a valid match date." };
    }
    fields.entryDate = patch.entryDate;
  }
  if (patch?.sport !== undefined) {
    if (!isSport(patch.sport)) return { ok: false, error: "Pick a valid sport." };
    fields.sport = patch.sport;
  }
  if (patch?.isFriendly !== undefined) {
    if (typeof patch.isFriendly !== "boolean") return { ok: false, error: "Pick League or Friendly." };
    fields.isFriendly = patch.isFriendly;
  }
  if (patch?.durationMinutes !== undefined) {
    if (patch.durationMinutes === null) {
      fields.durationMinutes = null;
    } else {
      // The DB requires duration_minutes > 0 when present.
      const mins = nonNegativeInt(patch.durationMinutes);
      if (mins === null || mins === 0) {
        return { ok: false, error: "Duration must be a positive number of minutes." };
      }
      fields.durationMinutes = mins;
    }
  }

  try {
    await repo.updateMatchMeta(matchId, fields);
    revalidateMatch(matchId);
    return OK;
  } catch (e) {
    return failed(e, "Failed to update the match.");
  }
}

/** Delete a draft match; halves, sides, squad and stats cascade with it. */
export async function deleteMatchAction(matchId: string): Promise<ActionResult> {
  const gate = await requireEditableMatch(matchId);
  if (!gate.ok) return gate;

  try {
    await repo.deleteMatch(matchId);
    revalidatePath(MATCHES_PATH);
    return OK;
  } catch (e) {
    return failed(e, "Failed to delete the match.");
  }
}

// ── sides ───────────────────────────────────────────────────────────────────

/**
 * Set the club leading one side of one half. `matchId` is carried alongside
 * `halfId` so the submit lock can be checked — a half id alone does not say
 * which match it belongs to.
 *
 * Two match-integrity rules sit on top of the editor gate: a club may lead
 * only one slot per match (`clubOnOtherSide`), and a non-staff caller must
 * keep one of their own clubs on it (`keepsManagedClub`). The second applies
 * to the creator too, so a creator who no longer manages any club can still
 * edit the draft's other fields (score, squad, stats, header) but cannot
 * change its clubs.
 */
export async function setSideClubAction(
  matchId: string,
  halfId: string,
  side: SideKey,
  clubId: string,
): Promise<ActionResult> {
  const gate = await requireEditableMatch(matchId);
  if (!gate.ok) return gate;

  if (!isSideKey(side)) return { ok: false, error: "Unknown side." };
  if (!clubId) return { ok: false, error: "Pick a club." };
  if (!gate.data.match.halves.some((h) => h.id === halfId)) {
    return { ok: false, error: "That half does not belong to this match." };
  }
  if (clubOnOtherSide(gate.data.match.halves, side, clubId)) {
    return { ok: false, error: "That club is already on the other side of this match." };
  }
  // A manager may not edit their own club off the match. Staff are exempt.
  const { player, match } = gate.data;
  if (!isStaffRole(player.role)) {
    let managed = gate.data.managed;
    if (!managed) {
      const loaded = await loadManaged(player.id);
      if (!loaded.ok) return loaded;
      managed = loaded.data;
    }
    if (!keepsManagedClub(match.halves, halfId, side, clubId, managed)) {
      return { ok: false, error: KEEP_OWN_CLUB };
    }
  }

  try {
    await repo.setSideClub(halfId, side, clubId);
    revalidateMatch(matchId);
    return OK;
  } catch (e) {
    // Passes "That club is already on the other side of this half." through.
    return failed(e, "Failed to set the club for this side.");
  }
}

/** Set one side's score for one half. The side must already have a club. */
export async function setSideScoreAction(
  matchId: string,
  halfId: string,
  side: SideKey,
  score: number,
): Promise<ActionResult> {
  const gate = await requireEditableMatch(matchId);
  if (!gate.ok) return gate;

  if (!isSideKey(side)) return { ok: false, error: "Unknown side." };
  if (!gate.data.match.halves.some((h) => h.id === halfId)) {
    return { ok: false, error: "That half does not belong to this match." };
  }
  const value = nonNegativeInt(score);
  if (value === null) return { ok: false, error: "A score cannot be negative." };

  try {
    await repo.setSideScore(halfId, side, value);
    revalidateMatch(matchId);
    return OK;
  } catch (e) {
    // Passes "Pick a club for this side before entering a score." through.
    return failed(e, "Failed to set the score.");
  }
}

// ── squad ───────────────────────────────────────────────────────────────────

/**
 * Put a player on a side for the whole match. Re-adding a player already in
 * the match moves them to `side`. Returns the appearance id.
 */
export async function addAppearanceAction(
  matchId: string,
  playerId: string,
  side: SideKey,
): Promise<ActionResult<string>> {
  const gate = await requireEditableMatch(matchId);
  if (!gate.ok) return gate;

  if (!isSideKey(side)) return { ok: false, error: "Unknown side." };
  if (!playerId) return { ok: false, error: "Pick a player." };

  try {
    const id = await repo.addAppearance(matchId, playerId, side);
    revalidateMatch(matchId);
    return { ok: true, data: id };
  } catch (e) {
    return failed(e, "Failed to add the player.");
  }
}

/** Remove a player from the match; their stats cascade away with them. */
export async function removeAppearanceAction(
  matchId: string,
  appearanceId: string,
): Promise<ActionResult> {
  const gate = await requireEditableMatch(matchId);
  if (!gate.ok) return gate;

  if (!gate.data.match.appearances.some((a) => a.id === appearanceId)) {
    return { ok: false, error: "That player is not in this match." };
  }

  try {
    await repo.removeAppearance(appearanceId);
    revalidateMatch(matchId);
    return OK;
  } catch (e) {
    return failed(e, "Failed to remove the player.");
  }
}

/**
 * Set one stat tally for one appearance in one half. A count of 0 clears it
 * (the repository deletes the row rather than storing a zero).
 */
export async function setStatAction(
  matchId: string,
  appearanceId: string,
  halfNo: number,
  statKey: StatKey,
  count: number,
): Promise<ActionResult> {
  const gate = await requireEditableMatch(matchId);
  if (!gate.ok) return gate;

  const { match } = gate.data;
  if (!match.appearances.some((a) => a.id === appearanceId)) {
    return { ok: false, error: "That player is not in this match." };
  }
  if (!match.halves.some((h) => h.halfNo === halfNo)) {
    return { ok: false, error: "This match has no such half." };
  }
  if (!KNOWN_STATS.has(statKey)) return { ok: false, error: "Unknown stat." };

  // Negative tallies are meaningless — the +/- sign lives in the rates — and
  // the DB rejects them. Clamp to 0, which the repository reads as "clear".
  const value = Math.max(0, nonNegativeInt(count) ?? 0);

  try {
    await repo.setStat(appearanceId, halfNo, statKey, value);
    revalidateMatch(matchId);
    return OK;
  } catch (e) {
    return failed(e, "Failed to record that stat.");
  }
}

// ── submit / reopen ─────────────────────────────────────────────────────────

/**
 * The payout lines for a stored draft.
 *
 * A player earns INDEPENDENTLY IN EACH HALF (spec §Cross-half stats): they may
 * play under a different club after half-time, so the halves' counts must not
 * be merged before scoring. Hence compute per half, then add — which also
 * keeps the sums correct if a rate ever becomes non-linear in the count.
 *
 * `clubName` is the club on that appearance's side in half 1: the aggregate
 * team's identity for display. (Half 2's club, when it differs, is visible on
 * the match itself.)
 */
function buildPayoutLines(
  match: MatchDraft,
  rates: StatRates,
  allowed: readonly StatKey[],
): PayoutLine[] {
  const firstHalf = match.halves.find((h) => h.halfNo === 1) ?? match.halves[0];
  const clubBySide = new Map<SideKey, string | null>();
  for (const s of firstHalf?.sides ?? []) clubBySide.set(s.side, s.clubName);

  return match.appearances.map((a) => {
    let kr = 0;
    let mmg = 0;
    for (const counts of Object.values(a.stats)) {
      const payout = computePlayerPayout(counts, rates, {
        includeKR: !match.isFriendly,
        allowed,
      });
      kr += payout.kr;
      mmg += payout.mmg;
    }
    return {
      playerId: a.playerId,
      displayName: a.displayName,
      side: a.side,
      clubName: clubBySide.get(a.side) ?? null,
      kr,
      mmg,
    };
  });
}

/**
 * Lock a match and return what it paid.
 *
 * A league match tags the ACTIVE season; a friendly carries none and pays no
 * Kroopies. Both are database constraints as well as spec rules, so an
 * unstarted season is refused here with a message that says what to do.
 *
 * Phase 2 only DISPLAYS the lines — landing them on the balance sheet is
 * Phase 5.
 */
export async function submitMatchAction(
  matchId: string,
): Promise<ActionResult<PayoutLine[]>> {
  const gate = await requireEditableMatch(matchId);
  if (!gate.ok) return gate;
  const { player, match } = gate.data;

  if (match.halves.length === 0) {
    return { ok: false, error: "This match has no halves." };
  }
  // Sides are created lazily, so a side with no club is an ABSENT row — never
  // a row with a null club_id. Fewer than two sides means a club is missing.
  const incomplete = match.halves.find((h) => h.sides.length < 2);
  if (incomplete) {
    return {
      ok: false,
      error:
        match.halves.length > 1
          ? `Pick a club for both sides of half ${incomplete.halfNo}.`
          : "Pick a club for both sides before submitting.",
    };
  }
  // The pair rule: a club leading home in one half and away in another would
  // play itself on aggregate. setSideClubAction blocks it; this catches drafts
  // from before that rule.
  if (clubOnBothSlots(match.halves) !== null) {
    return {
      ok: false,
      error: "A club can't be on both sides of one match. Fix the clubs before submitting.",
    };
  }
  if (match.appearances.length === 0) {
    return { ok: false, error: "Add at least one player before submitting." };
  }

  let seasonId: string | null = null;
  if (!match.isFriendly) {
    const active = await repo.getActiveSeason();
    if (!active) return { ok: false, error: NO_ACTIVE_SEASON };
    seasonId = active.id;
  }

  const [rates, sportStats] = await Promise.all([loadStatRates(), loadSportStats()]);
  const allowed = statsForSport(match.sport, sportStats);
  const lines = buildPayoutLines(match, rates, allowed);

  try {
    await repo.submitMatch(matchId, seasonId, player.id);
  } catch (e) {
    return failed(e, "Failed to submit the match.");
  }
  revalidateMatch(matchId);
  return { ok: true, data: lines };
}

/**
 * Unlock a submitted match for editing.
 *
 * KFANDRA-only: reopening un-tags the season and re-opens a payout that has
 * already been read as final, so a plain `admin` is refused. Reopening a match
 * that is already a draft is a no-op rather than an error.
 */
export async function reopenMatchAction(matchId: string): Promise<ActionResult> {
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };
  if (!canReopenMatch(player)) {
    return { ok: false, error: NOT_KFANDRA };
  }

  const match = await repo.getMatch(matchId);
  if (!match) return { ok: false, error: NO_MATCH };
  if (match.status === "draft") return OK;

  try {
    await repo.reopenMatch(matchId);
    revalidateMatch(matchId);
    return OK;
  } catch (e) {
    return failed(e, "Failed to reopen the match.");
  }
}

// ── seasons ─────────────────────────────────────────────────────────────────

/** Create a season as `upcoming`. It becomes live only when Started. */
export async function createSeasonAction(
  name: string,
  startDate: string,
): Promise<ActionResult<Season>> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  const trimmed = (name ?? "").trim();
  if (!trimmed) return { ok: false, error: "Give the season a name." };
  if (!DATE_RE.test(startDate ?? "")) {
    return { ok: false, error: "Pick a valid start date." };
  }

  try {
    const season = await repo.createSeason(trimmed, startDate);
    revalidatePath(SEASONS_PATH);
    return { ok: true, data: season };
  } catch (e) {
    return failed(e, "Failed to create the season.");
  }
}

/**
 * Make a season the active one. The repository closes whichever season is
 * currently active first — the database allows only one at a time.
 */
export async function startSeasonAction(seasonId: string): Promise<ActionResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  try {
    await repo.setSeasonStatus(seasonId, "active");
    revalidatePath(SEASONS_PATH);
    revalidatePath(MATCHES_PATH);
    return OK;
  } catch (e) {
    return failed(e, "Failed to start the season.");
  }
}

/**
 * Close a season, refusing while drafts dated inside it remain.
 *
 * The guard is by DATE, not by `season_id`: a draft never carries a season
 * (it is stamped at Submit and cleared by Reopen), so a season_id count would
 * always be 0 and this guard would never fire. See
 * `countDraftMatchesDatedInSeason`.
 */
export async function closeSeasonAction(seasonId: string): Promise<ActionResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  const drafts = await repo.countDraftMatchesDatedInSeason(seasonId);
  if (drafts > 0) {
    return {
      ok: false,
      error: `${drafts} draft match${drafts === 1 ? "" : "es"} dated in this season. Submit or delete them first.`,
    };
  }

  try {
    await repo.setSeasonStatus(seasonId, "closed");
    revalidatePath(SEASONS_PATH);
    revalidatePath(MATCHES_PATH);
    return OK;
  } catch (e) {
    return failed(e, "Failed to close the season.");
  }
}

export async function renameSeasonAction(
  seasonId: string,
  name: string,
): Promise<ActionResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  const trimmed = (name ?? "").trim();
  if (!trimmed) return { ok: false, error: "Give the season a name." };

  try {
    await repo.renameSeason(seasonId, trimmed);
    revalidatePath(SEASONS_PATH);
    revalidatePath(MATCHES_PATH);
    return OK;
  } catch (e) {
    return failed(e, "Failed to rename the season.");
  }
}
