import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildScoringConfig, type PointRuleRow, type ScoringConfig } from "./scoring";
import type { GameTypeKey } from "./types";

/**
 * Server-side loaders for the admin-editable scoring catalogue. Game types and
 * point rules live in the DB so they can be tuned without a deploy.
 */

export interface GameTypeOption {
  id: string;
  key: GameTypeKey;
  name: string;
  emoji: string | null;
  sortOrder: number;
}

export interface LoadedConfig {
  config: ScoringConfig;
  gameTypes: GameTypeOption[];
  /** key → id, for mapping a draft's game type onto submission_games rows. */
  gameTypeIdByKey: Record<string, string>;
}

export async function loadScoringConfig(): Promise<LoadedConfig> {
  const admin = createAdminClient();

  const [gtRes, prRes] = await Promise.all([
    admin
      .from("game_types")
      .select("id, key, name, emoji, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    admin
      .from("point_rules")
      .select("scope, rule_key, points, game_type_id")
      .eq("is_active", true),
  ]);

  const gameTypes: GameTypeOption[] = (gtRes.data ?? []).map((g) => ({
    id: g.id,
    key: g.key as GameTypeKey,
    name: g.name,
    emoji: g.emoji,
    sortOrder: g.sort_order,
  }));

  const gameTypeIdByKey: Record<string, string> = {};
  const gameTypeKeyById: Record<string, GameTypeKey> = {};
  for (const g of gameTypes) {
    gameTypeIdByKey[g.key] = g.id;
    gameTypeKeyById[g.id] = g.key;
  }

  const rows: PointRuleRow[] = (prRes.data ?? []).map((r) => ({
    scope: r.scope,
    rule_key: r.rule_key,
    points: r.points,
    game_type_key: r.game_type_id ? gameTypeKeyById[r.game_type_id] ?? null : null,
  }));

  return {
    config: buildScoringConfig(rows),
    gameTypes,
    gameTypeIdByKey,
  };
}
