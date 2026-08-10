import "server-only";
import { loadKlcRates } from "@/lib/klc/config";
import { computeClubTotals, type ClubTotals } from "@/lib/klc/compute";
import { getClub, listClubs, loadClubBalance } from "@/lib/klc/repository";
import type { ClubBalanceDraft, ClubSummary } from "@/lib/klc/types";

export interface AdminClubRow {
  club: ClubSummary;
  loaneeCount: number;
  hasData: boolean;
}

/** All clubs with a quick "does it have entries yet?" flag. */
export async function listClubsWithStatus(): Promise<AdminClubRow[]> {
  const clubs = await listClubs();
  return Promise.all(
    clubs.map(async (club) => {
      const draft = await loadClubBalance(club.id);
      const hasData =
        draft.matchesPlayed > 0 || draft.matchesWon > 0 || draft.matchesDrawn > 0 ||
        draft.matchesLost > 0 || draft.clubBonus > 0 || draft.shares.length > 0;
      return { club, loaneeCount: draft.shares.length, hasData };
    }),
  );
}

export interface AdminClubSheet {
  club: ClubSummary;
  draft: ClubBalanceDraft;
  totals: ClubTotals;
}

/** Full sheet + totals for one club (read-only admin view). */
export async function getClubSheetForAdmin(clubId: string): Promise<AdminClubSheet | null> {
  const club = await getClub(clubId);
  if (!club) return null;
  const [draft, rates] = await Promise.all([loadClubBalance(clubId), loadKlcRates()]);
  return { club, draft, totals: computeClubTotals(draft, rates) };
}
