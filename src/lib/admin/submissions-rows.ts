export type PlayerRef = { id: string; displayName: string };

export type SessionRow = {
  playerId: string;
  displayName: string;
  submitted: boolean;
  arrivalPoints: number;
  confirmationPoints: number;
  /** Self-scored points: games + stats + packing/participation + other rows. */
  gamesPoints: number;
  /** Grand total: order ladder (arrival + confirmation) + self-scored. */
  total: number;
};

export type OrderPts = {
  playerId: string;
  arrivalPoints: number;
  confirmationPoints: number;
};

/**
 * Pure: join every active player to their session points, flagging who
 * submitted. Order points come from the ladder; `selfPointsById` carries each
 * submitter's self-scored total (games/participation/other). Non-submitters
 * show 0 across the board so Coach can see the full roster, including who is
 * missing.
 */
export function toSessionRows(
  players: PlayerRef[],
  order: OrderPts[],
  submittedIds: string[],
  selfPointsById: Record<string, number> = {},
): SessionRow[] {
  const byId = new Map(order.map((o) => [o.playerId, o]));
  const submitted = new Set(submittedIds);
  return players.map((p) => {
    const o = byId.get(p.id);
    const arrivalPoints = o?.arrivalPoints ?? 0;
    const confirmationPoints = o?.confirmationPoints ?? 0;
    const gamesPoints = selfPointsById[p.id] ?? 0;
    return {
      playerId: p.id,
      displayName: p.displayName,
      submitted: submitted.has(p.id),
      arrivalPoints,
      confirmationPoints,
      gamesPoints,
      total: arrivalPoints + confirmationPoints + gamesPoints,
    };
  });
}
