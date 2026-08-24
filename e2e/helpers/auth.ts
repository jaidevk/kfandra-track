import type { Browser, BrowserContext, Page } from "@playwright/test";
import { hashPin } from "../../src/lib/auth/pin";
import { SESSION_COOKIE, createSessionToken } from "../../src/lib/auth/session";
import { E2E_PHONE_PREFIX, insertPlayer, type Role } from "./db";
import { requireEnv } from "./env";

/**
 * Signing in, without the login form.
 *
 * The app has no Supabase Auth: `getCurrentPlayer()` reads a `jose`-signed JWT
 * out of an httpOnly cookie and re-reads the player row on every request. So a
 * signed-in browser is exactly two things — a row in `players`, and that
 * cookie. Both are produced here with the app's OWN functions (`hashPin`,
 * `createSessionToken`) rather than reimplementations, so a change to either
 * breaks this helper loudly instead of letting the suite drift.
 *
 * Driving /login instead would add a page of form-filling to every spec and
 * test the login flow over and over; the login flow deserves its own spec.
 */

export type { Role };

export interface TestPlayer {
  id: string;
  displayName: string;
  phone: string;
  /** The real 4-digit PIN behind `pin_hash`, so a spec can drive /login if it wants. */
  pin: string;
  role: Role;
}

/** Every seeded player shares this PIN; the hash is computed once per worker. */
export const TEST_PIN = "1234";

let pinHashPromise: Promise<string> | null = null;
function testPinHash(): Promise<string> {
  // scrypt at N=16384 is ~100ms — seeding six players would pay it six times.
  pinHashPromise ??= hashPin(TEST_PIN);
  return pinHashPromise;
}

let seq = 0;
function nextPhone(): string {
  seq += 1;
  // Unique within and across workers: pid + a per-worker counter.
  const worker = String(process.pid % 100_000).padStart(5, "0");
  return `${E2E_PHONE_PREFIX}${worker}${String(seq).padStart(3, "0")}`;
}

const DEFAULT_NAMES: Record<Role, string> = {
  super_admin: "E2E Super",
  kfandra: "E2E KFANDRA",
  admin: "E2E Admin",
  user: "E2E Member",
};

/**
 * Insert a player with `role` and a working PIN hash.
 *
 * Clean up with `deleteSeededPlayers()` (or `resetKlcsraData()`), which matches
 * on the phone prefix this sets.
 */
export async function seedPlayer(
  role: Role,
  displayName: string = DEFAULT_NAMES[role],
): Promise<TestPlayer> {
  const phone = nextPhone();
  const id = await insertPlayer({
    displayName,
    role,
    phone,
    pinHash: await testPinHash(),
  });
  return { id, displayName, phone, pin: TEST_PIN, role };
}

/**
 * Give a browser context the session cookie for `player`.
 *
 * Calling it again with a different player REPLACES the cookie — which is how
 * a spec can prove that a server action re-resolves the caller instead of
 * trusting the page that rendered the button.
 */
export async function signIn(context: BrowserContext, player: TestPlayer): Promise<void> {
  // Fail loudly here rather than as a mystery redirect to /login.
  requireEnv("SESSION_SECRET");
  const token = await createSessionToken({
    playerId: player.id,
    role: player.role,
    name: player.displayName,
  });
  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value: token,
      // Domain + path rather than a url, so the helper does not need to know
      // which port playwright.config.ts is using.
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

/** Seed a player with `role` and sign `context` in as them. */
export async function signInAs(
  context: BrowserContext,
  role: Role,
  displayName?: string,
): Promise<TestPlayer> {
  const player = await seedPlayer(role, displayName);
  await signIn(context, player);
  return player;
}

/**
 * A second browser signed in as someone else — for the specs that need two
 * roles at once, or a stale tab. Close the returned context when done.
 */
export async function openAs(
  browser: Browser,
  role: Role,
  displayName?: string,
): Promise<{ context: BrowserContext; page: Page; player: TestPlayer }> {
  const context = await browser.newContext();
  const player = await signInAs(context, role, displayName);
  return { context, page: await context.newPage(), player };
}
