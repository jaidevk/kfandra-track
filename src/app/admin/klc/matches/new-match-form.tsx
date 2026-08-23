"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createMatchAction } from "@/lib/klcsra/actions";
import { SPORTS, SPORT_LABELS, type Sport } from "@/lib/klcsra/sport-stats";
import { ErrorNote } from "./notice";

/**
 * `today` is computed on the server and passed in: deriving it in the client
 * would hydrate a different value whenever the render straddles midnight.
 */
export function NewMatchForm({ today }: { today: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(today);
  const [sport, setSport] = useState<Sport>("football");
  const [isCombined, setCombined] = useState(false);
  const [isFriendly, setFriendly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    setError(null);
    const res = await createMatchAction({ entryDate: date, sport, isCombined, isFriendly });
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    // Stay busy across the navigation so the button cannot double-fire.
    startTransition(() => router.push(`/admin/klc/matches/${res.data}`));
  };

  return (
    <div
      data-testid="new-match-form"
      className="space-y-2 rounded-xl border border-gray-200 bg-white p-3"
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-600">New match</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          data-testid="new-match-date"
          aria-label="Match date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-gray-400 focus:outline-none"
        />
        <select
          data-testid="new-match-sport"
          aria-label="Sport"
          value={sport}
          onChange={(e) => setSport(e.target.value as Sport)}
          className="rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-gray-400 focus:outline-none"
        >
          {SPORTS.map((s) => (
            <option key={s} value={s}>
              {SPORT_LABELS[s]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-[12px] text-gray-700">
          <input
            type="checkbox"
            data-testid="new-match-combined"
            checked={isCombined}
            onChange={(e) => setCombined(e.target.checked)}
          />
          Combined
        </label>
        <label className="flex items-center gap-1 text-[12px] text-gray-700">
          <input
            type="checkbox"
            data-testid="new-match-friendly"
            checked={isFriendly}
            onChange={(e) => setFriendly(e.target.checked)}
          />
          Friendly
        </label>
        <button
          data-testid="new-match-submit"
          onClick={create}
          disabled={busy || pending}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          {busy || pending ? "Creating…" : "＋ New match"}
        </button>
      </div>
      <ErrorNote message={error} testId="new-match-error" />
    </div>
  );
}
