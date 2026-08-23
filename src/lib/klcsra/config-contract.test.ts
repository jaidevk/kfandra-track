/**
 * Seed/defaults contract test.
 *
 * The migration seeds three JSON rule sets into `app_config`; the TypeScript
 * modules define the same three rule sets again as `DEFAULT_*` constants.
 * They are two hand-maintained copies of the same data and nothing links them:
 * if they drift, `parseStatRates` / `parseSportStats` / `parseStandingsRules`
 * silently substitute the default for the mismatched key and the payout comes
 * out quietly wrong. Types cannot catch this — one side is a SQL string
 * literal inside a `.sql` file.
 *
 * This test is deliberately PURE: it reads the migration off disk with
 * `node:fs`. No DB connection, no Supabase client, and no import of
 * `config.ts` (which would pull in `server-only`). It imports the `DEFAULT_*`
 * constants from their own pure modules instead.
 */

import { describe, it, expect } from "vitest";

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_STAT_RATES, STAT_KEYS } from "./stat-rates";
import { DEFAULT_SPORT_STATS, SPORTS } from "./sport-stats";
import { DEFAULT_STANDINGS_RULES } from "./standings-rules";

const HERE = dirname(fileURLToPath(import.meta.url));
// src/lib/klcsra -> repo root
const REPO_ROOT = resolve(HERE, "..", "..", "..");
const MIGRATION_PATH = resolve(
  REPO_ROOT,
  "supabase/migrations/20260815120000_klcsra_core.sql",
);

const SQL = readFileSync(MIGRATION_PATH, "utf8");

const INSERT = "insert into public.app_config";

/**
 * Pull the seeded JSON literal for `key` out of the migration: find the
 * `insert into public.app_config` statement that mentions the key, then take
 * the text between the first `'{` and the matching `}'` before `::jsonb`.
 */
function extractSeededJsonLiteral(key: string): string {
  const statements = SQL.split(INSERT).slice(1);
  const statement = statements.find((s) => s.includes(`'${key}'`));
  if (statement === undefined) {
    throw new Error(`no "${INSERT}" statement seeds key '${key}'`);
  }
  const start = statement.indexOf("'{");
  if (start === -1) {
    throw new Error(`seed for '${key}' has no opening '{`);
  }
  const end = statement.indexOf("}'::jsonb", start);
  if (end === -1) {
    throw new Error(`seed for '${key}' has no closing }'::jsonb`);
  }
  // start + 1 skips the opening quote; end + 1 keeps the closing brace.
  return statement.slice(start + 1, end + 1);
}

function seededValue(key: string): unknown {
  const literal = extractSeededJsonLiteral(key);
  expect(literal.startsWith("{"), `seed for '${key}' should start with {`).toBe(true);
  expect(literal.endsWith("}"), `seed for '${key}' should end with }`).toBe(true);
  return JSON.parse(literal);
}

describe("migration seeds match TypeScript defaults", () => {
  it("finds all three seeded rule sets in the migration", () => {
    // Guards against the extraction silently yielding nothing, which would
    // make every assertion below vacuous.
    for (const key of [
      "klcsra_stat_rates",
      "klcsra_sport_stats",
      "klcsra_standings_rules",
    ]) {
      const value = seededValue(key);
      expect(typeof value, `${key} should parse to an object`).toBe("object");
      expect(value).not.toBeNull();
      expect(Object.keys(value as object).length).toBeGreaterThan(0);
    }
  });

  it("klcsra_stat_rates deep-equals DEFAULT_STAT_RATES", () => {
    expect(seededValue("klcsra_stat_rates")).toEqual(DEFAULT_STAT_RATES);
  });

  it("klcsra_stat_rates covers exactly STAT_KEYS", () => {
    const seeded = seededValue("klcsra_stat_rates") as Record<string, unknown>;
    expect(Object.keys(seeded).sort()).toEqual([...STAT_KEYS].sort());
  });

  it("klcsra_sport_stats deep-equals DEFAULT_SPORT_STATS", () => {
    expect(seededValue("klcsra_sport_stats")).toEqual(DEFAULT_SPORT_STATS);
  });

  it("klcsra_sport_stats covers exactly the four sports", () => {
    const seeded = seededValue("klcsra_sport_stats") as Record<string, unknown>;
    expect(Object.keys(seeded).sort()).toEqual([...SPORTS].sort());
  });

  it("every stat named in klcsra_sport_stats is a known STAT_KEY", () => {
    // A seeded allow-list naming a stat with no rate would silently never score.
    const seeded = seededValue("klcsra_sport_stats") as Record<string, string[]>;
    const known = new Set<string>(STAT_KEYS);
    for (const [sport, stats] of Object.entries(seeded)) {
      expect(Array.isArray(stats), `${sport} should seed an array`).toBe(true);
      for (const stat of stats) {
        expect(known.has(stat), `${sport} names unknown stat '${stat}'`).toBe(true);
      }
    }
  });

  it("klcsra_standings_rules deep-equals DEFAULT_STANDINGS_RULES", () => {
    expect(seededValue("klcsra_standings_rules")).toEqual(DEFAULT_STANDINGS_RULES);
  });
});
