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

/** Every dated entry for a club (newest first), each with its loanee rows. */
export async function loadClubEntries(clubId: string): Promise<ClubBalanceDraft[]> {
  const admin = createAdminClient();
  const [sheetsRes, sharesRes] = await Promise.all([
    admin
      .from("club_balance_sheets")
      .select("entry_date, matches_played, matches_won, matches_drawn, matches_lost, club_bonus")
      .eq("club_id", clubId)
      .order("entry_date", { ascending: false }),
    admin
      .from("club_player_shares")
      .select("entry_date, player_id, amount, players(display_name)")
      .eq("club_id", clubId),
  ]);

  const sharesByDate = new Map<string, ShareRowWithName[]>();
  for (const r of sharesRes.data ?? []) {
    // players(display_name) comes back as an object (to-one relation).
    const rel = r.players as unknown as { display_name: string } | null;
    const list = sharesByDate.get(r.entry_date) ?? [];
    list.push({
      player_id: r.player_id,
      amount: r.amount,
      display_name: rel?.display_name ?? "Unknown",
    });
    sharesByDate.set(r.entry_date, list);
  }

  return (sheetsRes.data ?? []).map((s) =>
    buildBalanceDraft(s as SheetRow, sharesByDate.get(s.entry_date as string) ?? []),
  );
}

/** Upsert one dated entry and REPLACE that date's loanee rows wholesale. */
export async function saveClubBalance(
  clubId: string,
  draft: ClubBalanceDraft,
  updatedBy: string,
): Promise<void> {
  if (!draft.asOfDate) {
    throw new Error("A date is required to save a balance entry.");
  }
  const entryDate = draft.asOfDate;
  const admin = createAdminClient();

  const { error: sheetErr } = await admin.from("club_balance_sheets").upsert(
    {
      club_id: clubId,
      entry_date: entryDate,
      matches_played: draft.matchesPlayed,
      matches_won: draft.matchesWon,
      matches_drawn: draft.matchesDrawn,
      matches_lost: draft.matchesLost,
      club_bonus: draft.clubBonus,
      updated_by: updatedBy,
    },
    { onConflict: "club_id,entry_date" },
  );
  if (sheetErr) throw new Error(`Failed to save balance sheet: ${sheetErr.message}`);

  // Replace this date's loanee rows: delete then insert (deduped by player).
  await admin
    .from("club_player_shares")
    .delete()
    .eq("club_id", clubId)
    .eq("entry_date", entryDate);

  const byPlayer = new Map<string, number>();
  for (const s of draft.shares) {
    if (s.playerId) byPlayer.set(s.playerId, s.amount || 0);
  }
  const rows = [...byPlayer.entries()].map(([player_id, amount]) => ({
    club_id: clubId,
    entry_date: entryDate,
    player_id,
    amount,
  }));
  if (rows.length > 0) {
    const { error: shareErr } = await admin.from("club_player_shares").insert(rows);
    if (shareErr) throw new Error(`Failed to save loanee rows: ${shareErr.message}`);
  }
}
