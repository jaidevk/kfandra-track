/**
 * Pure league table groups (no DB/server imports). DB loader in config.ts,
 * key `klcsra_table_groups`. Key order is display order: the first key is the
 * default chip. "*" means every sport.
 */
import { SPORTS, TRY_SPORTS, type Sport } from "./sport-stats";

export type TableGroups = Record<string, "*" | Sport[]>;

export const DEFAULT_TABLE_GROUPS: TableGroups = {
  all: "*",
  football_fooba: ["football", "fooba"],
  rugby_sox: ["rugby"],
  rugby_variations: ["rugby_variation"],
  short_game_variations: ["short_game_variation"],
};

const isSport = (x: unknown): x is Sport =>
  typeof x === "string" && (SPORTS as readonly string[]).includes(x);

/**
 * Drops unknown sports and empty groups; falls back to the defaults when
 * nothing usable remains. Fallbacks are fresh copies.
 */
export function parseTableGroups(value: unknown): TableGroups {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return structuredClone(DEFAULT_TABLE_GROUPS);
  }
  const out: TableGroups = {};
  for (const [key, raw] of Object.entries(value)) {
    if (key === "__proto__") continue;
    if (raw === "*") out[key] = "*";
    else if (Array.isArray(raw)) {
      const sports = [...new Set(raw.filter(isSport))];
      if (sports.length > 0) out[key] = sports;
    }
  }
  return Object.keys(out).length > 0 ? out : structuredClone(DEFAULT_TABLE_GROUPS);
}

export function sportInGroup(sport: Sport, groupKey: string, groups: TableGroups): boolean {
  const g = groups[groupKey];
  if (g === undefined) return false;
  return g === "*" || g.includes(sport);
}

/** Which score columns can be non-zero in a group (GF/GA vs TF/TA). */
export function groupScoreKinds(
  groupKey: string,
  groups: TableGroups,
): { goals: boolean; tries: boolean } {
  const g = groups[groupKey];
  if (g === undefined || g === "*") return { goals: true, tries: true };
  return {
    goals: g.some((s) => !TRY_SPORTS.has(s)),
    tries: g.some((s) => TRY_SPORTS.has(s)),
  };
}
