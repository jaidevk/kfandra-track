import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listPlayers,
  getSessionSubmissions,
} from "@/lib/admin/submissions-repository";
import { getSheetsConfig } from "./config";
import { createSheetsClient, type SheetsClient } from "./client";
import { monthTabTitle, buildSheetMatrix } from "./layout";

export type ExportResult =
  | { ok: true; sessions: number; players: number; tab: string }
  | { ok: false; error: string };

/** Sessions (id + date) for a given month. */
async function listMonthSessions(
  year: number,
  month: number,
): Promise<{ id: string; date: string }[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("sessions")
    .select("id, session_date")
    .eq("year", year)
    .eq("month", month)
    .order("session_date");
  return (data ?? []).map((s) => ({ id: s.id, date: s.session_date }));
}

/**
 * Rebuild one month's tab in the export spreadsheet from current data:
 * a player × session matrix of full totals (order + games), coach excluded.
 * `client` is injectable for tests. Returns a structured result; callers that
 * want best-effort behaviour should catch/ignore failures.
 */
export async function exportMonth(
  year: number,
  month: number,
  client?: SheetsClient,
): Promise<ExportResult> {
  const config = await getSheetsConfig();
  if (!config.enabled) return { ok: false, error: "Sheets export is disabled." };
  if (!config.spreadsheetId)
    return { ok: false, error: "No export spreadsheet configured." };

  const [sessions, players] = await Promise.all([
    listMonthSessions(year, month),
    listPlayers(),
  ]);

  const totals: Record<string, Record<string, number>> = {};
  for (const s of sessions) {
    const rows = await getSessionSubmissions(s.id);
    totals[s.id] = Object.fromEntries(rows.map((r) => [r.playerId, r.total]));
  }

  const title = monthTabTitle(year, month);
  const matrix = buildSheetMatrix(sessions, players, totals);
  const sheets = client ?? createSheetsClient();
  await sheets.ensureTab(config.spreadsheetId, title);
  await sheets.writeMatrix(config.spreadsheetId, title, matrix);

  return { ok: true, sessions: sessions.length, players: players.length, tab: title };
}

/** Best-effort export used by the finalize hook — never throws. */
export async function exportMonthBestEffort(year: number, month: number): Promise<void> {
  try {
    const res = await exportMonth(year, month);
    if (!res.ok) console.warn(`[jacaranda:sheets] skipped: ${res.error}`);
  } catch (e) {
    console.error("[jacaranda:error] sheets export failed", e);
  }
}

/** Best-effort export of the month a session belongs to. Never throws. */
export async function exportSessionMonthBestEffort(sessionId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("sessions")
      .select("year, month")
      .eq("id", sessionId)
      .maybeSingle();
    if (!data) return;
    await exportMonthBestEffort(data.year, data.month);
  } catch (e) {
    console.error("[jacaranda:error] sheets export (session) failed", e);
  }
}
