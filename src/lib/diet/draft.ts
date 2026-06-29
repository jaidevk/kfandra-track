import type { DietDraft, LoggedItem, MealLog } from "./types";

/**
 * Pure mutators over the sparse, key-addressed diet draft. Extracted from the
 * client form so the behaviour (incl. 0.5 portion stepping) is unit-tested and
 * the component stays declarative. None of these touch the DB.
 */

export function setMealIn(
  draft: DietDraft,
  slotKey: string,
  meal: MealLog,
): DietDraft {
  return { ...draft, meals: { ...draft.meals, [slotKey]: meal } };
}

function emptyMeal(): MealLog {
  return { skipped: false, items: [] };
}

function getMeal(draft: DietDraft, slotKey: string): MealLog {
  return draft.meals[slotKey] ?? emptyMeal();
}

export function tapFood(
  draft: DietDraft,
  slotKey: string,
  foodKey: string,
): DietDraft {
  const meal = getMeal(draft, slotKey);
  const existing = meal.items.find((it) => it.foodKey === foodKey);
  const items = existing
    ? meal.items.map((it) =>
        it.foodKey === foodKey ? { ...it, count: it.count + 1 } : it,
      )
    : [
        ...meal.items,
        { id: `${foodKey}-${Date.now()}`, foodKey, count: 1 } as LoggedItem,
      ];
  return setMealIn(draft, slotKey, { skipped: false, items });
}

export function adjustLogged(
  draft: DietDraft,
  slotKey: string,
  loggedId: string,
  delta: number,
): DietDraft {
  const meal = getMeal(draft, slotKey);
  const items = meal.items
    .map((it) => (it.id === loggedId ? { ...it, count: it.count + delta } : it))
    .filter((it) => it.count > 0);
  return setMealIn(draft, slotKey, { ...meal, items });
}

export function removeLogged(
  draft: DietDraft,
  slotKey: string,
  loggedId: string,
): DietDraft {
  const meal = getMeal(draft, slotKey);
  return setMealIn(draft, slotKey, {
    ...meal,
    items: meal.items.filter((it) => it.id !== loggedId),
  });
}

export function addCustomItem(
  draft: DietDraft,
  slotKey: string,
  custom: { name: string; quantity: number; unit: string; notes?: string },
): DietDraft {
  const meal = getMeal(draft, slotKey);
  const item: LoggedItem = {
    id: `custom-${Date.now()}`,
    foodKey: null,
    customName: custom.name,
    customUnit: custom.unit,
    customNotes: custom.notes,
    count: custom.quantity,
  };
  return setMealIn(draft, slotKey, {
    skipped: false,
    items: [...meal.items, item],
  });
}

export function setSkipped(
  draft: DietDraft,
  slotKey: string,
  skipped: boolean,
): DietDraft {
  const meal = getMeal(draft, slotKey);
  return setMealIn(draft, slotKey, {
    ...meal,
    skipped,
    items: skipped ? [] : meal.items,
  });
}
