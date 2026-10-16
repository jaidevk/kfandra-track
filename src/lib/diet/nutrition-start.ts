import { isValidDateKey } from "./dates";

/** app_config key holding the IST date nutrition starts counting from (D12). */
export const NUTRITION_START_KEY = "diet_nutrition_start_date";

/** Coerce the raw app_config JSON value; null turns nutrition off. */
export function parseStartDate(value: unknown): string | null {
  return typeof value === "string" && isValidDateKey(value) ? value : null;
}
