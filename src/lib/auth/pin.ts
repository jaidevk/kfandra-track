import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";
import { promisify } from "node:util";

/**
 * 4-digit PIN hashing for phone + PIN auth. Uses Node's scrypt (no external
 * dependency) with a per-PIN random salt. The stored format is:
 *
 *   scrypt$N$r$p$<saltB64>$<hashB64>
 *
 * so parameters travel with the hash and can be tuned later without breaking
 * existing rows. NEVER store the raw PIN.
 */

// promisify resolves to scrypt's no-options overload; re-type it so we can pass
// cost parameters.
const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options?: ScryptOptions,
) => Promise<Buffer>;

// scrypt cost params. N must be a power of two; these are interactive-fast.
const N = 16384;
const r = 8;
const p = 1;
const KEYLEN = 32;
const SALT_BYTES = 16;

/** True when `pin` is exactly four digits (0–9). */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/** Hash a 4-digit PIN into a self-describing scrypt string. */
export async function hashPin(pin: string): Promise<string> {
  if (!isValidPin(pin)) {
    throw new Error("PIN must be exactly 4 digits");
  }
  const salt = randomBytes(SALT_BYTES);
  const derived = (await scryptAsync(pin, salt, KEYLEN, { N, r, p })) as Buffer;
  return [
    "scrypt",
    N,
    r,
    p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

/**
 * Verify a PIN against a stored scrypt hash. Returns false (never throws) for
 * malformed input so callers can treat it as a plain auth failure. The compare
 * is constant-time.
 */
export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  if (!isValidPin(pin)) return false;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const nParam = Number(parts[1]);
  const rParam = Number(parts[2]);
  const pParam = Number(parts[3]);
  if (!nParam || !rParam || !pParam) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], "base64");
    expected = Buffer.from(parts[5], "base64");
  } catch {
    return false;
  }
  if (expected.length === 0) return false;

  const derived = (await scryptAsync(pin, salt, expected.length, {
    N: nParam,
    r: rParam,
    p: pParam,
  })) as Buffer;

  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
