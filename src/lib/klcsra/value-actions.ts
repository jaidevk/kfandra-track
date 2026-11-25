"use server";

import { revalidatePath } from "next/cache";
import { getCurrentPlayer, type CurrentPlayer } from "@/lib/auth/current-user";
import { canReopenMatch } from "./access";
import type { ActionResult } from "./actions";
import * as repo from "./repository";
import * as vrepo from "./value-repository";
import { parseAmount, parseKlcName, parseNote } from "./value-input";
import type { Season } from "./types";

/**
 * KFANDRA-only writes for the KLC register (spec 2026-11-22 §4). Each one
 * re-resolves the caller, checks `canReopenMatch` (KFANDRA or super_admin),
 * writes with the service role and appends to audit_log.
 */

const NOT_SIGNED_IN = "You must be signed in.";
const NOT_KFANDRA = "Only KFANDRA can change the register.";
const NO_SEASON = "Season not found.";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const OK: ActionResult = { ok: true, data: undefined };

function failed(e: unknown, fallback: string): ActionResult<never> {
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

function revalidateValues(): void {
  revalidatePath("/admin/klc/register");
  revalidatePath("/klc/league");
  revalidatePath("/klc/league/values", "layout");
}

async function requireKfandra(): Promise<ActionResult<CurrentPlayer>> {
  const player = await getCurrentPlayer();
  if (!player) return { ok: false, error: NOT_SIGNED_IN };
  if (!canReopenMatch(player)) return { ok: false, error: NOT_KFANDRA };
  return { ok: true, data: player };
}

async function findSeason(seasonId: string): Promise<Season | null> {
  return (await repo.listSeasons()).find((s) => s.id === seasonId) ?? null;
}

export async function setBaseValueAction(
  seasonId: string, playerId: string, raw: string,
): Promise<ActionResult> {
  const auth = await requireKfandra();
  if (!auth.ok) return auth;
  const value = parseAmount(raw);
  if (value === null || value < 0) return { ok: false, error: "Enter a value of 0 or more, up to 2 decimals." };
  try {
    if (!(await findSeason(seasonId))) return { ok: false, error: NO_SEASON };
    const from = await vrepo.getBaseValue(seasonId, playerId);
    if (from === value) return OK;
    await vrepo.upsertBaseValue(seasonId, playerId, value, auth.data.id);
    await repo.writeAudit({
      actorPlayerId: auth.data.id, action: "klc.base_value", entityType: "player", entityId: playerId,
      diff: { seasonId, from, to: value },
    });
    revalidateValues();
    return OK;
  } catch (e) {
    return failed(e, "Failed to save the base value.");
  }
}

export async function setKlcNameAction(playerId: string, raw: string): Promise<ActionResult> {
  const auth = await requireKfandra();
  if (!auth.ok) return auth;
  const parsed = parseKlcName(raw);
  if (!parsed.ok) return { ok: false, error: "Keep the name to 60 characters." };
  try {
    const from = await vrepo.getKlcName(playerId);
    if (from === parsed.value) return OK;
    await vrepo.setKlcName(playerId, parsed.value);
    await repo.writeAudit({
      actorPlayerId: auth.data.id, action: "klc.klc_name", entityType: "player", entityId: playerId,
      diff: { from, to: parsed.value },
    });
    revalidateValues();
    return OK;
  } catch (e) {
    return failed(e, "Failed to save the name.");
  }
}

export async function addValueChangeAction(
  seasonId: string, playerId: string, effectiveDate: string, rawAmount: string, rawNote: string,
): Promise<ActionResult> {
  const auth = await requireKfandra();
  if (!auth.ok) return auth;
  const amount = parseAmount(rawAmount);
  if (amount === null || amount === 0) return { ok: false, error: "Enter a plus or minus amount, not 0." };
  const note = parseNote(rawNote);
  if (note === null) return { ok: false, error: "Add a short note (up to 200 characters)." };
  if (!DATE_RE.test(effectiveDate ?? "")) return { ok: false, error: "Pick a valid date." };
  try {
    const season = await findSeason(seasonId);
    if (!season) return { ok: false, error: NO_SEASON };
    if (effectiveDate < season.startDate || (season.endDate !== null && effectiveDate > season.endDate)) {
      return { ok: false, error: "Pick a date inside the season." };
    }
    const id = await vrepo.insertValueChange({
      seasonId, playerId, effectiveDate, amount, note, by: auth.data.id,
    });
    await repo.writeAudit({
      actorPlayerId: auth.data.id, action: "klc.value_change", entityType: "klc_player_value_change",
      entityId: id, diff: { seasonId, playerId, effectiveDate, amount, note },
    });
    revalidateValues();
    return OK;
  } catch (e) {
    return failed(e, "Failed to add the change.");
  }
}

export async function voidValueChangeAction(changeId: string, rawNote: string): Promise<ActionResult> {
  const auth = await requireKfandra();
  if (!auth.ok) return auth;
  const note = parseNote(rawNote);
  if (note === null) return { ok: false, error: "Say why you are voiding it." };
  try {
    const c = await vrepo.getValueChange(changeId);
    if (!c) return { ok: false, error: "Change not found." };
    if (c.voidedAt !== null) return { ok: false, error: "That change is already voided." };
    await vrepo.voidValueChange(changeId, auth.data.id, note);
    await repo.writeAudit({
      actorPlayerId: auth.data.id, action: "klc.value_change_void", entityType: "klc_player_value_change",
      entityId: changeId, diff: { note },
    });
    revalidateValues();
    return OK;
  } catch (e) {
    return failed(e, "Failed to void the change.");
  }
}
