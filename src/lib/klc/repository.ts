import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildBalanceDraft, type SheetRow, type ShareRowWithName } from "./mapping";
import type { ClubBalanceDraft, ClubSummary, MemberOption } from "./types";

function toSummary(c: {
  id: string; slug: string; name: string; manager_name: string;
  manager_player_id: string | null; logo_path: string;
}): ClubSummary {
  return {
    id: c.id, slug: c.slug, name: c.name,
    managerName: c.manager_name, managerPlayerId: c.manager_player_id,
    logoPath: c.logo_path,
  };
}

/** All active clubs, ordered for the landing grid. */
export async function listClubs(): Promise<ClubSummary[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("clubs")
    .select("id, slug, name, manager_name, manager_player_id, logo_path, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []).map(toSummary);
}

/** One club by id, or null. */
export async function getClub(clubId: string): Promise<ClubSummary | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("clubs")
    .select("id, slug, name, manager_name, manager_player_id, logo_path")
    .eq("id", clubId)
    .maybeSingle();
  return data ? toSummary(data) : null;
}

/** Active members available as loanee-picker options. */
export async function listActiveMembers(): Promise<MemberOption[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("players")
    .select("id, display_name")
    .eq("is_active", true)
    .order("display_name", { ascending: true });
  return (data ?? []).map((p) => ({ id: p.id, displayName: p.display_name }));
}

/** The club's current running draft (sheet + loanee rows with names). */
export async function loadClubBalance(clubId: string): Promise<ClubBalanceDraft> {
  const admin = createAdminClient();
  const [sheetRes, sharesRes] = await Promise.all([
    admin
      .from("club_balance_sheets")
      .select("as_of_date, matches_played, matches_won, matches_drawn, matches_lost, club_bonus")
      .eq("club_id", clubId)
      .maybeSingle(),
    admin
      .from("club_player_shares")
      .select("player_id, amount, players(display_name)")
      .eq("club_id", clubId),
  ]);

  const shares: ShareRowWithName[] = (sharesRes.data ?? []).map((r) => {
    // players(display_name) comes back as an object (to-one relation).
    const rel = r.players as unknown as { display_name: string } | null;
    return {
      player_id: r.player_id,
      amount: r.amount,
      display_name: rel?.display_name ?? "Unknown",
    };
  });
  return buildBalanceDraft((sheetRes.data as SheetRow | null) ?? null, shares);
}

/** Upsert the club's sheet and REPLACE its loanee rows wholesale. */
export async function saveClubBalance(
  clubId: string,
  draft: ClubBalanceDraft,
  updatedBy: string,
): Promise<void> {
  const admin = createAdminClient();

  const { error: sheetErr } = await admin.from("club_balance_sheets").upsert(
    {
      club_id: clubId,
      as_of_date: draft.asOfDate,
      matches_played: draft.matchesPlayed,
      matches_won: draft.matchesWon,
      matches_drawn: draft.matchesDrawn,
      matches_lost: draft.matchesLost,
      club_bonus: draft.clubBonus,
      updated_by: updatedBy,
    },
    { onConflict: "club_id" },
  );
  if (sheetErr) throw new Error(`Failed to save balance sheet: ${sheetErr.message}`);

  // Replace loanee rows: delete all, then insert current (deduped by player).
  await admin.from("club_player_shares").delete().eq("club_id", clubId);

  const byPlayer = new Map<string, number>();
  for (const s of draft.shares) {
    if (s.playerId) byPlayer.set(s.playerId, s.amount || 0);
  }
  const rows = [...byPlayer.entries()].map(([player_id, amount]) => ({
    club_id: clubId,
    player_id,
    amount,
  }));
  if (rows.length > 0) {
    const { error: shareErr } = await admin.from("club_player_shares").insert(rows);
    if (shareErr) throw new Error(`Failed to save loanee rows: ${shareErr.message}`);
  }
}
