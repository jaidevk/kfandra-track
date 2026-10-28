// src/lib/diet/nutrition-seed-sql.ts
/**
 * Renders NUTRITION_SEED as the SQL upsert block that lives between the
 * markers in supabase/migrations/20261028120100_diet_catalog_additions.sql. Pure.
 */
import { per100g, type SeedFood } from "./nutrition-seed";

export const BEGIN_MARKER = "-- BEGIN GENERATED: diet nutrition seed";
export const END_MARKER = "-- END GENERATED: diet nutrition seed";

export function sqlString(v: string | null): string {
  return v === null ? "null" : `'${v.replace(/'/g, "''")}'`;
}

const num = (v: number | null) => (v === null ? "null" : String(v));

const COLUMNS = [
  "key", "name", "emoji", "unit", "unit_detail", "section_label", "sort_order", "is_active",
  "grams_per_unit", "kcal_per_100g", "protein_g_per_100g", "carbs_g_per_100g", "fat_g_per_100g",
  "sodium_mg_per_100g", "verdict", "nutrition_note", "nutrition_source", "nutrition_updated_at",
];

function renderRow(f: SeedFood, sortOrder: number): string[] {
  const head = [
    sqlString(f.key), sqlString(f.name), sqlString(f.emoji), sqlString(f.unit),
    sqlString(f.unitDetail), sqlString(f.section), String(sortOrder), "true",
  ];
  const n = f.nutrition;
  if (!n) return [`  (${[...head, ...Array(10).fill("null")].join(", ")})`];
  const p = per100g(n);
  const comment =
    `  -- ${f.key}: ${n.kcal} kcal, P ${n.protein}, C ${n.carbs}, F ${n.fat}` +
    (n.sodiumMg === null ? "" : `, Na ${n.sodiumMg} mg`) +
    ` per ${n.basisG} g (${n.source})`;
  const values = [
    ...head,
    num(n.gramsPerUnit), num(p.kcal), num(p.protein), num(p.carbs), num(p.fat), num(p.sodiumMg),
    sqlString(n.verdict), sqlString(n.note), sqlString(n.source), "now()",
  ];
  return [comment, `  (${values.join(", ")})`];
}

export function renderNutritionSeedSql(foods: SeedFood[]): string {
  const rows = foods.map((f, i) => renderRow(f, i + 1));
  // Commas go after each value tuple except the last; comment lines carry none.
  const body = rows
    .map((lines, i) => {
      const last = lines.length - 1;
      lines[last] += i === rows.length - 1 ? "" : ",";
      return lines.join("\n");
    })
    .join("\n");
  const updates = COLUMNS.filter((c) => c !== "key").map((c) => `  ${c} = excluded.${c}`).join(",\n");
  return [
    BEGIN_MARKER,
    "-- Generated from src/lib/diet/nutrition-seed.ts. Do not edit by hand. Regenerate with:",
    "--   WRITE_NUTRITION_SEED=1 npm run test -- src/lib/diet/nutrition-seed-sql.test.ts",
    `insert into public.food_catalog (${COLUMNS.join(", ")})`,
    "values",
    body,
    "on conflict (key) do update set",
    updates,
    // A food KFANDRA saved in the food editor is his; the seed never overwrites it.
    "where public.food_catalog.nutrition_source is distinct from 'kfandra';",
    END_MARKER,
  ].join("\n");
}
