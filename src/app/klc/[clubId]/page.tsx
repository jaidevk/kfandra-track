import { redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/auth/current-user";
import { isStaffRole } from "@/lib/auth/roles";
import { getClub, loadClubEntries, listActiveMembers } from "@/lib/klc/repository";
import { loadKlcRates } from "@/lib/klc/config";
import ClubBalanceEntry from "./club-balance-entry";

export const dynamic = "force-dynamic";

export default async function ClubPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  const player = await getCurrentPlayer();
  if (!player) redirect(`/login?next=/klc/${clubId}`);

  const club = await getClub(clubId);
  if (!club) redirect("/klc");

  const staff = isStaffRole(player.role);
  if (!staff && club.managerPlayerId !== player.id) redirect("/klc");

  const [entries, rates, members] = await Promise.all([
    loadClubEntries(clubId),
    loadKlcRates(),
    listActiveMembers(),
  ]);

  return (
    <ClubBalanceEntry
      clubId={clubId}
      club={club}
      initialEntries={entries}
      rates={rates}
      members={members}
    />
  );
}
