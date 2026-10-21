"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { createMatchAction } from "@/lib/klcsra/actions";
import { SPORTS, SPORT_LABELS, type Sport } from "@/lib/klcsra/sport-stats";
import type { ClubOption } from "@/lib/klcsra/types";
import { ErrorNote } from "./notice";

/**
 * The one CTA on Screen 1. Combined is a checkbox here because it is fixed at
 * creation (the half rows are written by `createMatchAction`). Friendly is
 * chosen here too, but can be switched in the recorder header until submit.
 * A club manager also picks their own club, which becomes half 1's home side.
 * Everything else about a match is editable inside the recorder.
 *
 * `today` is computed on the server and passed in: deriving it in the client
 * would hydrate a different value whenever the render straddles midnight.
 */
export function NewMatchForm({ today, myClubs }: { today: string; myClubs: ClubOption[] }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(today);
  const [sport, setSport] = useState<Sport>("football");
  const [isCombined, setCombined] = useState(false);
  const [isFriendly, setFriendly] = useState(false);
  const [homeClubId, setHomeClubId] = useState(myClubs[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    setError(null);
    const res = await createMatchAction({
      entryDate: date, sport, isCombined, isFriendly,
      homeClubId: myClubs.length > 0 ? homeClubId : null,
    });
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    // Stay busy across the navigation so the button cannot double-fire.
    startTransition(() => router.push(`/klc/matches/${res.data}`));
  };

  const working = busy || pending;

  return (
    <div
      data-testid="new-match-form"
      data-hydrated={hydrated}
      className="space-y-2.5 rounded-xl border border-gray-200 bg-white p-3"
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-600">New match</p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          data-testid="new-match-date"
          aria-label="Match date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
        />
        <select
          data-testid="new-match-sport"
          aria-label="Sport"
          value={sport}
          onChange={(e) => setSport(e.target.value as Sport)}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
        >
          {SPORTS.map((s) => (
            <option key={s} value={s}>
              {SPORT_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {myClubs.length > 0 && (
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
            Your club (home side)
          </span>
          <select
            data-testid="new-match-club"
            aria-label="Your club"
            value={homeClubId}
            onChange={(e) => setHomeClubId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
          >
            {myClubs.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Toggle
          testId="new-match-combined"
          label="Combined"
          checked={isCombined}
          onChange={setCombined}
        />
        <Toggle
          testId="new-match-friendly"
          label="Friendly"
          checked={isFriendly}
          onChange={setFriendly}
        />
      </div>

      <button
        data-testid="new-match-submit"
        onClick={create}
        disabled={working}
        className="w-full rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-40"
      >
        {working ? "Creating…" : "＋ New match"}
      </button>

      <p className="text-[11px] text-gray-500">
        Combined = two halves with different clubs. Friendly matches carry no season and pay
        MMG only. You can switch League/Friendly until you submit.
      </p>

      <ErrorNote message={error} testId="new-match-error" />
    </div>
  );
}

/**
 * A real, visible checkbox inside a pill. Deliberately not `sr-only` + a fake
 * box: the e2e suite drives these with `.check()`, and native visibility is the
 * cheapest way to keep that honest.
 */
function Toggle({
  testId,
  label,
  checked,
  onChange,
}: {
  testId: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold ${
        checked
          ? "border-gray-900 bg-gray-900 text-white"
          : "border-gray-200 bg-white text-gray-700"
      }`}
    >
      <input
        type="checkbox"
        data-testid={testId}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={`h-3.5 w-3.5 ${checked ? "accent-white" : "accent-gray-900"}`}
      />
      {label}
    </label>
  );
}
