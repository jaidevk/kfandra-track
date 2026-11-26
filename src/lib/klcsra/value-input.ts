/** Pure parsing for the register's inputs. Columns are numeric(10,2). */

const AMOUNT_RE = /^-?\d+(\.\d{1,2})?$/;
const MAX = 99_999_999.99;

/** A Kroopies amount: up to 2 decimals, commas ignored. Null when invalid. */
export function parseAmount(raw: string): number | null {
  const s = (raw ?? "").replace(/,/g, "").trim();
  if (!AMOUNT_RE.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && Math.abs(n) <= MAX ? n : null;
}

export function parseKlcName(raw: string): { ok: true; value: string | null } | { ok: false } {
  const s = (raw ?? "").trim();
  if (s.length > 60) return { ok: false };
  return { ok: true, value: s === "" ? null : s };
}

export function parseNote(raw: string): string | null {
  const s = (raw ?? "").trim();
  return s.length >= 1 && s.length <= 200 ? s : null;
}
