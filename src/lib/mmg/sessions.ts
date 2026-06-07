import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Session helpers. Training sessions fall on every Tue/Thu/Sat. Rather than
 * pre-seeding a year of dates, we derive a session's metadata from its date and
 * find-or-create rows on demand (sessions are deterministic and idempotent by
 * date — the unique constraint on session_date backstops races).
 */

export type Weekday = "Tue" | "Thu" | "Sat";

export interface SessionRow {
  id: string;
  session_date: string; // YYYY-MM-DD
  day_of_week: Weekday;
  month: number;
  year: number;
  label: string | null;
}

// JS getDay(): 0=Sun … 2=Tue, 4=Thu, 6=Sat.
const WEEKDAY_BY_DOW: Record<number, Weekday> = { 2: "Tue", 4: "Thu", 6: "Sat" };

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Format a Date as a local YYYY-MM-DD (no timezone shift). */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Derive session metadata for a date string, or null if it is not a session
 * day (not Tue/Thu/Sat).
 */
export function sessionMetaForDate(dateKey: string): Omit<SessionRow, "id"> | null {
  // Parse as local midday to avoid any DST/UTC edge flipping the weekday.
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d, 12, 0, 0);
  const weekday = WEEKDAY_BY_DOW[date.getDay()];
  if (!weekday) return null;

  return {
    session_date: dateKey,
    day_of_week: weekday,
    month: m,
    year: y,
    label: `${weekday} ${d} ${MONTH_NAMES[m - 1]} ${y}`,
  };
}

/** True if the given date string is a Tue/Thu/Sat session day. */
export function isSessionDay(dateKey: string): boolean {
  return sessionMetaForDate(dateKey) !== null;
}

/**
 * Fetch the session for a date, creating it if absent. Returns null only when
 * the date is not a valid session day.
 */
export async function getOrCreateSession(dateKey: string): Promise<SessionRow | null> {
  const meta = sessionMetaForDate(dateKey);
  if (!meta) return null;

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("sessions")
    .select("id, session_date, day_of_week, month, year, label")
    .eq("session_date", dateKey)
    .maybeSingle();
  if (existing) return existing as SessionRow;

  const { data: inserted, error } = await admin
    .from("sessions")
    .insert(meta)
    .select("id, session_date, day_of_week, month, year, label")
    .single();

  // Lost an insert race? Re-read the row the other writer created.
  if (error) {
    const { data: raced } = await admin
      .from("sessions")
      .select("id, session_date, day_of_week, month, year, label")
      .eq("session_date", dateKey)
      .maybeSingle();
    return (raced as SessionRow) ?? null;
  }

  return inserted as SessionRow;
}

/** Most-recent sessions (already created), newest first. */
export async function listRecentSessions(limit = 12): Promise<SessionRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("sessions")
    .select("id, session_date, day_of_week, month, year, label")
    .order("session_date", { ascending: false })
    .limit(limit);
  return (data as SessionRow[]) ?? [];
}

/** The most recent session day on or before `from` (defaults to today). */
export function mostRecentSessionDay(from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12);
  for (let i = 0; i < 7; i++) {
    const key = toDateKey(d);
    if (isSessionDay(key)) return key;
    d.setDate(d.getDate() - 1);
  }
  // Unreachable (every 7-day window contains a session day), but keep types happy.
  return toDateKey(from);
}
