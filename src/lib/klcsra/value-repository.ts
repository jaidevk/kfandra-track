import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadValueRules } from "./config";
import { listCountedMatches } from "./league-repository";
import { computePlayerValues, type PlayerValue, type RegisterPlayer, type ValueChange } from "./player-values";
import { buildRegister, playersWithoutClub, type RegisterPerson } from "./register";
import type { Season } from "./types";

/**
 * Reads and writes for the KLC register and value changes (spec 2026-11-22 §4).
 * Service role. Writes are called only from value-actions.ts, which checks
 * KFANDRA first. Every function throws on a DB error.
 */

export async function listRegister(seasonId: string): Promise<RegisterPlayer[]> {
  const admin = createAdminClient();
  const [clubs, bases] = await Promise.all([
    admin.from("clubs").select("id, name, sort_order, manager_player_id")
      .eq("is_active", true).not("manager_player_id", "is", null),
    admin.from("klc_player_base_values").select("player_id, base_value").eq("season_id", seasonId),
  ]);
  if (clubs.error) throw new Error(`Failed to load the clubs: ${clubs.error.message}`);
  if (bases.error) throw new Error(`Failed to load the base values: ${bases.error.message}`);

  const ids = [...new Set((clubs.data ?? []).map((c) => c.manager_player_id as string))];
  const people = ids.length === 0
    ? { data: [], error: null }
    : await admin.from("players").select("id, display_name, klc_name").in("id", ids);
  if (people.error) throw new Error(`Failed to load the players: ${people.error.message}`);

  return buildRegister(
    (clubs.data ?? []).map((c) => ({
      id: c.id, name: c.name, sortOrder: c.sort_order, managerPlayerId: c.manager_player_id as string,
    })),
    (people.data ?? []).map((p) => ({ id: p.id, displayName: p.display_name, klcName: p.klc_name })),
    (bases.data ?? []).map((b) => ({ playerId: b.player_id, baseValue: Number(b.base_value) })),
  );
}

/** Every change for the season, voided ones included, oldest first. */
export async function listValueChanges(seasonId: string): Promise<ValueChange[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("klc_player_value_changes")
    .select("id, player_id, effective_date, amount, note, created_at, voided_at, void_note")
    .eq("season_id", seasonId)
    .order("effective_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load the value changes: ${error.message}`);
  return (data ?? []).map((c) => ({
    id: c.id, playerId: c.player_id, effectiveDate: c.effective_date, amount: Number(c.amount),
    note: c.note, createdAt: c.created_at, voidedAt: c.voided_at, voidNote: c.void_note,
  }));
}

/** The register, the season's changes and everyone's values, from one place. */
export async function loadSeasonValues(season: Season): Promise<{
  register: RegisterPlayer[]; changes: ValueChange[]; values: PlayerValue[];
}> {
  const [register, changes, rules, matches] = await Promise.all([
    listRegister(season.id), listValueChanges(season.id), loadValueRules(), listCountedMatches(season),
  ]);
  return { register, changes, values: computePlayerValues({ players: register, matches, changes, rules }) };
}

/** Active players who manage no active club, for their official names. */
export async function listPlayersWithoutClub(register: RegisterPlayer[]): Promise<RegisterPerson[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("players").select("id, display_name, klc_name").eq("is_active", true);
  if (error) throw new Error(`Failed to load the players: ${error.message}`);
  return playersWithoutClub(
    (data ?? []).map((p) => ({ id: p.id, displayName: p.display_name, klcName: p.klc_name })),
    register,
  );
}

export async function getBaseValue(seasonId: string, playerId: string): Promise<number | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("klc_player_base_values").select("base_value")
    .eq("season_id", seasonId).eq("player_id", playerId).maybeSingle();
  if (error) throw new Error(`Failed to load the base value: ${error.message}`);
  return data ? Number(data.base_value) : null;
}

export async function upsertBaseValue(
  seasonId: string, playerId: string, value: number, by: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("klc_player_base_values").upsert({
    season_id: seasonId, player_id: playerId, base_value: value,
    updated_by: by, updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(`Failed to save the base value: ${error.message}`);
}

export async function getKlcName(playerId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("players").select("klc_name").eq("id", playerId).maybeSingle();
  if (error) throw new Error(`Failed to load the player: ${error.message}`);
  return data?.klc_name ?? null;
}

export async function setKlcName(playerId: string, name: string | null): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("players").update({ klc_name: name }).eq("id", playerId);
  if (error) throw new Error(`Failed to save the name: ${error.message}`);
}

export async function insertValueChange(c: {
  seasonId: string; playerId: string; effectiveDate: string; amount: number; note: string; by: string;
}): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("klc_player_value_changes").insert({
    season_id: c.seasonId, player_id: c.playerId, effective_date: c.effectiveDate,
    amount: c.amount, note: c.note, created_by: c.by,
  }).select("id").single();
  if (error) throw new Error(`Failed to add the change: ${error.message}`);
  return data.id;
}

export async function getValueChange(id: string): Promise<{ id: string; voidedAt: string | null } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("klc_player_value_changes")
    .select("id, voided_at").eq("id", id).maybeSingle();
  if (error) throw new Error(`Failed to load the change: ${error.message}`);
  return data ? { id: data.id, voidedAt: data.voided_at } : null;
}

export async function voidValueChange(id: string, by: string, note: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("klc_player_value_changes")
    .update({ voided_at: new Date().toISOString(), voided_by: by, void_note: note })
    .eq("id", id).is("voided_at", null);
  if (error) throw new Error(`Failed to void the change: ${error.message}`);
}
