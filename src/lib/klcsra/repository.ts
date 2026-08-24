import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StatKey } from "./stat-rates";
import type { Sport } from "./sport-stats";
import type {
  AppearanceDraft,
  ClubOption,
  HalfDraft,
  MatchDraft,
  MatchStatus,
  MatchSummary,
  MemberOption,
  Season,
  SeasonStatus,
  SideDraft,
  SideKey,
} from "./types";

/**
 * Server-only data access for the KLCSRA match recorder. Pure persistence:
 * no auth checks and no business rules (the submit lock, the "league needs an
 * active season" rule and the payout compute all live in actions.ts).
 *
 * Two schema facts shape this file:
 *   * `klc_match_sides.club_id` is NOT NULL, so an "empty" side cannot exist.
 *     Side rows are therefore created LAZILY by `setSideClub`, which upserts
 *     on `(half_id, side)`. `getMatch` returns only the sides that exist, so
 *     callers address a side by `(halfId, side)`, never by a row id.
 *   * `klc_player_stats.stat_count >= 0`, so `setStat` DELETES a row when the
 *     count reaches zero rather than storing a 0.
 */

// ── row-shape helpers ───────────────────────────────────────────────────────

/** A to-one embed comes back as an object (or null) despite the plural name. */
type ToOne<T> = T | T[] | null;
function one<T>(rel: ToOne<T>): T | null {
  if (!rel) return null;
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

const SEASON_COLS = "id, season_no, name, start_date, end_date, status";

function toSeason(s: {
  id: string; season_no: number; name: string;
  start_date: string; end_date: string | null; status: string;
}): Season {
  return {
    id: s.id, seasonNo: s.season_no, name: s.name,
    startDate: s.start_date, endDate: s.end_date,
    status: s.status as SeasonStatus,
  };
}

// ── seasons ─────────────────────────────────────────────────────────────────

/** Every season, oldest first (season_no order). */
export async function listSeasons(): Promise<Season[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("klc_seasons")
    .select(SEASON_COLS)
    .order("season_no", { ascending: true });
  return (data ?? []).map(toSeason);
}

/** The one active season, or null. At most one can exist (partial unique index). */
export async function getActiveSeason(): Promise<Season | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("klc_seasons")
    .select(SEASON_COLS)
    .eq("status", "active")
    .maybeSingle();
  return data ? toSeason(data) : null;
}

/** Create a season as `upcoming`; season_no is max+1. */
export async function createSeason(name: string, startDate: string): Promise<Season> {
  const admin = createAdminClient();
  const { data: last } = await admin
    .from("klc_seasons")
    .select("season_no")
    .order("season_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await admin
    .from("klc_seasons")
    .insert({
      season_no: (last?.season_no ?? 0) + 1,
      name,
      start_date: startDate,
      status: "upcoming",
    })
    .select(SEASON_COLS)
    .single();
  if (error) throw new Error(`Failed to create season: ${error.message}`);
  return toSeason(data);
}

/**
 * Set a season's status. Activating one CLOSES whichever season is currently
 * active first — the DB allows only one active season at a time.
 *
 * PostgREST gives us no cross-statement transaction, so this is two calls: the
 * close lands before the activate, and a failure in between leaves no active
 * season (recoverable by pressing Start again) rather than two.
 */
export async function setSeasonStatus(id: string, status: SeasonStatus): Promise<void> {
  const admin = createAdminClient();
  if (status === "active") {
    const { error: closeErr } = await admin
      .from("klc_seasons")
      .update({ status: "closed" })
      .eq("status", "active")
      .neq("id", id);
    if (closeErr) throw new Error(`Failed to close the current season: ${closeErr.message}`);
  }
  const { error } = await admin.from("klc_seasons").update({ status }).eq("id", id);
  if (error) throw new Error(`Failed to update season status: ${error.message}`);
}

export async function renameSeason(id: string, name: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("klc_seasons").update({ name }).eq("id", id);
  if (error) throw new Error(`Failed to rename season: ${error.message}`);
}

/**
 * How many matches are still in `draft` with an `entry_date` inside this
 * season's window — `start_date` .. `end_date`, or today while the season is
 * still open-ended.
 *
 * Deliberately DATE-based rather than `season_id`-based. `klc_matches.season_id`
 * is only written at Submit and is cleared again by Reopen, so a draft match
 * never carries a season and `countDraftMatchesInSeason` below can only ever
 * return 0. "Is there unfinished work in this season?" is therefore asked of
 * the calendar, which is the only thing a draft actually commits to.
 *
 * Returns 0 for an unknown season id — nothing to block on.
 */
export async function countDraftMatchesDatedInSeason(id: string): Promise<number> {
  const admin = createAdminClient();
  const { data: season } = await admin
    .from("klc_seasons")
    .select("start_date, end_date")
    .eq("id", id)
    .maybeSingle();
  if (!season) return 0;

  const end = season.end_date ?? new Date().toISOString().slice(0, 10);
  const { count } = await admin
    .from("klc_matches")
    .select("id", { count: "exact", head: true })
    .eq("status", "draft")
    .gte("entry_date", season.start_date)
    .lte("entry_date", end);
  return count ?? 0;
}

/**
 * How many matches still sit in `draft` under this season, by `season_id`.
 *
 * Kept for completeness of the season API, but note the caveat above: a draft
 * never carries a season_id, so this is 0 by construction. `closeSeasonAction`
 * uses `countDraftMatchesDatedInSeason` instead.
 */
export async function countDraftMatchesInSeason(id: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from("klc_matches")
    .select("id", { count: "exact", head: true })
    .eq("season_id", id)
    .eq("status", "draft");
  return count ?? 0;
}

// ── lookups ─────────────────────────────────────────────────────────────────

/** Active clubs, in landing-grid order — the club `<select>` options. */
export async function listClubs(): Promise<ClubOption[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("clubs")
    .select("id, name, manager_name, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []).map((c) => ({
    id: c.id, name: c.name, managerName: c.manager_name,
  }));
}

/** Active members — the squad picker options. */
export async function listActiveMembers(): Promise<MemberOption[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("players")
    .select("id, display_name")
    .eq("is_active", true)
    .order("display_name", { ascending: true });
  return (data ?? []).map((p) => ({ id: p.id, displayName: p.display_name }));
}

// ── matches ─────────────────────────────────────────────────────────────────

interface SideRow {
  id: string; side: string; score: number; club_id: string;
  clubs: ToOne<{ name: string }>;
}
interface HalfRow {
  id: string; half_no: number; klc_match_sides: SideRow[] | null;
}

function toSideDraft(s: SideRow): SideDraft {
  return {
    id: s.id,
    side: s.side as SideKey,
    clubId: s.club_id,
    clubName: one(s.clubs)?.name ?? null,
    score: s.score,
  };
}

const SIDE_ORDER: SideKey[] = ["home", "away"];

function toHalfDrafts(halves: HalfRow[] | null): HalfDraft[] {
  return [...(halves ?? [])]
    .sort((a, b) => a.half_no - b.half_no)
    .map((h) => ({
      id: h.id,
      halfNo: h.half_no,
      sides: [...(h.klc_match_sides ?? [])]
        .map(toSideDraft)
        .sort((a, b) => SIDE_ORDER.indexOf(a.side) - SIDE_ORDER.indexOf(b.side)),
    }));
}

/** "Cicadas / Hornets" — every distinct club that led this side, in half order. */
function sideLabel(halves: HalfDraft[], side: SideKey): string {
  const names: string[] = [];
  for (const h of halves) {
    const name = h.sides.find((s) => s.side === side)?.clubName;
    if (name && !names.includes(name)) names.push(name);
  }
  return names.length > 0 ? names.join(" / ") : "TBD";
}

function scoreLine(halves: HalfDraft[]): string {
  let home = 0;
  let away = 0;
  for (const h of halves) {
    for (const s of h.sides) {
      if (s.side === "home") home += s.score;
      else away += s.score;
    }
  }
  return `${home} - ${away}`;
}

/** Every match, newest first, with its aggregate score line. */
export async function listMatches(): Promise<MatchSummary[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("klc_matches")
    .select(
      `id, entry_date, sport, is_friendly, is_combined, status,
       klc_seasons(name),
       klc_match_halves(id, half_no,
         klc_match_sides(id, side, score, club_id, clubs(name)))`,
    )
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  return (data ?? []).map((m) => {
    const halves = toHalfDrafts(m.klc_match_halves as HalfRow[] | null);
    return {
      id: m.id,
      entryDate: m.entry_date,
      sport: m.sport as Sport,
      isFriendly: m.is_friendly,
      isCombined: m.is_combined,
      status: m.status as MatchStatus,
      seasonName: one(m.klc_seasons as ToOne<{ name: string }>)?.name ?? null,
      homeLabel: sideLabel(halves, "home"),
      awayLabel: sideLabel(halves, "away"),
      scoreLine: scoreLine(halves),
    };
  });
}

interface StatRow { half_no: number; stat_key: string; stat_count: number }
interface AppearanceRow {
  id: string; player_id: string; side: string; slot: number;
  players: ToOne<{ display_name: string }>;
  klc_player_stats: StatRow[] | null;
}

function toAppearanceDraft(a: AppearanceRow): AppearanceDraft {
  const stats: Record<number, Partial<Record<StatKey, number>>> = {};
  for (const s of a.klc_player_stats ?? []) {
    const half = (stats[s.half_no] ??= {});
    half[s.stat_key as StatKey] = s.stat_count;
  }
  return {
    id: a.id,
    playerId: a.player_id,
    displayName: one(a.players)?.display_name ?? "Unknown",
    side: a.side as SideKey,
    slot: a.slot,
    stats,
  };
}

/** One match with its halves, sides and squad (stats keyed by half), or null. */
export async function getMatch(matchId: string): Promise<MatchDraft | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("klc_matches")
    .select(
      `id, entry_date, sport, is_friendly, is_combined, duration_minutes,
       status, submitted_at, season_id,
       klc_seasons(name),
       klc_match_halves(id, half_no,
         klc_match_sides(id, side, score, club_id, clubs(name))),
       klc_match_appearances(id, player_id, side, slot,
         players(display_name),
         klc_player_stats(half_no, stat_key, stat_count))`,
    )
    .eq("id", matchId)
    .maybeSingle();
  if (!data) return null;

  const appearances = (data.klc_match_appearances as AppearanceRow[] | null ?? [])
    .map(toAppearanceDraft)
    .sort((a, b) =>
      SIDE_ORDER.indexOf(a.side) - SIDE_ORDER.indexOf(b.side) || a.slot - b.slot,
    );

  return {
    id: data.id,
    entryDate: data.entry_date,
    sport: data.sport as Sport,
    isFriendly: data.is_friendly,
    isCombined: data.is_combined,
    durationMinutes: data.duration_minutes,
    status: data.status as MatchStatus,
    submittedAt: data.submitted_at,
    seasonId: data.season_id,
    seasonName: one(data.klc_seasons as ToOne<{ name: string }>)?.name ?? null,
    halves: toHalfDrafts(data.klc_match_halves as HalfRow[] | null),
    appearances,
  };
}

export interface CreateMatchInput {
  entryDate: string;
  sport: Sport;
  isCombined: boolean;
  isFriendly: boolean;
}

/**
 * Create a draft match and its half rows (1, or 1 and 2 when combined).
 *
 * Side rows are deliberately NOT created here: `klc_match_sides.club_id` is
 * NOT NULL, so an empty side is unrepresentable. `setSideClub` creates them.
 *
 * @returns the new match id.
 */
export async function createMatch(input: CreateMatchInput): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("klc_matches")
    .insert({
      entry_date: input.entryDate,
      sport: input.sport,
      is_combined: input.isCombined,
      is_friendly: input.isFriendly,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to create match: ${error.message}`);

  const halfNos = input.isCombined ? [1, 2] : [1];
  const { error: halvesErr } = await admin
    .from("klc_match_halves")
    .insert(halfNos.map((half_no) => ({ match_id: data.id, half_no })));
  if (halvesErr) {
    // Leave no half-built match behind.
    await admin.from("klc_matches").delete().eq("id", data.id);
    throw new Error(`Failed to create match halves: ${halvesErr.message}`);
  }
  return data.id;
}

export interface MatchMetaPatch {
  entryDate?: string;
  sport?: Sport;
  durationMinutes?: number | null;
}

/** Patch the match header. `is_combined` is fixed at creation (halves exist). */
export async function updateMatchMeta(id: string, patch: MatchMetaPatch): Promise<void> {
  const fields: {
    entry_date?: string; sport?: string; duration_minutes?: number | null;
  } = {};
  if (patch.entryDate !== undefined) fields.entry_date = patch.entryDate;
  if (patch.sport !== undefined) fields.sport = patch.sport;
  if (patch.durationMinutes !== undefined) fields.duration_minutes = patch.durationMinutes;
  if (Object.keys(fields).length === 0) return;

  const admin = createAdminClient();
  const { error } = await admin.from("klc_matches").update(fields).eq("id", id);
  if (error) throw new Error(`Failed to update match: ${error.message}`);
}

/** Delete a match; halves, sides, appearances and stats cascade with it. */
export async function deleteMatch(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("klc_matches").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete match: ${error.message}`);
}

// ── sides ───────────────────────────────────────────────────────────────────

/**
 * Set (or create) the club leading one side of one half.
 *
 * Addressed by `(halfId, side)` rather than a side row id, because the row may
 * not exist yet — `club_id` is NOT NULL, so a side is born the moment a club
 * is chosen. The upsert only carries the columns it means to change, so an
 * already-entered score survives a club swap.
 */
export async function setSideClub(
  halfId: string,
  side: SideKey,
  clubId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("klc_match_sides")
    .upsert(
      { half_id: halfId, side, club_id: clubId, role: side },
      { onConflict: "half_id,side" },
    );
  if (error) {
    // unique (half_id, club_id) — a club cannot play itself.
    if (error.code === "23505") {
      throw new Error("That club is already on the other side of this half.");
    }
    throw new Error(`Failed to set the club for this side: ${error.message}`);
  }
}

/**
 * Set one side's score for one half. The side must already have a club — a
 * score with nobody to credit it to is meaningless, and the row cannot exist.
 */
export async function setSideScore(
  halfId: string,
  side: SideKey,
  score: number,
): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("klc_match_sides")
    .update({ score })
    .eq("half_id", halfId)
    .eq("side", side)
    .select("id");
  if (error) throw new Error(`Failed to set the score: ${error.message}`);
  if ((data ?? []).length === 0) {
    throw new Error("Pick a club for this side before entering a score.");
  }
}

// ── squad ───────────────────────────────────────────────────────────────────

/**
 * Put a player on a side for the WHOLE match (squads are match-level). The
 * slot is the next free one on that side. Re-adding a player already in the
 * match moves them to `side` rather than failing — `unique (match_id,
 * player_id)` is the conflict target, since the slot constraint is DEFERRABLE
 * and so cannot be one.
 *
 * @returns the appearance id.
 */
export async function addAppearance(
  matchId: string,
  playerId: string,
  side: SideKey,
): Promise<string> {
  const admin = createAdminClient();
  const { data: last } = await admin
    .from("klc_match_appearances")
    .select("slot")
    .eq("match_id", matchId)
    .eq("side", side)
    .order("slot", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await admin
    .from("klc_match_appearances")
    .upsert(
      { match_id: matchId, player_id: playerId, side, slot: (last?.slot ?? 0) + 1 },
      { onConflict: "match_id,player_id" },
    )
    .select("id")
    .single();
  if (error) throw new Error(`Failed to add the player: ${error.message}`);
  return data.id;
}

/** Remove a player from the match; their stats cascade away with them. */
export async function removeAppearance(appearanceId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("klc_match_appearances")
    .delete()
    .eq("id", appearanceId);
  if (error) throw new Error(`Failed to remove the player: ${error.message}`);
}

/**
 * Set one stat tally for one appearance in one half.
 *
 * A count of 0 (or less) DELETES the row instead of storing a zero: the tally
 * is constrained `>= 0`, and absent-means-zero keeps the table free of rows
 * that say nothing.
 */
export async function setStat(
  appearanceId: string,
  halfNo: number,
  statKey: StatKey,
  count: number,
): Promise<void> {
  const admin = createAdminClient();
  if (count <= 0) {
    const { error } = await admin
      .from("klc_player_stats")
      .delete()
      .eq("appearance_id", appearanceId)
      .eq("half_no", halfNo)
      .eq("stat_key", statKey);
    if (error) throw new Error(`Failed to clear ${statKey}: ${error.message}`);
    return;
  }
  const { error } = await admin
    .from("klc_player_stats")
    .upsert(
      { appearance_id: appearanceId, half_no: halfNo, stat_key: statKey, stat_count: count },
      { onConflict: "appearance_id,half_no,stat_key" },
    );
  if (error) throw new Error(`Failed to record ${statKey}: ${error.message}`);
}

// ── lock ────────────────────────────────────────────────────────────────────

/**
 * Lock a match. `seasonId` must be null for a friendly and non-null for a
 * league match — both are database constraints, and the caller (actions.ts)
 * is what decides which season applies.
 */
export async function submitMatch(
  id: string,
  seasonId: string | null,
  submittedBy: string | null,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("klc_matches")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      submitted_by: submittedBy,
      season_id: seasonId,
    })
    .eq("id", id);
  if (error) throw new Error(`Failed to submit the match: ${error.message}`);
}

/**
 * Unlock a match for editing. `submitted_at` and `season_id` are cleared in
 * the SAME update as the status flip: `klc_matches_submitted_at_chk` and
 * `klc_matches_league_season_chk` are both checked per-statement, so any
 * ordering that separates them fails.
 */
export async function reopenMatch(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("klc_matches")
    .update({ status: "draft", submitted_at: null, season_id: null })
    .eq("id", id);
  if (error) throw new Error(`Failed to reopen the match: ${error.message}`);
}
