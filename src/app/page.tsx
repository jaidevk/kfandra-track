import { getCurrentPlayer } from "@/lib/auth/current-user";
import { isStaffRole } from "@/lib/auth/roles";
import { canRecordMatches } from "@/lib/klcsra/access";
import { listManagedClubIds } from "@/lib/klcsra/repository";
import HomeScreen from "./home-screen";

export const dynamic = "force-dynamic";

export default async function Home() {
  const player = await getCurrentPlayer();
  const isStaff = player ? isStaffRole(player.role) : false;
  const canRecord = player
    ? canRecordMatches(player, await listManagedClubIds(player.id))
    : false;
  return <HomeScreen isStaff={isStaff} canRecord={canRecord} />;
}
