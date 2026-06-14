"use client";
import { useState } from "react";
import { resyncCurrentMonthAction } from "@/lib/sheets/actions";

export default function SyncButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const sync = async () => {
    setBusy(true);
    setMsg(null);
    const res = await resyncCurrentMonthAction();
    setMsg(res.ok ? res.message : res.error);
    setBusy(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={sync}
        disabled={busy}
        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
      >
        {busy ? "Syncing…" : "Sync this month to Google Sheet"}
      </button>
      {msg && <span className="text-[11px] text-gray-600">{msg}</span>}
    </div>
  );
}
