import { getCurrentPlayer } from "@/lib/auth/current-user";
import { isStaffRole } from "@/lib/auth/roles";
import HomeScreen from "./home-screen";

export const dynamic = "force-dynamic";

export default async function Home() {
  const player = await getCurrentPlayer();
  const isStaff = player ? isStaffRole(player.role) : false;
  return <HomeScreen isStaff={isStaff} />;
}
