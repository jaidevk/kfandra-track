import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeSessionOrderPoints } from "@/lib/mmg/order";
import { loadScoringConfig } from "@/lib/mmg/config";
import { loadMmgEntry } from "@/lib/mmg/repository";
import type { GameTypeKey } from "@/lib/mmg/types";
import {
  toSessionRows,
  buildSelfScored,
  type PlayerRef,
  type OrderPts,
  type RepScore,
  type SelfScored,
  type SessionRow,
  type SessionRowDetail,
} from "./submissions-rows";

/**
 * Gym-exercise rep points allocated to a session. Every rep is assigned to the
 * closest *previous* session: a session claims all gym reps logged from its own
 * date up to (but not including) the next session's date. Reps in S&C tests are
 * excluded — only entry_type='exercise' sets count. Returns {} when the rate is
 * 0 (feature disabled). Pass playerId to scope to one player.
 */
async function sessionRepScores(
  sessionId: string,
  pointsPerRep: number,
  playerId?: string,
): Promise<Record<string, RepScore>> {
  if (pointsPerRep <= 0) return {};
  const admin = createAdminClient();
  const { data: sess } = await admin
    .from("sessions")
    .select("session_date")
    .eq("id", sessionId)
    .maybeSingle();
  if (!sess) return {};
  const start = sess.session_date;
  const { data: nextRows } = await admin
    .from("sessions")
    .select("session_date")
    .gt("session_date", start)
    .order("session_date", { ascending: true })
    .limit(1);
  const end = nextRows?.[0]?.session_date ?? "9999-12-31";

  let q = admin
    .from("gym_logs")
    .select("player_id, gym_log_exercises(sets, entry_type)")
    .gte("log_date", start)
    .lt("log_date", end);
  if (playerId) q = q.eq("player_id", playerId);
  const { data: logs } = await q;

  const out: Record<string, RepScore> = {};
  for (const l of logs ?? []) {
    const exs = (l.gym_log_exercises ?? []) as Array<{
      sets: unknown;
      entry_type: string;
    }>;
    let reps = 0;
    for (const e of exs) {
      if (e.entry_type !== "exercise") continue;
      const sets = Array.isArray(e.sets) ? (e.sets as Array<{ reps?: number }>) : [];
      for (const s of sets) reps += typeof s.reps === "number" ? s.reps : 0;
    }
    const prev = out[l.player_id]?.reps ?? 0;
    const total = prev + reps;
    out[l.player_id] = { reps: total, points: total * pointsPerRep };
  }
  return out;
}

export type { PlayerRef, SessionRow, OrderPts, SessionRowDetail } from "./submissions-rows";

/** Active players, excluding KFANDRA (the 'kfandra' role earns no MMG points). */
export async function listPlayers(): Promise<PlayerRef[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("players")
    .select("id, display_name")
    .eq("is_active", true)
    .neq("role", "kfandra")
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
 * Every active player (KFANDRA excluded) for a session with their order points,
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

  // Self-scored breakdown (games / packing / other + drill-down) per submitter.
  const gameTypeKeyById: Record<string, GameTypeKey> = {};
  const gameNameByKey: Record<string, string> = {};
  for (const g of loaded.gameTypes) {
    gameTypeKeyById[g.id] = g.key;
    gameNameByKey[g.key] = g.name;
  }
  const gameName = (key: GameTypeKey) => gameNameByKey[key] ?? key;

  const rosterIds = new Set(players.map((p) => p.id));
  const selfById: Record<string, SelfScored> = {};
  await Promise.all(
    submittedIds
      .filter((id) => rosterIds.has(id))
      .map(async (id) => {
        const draft = await loadMmgEntry(id, sessionId, { gameTypeKeyById });
        selfById[id] = buildSelfScored(loaded.config, draft, gameName);
      }),
  );

  const repById = await sessionRepScores(sessionId, loaded.config.pointsPerRep);

  const rows = toSessionRows(players, orderPts, submittedIds, selfById, repById);
  // Submitted first, then by total descending.
  return rows.sort(
    (a, b) => Number(b.submitted) - Number(a.submitted) || b.total - a.total,
  );
}

export type PlayerSessionEntry = {
  sessionId: string;
  date: string;
  confirmationPoints: number;
  arrivalPoints: number;
  gamesPoints: number;
  packingPoints: number;
  otherPoints: number;
  repPoints: number;
  repReps: number;
  total: number;
  detail: SessionRowDetail | null;
  narration: string | null;
};

export type PlayerSubmissions = {
  mmg: PlayerSessionEntry[];
  gymDays: number;
  dietDays: number;
};

/**
 * One player's submitted data across all sessions with the same category
 * breakdown as the by-date view (confirm/arrival/games/packing/other + total)
 * and per-session drill-down, plus gym/diet day counts.
 */
export async function getPlayerSubmissions(playerId: string): Promise<PlayerSubmissions> {
  const admin = createAdminClient();
  const [entriesRes, gymRes, dietRes, loaded] = await Promise.all([
    admin
      .from("mmg_entries")
      .select("id, session_id, narration, sessions(session_date)")
      .eq("player_id", playerId),
    admin.from("gym_logs").select("id", { count: "exact", head: true }).eq("player_id", playerId),
    admin.from("diet_logs").select("id", { count: "exact", head: true }).eq("player_id", playerId),
    loadScoringConfig(),
  ]);

  const gameTypeKeyById: Record<string, GameTypeKey> = {};
  const gameNameByKey: Record<string, string> = {};
  for (const g of loaded.gameTypes) {
    gameTypeKeyById[g.id] = g.key;
    gameNameByKey[g.key] = g.name;
  }
  const gameName = (key: GameTypeKey) => gameNameByKey[key] ?? key;

  const mmg: PlayerSessionEntry[] = await Promise.all(
    (entriesRes.data ?? []).map(async (e) => {
      const session = e.sessions as { session_date: string } | null;
      const [draft, order, rep] = await Promise.all([
        loadMmgEntry(playerId, e.session_id, { gameTypeKeyById }),
        computeSessionOrderPoints(e.session_id),
        sessionRepScores(e.session_id, loaded.config.pointsPerRep, playerId),
      ]);
      const self = buildSelfScored(loaded.config, draft, gameName);
      const mine = order.find((o) => o.playerId === playerId);
      const confirmationPoints = mine?.confirmationPoints ?? 0;
      const arrivalPoints = mine?.arrivalPoints ?? 0;
      const myRep = rep[playerId] ?? { reps: 0, points: 0 };
      return {
        sessionId: e.session_id,
        date: session?.session_date ?? "",
        confirmationPoints,
        arrivalPoints,
        gamesPoints: self.games,
        packingPoints: self.packing,
        otherPoints: self.other,
        repPoints: myRep.points,
        repReps: myRep.reps,
        total:
          confirmationPoints +
          arrivalPoints +
          self.games +
          self.packing +
          self.other +
          myRep.points,
        detail: self.detail,
        narration: e.narration,
      };
    }),
  );
  mmg.sort((a, b) => b.date.localeCompare(a.date));

  return { mmg, gymDays: gymRes.count ?? 0, dietDays: dietRes.count ?? 0 };
}
