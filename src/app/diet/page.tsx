import { redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/auth/current-user";
import { loadDietCatalog, loadNutritionStartDate } from "@/lib/diet/config";
import { findDueRecap, loadDietLog } from "@/lib/diet/repository";
import { loadPlayerFoods } from "@/lib/diet/personal-foods-repository";
import { todayKey } from "@/lib/diet/dates";
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
  const [catalog, draft, personalFoods, nutritionStart] = await Promise.all([
    loadDietCatalog(),
    loadDietLog(player.id, dateKey),
    loadPlayerFoods(player.id),
    loadNutritionStartDate(),
  ]);
  const recap = await findDueRecap(player.id, dateKey, nutritionStart);

  return (
    <DietEntry
      playerName={player.displayName}
      initialDate={dateKey}
      initialDraft={draft}
      catalog={catalog}
      initialPersonalFoods={personalFoods}
      nutritionStart={nutritionStart}
      recap={recap}
    />
  );
}
