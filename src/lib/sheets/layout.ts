/**
 * Pure layout for the MMG points export sheet. No I/O — given the month's
 * sessions, the player roster, and each player's per-session total, it produces
 * the 2D cell grid the app writes to that month's tab. Unit-testable.
 */

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Tab title for a month, e.g. (2026, 6) -> "Jun 2026". */
export function monthTabTitle(year: number, month: number): string {
  return `${MONTHS[month - 1] ?? "?"} ${year}`;
}

/** Compact column header for a session date, e.g. "2026-06-02" -> "Tue 2/6". */
export function sessionColumnLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
  return `${wd} ${d.getDate()}/${d.getMonth() + 1}`;
}

export type SheetSession = { id: string; date: string };
export type SheetPlayer = { id: string; displayName: string };

/**
 * Build the full grid for a month tab:
 *   row 0:  ["", "PLAYERS", <date cols...>, "TOTAL"]
 *   row i:  [i, name, <per-session totals...>, rowTotal]
 * Sessions are laid out in chronological order; missing entries are 0.
 */
export function buildSheetMatrix(
  sessions: SheetSession[],
  players: SheetPlayer[],
  totals: Record<string, Record<string, number>>,
): (string | number)[][] {
  const ordered = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const header: (string | number)[] = [
    "",
    "PLAYERS",
    ...ordered.map((s) => sessionColumnLabel(s.date)),
    "TOTAL",
  ];

  const rows = players.map((p, i) => {
    const perSession = ordered.map((s) => totals[s.id]?.[p.id] ?? 0);
    const rowTotal = perSession.reduce((a, b) => a + b, 0);
    return [i + 1, p.displayName, ...perSession, rowTotal];
  });

  return [header, ...rows];
}
