import { statValue, type ScoringConfig } from "@/lib/mmg/scoring";
import type { GameTypeKey, MmgDraft, StatKey } from "@/lib/mmg/types";

export type PlayerRef = { id: string; displayName: string };

/** A single point line in a drill-down (e.g. one packing bonus, one Other row). */
export type PointLine = { label: string; points: number };

/** One stat within a game card, with its point value. */
export type StatLine = { key: string; count: number; points: number };

/** One game card in the drill-down: result split + logged stats. */
export type GameLine = {
  name: string;
  won: number;
  drew: number;
  lost: number;
  resultPoints: number;
  stats: StatLine[];
};

/** Everything the collapsed category columns hide, for the expandable row. */
export type SessionRowDetail = {
  games: GameLine[];
  packing: PointLine[];
  others: PointLine[];
  confirmationOrder: number | null;
  arrivalOrder: number | null;
};

/** A submitter's self-scored breakdown (games/packing/other) + drill-down. */
export type SelfScored = {
  games: number;
  packing: number;
  other: number;
  detail: SessionRowDetail;
};

export type SessionRow = {
  playerId: string;
  displayName: string;
  submitted: boolean;
  arrivalPoints: number;
  confirmationPoints: number;
  /** Game result + stat points only (packing & other now have their own columns). */
  gamesPoints: number;
  /** Participation/packing bonuses. */
  packingPoints: number;
  /** Free-form "other" points. */
  otherPoints: number;
  /** Grand total: order ladder + games + packing + other. */
  total: number;
  /** Drill-down detail for submitters; null for non-submitters. */
  detail: SessionRowDetail | null;
};

export type OrderPts = {
  playerId: string;
  arrivalPoints: number;
  confirmationPoints: number;
};

/**
 * Pure: join every active player to their session points, flagging who
 * submitted. Order points come from the ladder; `selfById` carries each
 * submitter's self-scored breakdown (games / packing / other) + drill-down
 * detail. Non-submitters show 0 across every column so Coach can see the full
 * roster, including who is missing.
 */
export function toSessionRows(
  players: PlayerRef[],
  order: OrderPts[],
  submittedIds: string[],
  selfById: Record<string, SelfScored> = {},
): SessionRow[] {
  const byId = new Map(order.map((o) => [o.playerId, o]));
  const submitted = new Set(submittedIds);
  return players.map((p) => {
    const o = byId.get(p.id);
    const arrivalPoints = o?.arrivalPoints ?? 0;
    const confirmationPoints = o?.confirmationPoints ?? 0;
    const self = selfById[p.id];
    const gamesPoints = self?.games ?? 0;
    const packingPoints = self?.packing ?? 0;
    const otherPoints = self?.other ?? 0;
    return {
      playerId: p.id,
      displayName: p.displayName,
      submitted: submitted.has(p.id),
      arrivalPoints,
      confirmationPoints,
      gamesPoints,
      packingPoints,
      otherPoints,
      total:
        arrivalPoints + confirmationPoints + gamesPoints + packingPoints + otherPoints,
      detail: self?.detail ?? null,
    };
  });
}

const PACKING: {
  key: "unpacking" | "packingWeights" | "packingKit" | "confirmedBy11am";
  label: string;
}[] = [
  { key: "unpacking", label: "Unpacking" },
  { key: "packingWeights", label: "Packing weights" },
  { key: "packingKit", label: "Packing kit / PTM" },
  { key: "confirmedBy11am", label: "Confirmed by 11am" },
];

/**
 * Pure: split one player's self-scored draft into games / packing / other
 * totals plus the per-line drill-down detail. Totals match the engine's
 * computeDraftPoints (games = result + stats, packing = participation bonuses,
 * other = free-form rows) but are computed alongside the detail lines so the
 * columns and the expandable rows never disagree.
 */
export function buildSelfScored(
  config: ScoringConfig,
  draft: MmgDraft,
  gameName: (type: GameTypeKey) => string,
): SelfScored {
  let gamesTotal = 0;
  const games: GameLine[] = draft.games.map((g) => {
    const resultPoints =
      g.results.won * (config.result.won ?? 0) +
      g.results.drew * (config.result.drew ?? 0) +
      g.results.lost * (config.result.lost ?? 0);
    const stats: StatLine[] = [];
    let statTotal = 0;
    for (const [key, count] of Object.entries(g.stats)) {
      if (!count) continue;
      const points = count * statValue(config, g.type, key as StatKey);
      stats.push({ key, count, points });
      statTotal += points;
    }
    gamesTotal += resultPoints + statTotal;
    return {
      name: gameName(g.type),
      won: g.results.won,
      drew: g.results.drew,
      lost: g.results.lost,
      resultPoints,
      stats,
    };
  });

  let packingTotal = 0;
  const packing: PointLine[] = [];
  for (const pk of PACKING) {
    if (draft.participation[pk.key]) {
      const points = config.participation[pk.key];
      packingTotal += points;
      packing.push({ label: pk.label, points });
    }
  }

  let otherTotal = 0;
  const others: PointLine[] = [];
  for (const o of draft.others) {
    const n = Number(o.points);
    if (!Number.isFinite(n) || n === 0) continue;
    otherTotal += n;
    others.push({ label: o.description || "—", points: n });
  }

  return {
    games: gamesTotal,
    packing: packingTotal,
    other: otherTotal,
    detail: {
      games,
      packing,
      others,
      confirmationOrder: draft.participation.confirmationOrder,
      arrivalOrder: draft.participation.arrivalOrder,
    },
  };
}
