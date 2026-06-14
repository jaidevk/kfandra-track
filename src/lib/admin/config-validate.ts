/** Pure validators for admin scoring edits (no I/O, unit-testable). */

export function validatePoints(raw: number): string | null {
  if (!Number.isInteger(raw)) return "Points must be a whole number.";
  if (raw < -100000 || raw > 100000) return "Points out of range.";
  return null;
}

export function validateGameTypeName(raw: string): string | null {
  const t = raw.trim();
  if (!t) return "Name cannot be empty.";
  if (t.length > 60) return "Name too long (max 60 characters).";
  return null;
}
