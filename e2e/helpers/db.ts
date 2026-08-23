import { Client, type QueryResultRow } from "pg";
import { loadLocalEnv } from "./env";
import { parseStatRates, type StatRates } from "../../src/lib/klcsra/stat-rates";

/**
 * Direct Postgres access for the E2E suite: seed what a spec needs, then put
 * the database back exactly as it was found.
 *
 * Deliberately NOT the app's Supabase client. These helpers exist to set up
 * and verify state INDEPENDENTLY of the code under test — asserting a payout
 * with the same repository that wrote it would prove nothing.
 *
 * Every spec is responsible for its own cleanup: `snapshotSeasons()` before,
 * `resetKlcsraData()` + `restoreSeasons()` after. The local database ships
 * with `players` and every `klc_match*` table empty, and it must stay that way.
 */

loadLocalEnv();

/** Local Supabase Postgres. Override with E2E_DATABASE_URL if yours differs. */
export const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:54322/postgres";

/**
 * Phone prefix stamped on every player this suite seeds. Cleanup deletes by
 * this prefix, so a spec can never take a real member's row with it.
 * `+9100…` is not a dialable Indian number, which is the point.
 */
export const E2E_PHONE_PREFIX = "+9100";

/** Run one statement. Opens and closes its own connection — no pool to leak. */
export async function sql<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const result = await client.query<T>(text, params);
    return result.rows;
  } finally {
    await client.end();
  }
}

// ── seasons ─────────────────────────────────────────────────────────────────

export type SeasonStatus = "upcoming" | "active" | "closed";

export interface SeasonRow {
  id: string;
  season_no: number;
  name: string;
  start_date: string;
  end_date: string | null;
  status: SeasonStatus;
}

// Dates as text, so a spec compares "2026-08-22" rather than a Date shifted by
// whatever timezone the test process happens to run in.
const SEASON_COLS = `id, season_no, name,
  to_char(start_date, 'YYYY-MM-DD') as start_date,
  to_char(end_date, 'YYYY-MM-DD') as end_date,
  status`;

export async function listSeasons(): Promise<SeasonRow[]> {
  return sql<SeasonRow>(`select ${SEASON_COLS} from klc_seasons order by season_no`);
}

/** The season with this exact name. Throws when it is missing — a spec that
 *  names a season it did not create wants to know immediately. */
export async function findSeason(name: string): Promise<SeasonRow> {
  const rows = await sql<SeasonRow>(
    `select ${SEASON_COLS} from klc_seasons where name = $1`,
    [name],
  );
  const season = rows[0];
  if (!season) throw new Error(`No season named "${name}" in the local database.`);
  return season;
}

export async function activeSeason(): Promise<SeasonRow | null> {
  const rows = await sql<SeasonRow>(
    `select ${SEASON_COLS} from klc_seasons where status = 'active'`,
  );
  return rows[0] ?? null;
}

/** Make one season the active one, closing whichever season holds that slot. */
export async function activateSeason(name: string): Promise<SeasonRow> {
  const season = await findSeason(name);
  // The partial unique index allows exactly one active row, and it is checked
  // per statement — so vacate the slot before claiming it.
  await sql("update klc_seasons set status = 'closed' where status = 'active' and id <> $1", [
    season.id,
  ]);
  await sql("update klc_seasons set status = 'active' where id = $1", [season.id]);
  return { ...season, status: "active" };
}

/** Leave no season active — the state in which league Submit must refuse. */
export async function deactivateAllSeasons(): Promise<void> {
  await sql("update klc_seasons set status = 'closed' where status = 'active'");
}

/** Every season row, to hand back to `restoreSeasons` in an afterEach. */
export async function snapshotSeasons(): Promise<SeasonRow[]> {
  return listSeasons();
}

/**
 * Put `klc_seasons` back exactly as the snapshot found it: drop any season a
 * spec created, then restore names, dates and statuses.
 *
 * Statuses are restored in two passes for the same reason `activateSeason`
 * vacates first — the one-active-season index is not deferrable, so the row
 * losing `active` must be updated before the row gaining it.
 */
export async function restoreSeasons(snapshot: SeasonRow[]): Promise<void> {
  const ids = snapshot.map((s) => s.id);
  await sql("delete from klc_seasons where not (id = any($1::uuid[]))", [ids]);

  const write = (s: SeasonRow) =>
    sql(
      `update klc_seasons
          set name = $2, start_date = $3::date, end_date = $4::date, status = $5
        where id = $1`,
      [s.id, s.name, s.start_date, s.end_date, s.status],
    );

  for (const s of snapshot.filter((s) => s.status !== "active")) await write(s);
  for (const s of snapshot.filter((s) => s.status === "active")) await write(s);
}

// ── players ─────────────────────────────────────────────────────────────────

export type Role = "super_admin" | "kfandra" | "admin" | "user";

export interface PlayerSeed {
  displayName: string;
  role: Role;
  phone: string;
  pinHash: string;
}

export async function insertPlayer(seed: PlayerSeed): Promise<string> {
  const rows = await sql<{ id: string }>(
    `insert into players (phone, pin_hash, display_name, role)
     values ($1, $2, $3, $4::app.player_role)
     returning id`,
    [seed.phone, seed.pinHash, seed.displayName, seed.role],
  );
  return rows[0].id;
}

// ── clubs ───────────────────────────────────────────────────────────────────

export interface ClubRow {
  id: string;
  name: string;
}

/** Active clubs in landing-grid order — the same order the club `<select>` shows. */
export async function listClubs(limit = 4): Promise<ClubRow[]> {
  return sql<ClubRow>(
    "select id, name from clubs where is_active order by sort_order limit $1",
    [limit],
  );
}

// ── matches ─────────────────────────────────────────────────────────────────

export interface MatchRow {
  id: string;
  entry_date: string;
  status: "draft" | "submitted";
  is_friendly: boolean;
  is_combined: boolean;
  season_id: string | null;
  submitted_at: string | null;
}

export async function getMatchRow(id: string): Promise<MatchRow | null> {
  const rows = await sql<MatchRow>(
    `select id, to_char(entry_date, 'YYYY-MM-DD') as entry_date, status,
            is_friendly, is_combined, season_id, submitted_at
       from klc_matches where id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export interface StatRow {
  player_id: string;
  half_no: number;
  stat_key: string;
  stat_count: number;
}

/** Every stored tally for a match, so a spec can prove what actually landed. */
export async function listStatRows(matchId: string): Promise<StatRow[]> {
  return sql<StatRow>(
    `select a.player_id, s.half_no, s.stat_key, s.stat_count
       from klc_player_stats s
       join klc_match_appearances a on a.id = s.appearance_id
      where a.match_id = $1
      order by s.half_no, s.stat_key`,
    [matchId],
  );
}

// ── the rate card ───────────────────────────────────────────────────────────

/** The rates the app will actually use, straight out of `app_config`. */
export async function loadStoredStatRates(): Promise<StatRates> {
  const rows = await sql<{ value: unknown }>(
    "select value from app_config where key = 'klcsra_stat_rates'",
  );
  return parseStatRates(rows[0]?.value ?? null);
}

// ── teardown ────────────────────────────────────────────────────────────────

/** Delete every KLCSRA match. Halves, sides, squads and stats cascade with it. */
export async function deleteAllMatches(): Promise<void> {
  await sql("delete from klc_matches");
}

/** Delete the players this suite seeded (identified by their phone prefix). */
export async function deleteSeededPlayers(): Promise<void> {
  await sql("delete from players where phone like $1", [`${E2E_PHONE_PREFIX}%`]);
}

/**
 * The whole-suite reset: matches first, then players.
 *
 * The order is forced — `klc_match_appearances.player_id` is ON DELETE
 * RESTRICT, so a seeded player who appeared in a match cannot be removed until
 * that match is gone.
 */
export async function resetKlcsraData(): Promise<void> {
  await deleteAllMatches();
  await deleteSeededPlayers();
}
