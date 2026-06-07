import { redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/auth/current-user";
import { loadDietCatalog } from "@/lib/diet/config";
import { loadDietLog } from "@/lib/diet/repository";
import { todayKey } from "@/lib/diet/dates";
import DietEntry from "./diet-entry";

/**
 * Daily Diet log entry. Server component: resolves the player, today's date,
 * the admin-editable catalogue (meal slots + food list) and the player's
 * existing draft for today, then hands everything to the client form which
 * autosaves. Unscored, per-day, current-day only — no Finalize step.
 */
export default async function DietPage() {
  const player = await getCurrentPlayer();
  if (!player) redirect("/login?next=/diet");

  const dateKey = todayKey();
  const [catalog, draft] = await Promise.all([
    loadDietCatalog(),
    loadDietLog(player.id, dateKey),
  ]);

  return (
    <DietEntry
      playerName={player.displayName}
      initialDate={dateKey}
      initialDraft={draft}
      catalog={catalog}
    />
  );
}
