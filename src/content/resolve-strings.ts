import "server-only";
import { strings, type AppStrings } from "./strings";
import { applyOverrides } from "./string-paths";
import { loadLabelOverrides } from "@/lib/admin/labels-repository";

/**
 * Resolved strings for rendering: defaults with DB overrides merged in.
 *
 * Reads the (tiny) label_overrides table on each call — no cache — so an admin
 * edit shows immediately. Consumer pages opt into dynamic rendering
 * (`export const dynamic = "force-dynamic"`) so they re-read per request rather
 * than freezing overrides at build time.
 */
export async function getStrings(): Promise<AppStrings> {
  const overrides = await loadLabelOverrides();
  return applyOverrides(strings, overrides);
}
