import type { KlcRates } from "./rates";
import type { ClubBalanceDraft } from "./types";

/** The three derived Kroopies totals (items 8, 9, 10). */
export interface ClubTotals {
  paidToKfandra: number; // item 8
  receivedFromKfandra: number; // item 9
  distributedToLoanees: number; // item 10
}

/** Pure. Derives items 8/9/10 for a single dated entry. Never stored. */
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

/** Running overview: summed counts across all dated entries + derived totals. */
export interface ClubOverview {
  entryCount: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesDrawn: number;
  matchesLost: number;
  clubBonus: number;
  loaneeTotal: number; // summed loanee numbers across dates
  totals: ClubTotals; // running Kroopies totals
}

/** Pure. Aggregate every dated entry into a single running overview. */
export function aggregateOverview(
  entries: ClubBalanceDraft[],
  rates: KlcRates,
): ClubOverview {
  const acc = {
    matchesPlayed: 0, matchesWon: 0, matchesDrawn: 0, matchesLost: 0,
    clubBonus: 0, loaneeTotal: 0,
  };
  for (const e of entries) {
    acc.matchesPlayed += e.matchesPlayed;
    acc.matchesWon += e.matchesWon;
    acc.matchesDrawn += e.matchesDrawn;
    acc.matchesLost += e.matchesLost;
    acc.clubBonus += e.clubBonus;
    acc.loaneeTotal += e.shares.reduce((s, x) => s + (x.amount || 0), 0);
  }
  return {
    entryCount: entries.length,
    ...acc,
    totals: {
      paidToKfandra: acc.matchesPlayed * rates.playedToKfandra,
      receivedFromKfandra: acc.matchesWon * rates.wonFromKfandra + acc.clubBonus,
      distributedToLoanees: acc.loaneeTotal * rates.loaneePerShare,
    },
  };
}
