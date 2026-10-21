/**
 * Pure. Display formats for calendar dates stored as ISO `YYYY-MM-DD`.
 *
 * A date-only value is a calendar day, not an instant, so it is formatted in
 * UTC from its own parts: the result never shifts with the server's or the
 * browser's timezone.
 */

function utcDay(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** "Thu 27 Aug" — a day heading inside a season. */
export function fmtDay(iso: string): string {
  return utcDay(iso).toLocaleDateString("en-GB", {
    timeZone: "UTC", weekday: "short", day: "numeric", month: "short",
  });
}

/** "1 Aug 2026". */
export function fmtDate(iso: string): string {
  return utcDay(iso).toLocaleDateString("en-GB", {
    timeZone: "UTC", day: "numeric", month: "short", year: "numeric",
  });
}
