import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeOrderPoints, type OrderEntry } from "@/lib/scoring/order-points";

/**
 * Session-level order ladder. Reads every player's self-reported confirmation
 * and arrival ranks for a session and runs the order engine over the whole set
 * (the points depend on how many showed, so this can only be computed per
 * session, not per player). Results are provisional until the session settles.
 */

export interface SessionOrderResult {
  playerId: string;
  name: string;
  confirmationPoints: number;
  arrivalPoints: number;
  total: number;
}

export async function computeSessionOrderPoints(
  sessionId: string,
): Promise<SessionOrderResult[]> {
  const admin = createAdminClient();

  const { data: entries } = await admin
    .from("mmg_entries")
    .select("player_id, confirmation_order, arrival_order, players(display_name)")
    .eq("session_id", sessionId);

  const rows = entries ?? [];

  const orderInput: OrderEntry[] = rows.map((r) => ({
    playerId: r.player_id,
    confirmationRank: r.confirmation_order,
    arrivalRank: r.arrival_order,
  }));

  const nameById = new Map<string, string>();
  for (const r of rows) {
    // players(display_name) is an object for a to-one relation.
    const player = r.players as { display_name: string } | null;
    nameById.set(r.player_id, player?.display_name ?? "Unknown");
  }

  return computeOrderPoints(orderInput).map((p) => ({
    playerId: p.playerId,
    name: nameById.get(p.playerId) ?? "Unknown",
    confirmationPoints: p.confirmationPoints,
    arrivalPoints: p.arrivalPoints,
    total: p.confirmationPoints + p.arrivalPoints,
  }));
}
