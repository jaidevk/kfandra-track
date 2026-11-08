/**
 * Pure. Goal/try times (spec §7, D12–D13): optional whole minutes, recorded by
 * the referee in official Fooba and Rugby Sox matches, shown next to the
 * scorer as "Caveman (12', 34')".
 */
import type { Sport } from "./sport-stats";
import type { StatKey } from "./stat-rates";
import type { AppearanceDraft, SideKey } from "./types";

export const TIMED_STATS: Partial<Record<Sport, readonly StatKey[]>> = {
  fooba: ["mainGoal", "reboundGoal"],
  rugby: ["try"],
};
export const MAX_MINUTE = 150;

/** Stats shown in the Scorers line. */
const SCORER_STATS: readonly StatKey[] = ["goal", "mainGoal", "reboundGoal", "try"];

export function isTimed(sport: Sport, statKey: StatKey, isFriendly: boolean): boolean {
  return !isFriendly && (TIMED_STATS[sport]?.includes(statKey) ?? false);
}

/** At most `count` entries, with trailing blanks dropped. */
export function trimTimes(times: readonly (number | null)[], count: number): (number | null)[] {
  const out = times.slice(0, Math.max(0, count));
  while (out.length > 0 && out[out.length - 1] === null) out.pop();
  return out;
}

/** Validated minutes (whole, 0..MAX_MINUTE, or null), or null when any entry is invalid. */
export function cleanTimes(raw: unknown): (number | null)[] | null {
  if (!Array.isArray(raw)) return null;
  const out: (number | null)[] = [];
  for (const v of raw) {
    if (v === null) out.push(null);
    else if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= MAX_MINUTE) out.push(v);
    else return null;
  }
  return out;
}

/** "Caveman ×2 (12', 34') · Acid": one team's scorers over the counted halves. */
export function scorersLine(
  appearances: readonly AppearanceDraft[],
  side: SideKey,
  halfNos: readonly number[],
): string {
  const rows: { text: string; first: number }[] = [];
  for (const a of appearances) {
    if (a.side !== side) continue;
    let count = 0;
    const mins: number[] = [];
    for (const h of halfNos) {
      for (const k of SCORER_STATS) {
        count += a.stats[h]?.[k] ?? 0;
        for (const t of a.times?.[h]?.[k] ?? []) if (t !== null) mins.push(t);
      }
    }
    if (count === 0) continue;
    mins.sort((x, y) => x - y);
    const times = mins.length > 0 ? ` (${mins.map((t) => `${t}'`).join(", ")})` : "";
    rows.push({
      text: `${a.displayName}${count > 1 ? ` ×${count}` : ""}${times}`,
      first: mins[0] ?? Number.POSITIVE_INFINITY,
    });
  }
  // Stable sort: untimed scorers keep squad order, after the timed ones.
  return rows.sort((x, y) => x.first - y.first).map((r) => r.text).join(" · ");
}
