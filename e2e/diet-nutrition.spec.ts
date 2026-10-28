import { readFileSync } from "node:fs";
import { test, expect, expectNoErrors } from "./fixtures";
import { seedPlayer, signIn, signInAs } from "./helpers/auth";
import * as db from "./helpers/db";

/**
 * Diet nutrition: meal summary, recap once, and the food editor feeding the
 * totals. Every spec seeds its own players; afterAll restores the start date
 * and the milk row and deletes the seeded players (cascading their logs).
 */

let startSnapshot: unknown;
let milkSnapshot: db.FoodSnapshot;

test.beforeAll(async () => {
  startSnapshot = await db.getNutritionStart();
  milkSnapshot = await db.snapshotFood("milk");
  await db.setNutritionStartDaysAgo(7);
});

test.afterAll(async () => {
  await db.restoreNutritionStart(startSnapshot);
  await db.restoreFood("milk", milkSnapshot);
  await db.deleteSeededPlayers();
});

test("logging a meal shows its summary and the day card", async ({ page, context, errors }) => {
  await signInAs(context, "user", "E2E Diet Eater");
  await page.goto("/diet");
  await page.getByRole("button", { name: /Breakfast/ }).first().click();
  // The catalogue tile (with its emoji), not the logged row that appears after the first tap.
  const bread = page.getByRole("button", { name: /🍞 White bread/ });
  await bread.click();
  await bread.click();
  await page.getByRole("button", { name: /^Done ·/ }).click();

  const sheet = page.getByTestId("meal-summary-sheet");
  await expect(sheet).toContainText("Breakfast · 134 kcal");
  await expect(sheet).toContainText("1 of 1 items counted");
  await expect(sheet).toContainText("High GI Processing");
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(sheet).toBeHidden();

  await expect(page.getByTestId("day-nutrition-card")).toContainText("134 kcal");
  expectNoErrors(errors);
});

test("yesterday's recap shows once", async ({ page, context, errors }) => {
  const player = await signInAs(context, "user", "E2E Recap Player");
  await db.insertYesterdayDietItem(player.id, "breakfast", "milk", 1);

  await page.goto("/diet");
  const recap = page.getByTestId("recap-sheet");
  await expect(recap).toContainText("124 kcal");
  await recap.getByRole("button", { name: "Done" }).click();
  await expect.poll(() => db.getYesterdayRecapSeenAt(player.id)).not.toBeNull();

  await page.reload();
  await expect(page.getByTestId("day-nutrition-card").or(page.getByText("Breakfast").first())).toBeVisible();
  await expect(page.getByTestId("recap-sheet")).toBeHidden();
  expectNoErrors(errors);
});

test("editing a food in the editor changes the team totals", async ({ page, context, errors }) => {
  const eater = await seedPlayer("user", "E2E Grid Player");
  await db.insertYesterdayDietItem(eater.id, "breakfast", "milk", 1);
  const kfandra = await seedPlayer("kfandra", "E2E KFANDRA");
  await signIn(context, kfandra);

  await page.goto("/admin/diet/foods");
  const row = page.getByTestId("food-row-milk");
  await row.getByRole("button", { name: "Edit" }).click();
  const kcal = row.getByLabel("kcal per unit");
  await kcal.fill("130");
  await row.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => db.getFoodKcalPer100g("milk")).toBe(65);

  await page.goto("/admin/diet/nutrition");
  await expect(page.locator("tr", { hasText: "E2E Grid Player" })).toContainText("130 kcal");
  expectNoErrors(errors);
});

test("the catalogue seed fills missing foods but never overwrites KFANDRA's edits", async () => {
  const egg = await db.snapshotFood("egg-boiled");
  try {
    await db.sql(
      `update food_catalog set kcal_per_100g = 999, nutrition_source = 'kfandra' where key = 'milk'`,
    );
    await db.sql(
      `update food_catalog set grams_per_unit = null, kcal_per_100g = null, protein_g_per_100g = null,
         carbs_g_per_100g = null, fat_g_per_100g = null, nutrition_source = null where key = 'egg-boiled'`,
    );
    const migration = readFileSync("supabase/migrations/20261028120100_diet_catalog_additions.sql", "utf8");
    const block = migration.slice(migration.indexOf("-- BEGIN GENERATED"), migration.indexOf("-- END GENERATED"));
    await db.sql(block);

    expect(await db.getFoodKcalPer100g("milk")).toBe(999);
    expect(await db.getFoodKcalPer100g("egg-boiled")).toBe(155);
  } finally {
    await db.restoreFood("egg-boiled", egg);
  }
});

test("the food list says one waati is 100 g", async ({ page, context, errors }) => {
  await signInAs(context, "user", "E2E Diet Portions");
  await page.goto("/diet");
  await page.getByRole("button", { name: /Breakfast/ }).first().click();
  await expect(page.getByTestId("diet-portion-note")).toHaveText("1 waati / bowl = 100 g");
  await expect(page.getByRole("button", { name: /🥚 Egg, boiled/ })).toContainText("1 piece · ~50 g");
  expectNoErrors(errors);
});
