import { redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/auth/current-user";
import { loadGymCatalog } from "@/lib/gym/config";
import { loadGymLog } from "@/lib/gym/repository";
import { todayKey } from "@/lib/gym/dates";
import { Breadcrumb } from "@/components/breadcrumb";
import GymEntry from "./gym-entry";

/**
 * Gym log entry. Server component: resolves the player, today's date, the
 * admin-editable catalogue and the player's existing draft for today, then
 * hands everything to the client form which autosaves. Unscored, per-day.
 */
export default async function GymPage() {
  const player = await getCurrentPlayer();
  if (!player) redirect("/login?next=/gym");

  const dateKey = todayKey();
  const [catalog, draft] = await Promise.all([
    loadGymCatalog(),
    loadGymLog(player.id, dateKey),
  ]);

  return (
    <>
      <Breadcrumb label="Strength & Conditioning" />
      <GymEntry
        playerName={player.displayName}
        initialDate={dateKey}
        initialDraft={draft}
        catalog={catalog}
      />
    </>
  );
}
