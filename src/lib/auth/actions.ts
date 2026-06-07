"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logServerError } from "@/lib/observability/log";
import { normalizePhone } from "./phone";
import { isValidPin, hashPin, verifyPin } from "./pin";
import { setSessionCookie, clearSessionCookie } from "./cookie";

/**
 * Phone + 4-digit PIN auth server actions. Self-register with NO approval gate
 * (internal-only club app). All DB access uses the service-role admin client
 * (RLS-bypassing) and is scoped explicitly here.
 *
 * Shaped for React's useActionState: (prevState, formData) => AuthResult.
 */

export type AuthResult =
  | { ok: true; playerId: string; role: string; isNew: boolean }
  | { ok: false; error: string };

const NAME_MAX = 40;
// Deliberately generic so we never reveal whether a phone is registered.
const BAD_CREDENTIALS = "Invalid phone number or PIN.";

export async function registerAction(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const name = String(formData.get("name") ?? "").trim();
  const phoneRaw = String(formData.get("phone") ?? "");
  const pin = String(formData.get("pin") ?? "");

  if (name.length < 1) return { ok: false, error: "Please enter your name." };
  if (name.length > NAME_MAX) {
    return { ok: false, error: `Name must be ${NAME_MAX} characters or fewer.` };
  }

  const phone = normalizePhone(phoneRaw);
  if (!phone) {
    return { ok: false, error: "Enter a valid 10-digit mobile number." };
  }
  if (!isValidPin(pin)) {
    return { ok: false, error: "PIN must be exactly 4 digits." };
  }

  const admin = createAdminClient();

  const { data: existing, error: lookupError } = await admin
    .from("players")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();
  if (lookupError) {
    // No phone/PIN in context — keep PII out of logs.
    logServerError("register.lookup_failed", lookupError);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  if (existing) {
    return {
      ok: false,
      error: "That number is already registered. Try signing in instead.",
    };
  }

  const pinHash = await hashPin(pin);
  const { data: created, error: insertError } = await admin
    .from("players")
    .insert({ display_name: name, phone, pin_hash: pinHash })
    .select("id, display_name, role")
    .single();

  if (insertError || !created) {
    // 23505 = unique violation (race on duplicate phone).
    if (insertError?.code === "23505") {
      return {
        ok: false,
        error: "That number is already registered. Try signing in instead.",
      };
    }
    logServerError("register.insert_failed", insertError ?? "no row returned");
    return { ok: false, error: "Could not create your account. Please try again." };
  }

  await setSessionCookie({
    playerId: created.id,
    role: created.role,
    name: created.display_name,
  });
  return { ok: true, playerId: created.id, role: created.role, isNew: true };
}

export async function loginAction(
  _prev: AuthResult | null,
  formData: FormData,
): Promise<AuthResult> {
  const phoneRaw = String(formData.get("phone") ?? "");
  const pin = String(formData.get("pin") ?? "");

  const phone = normalizePhone(phoneRaw);
  if (!phone || !isValidPin(pin)) {
    return { ok: false, error: BAD_CREDENTIALS };
  }

  const admin = createAdminClient();
  const { data: player, error } = await admin
    .from("players")
    .select("id, display_name, role, pin_hash, is_active")
    .eq("phone", phone)
    .maybeSingle();

  if (error) {
    logServerError("login.lookup_failed", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  if (!player) return { ok: false, error: BAD_CREDENTIALS };

  const pinOk = await verifyPin(pin, player.pin_hash);
  if (!pinOk) return { ok: false, error: BAD_CREDENTIALS };

  if (!player.is_active) {
    return { ok: false, error: "This account is disabled. Contact KFANDRA." };
  }

  await setSessionCookie({
    playerId: player.id,
    role: player.role,
    name: player.display_name,
  });
  return { ok: true, playerId: player.id, role: player.role, isNew: false };
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
}
