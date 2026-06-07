import type {
  DietDraft,
  FoodItemInfo,
  LoggedItem,
  MealLog,
  MealSlotInfo,
} from "./types";

/**
 * Pure summaries for the Diet hub + meal headers. Diet is unscored, so these
 * are simple counts/descriptions rather than points — but they live here (not
 * in the component) so the behaviour is unit-tested and the form stays
 * declarative. Catalogue-aware helpers take a key → item lookup so they stay
 * pure (no DB access).
 */

/** Resolve a logged item's display name + unit (catalogue tap or custom). */
export function describeLogged(
  item: LoggedItem,
  foodById: Record<string, FoodItemInfo>,
): { name: string; unit: string } {
  if (item.foodKey === null) {
    return {
      name: item.customName?.trim() || "Custom item",
      unit: item.customUnit ? `1 ${item.customUnit}` : "1 unit",
    };
  }
  const food = foodById[item.foodKey];
  return {
    name: food?.name ?? item.foodKey,
    unit: food?.unit ?? "1 unit",
  };
}

/** One-line preview of a meal for the hub card ("Roti × 2, Dal × 1, +2 more"). */
export function compactSummary(
  meal: MealLog | undefined,
  foodById: Record<string, FoodItemInfo>,
  max = 3,
): string {
  if (!meal) return "";
  if (meal.skipped) return "Skipped";
  if (meal.items.length === 0) return "";
  const parts = meal.items.slice(0, max).map((it) => {
    const { name } = describeLogged(it, foodById);
    return `${name} × ${it.count}`;
  });
  if (meal.items.length > max) parts.push(`+${meal.items.length - max} more`);
  return parts.join(", ");
}

/** Total units logged in a meal (0 for skipped/untouched). */
export function totalUnits(meal: MealLog | undefined): number {
  if (!meal || meal.skipped) return 0;
  return meal.items.reduce((sum, it) => sum + it.count, 0);
}

/** Total units logged across the whole day. */
export function dayTotalUnits(draft: DietDraft): number {
  return Object.values(draft.meals).reduce((sum, m) => sum + totalUnits(m), 0);
}

/**
 * Number of meals the player has "touched" today — a slot counts once it has
 * logged items or is explicitly skipped. Untouched slots don't count.
 */
export function loggedMealCount(draft: DietDraft): number {
  return Object.values(draft.meals).filter(
    (m) => m.skipped || m.items.length > 0,
  ).length;
}

/**
 * The slot whose time window contains `now`, or null. Handles the midnight
 * slot whose end_min wraps past 1440 (e.g. 10 pm – 2 am).
 */
export function currentMealKey(
  slots: MealSlotInfo[],
  now: Date = new Date(),
): string | null {
  const minutes = now.getHours() * 60 + now.getMinutes();
  for (const slot of slots) {
    if (slot.endMin > 24 * 60) {
      if (minutes >= slot.startMin || minutes < slot.endMin - 24 * 60) {
        return slot.key;
      }
    } else if (minutes >= slot.startMin && minutes < slot.endMin) {
      return slot.key;
    }
  }
  return null;
}
