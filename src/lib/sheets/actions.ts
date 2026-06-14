"use server";
import { requireEditor } from "@/lib/auth/guard";
import { istTodayKey } from "@/lib/dates/ist";
import { exportMonth } from "./export";

export type SyncResult = { ok: true; message: string } | { ok: false; error: string };

/** Rebuild the current month's tab in the export sheet (editor-gated). */
export async function resyncCurrentMonthAction(): Promise<SyncResult> {
  try {
    await requireEditor();
    const [y, m] = istTodayKey().split("-").map(Number);
    const res = await exportMonth(y, m);
    if (!res.ok) return { ok: false, error: res.error };
    return {
      ok: true,
      message: `Synced ${res.tab}: ${res.players} players × ${res.sessions} sessions.`,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sync failed." };
  }
}
