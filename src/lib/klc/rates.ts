/**
 * Pure rates model for the Club Balance Sheet (no DB / server-only imports so it
 * is safe to unit-test and to import from Client Components). The DB loader
 * lives in config.ts.
 */

/** Kroopies rates for the balance-sheet calculations (item 8/9/10). */
export interface KlcRates {
  playedToKfandra: number; // item 8 multiplier
  wonFromKfandra: number; // item 9 multiplier
  loaneePerShare: number; // item 10 multiplier
}

export const DEFAULT_KLC_RATES: KlcRates = {
  playedToKfandra: 10,
  wonFromKfandra: 20,
  loaneePerShare: 10,
};

/** Coerce a raw app_config JSON value into KlcRates with safe fallbacks. */
export function parseKlcRates(value: unknown): KlcRates {
  const v = (value ?? {}) as Record<string, unknown>;
  const num = (x: unknown, fallback: number) =>
    typeof x === "number" && Number.isFinite(x) ? x : fallback;
  return {
    playedToKfandra: num(v.playedToKfandra, DEFAULT_KLC_RATES.playedToKfandra),
    wonFromKfandra: num(v.wonFromKfandra, DEFAULT_KLC_RATES.wonFromKfandra),
    loaneePerShare: num(v.loaneePerShare, DEFAULT_KLC_RATES.loaneePerShare),
  };
}
