import "server-only";
import { unstable_cache } from "next/cache";
import { strings, type AppStrings } from "./strings";
import { applyOverrides } from "./string-paths";
import { loadLabelOverrides } from "@/lib/admin/labels-repository";

export const LABELS_CACHE_TAG = "label-overrides";

const cachedOverrides = unstable_cache(async () => loadLabelOverrides(), ["label-overrides"], {
  tags: [LABELS_CACHE_TAG],
});

/** Resolved strings for rendering: defaults with DB overrides merged in. */
export async function getStrings(): Promise<AppStrings> {
  const overrides = await cachedOverrides();
  return applyOverrides(strings, overrides);
}
