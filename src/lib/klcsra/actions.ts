"use server";

import { revalidatePath } from "next/cache";
import { getCurrentPlayer, type CurrentPlayer } from "@/lib/auth/current-user";
import { isStaffRole } from "@/lib/auth/roles";
import {
  canEditMatch, canReopenMatch, clubOnBothSlots, clubOnOtherSide, keepsManagedClub, matchClubIds,
  matchPermissions, ownedSides, sentSides, type MatchPermissions,
} from "./access";
import { loadSportStats, loadStatRates } from "./config";
import { computePlayerPayout } from "./payouts";
import * as repo from "./repository";
import { SPORTS, statsForSport, type Sport } from "./sport-stats";
import { STAT_KEYS, type StatKey, type StatRates } from "./stat-rates";
import { cleanTimes, isTimed, trimTimes } from "./goal-times";
import { asCandidate, findDuplicates, type DuplicateCandidate } from "./duplicates";
import type { MatchDraft, MatchStatus, PayoutLine, Season, SideKey } from "./types";

/**
 * Server actions for the KLCSRA match recorder.
 *
 * Three rules live here and nowhere else:
 *
 *  1. **Auth.** Every action re-resolves the caller with `getCurrentPlayer()`.
 *     Season actions require staff; match actions require a match editor
 *     (`access.ts`: staff, the creator, or a manager of a club on the match).
 *     A client-supplied identity is never trusted.
 *  2. **Who may change what.** `matchPermissions` (access.ts) per state and
 *     team; RLS deliberately does not enforce it (staff have blanket write
 *     access), so this file is the first lock; the `*_submit_lock` DB
 *     triggers are the backstop for official matches.
 *  3. **The payout compute.** Make official composes the pure domain
 *     (`computePlayerPayout` x `statsForSport`) over the stored match and
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
const WAITING = "Waiting for KFANDRA to make this official.";
const TEAM_SENT = "Your team has been sent. Ask KFANDRA to send it back if something needs fixing.";
const NOT_YOUR_TEAM = "You can only edit your own team.";
const DETAILS_FIXED =
  "A team has been sent, so the match details are fixed. Ask KFANDRA to send it back if something needs fixing.";
const STAFF_SCORE = "Only KFANDRA or an admin can enter a league score.";
const OTHER_CLUB = "That side belongs to the other club now. Ask their manager or KFANDRA.";

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

interface MatchGate {
  player: CurrentPlayer;
  match: MatchDraft;
  /** The caller's managed clubs; empty for staff (never looked up). */
  managed: Set<string>;
  perms: MatchPermissions;
}

/**
 * Signed in + the match exists + the caller is staff or involved in it
 * (creator, or manager of a club on it). What they may CHANGE is
 * `perms` (`matchPermissions`, spec §3); each action checks its own slice.
 */
async function loadMatchGate(matchId: string): Promise<ActionResult<MatchGate>> {
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };
  const match = await repo.getMatch(matchId);
  if (!match) return { ok: false, error: NO_MATCH };
  let managed = new Set<string>();
  if (!isStaffRole(player.role)) {
    const loaded = await loadManaged(player.id);
    if (!loaded.ok) return loaded;
    managed = loaded.data;
    const ownership = { createdBy: match.createdBy, clubIds: matchClubIds(match.halves) };
    if (!canEditMatch(player, ownership, managed)) return { ok: false, error: NOT_STAFF };
  }
  return { ok: true, data: { player, match, managed, perms: matchPermissions(player, match, managed) } };
}

/** The state-level refusal (locked, or waiting for KFANDRA), if any. */
function stateRefusal(g: MatchGate): string | null {
  if (g.match.status === "submitted") return LOCKED;
  if (g.match.status === "sent" && !isStaffRole(g.player.role)) return WAITING;
  return null;
}

function teamRefusal(g: MatchGate, side: SideKey): string | null {
  if (g.perms.team[side]) return null;
  return stateRefusal(g) ?? (sentSides(g.match)[side] && ownedSides(g.match.halves, g.managed).includes(side)
    ? TEAM_SENT
    : NOT_YOUR_TEAM);
}

function detailsRefusal(g: MatchGate): string | null {
  return g.perms.details ? null : (stateRefusal(g) ?? DETAILS_FIXED);
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
  /** The opponent. Required for a club manager; optional for staff. */
  awayClubId?: string | null;
  /** Create even though a match between the same clubs exists that day (spec §4). */
  allowDuplicate?: boolean;
}

export type CreateMatchOutcome =
  | { kind: "created"; id: string }
  | { kind: "duplicates"; matches: DuplicateCandidate[] };

/**
 * Create a draft match (with its half rows, and half 1's clubs when given).
 * When both clubs are known and another match on that date has the same two
 * clubs on opposite sides, nothing is created and those matches are returned,
 * so the form can offer "Open it" (D8). `allowDuplicate` skips the check.
 */
export async function createMatchAction(
  input: CreateMatchFields,
): Promise<ActionResult<CreateMatchOutcome>> {
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };

  if (!DATE_RE.test(input?.entryDate ?? "")) {
    return { ok: false, error: "Pick a valid match date." };
  }
  if (!isSport(input.sport)) return { ok: false, error: "Pick a valid sport." };

  const homeClubId = input.homeClubId || null;
  const awayClubId = input.awayClubId || null;
  if (!isStaffRole(player.role)) {
    const managed = await loadManaged(player.id);
    if (!managed.ok) return managed;
    if (!homeClubId || !managed.data.has(homeClubId)) return { ok: false, error: NOT_STAFF };
    if (!awayClubId) return { ok: false, error: "Pick the other club." };
  }
  if (homeClubId && awayClubId && homeClubId === awayClubId) {
    return { ok: false, error: "Pick two different clubs." };
  }

  if (homeClubId && awayClubId && !input.allowDuplicate) {
    const sameDay = await repo.listMatches({ entryDate: input.entryDate });
    const matches = findDuplicates(
      {
        id: null,
        entryDate: input.entryDate,
        sideClubs: [{ side: "home", clubId: homeClubId }, { side: "away", clubId: awayClubId }],
      },
      sameDay,
    );
    if (matches.length > 0) {
      return { ok: true, data: { kind: "duplicates", matches: matches.map(asCandidate) } };
    }
  }

  try {
    const id = await repo.createMatch({
      entryDate: input.entryDate,
      sport: input.sport,
      isCombined: Boolean(input.isCombined),
      isFriendly: Boolean(input.isFriendly),
      createdBy: player.id,
      homeClubId,
      awayClubId,
    });
    revalidatePath(MATCHES_PATH);
    return { ok: true, data: { kind: "created", id } };
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
  const gate = await loadMatchGate(matchId);
  if (!gate.ok) return gate;
  const why = detailsRefusal(gate.data);
  if (why) return { ok: false, error: why };

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

  // A manager may enter a friendly's score but not a league one (D1), so
  // flipping Friendly -> League must not carry their score across. Cleared
  // first: if the update then fails, the match is still a friendly.
  const toLeague = patch?.isFriendly === false && gate.data.match.isFriendly;
  const clearsScores = toLeague && !isStaffRole(gate.data.player.role);

  try {
    if (clearsScores) await repo.clearScores(matchId);
    await repo.updateMatchMeta(matchId, fields);
    revalidateMatch(matchId);
    return OK;
  } catch (e) {
    return failed(e, "Failed to update the match.");
  }
}

/** Delete a draft match; halves, sides, squad and stats cascade with it. */
export async function deleteMatchAction(matchId: string): Promise<ActionResult> {
  const gate = await loadMatchGate(matchId);
  if (!gate.ok) return gate;
  if (!gate.data.perms.deleteDraft) {
    return { ok: false, error: stateRefusal(gate.data) ?? DETAILS_FIXED };
  }

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
  const gate = await loadMatchGate(matchId);
  if (!gate.ok) return gate;

  if (!isSideKey(side)) return { ok: false, error: "Unknown side." };
  if (!clubId) return { ok: false, error: "Pick a club." };
  const { player, match, managed, perms } = gate.data;
  if (!match.halves.some((h) => h.id === halfId)) {
    return { ok: false, error: "That half does not belong to this match." };
  }
  if (!perms.clubs[side]) {
    const why = stateRefusal(gate.data) ??
      (ownedSides(match.halves, managed).includes(side) ? TEAM_SENT : OTHER_CLUB);
    return { ok: false, error: why };
  }
  if (clubOnOtherSide(match.halves, side, clubId)) {
    return { ok: false, error: "That club is already on the other side of this match." };
  }
  // A manager may not edit their own club off the match. Staff are exempt.
  if (!isStaffRole(player.role) && !keepsManagedClub(match.halves, halfId, side, clubId, managed)) {
    return { ok: false, error: KEEP_OWN_CLUB };
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
  const gate = await loadMatchGate(matchId);
  if (!gate.ok) return gate;
  if (!gate.data.perms.score) {
    const why = stateRefusal(gate.data) ?? (gate.data.match.isFriendly ? DETAILS_FIXED : STAFF_SCORE);
    return { ok: false, error: why };
  }

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
  const gate = await loadMatchGate(matchId);
  if (!gate.ok) return gate;

  if (!isSideKey(side)) return { ok: false, error: "Unknown side." };
  if (!playerId) return { ok: false, error: "Pick a player." };
  const why = teamRefusal(gate.data, side);
  if (why) return { ok: false, error: why };
  // Re-adding moves a player between sides: never out of a team the caller can't edit.
  const existing = gate.data.match.appearances.find((a) => a.playerId === playerId);
  if (existing && existing.side !== side && !gate.data.perms.team[existing.side]) {
    return { ok: false, error: "That player is already in the other team." };
  }

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
  const gate = await loadMatchGate(matchId);
  if (!gate.ok) return gate;

  const app = gate.data.match.appearances.find((a) => a.id === appearanceId);
  if (!app) return { ok: false, error: "That player is not in this match." };
  const why = teamRefusal(gate.data, app.side);
  if (why) return { ok: false, error: why };

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
  const gate = await loadMatchGate(matchId);
  if (!gate.ok) return gate;

  const { match } = gate.data;
  const app = match.appearances.find((a) => a.id === appearanceId);
  if (!app) return { ok: false, error: "That player is not in this match." };
  if (!match.halves.some((h) => h.halfNo === halfNo)) {
    return { ok: false, error: "This match has no such half." };
  }
  if (!KNOWN_STATS.has(statKey)) return { ok: false, error: "Unknown stat." };
  const why = teamRefusal(gate.data, app.side);
  if (why) return { ok: false, error: why };

  // Negative tallies are meaningless — the +/- sign lives in the rates — and
  // the DB rejects them. Clamp to 0, which the repository reads as "clear".
  const value = Math.max(0, nonNegativeInt(count) ?? 0);
  // A lower count drops the latest goal times with it (minutes_len_chk).
  const minutes = trimTimes(app.times?.[halfNo]?.[statKey] ?? [], value);

  try {
    await repo.setStat(appearanceId, halfNo, statKey, value, minutes);
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

/** The checks Send and Make official share. Null when the match is complete. */
function completenessRefusal(match: MatchDraft, verb: "sending" | "submitting"): string | null {
  if (match.halves.length === 0) return "This match has no halves.";
  // Sides are created lazily, so a side with no club is an ABSENT row.
  const incomplete = match.halves.find((h) => h.sides.length < 2);
  if (incomplete) {
    return match.halves.length > 1
      ? `Pick a club for both sides of half ${incomplete.halfNo}.`
      : `Pick a club for both sides before ${verb}.`;
  }
  if (clubOnBothSlots(match.halves) !== null) {
    return `A club can't be on both sides of one match. Fix the clubs before ${verb}.`;
  }
  return null;
}

/**
 * A manager sends their own team (D2, D9). It then locks for them. When both
 * teams are sent, a league match moves to Sent (waiting for KFANDRA) and a
 * friendly is submitted. Returns the match status after the send.
 */
export async function sendTeamAction(
  matchId: string,
  side: SideKey,
): Promise<ActionResult<MatchStatus>> {
  const gate = await loadMatchGate(matchId);
  if (!gate.ok) return gate;
  if (!isSideKey(side)) return { ok: false, error: "Unknown side." };
  const { player, match, perms } = gate.data;
  if (!perms.send.includes(side)) {
    return { ok: false, error: teamRefusal(gate.data, side) ?? NOT_YOUR_TEAM };
  }
  const incomplete = completenessRefusal(match, "sending");
  if (incomplete) return { ok: false, error: incomplete };
  if (!match.appearances.some((a) => a.side === side)) {
    return { ok: false, error: "Add at least one player to your team before sending." };
  }

  try {
    await repo.sendTeam(matchId, side);
    const status = await repo.finishSending(matchId, player.id);
    revalidateMatch(matchId);
    return { ok: true, data: status };
  } catch (e) {
    return failed(e, "Failed to send your team.");
  }
}

/**
 * Staff make a match official (D3): it locks and, for a league match, tags the
 * ACTIVE season and starts counting in the tables. Works from Draft or Sent
 * (a club may never send). A friendly made official here carries no season.
 * Returns the payout lines, as Submit did.
 */
export async function makeOfficialAction(
  matchId: string,
): Promise<ActionResult<PayoutLine[]>> {
  const gate = await loadMatchGate(matchId);
  if (!gate.ok) return gate;
  const { player, match, perms } = gate.data;
  if (!perms.makeOfficial) return { ok: false, error: stateRefusal(gate.data) ?? NOT_STAFF };

  const incomplete = completenessRefusal(match, "submitting");
  if (incomplete) return { ok: false, error: incomplete };
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
  const lines = buildPayoutLines(match, rates, statsForSport(match.sport, sportStats));

  try {
    await repo.makeOfficial(matchId, seasonId, player.id);
  } catch (e) {
    return failed(e, "Failed to make the match official.");
  }
  revalidateMatch(matchId);
  return { ok: true, data: lines };
}

/** Staff send a match back to the managers (D5): both teams editable again. */
export async function sendBackAction(matchId: string): Promise<ActionResult> {
  const gate = await loadMatchGate(matchId);
  if (!gate.ok) return gate;
  if (!isStaffRole(gate.data.player.role)) {
    return { ok: false, error: stateRefusal(gate.data) ?? NOT_STAFF };
  }
  if (gate.data.match.status === "submitted") return { ok: false, error: LOCKED };
  if (!gate.data.perms.sendBack) return { ok: false, error: "No team has been sent yet." };

  try {
    await repo.sendBack(matchId);
    revalidateMatch(matchId);
    return OK;
  } catch (e) {
    return failed(e, "Failed to send the match back.");
  }
}

/**
 * Unlock an official match (KFANDRA only, D6). A league match goes back to
 * Sent, so KFANDRA edits and re-officials without involving the managers; a
 * friendly goes back to Draft. Reopening a match that isn't official is a no-op.
 */
export async function reopenMatchAction(matchId: string): Promise<ActionResult> {
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };
  if (!canReopenMatch(player)) return { ok: false, error: NOT_KFANDRA };

  const match = await repo.getMatch(matchId);
  if (!match) return { ok: false, error: NO_MATCH };
  if (match.status !== "submitted") return OK;

  try {
    await repo.reopenMatch(matchId, match.isFriendly ? "draft" : "sent");
    revalidateMatch(matchId);
    return OK;
  } catch (e) {
    return failed(e, "Failed to reopen the match.");
  }
}

/**
 * Set the goal/try minutes for one tally (D12). A manager, for their own team
 * while it's editable; staff any time, including on an official match (D13:
 * times don't touch the score or the tables). Trailing blanks are dropped.
 */
export async function setGoalTimesAction(
  matchId: string,
  appearanceId: string,
  halfNo: number,
  statKey: StatKey,
  minutes: (number | null)[],
): Promise<ActionResult> {
  const gate = await loadMatchGate(matchId);
  if (!gate.ok) return gate;
  const { match, perms } = gate.data;
  const app = match.appearances.find((a) => a.id === appearanceId);
  if (!app) return { ok: false, error: "That player is not in this match." };
  if (!perms.times[app.side]) {
    return { ok: false, error: stateRefusal(gate.data) ?? teamRefusal(gate.data, app.side) ?? LOCKED };
  }
  if (!KNOWN_STATS.has(statKey) || !isTimed(match.sport, statKey, match.isFriendly)) {
    return { ok: false, error: "Times are only kept for league Fooba goals and Rugby Sox tries." };
  }
  const cleaned = cleanTimes(minutes);
  if (!cleaned) return { ok: false, error: "Enter whole minutes between 0 and 150." };
  const count = app.stats[halfNo]?.[statKey] ?? 0;
  const trimmed = trimTimes(cleaned, cleaned.length);
  if (trimmed.length > count) {
    return { ok: false, error: "More times than goals: lower the times first." };
  }

  try {
    await repo.setGoalTimes(appearanceId, halfNo, statKey, trimmed);
    revalidateMatch(matchId);
    return OK;
  } catch (e) {
    return failed(e, "Failed to save the times.");
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
 * Close a season, refusing while unfinished (draft or sent) matches dated
 * inside it remain.
 *
 * The guard is by DATE, not by `season_id`: an unfinished match never carries
 * a season (it is stamped when made official and cleared by Reopen), so a
 * season_id count would always be 0 and this guard would never fire. See
 * `countUnfinishedMatchesDatedInSeason`.
 */
export async function closeSeasonAction(seasonId: string): Promise<ActionResult> {
  const auth = await requireStaff();
  if (!auth.ok) return auth;

  const drafts = await repo.countUnfinishedMatchesDatedInSeason(seasonId);
  if (drafts > 0) {
    return {
      ok: false,
      error: `${drafts} unfinished match${drafts === 1 ? "" : "es"} dated in this season. Finish or delete them first.`,
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
