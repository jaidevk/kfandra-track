import type { KlcRates } from "./rates";
import type { ClubBalanceDraft } from "./types";

/** The three derived Kroopies totals (items 8, 9, 10). */
export interface ClubTotals {
  paidToKfandra: number; // item 8
  receivedFromKfandra: number; // item 9
  distributedToLoanees: number; // item 10
}

/** Pure. Derives items 8/9/10 from the draft + rates. Never stored. */
export function computeClubTotals(
  draft: ClubBalanceDraft,
  rates: KlcRates,
): ClubTotals {
  const shareTotal = draft.shares.reduce((sum, s) => sum + (s.amount || 0), 0);
  return {
    paidToKfandra: draft.matchesPlayed * rates.playedToKfandra,
    receivedFromKfandra: draft.matchesWon * rates.wonFromKfandra + draft.clubBonus,
    distributedToLoanees: shareTotal * rates.loaneePerShare,
  };
}
