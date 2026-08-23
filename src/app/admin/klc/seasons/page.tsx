import { getActiveSeason, listSeasons } from "@/lib/klcsra/repository";
import SeasonsAdmin from "./seasons-admin";

/**
 * Seasons admin — the first page KFANDRA touches.
 *
 * League Submit refuses without an ACTIVE season (`submitMatchAction`), and
 * seasons ship seeded as `upcoming`, so the page's main job is to make the
 * missing-active-season state impossible to miss.
 *
 * Staff gating comes from `src/app/admin/layout.tsx` (`requireStaff()`); the
 * season actions re-check it server-side anyway.
 */

export const dynamic = "force-dynamic";

export default async function SeasonsPage() {
  const [seasons, active] = await Promise.all([listSeasons(), getActiveSeason()]);
  return <SeasonsAdmin seasons={seasons} activeId={active?.id ?? null} />;
}
