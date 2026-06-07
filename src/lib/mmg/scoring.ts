import type {
  GameDraft,
  GameResult,
  GameTypeKey,
  MmgDraft,
  StatKey,
} from "./types";

/**
 * MMG point scoring. Values are entirely data-driven from point_rules so they
 * stay admin-editable — nothing is hardcoded here.
 *
 * This computes the "self-determined" portion of a player's session total:
 * result + per-game stats + participation bonuses + free-form others. The
 * order-of-arrival / confirmation ladder is session-wide (depends on everyone
 * who showed) and is computed separately by the order engine, not here.
 */

export type PointScope =
  | "participation"
  | "result"
  | "stat"
  | "order"
  | "other";

/** A point_rules row with its game-type override resolved to a key. */
export interface PointRuleRow {
  scope: PointScope;
  rule_key: string;
  points: number;
  /** null = default value; set = applies only to this game type. */
  game_type_key: GameTypeKey | null;
}

/** point_rules participation rule_key → MmgDraft participation field. */
const PARTICIPATION_KEY_MAP: Record<string, keyof ScoringConfig["participation"]> = {
  unpacking: "unpacking",
  packing_weights: "packingWeights",
  packing_kit: "packingKit",
  confirmed_by_11am: "confirmedBy11am",
};

export interface ScoringConfig {
  result: Partial<Record<GameResult, number>>;
  /** Default stat values (game_type_id NULL). */
  statDefault: Partial<Record<StatKey, number>>;
  /** Per-game-type stat overrides (e.g. rugby tackle, big-goal goalConceded). */
  statOverride: Partial<Record<GameTypeKey, Partial<Record<StatKey, number>>>>;
  participation: {
    unpacking: number;
    packingWeights: number;
    packingKit: number;
    confirmedBy11am: number;
  };
  /** Base unit for the N×100 order ladder (used by the session-level engine). */
  orderBasePerRank: number;
}

/** Fold raw point_rules rows into a structured, lookup-friendly config. */
export function buildScoringConfig(rows: PointRuleRow[]): ScoringConfig {
  const config: ScoringConfig = {
    result: {},
    statDefault: {},
    statOverride: {},
    participation: {
      unpacking: 0,
      packingWeights: 0,
      packingKit: 0,
      confirmedBy11am: 0,
    },
    orderBasePerRank: 0,
  };

  for (const row of rows) {
    switch (row.scope) {
      case "result":
        config.result[row.rule_key as GameResult] = row.points;
        break;
      case "stat":
        if (row.game_type_key === null) {
          config.statDefault[row.rule_key as StatKey] = row.points;
        } else {
          const bucket = (config.statOverride[row.game_type_key] ??= {});
          bucket[row.rule_key as StatKey] = row.points;
        }
        break;
      case "participation": {
        const field = PARTICIPATION_KEY_MAP[row.rule_key];
        if (field) config.participation[field] = row.points;
        break;
      }
      case "order":
        if (row.rule_key === "base_per_rank") config.orderBasePerRank = row.points;
        break;
      // 'other' rows carry no fixed value — points are entered free-form.
    }
  }

  return config;
}

/**
 * Points for a single stat on a given game type. A per-game-type override wins
 * over the default; an unknown stat is worth 0 (e.g. goalConceded outside
 * Big Goal has no rule and never scores).
 */
export function statValue(
  config: ScoringConfig,
  type: GameTypeKey,
  key: StatKey,
): number {
  const override = config.statOverride[type]?.[key];
  if (override !== undefined) return override;
  return config.statDefault[key] ?? 0;
}

/** Points for one game card: each result count × its value + each stat. */
export function gameTotal(config: ScoringConfig, game: GameDraft): number {
  let total = 0;
  for (const r of ["won", "drew", "lost"] as GameResult[]) {
    const count = game.results[r];
    if (count) total += count * (config.result[r] ?? 0);
  }
  for (const [key, count] of Object.entries(game.stats)) {
    if (!count) continue;
    total += count * statValue(config, game.type, key as StatKey);
  }
  return total;
}

/** Participation bonuses for the true flags only. */
export function participationTotal(config: ScoringConfig, draft: MmgDraft): number {
  const p = draft.participation;
  let total = 0;
  if (p.unpacking) total += config.participation.unpacking;
  if (p.packingWeights) total += config.participation.packingWeights;
  if (p.packingKit) total += config.participation.packingKit;
  if (p.confirmedBy11am) total += config.participation.confirmedBy11am;
  return total;
}

/** Sum of the free-form "other" rows (non-numeric entries ignored). */
export function othersTotal(draft: MmgDraft): number {
  return draft.others.reduce((sum, row) => {
    const n = Number(row.points);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}

export interface DraftPointsBreakdown {
  participation: number;
  games: number;
  others: number;
  /** Self-determined total (EXCLUDES the session-level order ladder). */
  total: number;
}

/** Full self-determined points breakdown for a draft. */
export function computeDraftPoints(
  config: ScoringConfig,
  draft: MmgDraft,
): DraftPointsBreakdown {
  const participation = participationTotal(config, draft);
  const games = draft.games.reduce((sum, g) => sum + gameTotal(config, g), 0);
  const others = othersTotal(draft);
  return { participation, games, others, total: participation + games + others };
}
