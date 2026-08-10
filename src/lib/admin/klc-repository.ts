import "server-only";
import { loadKlcRates } from "@/lib/klc/config";
import { aggregateOverview, computeClubTotals, type ClubOverview, type ClubTotals } from "@/lib/klc/compute";
import { getClub, listClubs, loadClubEntries } from "@/lib/klc/repository";
import type { ClubBalanceDraft, ClubSummary } from "@/lib/klc/types";

export interface AdminClubRow {
  club: ClubSummary;
  entryCount: number;
  hasData: boolean;
}

/** All clubs with a quick "does it have entries yet?" flag. */
export async function listClubsWithStatus(): Promise<AdminClubRow[]> {
  const clubs = await listClubs();
  return Promise.all(
    clubs.map(async (club) => {
      const entries = await loadClubEntries(club.id);
      return { club, entryCount: entries.length, hasData: entries.length > 0 };
    }),
  );
}

export interface AdminDatedEntry {
  draft: ClubBalanceDraft;
  totals: ClubTotals;
}

export interface AdminClubSheet {
  club: ClubSummary;
  overview: ClubOverview;
  entries: AdminDatedEntry[]; // newest first, each with its own date totals
}

/** Running overview + per-date breakdown for one club (read-only admin view). */
export async function getClubSheetForAdmin(clubId: string): Promise<AdminClubSheet | null> {
  const club = await getClub(clubId);
  if (!club) return null;
  const [entries, rates] = await Promise.all([loadClubEntries(clubId), loadKlcRates()]);
  return {
    club,
    overview: aggregateOverview(entries, rates),
    entries: entries.map((draft) => ({ draft, totals: computeClubTotals(draft, rates) })),
  };
}
