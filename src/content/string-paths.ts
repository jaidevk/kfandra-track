import { strings, type AppStrings } from "./strings";

/** Recursively enumerate dot-paths to every string leaf. */
function collect(obj: unknown, prefix = ""): string[] {
  if (typeof obj === "string") return [prefix];
  if (obj && typeof obj === "object") {
    return Object.entries(obj).flatMap(([k, v]) =>
      collect(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [];
}

/** All editable label paths (every string leaf in strings.ts). */
export const EDITABLE_PATHS: readonly string[] = collect(strings);

export function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (acc, k) =>
      acc && typeof acc === "object"
        ? (acc as Record<string, unknown>)[k]
        : undefined,
    obj,
  );
}

/** Immutably set a leaf by dot-path, returning a deep-cloned object. */
export function setByPath<T>(obj: T, path: string, value: string): T {
  const clone: unknown = structuredClone(obj);
  const keys = path.split(".");
  let cur = clone as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]] as Record<string, unknown>;
  cur[keys[keys.length - 1]] = value;
  return clone as T;
}

/** Pure: apply a {path: value} map onto a copy of the defaults. */
export function applyOverrides(
  base: AppStrings,
  overrides: Record<string, string>,
): AppStrings {
  let out = base;
  for (const [path, value] of Object.entries(overrides)) {
    if (typeof getByPath(out, path) === "string") out = setByPath(out, path, value);
  }
  return out;
}
