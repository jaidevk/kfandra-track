export type PlayerRef = { id: string; displayName: string };

export type SessionRow = {
  playerId: string;
  displayName: string;
  submitted: boolean;
  arrivalPoints: number;
  confirmationPoints: number;
  total: number;
};

export type OrderPts = {
  playerId: string;
  arrivalPoints: number;
  confirmationPoints: number;
};

/**
 * Pure: join every active player to their session order points, flagging who
 * submitted. Non-submitters (and submitters who never recorded an arrival rank)
 * show 0 points so Coach can see the full roster, including who is missing.
 */
export function toSessionRows(
  players: PlayerRef[],
  order: OrderPts[],
  submittedIds: string[],
): SessionRow[] {
  const byId = new Map(order.map((o) => [o.playerId, o]));
  const submitted = new Set(submittedIds);
  return players.map((p) => {
    const o = byId.get(p.id);
    const arrivalPoints = o?.arrivalPoints ?? 0;
    const confirmationPoints = o?.confirmationPoints ?? 0;
    return {
      playerId: p.id,
      displayName: p.displayName,
      submitted: submitted.has(p.id),
      arrivalPoints,
      confirmationPoints,
      total: arrivalPoints + confirmationPoints,
    };
  });
}
