import { STAT_KEYS, type StatKey, type StatRates } from "./stat-rates";

/** Per-stat event counts for one player (missing keys treated as 0). */
export type PlayerStatCounts = Partial<Record<StatKey, number>>;

/** A player's earned Kroopies (kr) and MMG points (mmg). */
export interface Payout {
  kr: number;
  mmg: number;
}

export interface PayoutOptions {
  /**
   * Friendlies pay MMG only. When false the returned `kr` is 0; `mmg` is
   * computed as normal. Defaults to true.
   */
  includeKR?: boolean;
  /**
   * Restrict scoring to this sport's allow-list (see `statsForSport`). Stats
   * outside it score nothing. Omit to score every known stat.
   */
  allowed?: readonly StatKey[];
}

/**
 * Pure. Sum count x rate across all known, allowed stats. Unknown keys are
 * ignored; so are keys the sport does not allow.
 */
export function computePlayerPayout(
  counts: PlayerStatCounts,
  rates: StatRates,
  opts: PayoutOptions = {},
): Payout {
  const { includeKR = true, allowed } = opts;
  const allowSet = allowed ? new Set<StatKey>(allowed) : null;

  let kr = 0;
  let mmg = 0;
  for (const key of STAT_KEYS) {
    if (allowSet && !allowSet.has(key)) continue;
    const n = counts[key];
    if (!n) continue;
    kr += n * rates[key].kr;
    mmg += n * rates[key].mmg;
  }
  return { kr: includeKR ? kr : 0, mmg };
}
