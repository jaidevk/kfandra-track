import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  GameDraft,
  GameTypeKey,
  MmgDraft,
  StatKey,
} from "./types";
import { emptyDraft } from "./types";

/**
 * Persistence for a single player's MMG entry (continuous log). The whole draft
 * is the unit of save: the parent mmg_entries row is upserted and the child
 * games/stats/others are replaced wholesale. That keeps autosave dead simple
 * and idempotent (no per-row diffing), which suits a small per-session payload.
 */

export interface SaveMaps {
  /** game type key → game_types.id */
  gameTypeIdByKey: Record<string, string>;
}
export interface LoadMaps {
  /** game_types.id → game type key */
  gameTypeKeyById: Record<string, GameTypeKey>;
}

/** Load a player's draft for a session. Returns an empty draft if none exists. */
export async function loadMmgEntry(
  playerId: string,
  sessionId: string,
  maps: LoadMaps,
): Promise<MmgDraft> {
  const admin = createAdminClient();

  const { data: entry } = await admin
    .from("mmg_entries")
    .select(
      "id, confirmation_order, arrival_order, unpacking, packing_weights, packing_kit, confirmed_by_11am, narration",
    )
    .eq("player_id", playerId)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!entry) return emptyDraft();

  const [gamesRes, othersRes] = await Promise.all([
    admin
      .from("submission_games")
      .select("id, game_type_id, won_count, drew_count, lost_count, sort_order")
      .eq("mmg_entry_id", entry.id)
      .order("sort_order", { ascending: true }),
    admin
      .from("submission_others")
      .select("id, description, points, sort_order")
      .eq("mmg_entry_id", entry.id)
      .order("sort_order", { ascending: true }),
  ]);

  const gameRows = gamesRes.data ?? [];
  const gameIds = gameRows.map((g) => g.id);

  // Fetch all stats for these games in one query, then group by game.
  const statsByGame: Record<string, Partial<Record<StatKey, number>>> = {};
  if (gameIds.length > 0) {
    const { data: statRows } = await admin
      .from("submission_game_stats")
      .select("submission_game_id, stat_key, stat_value")
      .in("submission_game_id", gameIds);
    for (const s of statRows ?? []) {
      (statsByGame[s.submission_game_id] ??= {})[s.stat_key as StatKey] = s.stat_value;
    }
  }

  const games: GameDraft[] = gameRows.map((g) => ({
    id: g.id,
    type: (g.game_type_id ? maps.gameTypeKeyById[g.game_type_id] : "other") ?? "other",
    results: {
      won: g.won_count ?? 0,
      drew: g.drew_count ?? 0,
      lost: g.lost_count ?? 0,
    },
    stats: statsByGame[g.id] ?? {},
  }));

  return {
    participation: {
      confirmationOrder: entry.confirmation_order,
      arrivalOrder: entry.arrival_order,
      unpacking: entry.unpacking,
      packingWeights: entry.packing_weights,
      packingKit: entry.packing_kit,
      confirmedBy11am: entry.confirmed_by_11am,
    },
    games,
    others: (othersRes.data ?? []).map((o) => ({
      id: o.id,
      description: o.description,
      points: String(o.points),
    })),
    narration: entry.narration ?? "",
  };
}

/**
 * Upsert a player's draft for a session. The parent row is upserted on
 * (player_id, session_id); child games/others are deleted and re-inserted.
 */
export async function saveMmgEntry(
  playerId: string,
  sessionId: string,
  draft: MmgDraft,
  maps: SaveMaps,
): Promise<void> {
  const admin = createAdminClient();
  const p = draft.participation;

  const { data: entry, error: upsertErr } = await admin
    .from("mmg_entries")
    .upsert(
      {
        player_id: playerId,
        session_id: sessionId,
        confirmation_order: p.confirmationOrder,
        arrival_order: p.arrivalOrder,
        unpacking: p.unpacking,
        packing_weights: p.packingWeights,
        packing_kit: p.packingKit,
        confirmed_by_11am: p.confirmedBy11am,
        narration: draft.narration || null,
      },
      { onConflict: "player_id,session_id" },
    )
    .select("id")
    .single();

  if (upsertErr || !entry) {
    throw new Error(`Failed to save MMG entry: ${upsertErr?.message ?? "unknown"}`);
  }

  // Replace children wholesale. Deleting games cascades to their stats.
  await Promise.all([
    admin.from("submission_games").delete().eq("mmg_entry_id", entry.id),
    admin.from("submission_others").delete().eq("mmg_entry_id", entry.id),
  ]);

  // Re-insert games, then their stats.
  for (let i = 0; i < draft.games.length; i++) {
    const g = draft.games[i];
    const { data: gameRow, error: gErr } = await admin
      .from("submission_games")
      .insert({
        mmg_entry_id: entry.id,
        game_type_id: maps.gameTypeIdByKey[g.type] ?? null,
        won_count: g.results.won,
        drew_count: g.results.drew,
        lost_count: g.results.lost,
        sort_order: i,
      })
      .select("id")
      .single();
    if (gErr || !gameRow) {
      throw new Error(`Failed to save game: ${gErr?.message ?? "unknown"}`);
    }

    const statRows = Object.entries(g.stats)
      .filter(([, v]) => typeof v === "number" && v !== 0)
      .map(([stat_key, stat_value]) => ({
        submission_game_id: gameRow.id,
        stat_key,
        stat_value: stat_value as number,
      }));
    if (statRows.length > 0) {
      const { error: sErr } = await admin.from("submission_game_stats").insert(statRows);
      if (sErr) throw new Error(`Failed to save game stats: ${sErr.message}`);
    }
  }

  const otherRows = draft.others
    .map((o, i) => ({
      mmg_entry_id: entry.id,
      description: o.description.trim(),
      points: Number(o.points) || 0,
      sort_order: i,
    }))
    .filter((o) => o.description.length > 0 || o.points !== 0);
  if (otherRows.length > 0) {
    const { error: oErr } = await admin.from("submission_others").insert(otherRows);
    if (oErr) throw new Error(`Failed to save other rows: ${oErr.message}`);
  }
}
