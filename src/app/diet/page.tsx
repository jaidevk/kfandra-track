import { redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/auth/current-user";
import { loadDietCatalog } from "@/lib/diet/config";
import { loadDietLog } from "@/lib/diet/repository";
import { loadPlayerFoods } from "@/lib/diet/personal-foods-repository";
import { todayKey } from "@/lib/diet/dates";
import { Breadcrumb } from "@/components/breadcrumb";
import DietEntry from "./diet-entry";

/**
 * Daily Diet log entry. Server component: resolves the player, today's date,
 * the admin-editable catalogue (meal slots + food list), the player's existing
 * draft for today, and their personal "My foods" palette, then hands everything
 * to the client form which autosaves. Unscored, per-day, current-day only.
 */
export default async function DietPage() {
  const player = await getCurrentPlayer();
  if (!player) redirect("/login?next=/diet");

  const dateKey = todayKey();
  const [catalog, draft, personalFoods] = await Promise.all([
    loadDietCatalog(),
    loadDietLog(player.id, dateKey),
    loadPlayerFoods(player.id),
  ]);

  return (
    <>
      <Breadcrumb label="Diet" />
      <DietEntry
        playerName={player.displayName}
        initialDate={dateKey}
        initialDraft={draft}
        catalog={catalog}
        initialPersonalFoods={personalFoods}
      />
    </>
  );
}
