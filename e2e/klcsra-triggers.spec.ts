import { test, expect } from "@playwright/test";
import * as db from "./helpers/db";
import { seedPlayer } from "./helpers/auth";

/**
 * The submit lock and touch-parent triggers (migration 20261020120000).
 * SQL only; no browser. Local Supabase only.
 */

async function makeMatch(status: "draft" | "submitted") {
  const [c1, c2] = await db.listClubs(2);
  const player = await seedPlayer("user", "E2E Trigger Player");
  const [m] = await db.sql<{ id: string }>(
    `insert into klc_matches (entry_date, sport, is_friendly, status)
     values ('2026-08-23', 'football', true, 'draft') returning id`,
  );
  const [h] = await db.sql<{ id: string }>(
    `insert into klc_match_halves (match_id, half_no) values ($1, 1) returning id`, [m.id],
  );
  await db.sql(
    `insert into klc_match_sides (half_id, side, club_id, role) values ($1,'home',$2,'home'), ($1,'away',$3,'away')`,
    [h.id, c1.id, c2.id],
  );
  const [a] = await db.sql<{ id: string }>(
    `insert into klc_match_appearances (match_id, player_id, side, slot) values ($1,$2,'home',1) returning id`,
    [m.id, player.id],
  );
  await db.sql(
    `insert into klc_player_stats (appearance_id, half_no, stat_key, stat_count) values ($1,1,'goal',1)`,
    [a.id],
  );
  if (status === "submitted") {
    await db.sql(
      `update klc_matches set status='submitted', submitted_at=now() where id=$1`, [m.id],
    );
  }
  return { matchId: m.id, halfId: h.id, appearanceId: a.id };
}

test.beforeEach(async () => { await db.resetKlcsraData(); });
test.afterEach(async () => { await db.resetKlcsraData(); });

/**
 * Read klc_matches.updated_at, pause, run `write`, and say whether updated_at
 * moved. Compared as timestamptz in SQL so no precision is lost in JS.
 *
 * Note: backdating updated_at by hand does not work as a baseline —
 * klc_matches_set_updated_at (BEFORE UPDATE) forces it to now().
 */
async function bumpsUpdatedAt(matchId: string, write: () => Promise<unknown>): Promise<boolean> {
  const [before] = await db.sql<{ updated_at: string }>(
    `select updated_at::text from klc_matches where id = $1`, [matchId],
  );
  await db.sql(`select pg_sleep(0.05)`);
  await write();
  const [row] = await db.sql<{ bumped: boolean }>(
    `select $1::timestamptz < updated_at as bumped from klc_matches where id = $2`,
    [before.updated_at, matchId],
  );
  return row.bumped;
}

test("child writes on a submitted match are rejected", async () => {
  const { matchId, halfId, appearanceId } = await makeMatch("submitted");
  // UPDATE, one hop (sides -> halves) and two hops (stats -> appearances).
  await expect(
    db.sql(`update klc_match_sides set score = 9 where half_id = $1`, [halfId]),
  ).rejects.toThrow(/match is submitted/);
  await expect(
    db.sql(`update klc_player_stats set stat_count = 5 where appearance_id = $1`, [appearanceId]),
  ).rejects.toThrow(/match is submitted/);
  // DELETE.
  await expect(
    db.sql(`delete from klc_match_appearances where id = $1`, [appearanceId]),
  ).rejects.toThrow(/match is submitted/);
  // INSERT, via the two-hop lookup.
  await expect(
    db.sql(
      `insert into klc_player_stats (appearance_id, half_no, stat_key, stat_count) values ($1,1,'assist',1)`,
      [appearanceId],
    ),
  ).rejects.toThrow(/match is submitted/);
  // INSERT on klc_match_halves (direct match_id).
  await expect(
    db.sql(`insert into klc_match_halves (match_id, half_no) values ($1, 2)`, [matchId]),
  ).rejects.toThrow(/match is submitted/);
});

test("child writes on a draft are allowed and bump updated_at", async () => {
  const { matchId, halfId, appearanceId } = await makeMatch("draft");
  // One hop: sides -> halves -> match.
  expect(
    await bumpsUpdatedAt(matchId, () =>
      db.sql(`update klc_match_sides set score = 2 where half_id = $1 and side = 'home'`, [halfId]),
    ),
  ).toBe(true);
  // Two hops: stats -> appearances -> match.
  expect(
    await bumpsUpdatedAt(matchId, () =>
      db.sql(`update klc_player_stats set stat_count = 3 where appearance_id = $1`, [appearanceId]),
    ),
  ).toBe(true);
});

test("deleting a submitted match still cascades", async () => {
  const { matchId } = await makeMatch("submitted");
  await db.sql(`delete from klc_matches where id = $1`, [matchId]);
  const left = await db.sql(`select 1 from klc_match_halves where match_id = $1`, [matchId]);
  expect(left).toHaveLength(0);
});

test("reopen then edit works", async () => {
  const { matchId, halfId } = await makeMatch("submitted");
  await db.sql(
    `update klc_matches set status='draft', submitted_at=null, season_id=null where id=$1`, [matchId],
  );
  await db.sql(`update klc_match_sides set score = 4 where half_id = $1 and side='home'`, [halfId]);
  const [row] = await db.sql<{ score: number }>(
    `select score from klc_match_sides where half_id = $1 and side = 'home'`, [halfId],
  );
  expect(row.score).toBe(4);
});
