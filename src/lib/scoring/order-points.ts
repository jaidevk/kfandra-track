/**
 * Order-of-arrival & order-of-confirmation points engine.
 *
 * LOCKED algorithm (2026-06-07). Two independent ladders are scored per
 * session from each player's self-reported ranks:
 *
 *   S  = players who self-report an ARRIVAL rank (i.e. who actually showed).
 *        N = |S|. No-shows are excluded entirely.
 *   Sc = players in S who ALSO self-report a CONFIRMATION rank.
 *        Nc = |Sc| (the confirmation denominator). Players who arrived but
 *        never confirmed earn 0 confirmation points AND are excluded from Nc,
 *        so Nc may be < N.
 *
 * Within each ladder, players are sorted by their reported rank and the k-th
 * in that order earns (TOTAL − k + 1) × 100 — i.e. first earns TOTAL×100 and
 * the last earns 100. The reported rank is used ONLY to order players, never
 * as a literal multiplier, so honest gaps/typos in the numbers don't break the
 * math. Arrival uses N as TOTAL; confirmation uses Nc.
 *
 * Ties use standard SKIP (competition) ranking: two players sharing position 1
 * of 5 both earn 500 and the next earns 300 (500, 500, 300).
 *
 * The function is pure and deterministic. Results are provisional until the
 * session is finalized (N can still change as more players report).
 */

const STEP = 100;

export interface OrderEntry {
  /** Stable identifier for the player (used to key the result). */
  playerId: string;
  /**
   * Self-reported confirmation rank, or null if the player never confirmed.
   * Only the relative ordering matters; absolute values may have gaps.
   */
  confirmationRank: number | null;
  /**
   * Self-reported arrival rank, or null if the player did not show.
   * A null arrival rank excludes the player from BOTH ladders.
   */
  arrivalRank: number | null;
}

export interface OrderPoints {
  playerId: string;
  confirmationPoints: number;
  arrivalPoints: number;
}

/**
 * Assign points down a single ladder. `entries` must already be filtered to
 * the participating set. `total` is the ladder denominator (N or Nc). Ties on
 * `rank` share the better position (skip ranking) and therefore the same
 * points.
 */
function scoreLadder(
  entries: { playerId: string; rank: number }[],
  total: number,
): Map<string, number> {
  const sorted = [...entries].sort((a, b) => a.rank - b.rank);
  const points = new Map<string, number>();

  let position = 0; // 1-based competition rank of the player just scored
  for (let i = 0; i < sorted.length; i++) {
    // Skip ranking: a tie keeps the previous position; otherwise position is
    // the 1-based index, which "skips" past any tied players above.
    if (i === 0 || sorted[i].rank !== sorted[i - 1].rank) {
      position = i + 1;
    }
    points.set(sorted[i].playerId, (total - position + 1) * STEP);
  }

  return points;
}

/**
 * Compute confirmation and arrival points for every player who showed.
 *
 * Players with a null arrival rank (no-shows) are omitted from the result
 * entirely — they earn nothing on either ladder. Players who arrived but
 * never confirmed appear in the result with 0 confirmation points.
 */
export function computeOrderPoints(entries: OrderEntry[]): OrderPoints[] {
  // S: everyone who showed. Defines N and the result set.
  const arrivers = entries.filter((e) => e.arrivalRank !== null);
  const N = arrivers.length;

  // Sc: arrivers who also confirmed. Defines Nc.
  const confirmers = arrivers.filter((e) => e.confirmationRank !== null);
  const Nc = confirmers.length;

  const arrivalPts = scoreLadder(
    arrivers.map((e) => ({ playerId: e.playerId, rank: e.arrivalRank as number })),
    N,
  );
  const confirmationPts = scoreLadder(
    confirmers.map((e) => ({
      playerId: e.playerId,
      rank: e.confirmationRank as number,
    })),
    Nc,
  );

  return arrivers.map((e) => ({
    playerId: e.playerId,
    confirmationPoints: confirmationPts.get(e.playerId) ?? 0,
    arrivalPoints: arrivalPts.get(e.playerId) ?? 0,
  }));
}
