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
 * How many matches are still unfinished (`draft` or `sent`) with an
 * `entry_date` inside this season's window — `start_date` .. `end_date`, or today while the season is
 * still open-ended.
 *
 * Deliberately DATE-based rather than `season_id`-based. `klc_matches.season_id`
 * is only written at Submit and is cleared again by Reopen, so a draft match
 * never carries a season and a `season_id` count of drafts would always be 0.
 * "Is there unfinished work in this season?" is therefore asked of
 * the calendar, which is the only thing a draft actually commits to.
 *
 * Returns 0 for an unknown season id — nothing to block on.
 */
export async function countUnfinishedMatchesDatedInSeason(id: string): Promise<number> {
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
    .in("status", ["draft", "sent"])
    .gte("entry_date", season.start_date)
    .lte("entry_date", end);
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

/** Clubs whose `manager_player_id` is this player. Throws on a DB error. */
export async function listManagedClubIds(playerId: string): Promise<Set<string>> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("clubs")
    .select("id")
    .eq("manager_player_id", playerId);
  // This feeds an authorisation check: a DB error must not read as "manages nothing".
  if (error) throw new Error(`Failed to load your clubs: ${error.message}`);
  return new Set((data ?? []).map((c) => c.id));
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

/** Matches newest first (optionally one date only), with their aggregate score line. */
export async function listMatches(opts: { entryDate?: string } = {}): Promise<MatchSummary[]> {
  const admin = createAdminClient();
  let query = admin
    .from("klc_matches")
    .select(
      `id, entry_date, sport, is_friendly, is_combined, status,
       created_by, home_sent_at, away_sent_at,
       klc_seasons(name),
       klc_match_halves(id, half_no,
         klc_match_sides(id, side, score, club_id, clubs(name)))`,
    );
  if (opts.entryDate) query = query.eq("entry_date", opts.entryDate);
  const { data } = await query
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  return (data ?? []).map((m) => {
    const halves = toHalfDrafts(m.klc_match_halves as HalfRow[] | null);
    const sideClubs = halves.flatMap((h) =>
      h.sides
        .filter((s): s is SideDraft & { clubId: string } => s.clubId !== null)
        .map((s) => ({ side: s.side, clubId: s.clubId })),
    );
    return {
      id: m.id,
      entryDate: m.entry_date,
      sport: m.sport as Sport,
      isFriendly: m.is_friendly,
      isCombined: m.is_combined,
      status: m.status as MatchStatus,
      seasonName: one(m.klc_seasons as ToOne<{ name: string }>)?.name ?? null,
      createdBy: m.created_by,
      clubIds: [...new Set(sideClubs.map((s) => s.clubId))],
      homeSentAt: m.home_sent_at,
      awaySentAt: m.away_sent_at,
      sideClubs,
      homeLabel: sideLabel(halves, "home"),
      awayLabel: sideLabel(halves, "away"),
      scoreLine: scoreLine(halves),
    };
  });
}

interface StatRow { half_no: number; stat_key: string; stat_count: number; minutes: (number | null)[] | null }
interface AppearanceRow {
  id: string; player_id: string; side: string; slot: number;
  players: ToOne<{ display_name: string }>;
  klc_player_stats: StatRow[] | null;
}

function toAppearanceDraft(a: AppearanceRow): AppearanceDraft {
  const stats: Record<number, Partial<Record<StatKey, number>>> = {};
  const times: Record<number, Partial<Record<StatKey, (number | null)[]>>> = {};
  for (const s of a.klc_player_stats ?? []) {
    (stats[s.half_no] ??= {})[s.stat_key as StatKey] = s.stat_count;
    if (s.minutes && s.minutes.length > 0) {
      (times[s.half_no] ??= {})[s.stat_key as StatKey] = s.minutes;
    }
  }
  return {
    id: a.id,
    playerId: a.player_id,
    displayName: one(a.players)?.display_name ?? "Unknown",
    side: a.side as SideKey,
    slot: a.slot,
    stats,
    ...(Object.keys(times).length > 0 ? { times } : {}),
  };
}

export const MATCH_DRAFT_COLS = `id, entry_date, sport, is_friendly, is_combined, duration_minutes,
   status, submitted_at, season_id, created_by, home_sent_at, away_sent_at,
   klc_seasons(name),
   klc_match_halves(id, half_no,
     klc_match_sides(id, side, score, club_id, clubs(name))),
   klc_match_appearances(id, player_id, side, slot,
     players(display_name),
     klc_player_stats(half_no, stat_key, stat_count, minutes))`;

export interface MatchDraftRow {
  id: string; entry_date: string; sport: string;
  is_friendly: boolean; is_combined: boolean; duration_minutes: number | null;
  status: string; submitted_at: string | null; season_id: string | null;
  created_by: string | null;
  home_sent_at: string | null; away_sent_at: string | null;
  klc_seasons: unknown; klc_match_halves: unknown; klc_match_appearances: unknown;
}

/** Map a `MATCH_DRAFT_COLS` row to a `MatchDraft` (shared with league-repository). */
export function toMatchDraft(data: MatchDraftRow): MatchDraft {
  const appearances = ((data.klc_match_appearances as AppearanceRow[] | null) ?? [])
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
    homeSentAt: data.home_sent_at,
    awaySentAt: data.away_sent_at,
    seasonId: data.season_id,
    seasonName: one(data.klc_seasons as ToOne<{ name: string }>)?.name ?? null,
    createdBy: data.created_by,
    halves: toHalfDrafts(data.klc_match_halves as HalfRow[] | null),
    appearances,
  };
}

/** One match with its halves, sides and squad (stats keyed by half), or null. */
export async function getMatch(matchId: string): Promise<MatchDraft | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("klc_matches")
    .select(MATCH_DRAFT_COLS)
    .eq("id", matchId)
    .maybeSingle();
  return data ? toMatchDraft(data as MatchDraftRow) : null;
}

export interface CreateMatchInput {
  entryDate: string;
  sport: Sport;
  isCombined: boolean;
  isFriendly: boolean;
  createdBy: string | null;
  /** Created as half 1's home side when given (a manager's own club). */
  homeClubId: string | null;
  /** Created as half 1's away side when given (the opponent). */
  awayClubId: string | null;
}

/**
 * Create a draft match and its half rows (1, or 1 and 2 when combined), plus
 * half 1's home and away sides when `homeClubId` / `awayClubId` are given.
 *
 * Other side rows are NOT created here: `klc_match_sides.club_id` is NOT NULL,
 * so an empty side is unrepresentable. `setSideClub` creates them.
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
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Failed to create match: ${error.message}`);

  const halfNos = input.isCombined ? [1, 2] : [1];
  const { data: halves, error: halvesErr } = await admin
    .from("klc_match_halves")
    .insert(halfNos.map((half_no) => ({ match_id: data.id, half_no })))
    .select("id, half_no");
  if (halvesErr) {
    // Leave no half-built match behind.
    await admin.from("klc_matches").delete().eq("id", data.id);
    throw new Error(`Failed to create match halves: ${halvesErr.message}`);
  }

  const first = halves?.find((h) => h.half_no === 1);
  const sides = [
    input.homeClubId ? { side: "home", club_id: input.homeClubId } : null,
    input.awayClubId ? { side: "away", club_id: input.awayClubId } : null,
  ].filter((s): s is { side: string; club_id: string } => s !== null);
  if (sides.length > 0) {
    const { error: sideErr } = first
      ? await admin.from("klc_match_sides").insert(
          sides.map((s) => ({ half_id: first.id, side: s.side, club_id: s.club_id, role: s.side })),
        )
      : { error: { message: "half 1 was not returned" } };
    if (sideErr) {
      await admin.from("klc_matches").delete().eq("id", data.id);
      throw new Error(`Failed to set the clubs: ${sideErr.message}`);
    }
  }
  return data.id;
}

export interface MatchMetaPatch {
  entryDate?: string;
  sport?: Sport;
  durationMinutes?: number | null;
  isFriendly?: boolean;
}

/**
 * Patch the match header. `is_combined` is fixed at creation (halves exist);
 * `is_friendly` may change while the match is a draft (a draft has no season
 * tag, so `klc_matches_friendly_season_chk` holds).
 */
export async function updateMatchMeta(id: string, patch: MatchMetaPatch): Promise<void> {
  const fields: {
    entry_date?: string; sport?: string; duration_minutes?: number | null;
    is_friendly?: boolean;
  } = {};
  if (patch.entryDate !== undefined) fields.entry_date = patch.entryDate;
  if (patch.sport !== undefined) fields.sport = patch.sport;
  if (patch.durationMinutes !== undefined) fields.duration_minutes = patch.durationMinutes;
  if (patch.isFriendly !== undefined) fields.is_friendly = patch.isFriendly;
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
 * A count of 0 (or less) DELETES the row instead of storing a zero. `minutes`
 * is written with the count, already trimmed by the caller to at most
 * `count` entries (`klc_player_stats_minutes_len_chk`).
 */
export async function setStat(
  appearanceId: string,
  halfNo: number,
  statKey: StatKey,
  count: number,
  minutes: (number | null)[] = [],
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
      {
        appearance_id: appearanceId, half_no: halfNo, stat_key: statKey, stat_count: count,
        // int[] holds nulls; the generated type just doesn't say so.
        minutes: minutes as number[],
      },
      { onConflict: "appearance_id,half_no,stat_key" },
    );
  if (error) throw new Error(`Failed to record ${statKey}: ${error.message}`);
}

/**
 * Set the goal/try minutes on an existing tally. The only write the submit
 * lock lets through on an official match (minutes-only UPDATE).
 */
export async function setGoalTimes(
  appearanceId: string,
  halfNo: number,
  statKey: StatKey,
  minutes: (number | null)[],
): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("klc_player_stats")
    .update({ minutes: minutes as number[] })
    .eq("appearance_id", appearanceId)
    .eq("half_no", halfNo)
    .eq("stat_key", statKey)
    .select("id");
  if (error) throw new Error(`Failed to save the times: ${error.message}`);
  if ((data ?? []).length === 0) throw new Error("Record the goal before its time.");
}

// ── workflow ────────────────────────────────────────────────────────────────

/** Stamp one team as sent. Only a draft with that team unsent changes. */
export async function sendTeam(id: string, side: SideKey): Promise<void> {
  const admin = createAdminClient();
  const col = side === "home" ? "home_sent_at" : "away_sent_at";
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("klc_matches")
    .update(side === "home" ? { home_sent_at: now } : { away_sent_at: now })
    .eq("id", id)
    .eq("status", "draft")
    .is(col, null)
    .select("id");
  if (error) throw new Error(`Failed to send your team: ${error.message}`);
  if (!data || data.length === 0) throw new Error("This team has already been sent.");
}

/**
 * Move a draft on once BOTH teams are sent: a league match to `sent`, a
 * friendly straight to `submitted`. Safe to call twice (two managers sending
 * at once): the guard makes the second call a no-op. Returns the status after.
 */
export async function finishSending(id: string, by: string | null): Promise<MatchStatus> {
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("klc_matches")
    .select("status, is_friendly, home_sent_at, away_sent_at")
    .eq("id", id)
    .single();
  if (error) throw new Error(`Failed to read the match: ${error.message}`);
  if (row.status !== "draft" || !row.home_sent_at || !row.away_sent_at) {
    return row.status as MatchStatus;
  }
  const next = row.is_friendly
    ? { status: "submitted", submitted_at: new Date().toISOString(), submitted_by: by }
    : { status: "sent" };
  const { error: upErr } = await admin
    .from("klc_matches")
    .update(next)
    .eq("id", id)
    .eq("status", "draft")
    .not("home_sent_at", "is", null)
    .not("away_sent_at", "is", null);
  if (upErr) throw new Error(`Failed to send the match: ${upErr.message}`);
  return next.status as MatchStatus;
}

/**
 * Make a match official (lock it). `seasonId` is null for a friendly and the
 * active season for a league match (both DB constraints). Only a draft or a
 * sent match flips, so a lost race updates 0 rows.
 */
export async function makeOfficial(
  id: string,
  seasonId: string | null,
  by: string | null,
): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("klc_matches")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      submitted_by: by,
      season_id: seasonId,
    })
    .eq("id", id)
    .in("status", ["draft", "sent"])
    .select("id");
  if (error) throw new Error(`Failed to make the match official: ${error.message}`);
  if (!data || data.length === 0) throw new Error("This match is locked. Reopen it first.");
}

/** KFANDRA's Send back: both teams editable again. */
export async function sendBack(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("klc_matches")
    .update({ status: "draft", home_sent_at: null, away_sent_at: null })
    .eq("id", id)
    .in("status", ["draft", "sent"]);
  if (error) throw new Error(`Failed to send the match back: ${error.message}`);
}

/**
 * Unlock an official match. A league match goes back to `sent` (KFANDRA edits
 * and re-officials without the managers); a friendly goes back to `draft`
 * with its stamps cleared. `submitted_at` and `season_id` are cleared in the
 * SAME update as the status flip: `klc_matches_submitted_at_chk` and
 * `klc_matches_league_season_chk` are checked per statement.
 */
export async function reopenMatch(id: string, to: "sent" | "draft"): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("klc_matches")
    .update({
      status: to,
      submitted_at: null,
      season_id: null,
      ...(to === "draft" ? { home_sent_at: null, away_sent_at: null } : {}),
    })
    .eq("id", id)
    .eq("status", "submitted");
  if (error) throw new Error(`Failed to reopen the match: ${error.message}`);
}
