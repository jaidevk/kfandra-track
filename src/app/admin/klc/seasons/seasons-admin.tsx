"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  closeSeasonAction,
  createSeasonAction,
  renameSeasonAction,
  startSeasonAction,
  type ActionResult,
} from "@/lib/klcsra/actions";
import type { Season } from "@/lib/klcsra/types";

/**
 * Placeholder Phase 2 UI: plain forms, house Tailwind, no autosave.
 *
 * Two deliberate choices:
 *  * Every `ActionResult.error` is shown verbatim next to the control that
 *    produced it. `closeSeasonAction` in particular returns "N draft match(es)
 *    dated in this season..." which tells KFANDRA exactly what to do next.
 *  * Start and Close are two-step. Starting a season SILENTLY closes the one
 *    currently active, so the confirm names the season that is about to be
 *    closed rather than springing it on the user.
 */

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function SeasonsAdmin({
  seasons,
  activeId,
}: {
  seasons: Season[];
  activeId: string | null;
}) {
  const active = seasons.find((s) => s.id === activeId) ?? null;
  const firstUpcoming = seasons.find((s) => s.status === "upcoming") ?? null;

  return (
    <div className="space-y-5">
      <Link href="/admin/klc" className="text-[12px] text-gray-600 hover:underline">
        ← KLC admin
      </Link>

      <div>
        <h2 className="text-lg font-bold text-gray-900">Seasons</h2>
        <p className="text-[11px] text-gray-600">
          League matches are tagged with the active season when they are submitted.
          Friendlies carry no season.
        </p>
      </div>

      {active ? <ActiveBanner season={active} /> : <NoActiveBanner upcoming={firstUpcoming} />}

      <section>
        <h3 className="mb-2 text-sm font-bold text-gray-900">All seasons</h3>
        {seasons.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
            No seasons yet. Create one below.
          </p>
        ) : (
          <ul className="space-y-2">
            {seasons.map((s) => (
              <SeasonRow key={s.id} season={s} active={active} />
            ))}
          </ul>
        )}
      </section>

      <CreateSeason />

      <p className="text-[11px] text-gray-500">
        Phase 2 placeholder screen — Phase 3 replaces this with the full recorder UX.
      </p>
    </div>
  );
}

// ── banners ─────────────────────────────────────────────────────────────────

function ActiveBanner({ season }: { season: Season }) {
  return (
    <div className="rounded-xl border-2 border-green-500 bg-green-50 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-green-800">
        Active season
      </p>
      <p className="mt-0.5 text-base font-bold text-green-900">
        S{season.seasonNo} · {season.name}
      </p>
      <p className="mt-0.5 text-[12px] text-green-800">
        Started {fmtDate(season.startDate)} · league matches submitted now are tagged with
        this season.
      </p>
    </div>
  );
}

function NoActiveBanner({ upcoming }: { upcoming: Season | null }) {
  return (
    <div className="rounded-xl border-2 border-red-500 bg-red-50 p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-red-800">
        No active season
      </p>
      <p className="mt-0.5 text-sm font-bold text-red-900">
        League matches cannot be submitted until you start one.
      </p>
      <p className="mt-1 text-[12px] text-red-800">
        {upcoming
          ? `Press Start on S${upcoming.seasonNo} · ${upcoming.name} below.`
          : "Create a season below, then press Start on it."}
      </p>
    </div>
  );
}

// ── one season ──────────────────────────────────────────────────────────────

type Pending = "start" | "close" | null;

function SeasonRow({ season, active }: { season: Season; active: Season | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(season.name);

  const isActive = season.status === "active";

  const run = async (fn: () => Promise<ActionResult<unknown>>, done?: () => void) => {
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setPending(null);
    done?.();
    router.refresh();
  };

  return (
    <li
      className={`rounded-xl border bg-white p-4 ${
        isActive ? "border-2 border-green-500 bg-green-50" : "border-gray-200"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900">
            S{season.seasonNo} · {season.name}
          </p>
          <p className="text-[11px] text-gray-600">
            {fmtDate(season.startDate)} → {fmtDate(season.endDate)}
          </p>
        </div>
        <StatusBadge status={season.status} />
      </div>

      {/* Controls */}
      {!renaming && pending === null && (
        <div className="mt-3 flex flex-wrap gap-2">
          {season.status === "upcoming" && (
            <button
              onClick={() => {
                setError(null);
                setPending("start");
              }}
              disabled={busy}
              className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              Start
            </button>
          )}
          {isActive && (
            <button
              onClick={() => {
                setError(null);
                setPending("close");
              }}
              disabled={busy}
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              Close
            </button>
          )}
          <button
            onClick={() => {
              setError(null);
              setName(season.name);
              setRenaming(true);
            }}
            disabled={busy}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-800 disabled:opacity-40"
          >
            Rename
          </button>
        </div>
      )}

      {/* Start confirm — names the season that is about to be closed */}
      {pending === "start" && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="text-[12px] font-semibold text-amber-900">
            Start S{season.seasonNo} · {season.name}?
          </p>
          <p className="mt-0.5 text-[12px] text-amber-900">
            {active
              ? `This will CLOSE the current active season, S${active.seasonNo} · ${active.name}. Only one season can be active at a time. Matches already submitted keep the season they were tagged with.`
              : "League matches submitted from now on will be tagged with this season."}
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => run(() => startSeasonAction(season.id))}
              disabled={busy}
              className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Starting…" : active ? "Close it and start" : "Yes, start"}
            </button>
            <button
              onClick={() => setPending(null)}
              disabled={busy}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-800 disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Close confirm */}
      {pending === "close" && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="text-[12px] font-semibold text-amber-900">
            Close S{season.seasonNo} · {season.name}?
          </p>
          <p className="mt-0.5 text-[12px] text-amber-900">
            No league match can be submitted until another season is started.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => run(() => closeSeasonAction(season.id))}
              disabled={busy}
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              {busy ? "Closing…" : "Yes, close"}
            </button>
            <button
              onClick={() => setPending(null)}
              disabled={busy}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-800 disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Rename */}
      {renaming && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            aria-label={`Name for season ${season.seasonNo}`}
            className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-gray-400 focus:outline-none"
          />
          <button
            onClick={() =>
              run(
                () => renameSeasonAction(season.id, name),
                () => setRenaming(false),
              )
            }
            disabled={busy || name.trim() === "" || name.trim() === season.name}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            Save
          </button>
          <button
            onClick={() => {
              setRenaming(false);
              setName(season.name);
              setError(null);
            }}
            disabled={busy}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-800 disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-800">
          {error}
        </p>
      )}
    </li>
  );
}

function StatusBadge({ status }: { status: Season["status"] }) {
  const styles: Record<Season["status"], string> = {
    active: "bg-green-600 text-white",
    upcoming: "bg-amber-100 text-amber-900 border border-amber-300",
    closed: "bg-gray-100 text-gray-700 border border-gray-300",
  };
  return (
    <span
      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${styles[status]}`}
    >
      {status}
    </span>
  );
}

// ── create ──────────────────────────────────────────────────────────────────

function CreateSeason() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await createSeasonAction(name, startDate);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setMsg(`Created S${res.data.seasonNo} · ${res.data.name}. Press Start when it begins.`);
    setName("");
    router.refresh();
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-bold text-gray-900">Create a season</h3>
      <p className="mt-0.5 text-[11px] text-gray-600">
        New seasons are created as <strong>upcoming</strong>. They go live only when you
        press Start.
      </p>
      <div className="mt-3 space-y-2">
        <label className="block">
          <span className="text-[11px] font-semibold text-gray-700">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            placeholder="KLCFERRSXVSG3"
            className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-gray-400 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[11px] font-semibold text-gray-700">Start date</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={busy}
            className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm focus:border-gray-400 focus:outline-none"
          />
        </label>
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          {busy ? "Creating…" : "Create season"}
        </button>
      </div>
      {error && (
        <p className="mt-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-800">
          {error}
        </p>
      )}
      {msg && <p className="mt-2 text-[12px] font-medium text-green-800">{msg}</p>}
    </section>
  );
}
