/**
 * Canonical Diet log (draft) shape — shared by the client form, the autosave
 * layer and the server repository. Mirrors the DB:
 *   meals[slotKey]            → diet_log_meals (one per touched slot)
 *   meals[slotKey].items      → diet_log_items (catalogue tap or custom)
 *   narration                 → diet_logs.narration
 *
 * Diet logging carries NO points; it is informational tracking only. The log
 * is keyed per (player, day), so like Gym there is no Finalize step.
 *
 * `meals` is sparse: a slot only appears once it has been touched (logged
 * items or explicitly skipped). An absent slot is "not logged yet", which is
 * distinct from a skipped slot (present, skipped = true, no items).
 */

export interface LoggedItem {
  /** Client-stable id (also the diet_log_items id when round-tripped). */
  id: string;
  /** Catalogue food key, or null for a free-form custom entry. */
  foodKey: string | null;
  /** Custom-entry fields (only set when foodKey is null). */
  customName?: string;
  customUnit?: string;
  customNotes?: string;
  /** How many units; always > 0 (a row at 0 is removed). */
  count: number;
}

export interface MealLog {
  skipped: boolean;
  items: LoggedItem[];
}

export interface DietDraft {
  /** Sparse map keyed by meal_slot key. */
  meals: Record<string, MealLog>;
  narration: string;
}

export function emptyDraft(): DietDraft {
  return { meals: {}, narration: "" };
}

/** A blank meal log (the default for an untouched slot). */
export function emptyMeal(): MealLog {
  return { skipped: false, items: [] };
}

/** Read a slot's meal, returning a blank one when the slot is untouched. */
export function getMeal(draft: DietDraft, slotKey: string): MealLog {
  return draft.meals[slotKey] ?? emptyMeal();
}

/** Units the player can pick for a custom (free-form) item. */
export const CUSTOM_UNIT_OPTIONS = [
  "piece",
  "waati",
  "glass",
  "bottle",
  "plate",
  "spoon",
  "other",
] as const;

export type CustomUnit = (typeof CUSTOM_UNIT_OPTIONS)[number];

/* ── Catalogue (reference data loaded server-side, passed to the client) ───── */

export interface MealSlotInfo {
  key: string;
  name: string;
  windowLabel: string;
  emoji: string | null;
  /** Minutes since midnight; endMin may exceed 1440 when wrapping past midnight. */
  startMin: number;
  endMin: number;
}

export interface FoodItemInfo {
  key: string;
  name: string;
  emoji: string | null;
  /** Label shown on the catalogue button, e.g. "1 slice". */
  unit: string;
  /** Optional sub-label, e.g. "200 ml". */
  unitDetail: string | null;
}

export interface FoodSection {
  label: string;
  items: FoodItemInfo[];
}

export interface DietCatalog {
  slots: MealSlotInfo[];
  sections: FoodSection[];
}

/** Flat key → item lookup for rendering logged rows. */
export function indexFoods(catalog: DietCatalog): Record<string, FoodItemInfo> {
  return Object.fromEntries(
    catalog.sections.flatMap((s) => s.items).map((i) => [i.key, i]),
  );
}
