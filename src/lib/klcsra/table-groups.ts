/**
 * Pure league table groups (no DB/server imports). DB loader in config.ts,
 * key `klcsra_table_groups`.
 *
 * Stored as an ordered ARRAY of `{ key, sports }`, because Postgres jsonb does
 * not keep object key order (it re-sorts keys by length, then bytes). Parsed
 * into a `TableGroups` record whose insertion order is display order: the
 * first key is the default chip. "*" means every sport.
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
 * Parses the stored array form. Drops invalid entries, empty groups, unknown
 * sports, duplicate keys and `__proto__`; falls back to a fresh copy of the
 * defaults when the value is not an array or nothing usable remains.
 */
export function parseTableGroups(value: unknown): TableGroups {
  if (!Array.isArray(value)) return structuredClone(DEFAULT_TABLE_GROUPS);
  const out: TableGroups = {};
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const { key, sports } = entry as { key?: unknown; sports?: unknown };
    if (typeof key !== "string" || key === "" || key === "__proto__") continue;
    if (Object.prototype.hasOwnProperty.call(out, key)) continue;
    if (sports === "*") out[key] = "*";
    else if (Array.isArray(sports)) {
      const valid = [...new Set(sports.filter(isSport))];
      if (valid.length > 0) out[key] = valid;
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
