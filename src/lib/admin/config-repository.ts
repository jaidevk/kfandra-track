import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type PointRuleRow = {
  id: string;
  scope: string;
  ruleKey: string;
  label: string;
  points: number;
  gameTypeId: string | null;
  gameTypeName: string | null;
};

/** All active point rules with their labels + (for overrides) the game type. */
export async function listPointRules(): Promise<PointRuleRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("point_rules")
    .select("id, scope, rule_key, label, points, game_type_id, game_types(name)")
    .eq("is_active", true)
    .order("scope")
    .order("label");
  return (data ?? []).map((r) => ({
    id: r.id,
    scope: r.scope,
    ruleKey: r.rule_key,
    label: r.label,
    points: r.points,
    gameTypeId: r.game_type_id,
    gameTypeName: (r.game_types as { name: string } | null)?.name ?? null,
  }));
}

export type GameTypeRow = {
  id: string;
  key: string;
  name: string;
  emoji: string | null;
};

/** All game types (active + inactive) in display order, for name editing. */
export async function listGameTypesForEdit(): Promise<GameTypeRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("game_types")
    .select("id, key, name, emoji")
    .order("sort_order");
  return (data ?? []).map((g) => ({
    id: g.id,
    key: g.key,
    name: g.name,
    emoji: g.emoji,
  }));
}
