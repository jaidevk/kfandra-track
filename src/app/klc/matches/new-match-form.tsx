"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { fmtDayDate } from "@/lib/format-date";
import { createMatchAction } from "@/lib/klcsra/actions";
import type { DuplicateCandidate } from "@/lib/klcsra/duplicates";
import { statusLabel } from "@/lib/klcsra/match-status";
import { SPORTS, SPORT_LABELS, type Sport } from "@/lib/klcsra/sport-stats";
import type { ClubOption } from "@/lib/klcsra/types";
import { ErrorNote } from "./notice";

/**
 * The one CTA on Screen 1. Combined is a checkbox here because it is fixed at
 * creation (the half rows are written by `createMatchAction`). Friendly is
 * chosen here too, but can be switched in the recorder header until a team
 * is sent.
 *
 * A club manager picks their own club (home side) and the opponent; staff may
 * pick both clubs or leave them for later. With both clubs known, the server
 * checks for a match between them that day and, if one exists, this form
 * offers to open it instead (spec §4).
 *
 * `today` is computed on the server and passed in: deriving it in the client
 * would hydrate a different value whenever the render straddles midnight.
 */
export function NewMatchForm({
  today,
  myClubs,
  allClubs,
  isStaff,
}: {
  today: string;
  myClubs: ClubOption[];
  allClubs: ClubOption[];
  isStaff: boolean;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(today);
  const [sport, setSport] = useState<Sport>("football");
  const [isCombined, setCombined] = useState(false);
  const [isFriendly, setFriendly] = useState(false);
  const [homeClubId, setHomeClubId] = useState(isStaff ? "" : (myClubs[0]?.id ?? ""));
  const [awayClubId, setAwayClubId] = useState("");
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Any change to the form makes an earlier duplicate warning stale. */
  const edit = <T,>(set: (v: T) => void) => (v: T) => {
    setDuplicates([]);
    set(v);
  };

  const create = async (allowDuplicate: boolean) => {
    setBusy(true);
    setError(null);
    const res = await createMatchAction({
      entryDate: date, sport, isCombined, isFriendly,
      homeClubId: homeClubId || null,
      awayClubId: awayClubId || null,
      allowDuplicate,
    });
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    if (res.data.kind === "duplicates") {
      setDuplicates(res.data.matches);
      setBusy(false);
      return;
    }
    const id = res.data.id;
    // Stay busy across the navigation so the button cannot double-fire.
    startTransition(() => router.push(`/klc/matches/${id}`));
  };

  const working = busy || pending;
  const homeOptions = isStaff ? allClubs : myClubs;

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
          onChange={(e) => edit(setDate)(e.target.value)}
          className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
        />
        <select
          data-testid="new-match-sport"
          aria-label="Sport"
          value={sport}
          onChange={(e) => edit(setSport)(e.target.value as Sport)}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
        >
          {SPORTS.map((s) => (
            <option key={s} value={s}>
              {SPORT_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
            {isStaff ? "Home club" : "Your club (home side)"}
          </span>
          <select
            data-testid="new-match-club"
            aria-label={isStaff ? "Home club" : "Your club"}
            value={homeClubId}
            onChange={(e) => edit(setHomeClubId)(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
          >
            {isStaff && <option value="">— pick later —</option>}
            {homeOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
            {isStaff ? "Away club" : "Opponent"}
          </span>
          <select
            data-testid="new-match-opponent"
            aria-label={isStaff ? "Away club" : "Opponent"}
            value={awayClubId}
            onChange={(e) => edit(setAwayClubId)(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none"
          >
            <option value="">{isStaff ? "— pick later —" : "— pick a club —"}</option>
            {allClubs.map((c) => (
              <option key={c.id} value={c.id} disabled={c.id === homeClubId}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Toggle
          testId="new-match-combined"
          label="Combined"
          checked={isCombined}
          onChange={edit(setCombined)}
        />
        <Toggle
          testId="new-match-friendly"
          label="Friendly"
          checked={isFriendly}
          onChange={edit(setFriendly)}
        />
      </div>

      {duplicates.length > 0 ? (
        <div
          data-testid="duplicate-warning"
          className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-[12px] text-amber-900"
        >
          {duplicates.map((d) => (
            <p key={d.id}>
              {d.homeLabel} vs {d.awayLabel} already has a match on {fmtDayDate(d.entryDate)} (
              {statusLabel(d)}).{" "}
              <Link
                href={`/klc/matches/${d.id}`}
                data-testid="duplicate-open"
                className="font-bold underline"
              >
                Open it
              </Link>
            </p>
          ))}
          <button
            type="button"
            data-testid="duplicate-create-anyway"
            disabled={working}
            onClick={() => void create(true)}
            className="text-[12px] font-semibold text-amber-900 underline disabled:opacity-40"
          >
            Create a new match anyway
          </button>
        </div>
      ) : (
        <button
          data-testid="new-match-submit"
          onClick={() => void create(false)}
          disabled={working}
          className="w-full rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-40"
        >
          {working ? "Creating…" : "＋ New match"}
        </button>
      )}

      <p className="text-[11px] text-gray-500">
        Combined = two halves with different clubs. Friendly matches carry no season and pay
        MMG only. Each club enters its own team; KFANDRA enters the league score.
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
