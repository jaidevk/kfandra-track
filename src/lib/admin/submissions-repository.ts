import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeSessionOrderPoints } from "@/lib/mmg/order";
import {
  toSessionRows,
  type PlayerRef,
  type OrderPts,
  type SessionRow,
} from "./submissions-rows";

export type { PlayerRef, SessionRow, OrderPts } from "./submissions-rows";

export async function listPlayers(): Promise<PlayerRef[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("players")
    .select("id, display_name")
    .eq("is_active", true)
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

/** All active players for a session with their order points + submitted flag. */
export async function getSessionSubmissions(sessionId: string): Promise<SessionRow[]> {
  const admin = createAdminClient();
  const [players, order, entries] = await Promise.all([
    listPlayers(),
    computeSessionOrderPoints(sessionId),
    admin.from("mmg_entries").select("player_id").eq("session_id", sessionId),
  ]);
  const submittedIds = (entries.data ?? []).map((e) => e.player_id);
  const orderPts: OrderPts[] = order.map((o) => ({
    playerId: o.playerId,
    arrivalPoints: o.arrivalPoints,
    confirmationPoints: o.confirmationPoints,
  }));
  const rows = toSessionRows(players, orderPts, submittedIds);
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
