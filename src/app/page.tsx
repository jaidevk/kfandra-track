import { getCurrentPlayer } from "@/lib/auth/current-user";
import { isStaffRole } from "@/lib/auth/roles";
import { canRecordMatches } from "@/lib/klcsra/access";
import { listManagedClubIds } from "@/lib/klcsra/repository";
import { logServerError } from "@/lib/observability/log";
import HomeScreen from "./home-screen";

export const dynamic = "force-dynamic";

export default async function Home() {
  const player = await getCurrentPlayer();
  const isStaff = player ? isStaffRole(player.role) : false;
  // Staff can always record; only a non-staff player needs the club lookup.
  let canRecord = isStaff;
  if (player && !isStaff) {
    try {
      canRecord = canRecordMatches(player, await listManagedClubIds(player.id));
    } catch (err) {
      // The home screen must render even if the club lookup fails; the
      // record link is a shortcut, so hide it rather than crash.
      logServerError("home.managed_clubs_failed", err, { playerId: player.id });
    }
  }
  return <HomeScreen isStaff={isStaff} canRecord={canRecord} />;
}
