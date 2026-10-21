import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/auth/current-user";
// The KLCSRA club option carries only the manager's NAME (free text). The KLC
// club repository already selects `manager_player_id`, so the recorder's
// "auto-place the manager in slot 1" is joined on from there rather than by
// adding anything to the (frozen) Phase 2 repository.
import { listClubs as listClubProfiles } from "@/lib/klc/repository";
import { canEditMatch, canReopenMatch, matchClubIds } from "@/lib/klcsra/access";
import { loadSportStats, loadStandingsRules, loadStatRates } from "@/lib/klcsra/config";
import {
  getActiveSeason,
  getMatch,
  listActiveMembers,
  listClubs,
  listManagedClubIds,
} from "@/lib/klcsra/repository";
import { statsForSport } from "@/lib/klcsra/sport-stats";
import { createAdminClient } from "@/lib/supabase/admin";
import { MatchRecorder } from "./match-recorder";
import type { RecorderClub } from "./recorder-shared";

export const dynamic = "force-dynamic";

/**
 * Who locked the match, for the audit line. `getMatch` does not return
 * `submitted_by` and Phase 2's repository is frozen, so it is read here — the
 * only consumer — and only for a match that is actually submitted.
 */
async function submitterName(matchId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("klc_matches")
    .select("submitted_by")
    .eq("id", matchId)
    .maybeSingle();
  if (!row?.submitted_by) return null;
  const { data: player } = await admin
    .from("players")
    .select("display_name")
    .eq("id", row.submitted_by)
    .maybeSingle();
  return player?.display_name ?? null;
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [match, clubs, clubProfiles, members, player, rates, sportStats, season, rules] =
    await Promise.all([
      getMatch(id),
      listClubs(),
      listClubProfiles(),
      listActiveMembers(),
      getCurrentPlayer(),
      loadStatRates(),
      loadSportStats(),
      getActiveSeason(),
      loadStandingsRules(),
    ]);
  if (!player) redirect(`/login?next=/klc/matches/${id}`);
  if (!match) notFound();
  const managed = await listManagedClubIds(player.id);
  const canEdit = canEditMatch(
    player,
    { createdBy: match.createdBy, clubIds: matchClubIds(match.halves) },
    managed,
  );
  // A draft is private to the people who may edit it; a submitted match is a
  // public record (read-only for everyone but its editors' Reopen path).
  if (match.status === "draft" && !canEdit) notFound();
  const canReopen = canReopenMatch(player);

  const managerByClub = new Map(clubProfiles.map((c) => [c.id, c.managerPlayerId]));
  const recorderClubs: RecorderClub[] = clubs.map((c) => ({
    ...c,
    managerPlayerId: managerByClub.get(c.id) ?? null,
  }));

  const allowedStats = statsForSport(match.sport, sportStats);
  const submittedBy = match.status === "submitted" ? await submitterName(match.id) : null;

  return (
    <div className="mx-auto max-w-md space-y-4 p-5 pb-24">
      <Link href={canEdit ? "/klc/matches" : "/klc/league?tab=matches"}
        className="block text-[12px] text-gray-600 hover:underline">
        ← {canEdit ? "All matches" : "KLC League"}
      </Link>
      <MatchRecorder
        match={match}
        clubs={recorderClubs}
        members={members}
        allowedStats={allowedStats}
        rates={rates}
        canReopen={canReopen}
        activeSeasonName={season?.name ?? null}
        submittedBy={submittedBy}
        rules={rules}
      />
    </div>
  );
}
