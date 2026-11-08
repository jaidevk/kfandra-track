/**
 * Pure. Who may record and edit KLC matches (design §5.1), plus the
 * match-integrity rules the recorder enforces on top of the DB.
 *
 * Staff edit any draft. A club manager edits a draft they created, or one in
 * which any club they manage leads a side ("anyone involved can edit",
 * decided 2026-10-20). Only KFANDRA / super_admin reopen a submitted match.
 */
import { isStaffRole, type Role } from "@/lib/auth/roles";
import type { MatchStatus, SideKey } from "./types";

export interface Viewer {
  id: string;
  role: Role;
}

export interface MatchOwnership {
  createdBy: string | null;
  clubIds: readonly string[];
}

export function canRecordMatches(viewer: Viewer, managed: ReadonlySet<string>): boolean {
  return isStaffRole(viewer.role) || managed.size > 0;
}

export function canEditMatch(
  viewer: Viewer,
  match: MatchOwnership,
  managed: ReadonlySet<string>,
): boolean {
  if (isStaffRole(viewer.role)) return true;
  if (match.createdBy !== null && match.createdBy === viewer.id) return true;
  return match.clubIds.some((id) => managed.has(id));
}

/**
 * True if the viewer created a draft that is still open. A creator who no
 * longer manages any club keeps edit access to their own draft (via
 * `created_by`), so the matches list must stay reachable for them.
 */
export function hasOwnDraft(
  viewer: Viewer,
  matches: readonly { status: string; createdBy: string | null }[],
): boolean {
  return matches.some((m) => m.status === "draft" && m.createdBy === viewer.id);
}

export function canReopenMatch(viewer: Viewer): boolean {
  return viewer.role === "super_admin" || viewer.role === "kfandra";
}

export function matchClubIds(halves: { sides: { clubId: string | null }[] }[]): string[] {
  const ids: string[] = [];
  for (const h of halves) {
    for (const s of h.sides) {
      if (s.clubId !== null && !ids.includes(s.clubId)) ids.push(s.clubId);
    }
  }
  return ids;
}

/**
 * True if `clubId` already leads the OTHER slot in any half of this match.
 *
 * A club leading home in one half and away in the other would play itself on
 * aggregate (and be credited a W and an L for one match). The DB only blocks
 * this within a single half, so the recorder refuses it across halves.
 */
export function clubOnOtherSide(
  halves: { sides: { side: "home" | "away"; clubId: string | null }[] }[],
  side: "home" | "away",
  clubId: string,
): boolean {
  return halves.some((h) => h.sides.some((s) => s.side !== side && s.clubId === clubId));
}

/**
 * True if, after setting `side` of half `halfId` to `newClubId`, at least one
 * club in `managed` still leads a side somewhere in the match. A manager may
 * not edit their own club off a match (they would lose access to it). Staff
 * are exempt; the caller decides that.
 */
export function keepsManagedClub(
  halves: { id: string; sides: { side: "home" | "away"; clubId: string | null }[] }[],
  halfId: string,
  side: "home" | "away",
  newClubId: string,
  managed: ReadonlySet<string>,
): boolean {
  if (managed.has(newClubId)) return true;
  return halves.some((h) =>
    h.sides.some(
      (s) =>
        !(h.id === halfId && s.side === side) && s.clubId !== null && managed.has(s.clubId),
    ),
  );
}

/**
 * The first club that leads the home slot in one half and the away slot in
 * another (or the same) half, or null if every club stays on one slot.
 *
 * Submit refuses such a match: on aggregate the club would play itself and be
 * credited a W and an L. `setSideClubAction` blocks this going forward, but a
 * draft from before that rule (the removed half-2 "Swap clubs" prompt) can
 * still hold one.
 */
export function clubOnBothSlots(
  halves: { sides: { side: "home" | "away"; clubId: string | null }[] }[],
): string | null {
  const home = new Set<string>();
  const away = new Set<string>();
  for (const h of halves) {
    for (const s of h.sides) {
      if (s.clubId !== null) (s.side === "home" ? home : away).add(s.clubId);
    }
  }
  for (const id of home) if (away.has(id)) return id;
  return null;
}

// ── match workflow (spec 2026-11-08 §3) ─────────────────────────────────────

/** The fields `matchPermissions` reads. `MatchDraft` satisfies it. */
export interface PermissionMatch {
  status: MatchStatus;
  isFriendly: boolean;
  createdBy: string | null;
  homeSentAt: string | null;
  awaySentAt: string | null;
  halves: { id: string; sides: { side: SideKey; clubId: string | null }[] }[];
  appearances: { side: SideKey }[];
}

/** What one viewer may change on one match, right now. */
export interface MatchPermissions {
  /** Date, sport, duration, League/Friendly. */
  details: boolean;
  deleteDraft: boolean;
  /** Squad and stats, per team. */
  team: Record<SideKey, boolean>;
  /** Pick the club leading this side (pair and keep-your-club rules apply on top). */
  clubs: Record<SideKey, boolean>;
  score: boolean;
  /** Goal/try minutes, per team. */
  times: Record<SideKey, boolean>;
  /** Teams this viewer can send now. */
  send: SideKey[];
  makeOfficial: boolean;
  sendBack: boolean;
  reopen: boolean;
}

const SIDE_KEYS: readonly SideKey[] = ["home", "away"];
const both = (v: boolean): Record<SideKey, boolean> => ({ home: v, away: v });

const NOTHING: MatchPermissions = {
  details: false, deleteDraft: false, team: both(false), clubs: both(false),
  score: false, times: both(false), send: [], makeOfficial: false, sendBack: false, reopen: false,
};

/** The teams (aggregate sides) led by a managed club in any half. */
export function ownedSides(
  halves: { sides: { side: SideKey; clubId: string | null }[] }[],
  managed: ReadonlySet<string>,
): SideKey[] {
  return SIDE_KEYS.filter((side) =>
    halves.some((h) =>
      h.sides.some((s) => s.side === side && s.clubId !== null && managed.has(s.clubId)),
    ),
  );
}

export function sentSides(m: { homeSentAt: string | null; awaySentAt: string | null }) {
  return { home: m.homeSentAt !== null, away: m.awaySentAt !== null };
}

/**
 * The one permission rule, used by the server actions (to refuse) and the
 * recorder (to hide what would be refused).
 *
 *  - Official: nothing changes, except staff may add goal times (D13), and
 *    KFANDRA may reopen.
 *  - Staff: everything before official; they never "send", they make official.
 *  - Manager (draft only): their own team until they send it (D9, D2); the
 *    match details and a friendly score until either team is sent; the other
 *    side's club only while that team has no players (that's how the creator
 *    names the opponent).
 */
export function matchPermissions(
  viewer: Viewer,
  m: PermissionMatch,
  managed: ReadonlySet<string>,
): MatchPermissions {
  const staff = isStaffRole(viewer.role);
  if (m.status === "submitted") {
    return { ...NOTHING, times: both(staff), reopen: canReopenMatch(viewer) };
  }
  const sent = sentSides(m);
  if (staff) {
    return {
      details: true, deleteDraft: true, team: both(true), clubs: both(true),
      score: true, times: both(true), send: [], makeOfficial: true,
      sendBack: m.status === "sent" || sent.home || sent.away, reopen: false,
    };
  }
  if (m.status !== "draft") return NOTHING;
  const owned = ownedSides(m.halves, managed);
  const involved = owned.length > 0 || (m.createdBy !== null && m.createdBy === viewer.id);
  if (!involved) return NOTHING;

  const noneSent = !sent.home && !sent.away;
  const team = {
    home: owned.includes("home") && !sent.home,
    away: owned.includes("away") && !sent.away,
  };
  const empty = (side: SideKey) => !m.appearances.some((a) => a.side === side);
  const clubs = {
    home: owned.includes("home") ? !sent.home : noneSent && empty("home"),
    away: owned.includes("away") ? !sent.away : noneSent && empty("away"),
  };
  return {
    details: noneSent, deleteDraft: noneSent, team, clubs,
    score: m.isFriendly && noneSent, times: team,
    send: SIDE_KEYS.filter((s) => team[s]),
    makeOfficial: false, sendBack: false, reopen: false,
  };
}
