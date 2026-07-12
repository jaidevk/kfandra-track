import { redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/auth/current-user";
import { loadScoringConfig } from "@/lib/mmg/config";
import { loadMmgEntry } from "@/lib/mmg/repository";
import {
  getOrCreateSession,
  listRecentSessions,
  mostRecentSessionDay,
  type SessionRow,
} from "@/lib/mmg/sessions";
import type { GameTypeKey } from "@/lib/mmg/types";
import { Breadcrumb } from "@/components/breadcrumb";
import MmgEntry from "./mmg-entry";

/**
 * MMG session entry. Server component: resolves the player, the default
 * session day (most recent Tue/Thu/Sat), the scoring config and the player's
 * existing draft, then hands everything to the client form which autosaves.
 */
export default async function MmgPage() {
  const player = await getCurrentPlayer();
  if (!player) redirect("/login?next=/mmg");

  const dateKey = mostRecentSessionDay();
  const [session, { config, gameTypes }, recent] = await Promise.all([
    getOrCreateSession(dateKey),
    loadScoringConfig(),
    listRecentSessions(8),
  ]);

  if (!session) {
    // Should never happen — mostRecentSessionDay always returns a session day.
    redirect("/");
  }

  const gameTypeKeyById: Record<string, GameTypeKey> = {};
  for (const g of gameTypes) gameTypeKeyById[g.id] = g.key;

  const draft = await loadMmgEntry(player.id, session.id, { gameTypeKeyById });

  // Ensure the current session appears in the picker even if just created.
  const sessions: SessionRow[] = recent.some((s) => s.id === session.id)
    ? recent
    : [session, ...recent];

  return (
    <>
      <Breadcrumb label="MMG" />
      <MmgEntry
        playerName={player.displayName}
        initialSession={session}
        initialDraft={draft}
        config={config}
        gameTypes={gameTypes}
        sessions={sessions}
      />
    </>
  );
}
