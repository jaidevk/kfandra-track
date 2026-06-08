/**
 * Date helpers for Gym logs. Unlike MMG sessions (Tue/Thu/Sat only), gym logs
 * can fall on any calendar day, so these are plain date-key utilities.
 */

import { istTodayKey } from "@/lib/dates/ist";

/** Format a Date as a local YYYY-MM-DD (no timezone shift). */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Today as a YYYY-MM-DD, anchored to IST (Asia/Kolkata) on server and client. */
export function todayKey(from: Date = new Date()): string {
  return istTodayKey(from);
}

/** Validate a YYYY-MM-DD string into a real calendar date. */
export function isValidDateKey(dateKey: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) return false;
  const [, y, mo, d] = m.map(Number);
  const date = new Date(y, mo - 1, d, 12, 0, 0);
  return (
    date.getFullYear() === y &&
    date.getMonth() === mo - 1 &&
    date.getDate() === d
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Human label for a date key, e.g. "Sat 7 June 2026". */
export function dateLabel(dateKey: string): string {
  const [y, mo, d] = dateKey.split("-").map(Number);
  const date = new Date(y, mo - 1, d, 12, 0, 0);
  return `${WEEKDAYS[date.getDay()]} ${d} ${MONTHS[mo - 1]} ${y}`;
}
