import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * `.env.local` is a Next.js convention — the Playwright process does not read
 * it. The auth helper mints session cookies with `SESSION_SECRET`, and the dev
 * server verifies them with the same variable, so the two MUST come from the
 * same file or every cookie we mint is silently rejected and the specs bounce
 * to /login.
 *
 * Values already present in `process.env` win, so CI can override without
 * editing the file.
 */

const ENV_FILE = path.join(__dirname, "..", "..", ".env.local");

let loaded = false;

export function loadLocalEnv(): void {
  if (loaded) return;
  loaded = true;

  let raw: string;
  try {
    raw = readFileSync(ENV_FILE, "utf8");
  } catch {
    // No .env.local (CI supplies the variables directly). Nothing to merge.
    return;
  }

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    process.env[key] = trimmed.slice(eq + 1).trim();
  }
}

/** Throw a message that names the fix, rather than failing deep inside jose. */
export function requireEnv(key: string): string {
  loadLocalEnv();
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing env ${key}. The E2E suite reads it from .env.local — run ` +
        "`npx supabase start` and make sure .env.local exists.",
    );
  }
  return value;
}
