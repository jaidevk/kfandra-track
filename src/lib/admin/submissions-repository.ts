import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeSessionOrderPoints } from "@/lib/mmg/order";
import { loadScoringConfig } from "@/lib/mmg/config";
import { loadMmgEntry } from "@/lib/mmg/repository";
import { computeDraftPoints } from "@/lib/mmg/scoring";
import type { GameTypeKey } from "@/lib/mmg/types";
import {
  toSessionRows,
  type PlayerRef,
  type OrderPts,
  type SessionRow,
} from "./submissions-rows";

export type { PlayerRef, SessionRow, OrderPts } from "./submissions-rows";

/** Active players, excluding the coach (who does not earn MMG points). */
export async function listPlayers(): Promise<PlayerRef[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("players")
    .select("id, display_name")
    .eq("is_active", true)
    .neq("role", "coach")
    .order("display_name");
  return (data ?? []).map((p) => ({ id: p.id, displayName: p.display_name }));
}

export type SessionRef = { id: string; date: string; label: string | null };

export async function listSessions(): Promise<SessionRef[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("sessions")
    .select("id, session_date, label")
    .order("session_date", { ascending: false });
  return (data ?? []).map((s) => ({ id: s.id, date: s.session_date, label: s.label }));
}

/**
 * Every active player (coach excluded) for a session with their order points,
 * self-scored games points, grand total, and submitted flag.
 */
export async function getSessionSubmissions(sessionId: string): Promise<SessionRow[]> {
  const admin = createAdminClient();
  const [players, order, entries, loaded] = await Promise.all([
    listPlayers(),
    computeSessionOrderPoints(sessionId),
    admin.from("mmg_entries").select("player_id").eq("session_id", sessionId),
    loadScoringConfig(),
  ]);

  const submittedIds = (entries.data ?? []).map((e) => e.player_id);
  const orderPts: OrderPts[] = order.map((o) => ({
    playerId: o.playerId,
    arrivalPoints: o.arrivalPoints,
    confirmationPoints: o.confirmationPoints,
  }));

  // Self-scored points (games + stats + packing + other) per roster submitter.
  const gameTypeKeyById: Record<string, GameTypeKey> = {};
  for (const g of loaded.gameTypes) gameTypeKeyById[g.id] = g.key;
  const rosterIds = new Set(players.map((p) => p.id));
  const selfPointsById: Record<string, number> = {};
  await Promise.all(
    submittedIds
      .filter((id) => rosterIds.has(id))
      .map(async (id) => {
        const draft = await loadMmgEntry(id, sessionId, { gameTypeKeyById });
        selfPointsById[id] = computeDraftPoints(loaded.config, draft).total;
      }),
  );

  const rows = toSessionRows(players, orderPts, submittedIds, selfPointsById);
  // Submitted first, then by total descending.
  return rows.sort(
    (a, b) => Number(b.submitted) - Number(a.submitted) || b.total - a.total,
  );
}

export type PlayerSessionEntry = {
  sessionId: string;
  date: string;
  confirmationOrder: number | null;
  arrivalOrder: number | null;
  gameCount: number;
  narration: string | null;
};

export type PlayerSubmissions = {
  mmg: PlayerSessionEntry[];
  gymDays: number;
  dietDays: number;
};

/** One player's submitted data across all sessions + gym/diet day counts. */
export async function getPlayerSubmissions(playerId: string): Promise<PlayerSubmissions> {
  const admin = createAdminClient();
  const [entriesRes, gymRes, dietRes] = await Promise.all([
    admin
      .from("mmg_entries")
      .select(
        "id, session_id, confirmation_order, arrival_order, narration, sessions(session_date), submission_games(count)",
      )
      .eq("player_id", playerId),
    admin.from("gym_logs").select("id", { count: "exact", head: true }).eq("player_id", playerId),
    admin.from("diet_logs").select("id", { count: "exact", head: true }).eq("player_id", playerId),
  ]);

  const mmg: PlayerSessionEntry[] = (entriesRes.data ?? [])
    .map((e) => {
      const session = e.sessions as { session_date: string } | null;
      const games = e.submission_games as { count: number }[] | null;
      return {
        sessionId: e.session_id,
        date: session?.session_date ?? "",
        confirmationOrder: e.confirmation_order,
        arrivalOrder: e.arrival_order,
        gameCount: games?.[0]?.count ?? 0,
        narration: e.narration,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  return { mmg, gymDays: gymRes.count ?? 0, dietDays: dietRes.count ?? 0 };
}
