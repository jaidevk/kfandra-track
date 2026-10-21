import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/auth/current-user";
import { isStaffRole } from "@/lib/auth/roles";
// The KLCSRA club option carries only the manager's NAME (free text). The KLC
// club repository already selects `manager_player_id`, so the recorder's
// "auto-place the manager in slot 1" is joined on from there rather than
// widening the KLCSRA `listClubs` shape for this one consumer.
import { listClubs as listClubProfiles } from "@/lib/klc/repository";
import {
  canEditMatch,
  canRecordMatches,
  canReopenMatch,
  matchClubIds,
} from "@/lib/klcsra/access";
import { loadSportStats, loadStandingsRules, loadStatRates } from "@/lib/klcsra/config";
import {
  getActiveSeason,
  getMatch,
  listActiveMembers,
  listClubs,
  listManagedClubIds,
} from "@/lib/klcsra/repository";
import { statsForSport } from "@/lib/klcsra/sport-stats";
import type { MatchDraft } from "@/lib/klcsra/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { MatchRecorder } from "./match-recorder";
import type { RecorderClub } from "./recorder-shared";

export const dynamic = "force-dynamic";

/**
 * Who locked the match, for the audit line. `getMatch` does not return
 * `submitted_by`, so it is read here (the only consumer) and only for a match
 * that is actually submitted, rather than widening `MatchDraft` for every
 * caller.
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

/** The clubs already on a match, as picker options (manager names left blank). */
function clubsOnMatch(match: MatchDraft): RecorderClub[] {
  const byId = new Map<string, RecorderClub>();
  for (const h of match.halves) {
    for (const s of h.sides) {
      if (s.clubId && !byId.has(s.clubId)) {
        byId.set(s.clubId, {
          id: s.clubId, name: s.clubName ?? "—", managerName: "", managerPlayerId: null,
        });
      }
    }
  }
  return [...byId.values()];
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Who is asking decides what else is worth reading, so resolve them first.
  const player = await getCurrentPlayer();
  if (!player) redirect(`/login?next=/klc/matches/${id}`);

  const [match, managed, rates, sportStats, season, rules] = await Promise.all([
    getMatch(id),
    listManagedClubIds(player.id),
    loadStatRates(),
    loadSportStats(),
    getActiveSeason(),
    loadStandingsRules(),
  ]);
  if (!match) notFound();
  const canEdit = canEditMatch(
    player,
    { createdBy: match.createdBy, clubIds: matchClubIds(match.halves) },
    managed,
  );
  // A draft is private to the people who may edit it; a submitted match is a
  // public record (read-only for everyone but its editors' Reopen path).
  if (match.status === "draft" && !canEdit) notFound();
  const canReopen = canReopenMatch(player);
  // The matches list is also open to a creator with a draft (no club needed).
  const showMatchesLink =
    canRecordMatches(player, managed) ||
    (match.status === "draft" && match.createdBy === player.id);

  // The pickers' option lists are only needed by an editor. A read-only viewer
  // (always a locked match) gets no member list, and clubs built from the
  // match's own sides, so each disabled club select still shows its club.
  let recorderClubs: RecorderClub[];
  let members: Awaited<ReturnType<typeof listActiveMembers>> = [];
  if (canEdit) {
    const [clubs, clubProfiles, activeMembers] = await Promise.all([
      listClubs(),
      listClubProfiles(),
      listActiveMembers(),
    ]);
    const managerByClub = new Map(clubProfiles.map((c) => [c.id, c.managerPlayerId]));
    recorderClubs = clubs.map((c) => ({
      ...c,
      managerPlayerId: managerByClub.get(c.id) ?? null,
    }));
    members = activeMembers;
  } else {
    recorderClubs = clubsOnMatch(match);
  }

  const allowedStats = statsForSport(match.sport, sportStats);
  const submittedBy = match.status === "submitted" ? await submitterName(match.id) : null;

  return (
    <div className="mx-auto max-w-md space-y-4 p-5 pb-24">
      <Link href={showMatchesLink ? "/klc/matches" : "/klc/league?tab=matches"}
        className="block text-[12px] text-gray-600 hover:underline">
        ← {showMatchesLink ? "All matches" : "KLC League"}
      </Link>
      <MatchRecorder
        match={match}
        clubs={recorderClubs}
        members={members}
        allowedStats={allowedStats}
        rates={rates}
        canReopen={canReopen}
        canEdit={canEdit}
        isStaff={isStaffRole(player.role)}
        managedClubIds={[...managed]}
        activeSeasonName={season?.name ?? null}
        submittedBy={submittedBy}
        rules={rules}
      />
    </div>
  );
}
