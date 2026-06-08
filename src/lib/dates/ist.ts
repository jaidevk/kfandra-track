/**
 * IST (Asia/Kolkata) date anchoring.
 *
 * The club is in Pune, so "today" and "is it a session day?" must always be
 * judged in India Standard Time — never in the runtime's local wall clock.
 * That distinction matters because this runs in two places that are NOT in IST:
 *
 *   - Server: Vercel functions run in UTC. Between IST midnight and 05:30 the
 *     UTC clock still reads the previous calendar day, so a naive server would
 *     open yesterday's date (and mis-judge Tue/Thu/Sat session days).
 *   - Client: a player travelling, or a laptop with the wrong timezone, would
 *     otherwise resolve "today" to wherever they physically are.
 *
 * Anchoring everything to Asia/Kolkata makes the default date deterministic and
 * identical on server and client. There is intentionally NO `server-only` here:
 * the gym entry screen (a client component) also needs the IST "today".
 *
 * Implementation note: we format via Intl with `timeZone: "Asia/Kolkata"`. The
 * `en-CA` locale renders dates as `YYYY-MM-DD`, which is exactly our date-key
 * shape, so no manual reassembly (and no off-by-one) is needed.
 */

const IST_KEY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * The current IST calendar day as a `YYYY-MM-DD` date key, regardless of the
 * runtime's own timezone. Pass `now` to anchor to a specific instant (tests).
 */
export function istTodayKey(now: Date = new Date()): string {
  return IST_KEY_FORMAT.format(now);
}
