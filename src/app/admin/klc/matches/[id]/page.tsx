import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentPlayer } from "@/lib/auth/current-user";
import { loadSportStats, loadStatRates } from "@/lib/klcsra/config";
import { computePlayerPayout } from "@/lib/klcsra/payouts";
import { getMatch, listActiveMembers, listClubs } from "@/lib/klcsra/repository";
import { statsForSport } from "@/lib/klcsra/sport-stats";
import type { StatKey, StatRates } from "@/lib/klcsra/stat-rates";
import type { MatchDraft, PayoutLine, SideKey } from "@/lib/klcsra/types";
import { PhaseNotice } from "../notice";
import { MatchRecorder } from "./match-recorder";

export const dynamic = "force-dynamic";

/**
 * The same composition `submitMatchAction` performs, run for display so the
 * recorder can show a running total while the match is still a draft — and so
 * a submitted match still shows its numbers after a reload (Phase 2 stores no
 * totals anywhere; Phase 5 lands them on the balance sheet).
 *
 * A player earns independently in each half, so the halves are scored
 * separately and then added — never merged first.
 */
function payoutPreview(
  match: MatchDraft,
  rates: StatRates,
  allowed: readonly StatKey[],
): PayoutLine[] {
  const firstHalf = match.halves.find((h) => h.halfNo === 1) ?? match.halves[0];
  const clubBySide = new Map<SideKey, string | null>();
  for (const s of firstHalf?.sides ?? []) clubBySide.set(s.side, s.clubName);

  return match.appearances.map((a) => {
    let kr = 0;
    let mmg = 0;
    for (const counts of Object.values(a.stats)) {
      const p = computePlayerPayout(counts, rates, {
        includeKR: !match.isFriendly,
        allowed,
      });
      kr += p.kr;
      mmg += p.mmg;
    }
    return {
      playerId: a.playerId,
      displayName: a.displayName,
      side: a.side,
      clubName: clubBySide.get(a.side) ?? null,
      kr,
      mmg,
    };
  });
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [match, clubs, members, player, rates, sportStats] = await Promise.all([
    getMatch(id),
    listClubs(),
    listActiveMembers(),
    getCurrentPlayer(),
    loadStatRates(),
    loadSportStats(),
  ]);
  if (!match) notFound();

  const allowedStats = statsForSport(match.sport, sportStats);
  const canReopen = player?.role === "super_admin" || player?.role === "kfandra";

  return (
    <div className="space-y-4">
      <Link href="/admin/klc/matches" className="text-[12px] text-gray-600 hover:underline">
        ← All matches
      </Link>
      <PhaseNotice />
      <MatchRecorder
        match={match}
        clubs={clubs}
        members={members}
        allowedStats={allowedStats}
        preview={payoutPreview(match, rates, allowedStats)}
        canReopen={canReopen}
      />
    </div>
  );
}
