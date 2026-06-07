/**
 * Phone normalization for an India-based club. Players type a 10-digit Indian
 * mobile number (optionally with +91 / 91 / leading 0 and spaces or dashes).
 * We normalize to E.164 — "+91XXXXXXXXXX" — so the stored value is canonical
 * and the `players.phone` unique constraint dedupes regardless of formatting.
 *
 * V1 is India-only by design; widen here if the club ever needs other regions.
 */

/** Strip spaces, dashes, parens, dots. */
function stripFormatting(input: string): string {
  return input.replace(/[\s\-().]/g, "");
}

/**
 * Normalize a user-entered phone to E.164 (+91XXXXXXXXXX), or return null when
 * it is not a valid Indian mobile number. Indian mobiles are 10 digits and
 * start with 6, 7, 8, or 9.
 */
export function normalizePhone(input: string): string | null {
  if (!input) return null;
  let s = stripFormatting(input.trim());

  if (s.startsWith("+91")) s = s.slice(3);
  else if (s.startsWith("91") && s.length === 12) s = s.slice(2);
  else if (s.startsWith("0") && s.length === 11) s = s.slice(1);

  if (!/^[6-9]\d{9}$/.test(s)) return null;
  return `+91${s}`;
}

/** True when `input` normalizes to a valid Indian mobile number. */
export function isValidPhone(input: string): boolean {
  return normalizePhone(input) !== null;
}
