/**
 * Pure rules for the per-player "My foods" palette. The repository loads the
 * player's rows and uses these to enforce the cap; kept here so the eviction
 * policy is unit-tested and DB-free.
 */

/** Maximum personal foods kept per player. Adding a 9th evicts the least-used. */
export const MAX_PERSONAL_FOODS = 8;

/**
 * Pick which row to evict, or null if the list is within the cap. Eviction
 * policy: lowest use_count, ties broken by oldest last_used_at. A just-inserted
 * row (most recent last_used_at, count 1) therefore survives when other count-1
 * rows exist.
 */
export function selectEvicteeId(
  rows: { id: string; useCount: number; lastUsedAt: string }[],
): string | null {
  if (rows.length <= MAX_PERSONAL_FOODS) return null;
  let worst = rows[0];
  for (const r of rows) {
    const lower = r.useCount < worst.useCount;
    const tie =
      r.useCount === worst.useCount &&
      Date.parse(r.lastUsedAt) < Date.parse(worst.lastUsedAt);
    if (lower || tie) worst = r;
  }
  return worst.id;
}
