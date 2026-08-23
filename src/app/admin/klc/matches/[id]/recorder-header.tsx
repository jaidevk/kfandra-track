"use client";

import Link from "next/link";
import { useState } from "react";
import { SPORTS, SPORT_LABELS, type Sport } from "@/lib/klcsra/sport-stats";
import type { MatchDraft } from "@/lib/klcsra/types";
import { ErrorNote, SyncBadge, Tag, type SyncStatus } from "./recorder-shared";

/**
 * Screen 2 — the recorder header.
 *
 * Sport is chips (4 across) because changing it re-filters the stat set, which
 * is a decision worth showing rather than hiding in a `<select>`. Date and
 * Duration autosave on a debounce; the sport chip saves immediately so the
 * stats popup re-filters on the next server render.
 *
 * Friendly and Combined are SHOWN as segmented controls but are read-only:
 * `updateMatchMetaAction` accepts only `entryDate` / `sport` /
 * `durationMinutes`, and `is_combined` cannot change after creation because
 * the half rows already exist. Both are set on the New match form.
 */
export function RecorderHeader({
  match,
  seasonName,
  locked,
  sync,
  error,
  onMeta,
}: {
  match: MatchDraft;
  /** The season this match will be (or was) tagged with; null when there is none. */
  seasonName: string | null;
  locked: boolean;
  sync: SyncStatus;
  error: string | null;
  onMeta: (
    patch: { entryDate?: string; sport?: Sport; durationMinutes?: number | null },
    immediate: boolean,
  ) => void;
}) {
  // Local state, never re-keyed off the server: this component is the only
  // writer, and remounting it on each autosave refresh would fight the typing
  // that triggered the save.
  const [date, setDate] = useState(match.entryDate);
  const [sport, setSport] = useState<Sport>(match.sport);
  const [duration, setDuration] = useState(
    match.durationMinutes === null ? "" : String(match.durationMinutes),
  );

  return (
    <section
      data-testid="match-header"
      className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <Tag testId="match-status" tone={locked ? "green" : "gray"}>
            {match.status}
          </Tag>
          {match.isFriendly ? (
            <Tag tone="blue">No season — friendly</Tag>
          ) : seasonName ? (
            <Tag testId="flag-season">{seasonName}</Tag>
          ) : (
            <Link href="/admin/klc/seasons" className="hover:underline">
              <Tag testId="flag-no-season" tone="amber">
                No active season
              </Tag>
            </Link>
          )}
        </div>
        {/* A locked match saves nothing, so the badge would only mislead. */}
        {!locked && <SyncBadge status={sync} />}
      </div>

      {/* Sport chips — 4 across. */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">Sport</p>
        <div
          data-testid="header-sport"
          role="group"
          aria-label="Sport"
          data-sport={sport}
          className="mt-1 grid grid-cols-4 gap-1.5"
        >
          {SPORTS.map((s) => {
            const on = s === sport;
            return (
              <button
                key={s}
                type="button"
                data-testid="sport-chip"
                data-sport={s}
                aria-pressed={on}
                disabled={locked}
                onClick={() => {
                  if (s === sport) return;
                  setSport(s);
                  onMeta({ sport: s }, true);
                }}
                className={`rounded-xl px-1 py-2 text-[11px] font-bold transition-colors disabled:opacity-50 ${
                  on
                    ? "bg-gray-900 text-white"
                    : "border border-gray-200 bg-white text-gray-700"
                }`}
              >
                {SPORT_LABELS[s]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Date + Duration, inline. */}
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-600">Date</span>
          <input
            type="date"
            data-testid="header-date"
            aria-label="Match date"
            value={date}
            disabled={locked}
            onChange={(e) => {
              setDate(e.target.value);
              // A half-typed date ("0002-01-01") would be refused; only send
              // something the action's DATE_RE will accept.
              if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)) {
                onMeta({ entryDate: e.target.value }, false);
              }
            }}
            className="mt-1 w-full rounded-xl border border-gray-200 px-2 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
            Duration (mins)
          </span>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            data-testid="header-duration"
            aria-label="Duration in minutes"
            placeholder="—"
            value={duration}
            disabled={locked}
            onChange={(e) => {
              setDuration(e.target.value);
              const raw = e.target.value.trim();
              onMeta({ durationMinutes: raw === "" ? null : Number(raw) }, false);
            }}
            className="mt-1 w-full rounded-xl border border-gray-200 px-2 py-2 text-sm tabular-nums disabled:bg-gray-50 disabled:text-gray-500"
          />
        </label>
      </div>

      {/* Friendly / Combined — segmented, read-only (fixed at creation). */}
      <div className="grid grid-cols-2 gap-2">
        <Segmented
          label="Type"
          options={[
            { on: !match.isFriendly, label: "League" },
            { on: match.isFriendly, label: "Friendly", testId: "flag-friendly" },
          ]}
        />
        <Segmented
          label="Format"
          options={[
            { on: !match.isCombined, label: "Single" },
            { on: match.isCombined, label: "Combined", testId: "flag-combined" },
          ]}
        />
      </div>
      <p className="text-[11px] text-gray-500">
        {match.isFriendly ? "Friendly — MMG only, no Kroopies are credited. " : ""}
        Type and Format are fixed when the match is created.
      </p>

      <ErrorNote message={error} testId="header-error" />
    </section>
  );
}

/**
 * A read-only segmented control.
 *
 * The `data-testid` rides the ACTIVE segment, so `flag-friendly` /
 * `flag-combined` are present exactly when the match carries that flag —
 * the same semantics the Phase 2 badges had.
 */
function Segmented({
  label,
  options,
}: {
  label: string;
  options: { on: boolean; label: string; testId?: string }[];
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">{label}</p>
      <div className="mt-1 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
        {options.map((o) => (
          <span
            key={o.label}
            data-testid={o.on ? o.testId : undefined}
            aria-current={o.on ? "true" : undefined}
            className={`rounded-lg px-1 py-1.5 text-center text-[11px] font-bold ${
              o.on ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
            }`}
          >
            {o.label}
          </span>
        ))}
      </div>
    </div>
  );
}
