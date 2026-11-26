import { getCurrentPlayer } from "@/lib/auth/current-user";
import { canReopenMatch } from "@/lib/klcsra/access";
import { listSeasons } from "@/lib/klcsra/repository";
import { listPlayersWithoutClub, loadSeasonValues } from "@/lib/klcsra/value-repository";
import type { Season } from "@/lib/klcsra/types";
import RegisterAdmin from "./register-admin";

export const dynamic = "force-dynamic";

/** The active season, else the earliest upcoming one, else the newest. */
function defaultRegisterSeason(seasons: Season[]): Season | null {
  return seasons.find((s) => s.status === "active")
    ?? [...seasons].filter((s) => s.status === "upcoming").sort((a, b) => a.seasonNo - b.seasonNo)[0]
    ?? [...seasons].sort((a, b) => b.seasonNo - a.seasonNo)[0]
    ?? null;
}

/**
 * Admin › KLC › Register (spec 2026-11-22 §4). KFANDRA and super_admin only;
 * the admin layout lets staff in, so the page checks again. The actions check
 * on every write regardless.
 */
export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const player = await getCurrentPlayer();
  if (!player || !canReopenMatch(player)) {
    return <p data-testid="register-refused" className="text-sm text-gray-600">Only KFANDRA can open the register.</p>;
  }
  const { season: seasonParam } = await searchParams;
  const seasons = await listSeasons();
  const season = seasons.find((s) => s.id === seasonParam) ?? defaultRegisterSeason(seasons);
  if (!season) return <p className="text-sm text-gray-600">Create a season first.</p>;
  const { register, changes, values } = await loadSeasonValues(season);
  const others = await listPlayersWithoutClub(register);
  return (
    <RegisterAdmin seasons={seasons} season={season} register={register} changes={changes} values={values}
      others={others} />
  );
}
