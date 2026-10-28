// src/lib/diet/nutrition-seed-sql.test.ts
/**
 * Contract test: the generated block in the migration must equal what
 * renderNutritionSeedSql(NUTRITION_SEED) produces. Pure: reads the migration
 * off disk (same pattern as src/lib/klcsra/config-contract.test.ts).
 *
 * To regenerate after editing nutrition-seed.ts:
 *   WRITE_NUTRITION_SEED=1 npm run test -- src/lib/diet/nutrition-seed-sql.test.ts
 */
import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { NUTRITION_SEED, type SeedFood } from "./nutrition-seed";
import { BEGIN_MARKER, END_MARKER, renderNutritionSeedSql, sqlString } from "./nutrition-seed-sql";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATION = resolve(HERE, "..", "..", "..", "supabase/migrations/20261028120100_diet_catalog_additions.sql");

describe("sqlString", () => {
  it("quotes and escapes single quotes", () => {
    expect(sqlString("KFANDRA's")).toBe("'KFANDRA''s'");
  });
  it("renders null as NULL", () => {
    expect(sqlString(null)).toBe("null");
  });
});

describe("renderNutritionSeedSql", () => {
  const white: SeedFood = NUTRITION_SEED.find((f) => f.key === "white-bread")!;
  const paratha: SeedFood = NUTRITION_SEED.find((f) => f.key === "paratha")!;

  it("renders a counted food with per-100 g values and a source comment", () => {
    const sql = renderNutritionSeedSql([white]);
    expect(sql).toContain("-- white-bread: 67 kcal, P 2, C 12, F 0.8 per 25 g (matrix_v2)");
    expect(sql).toContain(
      "('white-bread', 'White bread', '🍞', '1 slice', '25 g', 'Grains & Bread', 1, true, 25, 268, 8, 48, 3.2, null, 'watch', 'High GI Processing, Low Dietary Fiber', 'matrix_v2', now())",
    );
  });

  it("renders an uncounted food with null nutrition", () => {
    const sql = renderNutritionSeedSql([{ ...paratha, unitDetail: null, nutrition: null }]);
    expect(sql).toContain(
      "('paratha', 'Paratha', '🫓', '1 piece', null, 'Grains & Bread', 1, true, null, null, null, null, null, null, null, null, null, null)",
    );
  });

  it("numbers sort_order from the list position", () => {
    const sql = renderNutritionSeedSql([white, paratha]);
    expect(sql).toMatch(/'paratha', 'Paratha', '🫓', '1 piece', '~60 g', 'Grains & Bread', 2,/);
  });

  it("never overwrites a food KFANDRA edited in the food editor", () => {
    expect(renderNutritionSeedSql([white])).toMatch(
      /excluded\.nutrition_updated_at\nwhere public\.food_catalog\.nutrition_source is distinct from 'kfandra';/,
    );
  });
});

describe("migration contract", () => {
  it("contains exactly the rendered seed block", () => {
    const rendered = renderNutritionSeedSql(NUTRITION_SEED);
    let sql = readFileSync(MIGRATION, "utf8");
    const start = sql.indexOf(BEGIN_MARKER);
    const end = sql.indexOf(END_MARKER);
    expect(start, "BEGIN marker missing").toBeGreaterThanOrEqual(0);
    expect(end, "END marker missing").toBeGreaterThan(start);

    if (process.env.WRITE_NUTRITION_SEED) {
      sql = sql.slice(0, start) + rendered + sql.slice(end + END_MARKER.length);
      writeFileSync(MIGRATION, sql);
    }

    const block = sql.slice(start, sql.indexOf(END_MARKER) + END_MARKER.length);
    expect(block).toBe(rendered);
  });
});
