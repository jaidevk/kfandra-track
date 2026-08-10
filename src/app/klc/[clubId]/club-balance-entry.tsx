"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { saveDraft as saveLocalDraft } from "@/lib/drafts/storage";
import { saveClubBalanceAction } from "@/lib/klc/actions";
import { aggregateOverview, computeClubTotals } from "@/lib/klc/compute";
import type { KlcRates } from "@/lib/klc/rates";
import type { ClubBalanceDraft, ClubSummary, MemberOption } from "@/lib/klc/types";
import { strings } from "@/content/strings";
import { Breadcrumb } from "@/components/breadcrumb";

type SyncStatus = "idle" | "saving" | "saved" | "error";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A blank entry for a given date. */
function emptyDated(date: string): ClubBalanceDraft {
  return {
    asOfDate: date,
    matchesPlayed: 0,
    matchesWon: 0,
    matchesDrawn: 0,
    matchesLost: 0,
    clubBonus: 0,
    shares: [],
  };
}

/** Insert-or-replace a dated entry, keeping the list sorted newest-first. */
function upsertEntry(list: ClubBalanceDraft[], draft: ClubBalanceDraft): ClubBalanceDraft[] {
  const rest = list.filter((e) => e.asOfDate !== draft.asOfDate);
  return [...rest, draft].sort((a, b) => (a.asOfDate! < b.asOfDate! ? 1 : -1));
}

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function ClubBalanceEntry({
  clubId,
  club,
  initialEntries,
  rates,
  members,
}: {
  clubId: string;
  club: ClubSummary;
  initialEntries: ClubBalanceDraft[];
  rates: KlcRates;
  members: MemberOption[];
}) {
  const { klc } = strings;
  const f = klc.fields;

  const [entries, setEntries] = useState<ClubBalanceDraft[]>(initialEntries);
  const [activeDate, setActiveDate] = useState<string>(todayISO());
  const [status, setStatus] = useState<SyncStatus>("idle");

  const activeDraft = useMemo(
    () => entries.find((e) => e.asOfDate === activeDate) ?? emptyDated(activeDate),
    [entries, activeDate],
  );
  const dateTotals = useMemo(() => computeClubTotals(activeDraft, rates), [activeDraft, rates]);
  const overview = useMemo(() => aggregateOverview(entries, rates), [entries, rates]);
  const nameById = useMemo(() => new Map(members.map((m) => [m.id, m.displayName])), [members]);

  const serverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = useCallback(
    (draft: ClubBalanceDraft) => {
      saveLocalDraft(`klc:${clubId}:${draft.asOfDate}`, draft);
      if (serverTimer.current) clearTimeout(serverTimer.current);
      serverTimer.current = setTimeout(async () => {
        const res = await saveClubBalanceAction(clubId, draft);
        setStatus(res.ok ? "saved" : "error");
      }, 1000);
    },
    [clubId],
  );

  /** Apply an edit to the active date's entry, upsert it, and schedule a save. */
  const mutate = useCallback(
    (updater: (d: ClubBalanceDraft) => ClubBalanceDraft) => {
      const next = updater(activeDraft);
      setStatus("saving");
      setEntries((prev) => upsertEntry(prev, next));
      scheduleSave(next);
    },
    [activeDraft, scheduleSave],
  );

  const setNum = (key: keyof ClubBalanceDraft, raw: string) => {
    const cleaned = raw.replace(/\D/g, "");
    mutate((d) => ({ ...d, [key]: cleaned === "" ? 0 : Number(cleaned) }));
  };

  // Loanee rows (item 4) — for the active date
  const addLoanee = () =>
    mutate((d) => ({ ...d, shares: [...d.shares, { playerId: "", playerName: "", amount: 0 }] }));
  const setLoaneePlayer = (index: number, playerId: string) =>
    mutate((d) => ({
      ...d,
      shares: d.shares.map((s, i) =>
        i === index ? { ...s, playerId, playerName: nameById.get(playerId) ?? "" } : s,
      ),
    }));
  const setLoaneeAmount = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, "");
    mutate((d) => ({
      ...d,
      shares: d.shares.map((s, i) =>
        i === index ? { ...s, amount: cleaned === "" ? 0 : Number(cleaned) } : s,
      ),
    }));
  };
  const removeLoanee = (index: number) =>
    mutate((d) => ({ ...d, shares: d.shares.filter((_, i) => i !== index) }));

  const chosen = new Set(activeDraft.shares.map((s) => s.playerId).filter(Boolean));
  const loggedDates = entries.map((e) => e.asOfDate!).filter(Boolean);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-5 pb-32">
      {/* Header */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={club.logoPath} alt={club.name} className="h-12 w-12 object-contain" />
            <div>
              <h1 className="text-lg font-black text-gray-900">{club.name}</h1>
              <p className="text-[11px] text-gray-600">
                {klc.managerLabel} — {club.managerName || "—"}
              </p>
            </div>
          </div>
          <SyncBadge status={status} />
        </div>
      </div>

      {/* Running overview across all dates */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-[10px] uppercase tracking-widest text-blue-700 font-semibold">
          {klc.overviewHeading} · {overview.entryCount} {overview.entryCount === 1 ? "match-day" : "match-days"}
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <Mini label={f.matchesPlayed} value={overview.matchesPlayed} />
          <Mini label={f.matchesWon} value={overview.matchesWon} />
          <Mini label={f.matchesDrawn} value={overview.matchesDrawn} />
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          <OverviewLine label={f.paidToKfandra} value={overview.totals.paidToKfandra} currency={klc.currency} />
          <OverviewLine label={f.receivedFromKfandra} value={overview.totals.receivedFromKfandra} currency={klc.currency} />
          <OverviewLine label={f.distributedToLoanees} value={overview.totals.distributedToLoanees} currency={klc.currency} />
        </div>
      </div>

      <Breadcrumb label={klc.breadcrumb} />

      {/* 1. Entry date — selecting a date shows/edits that date's values */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-medium text-gray-800">
            <Num n={1} /> {f.asOfDate}
          </span>
          <input
            type="date"
            value={activeDate}
            max={todayISO()}
            onChange={(e) => setActiveDate(e.target.value || todayISO())}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        {loggedDates.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {loggedDates.map((d) => (
              <button
                key={d}
                onClick={() => setActiveDate(d)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                  d === activeDate
                    ? "border-blue-400 bg-blue-50 text-blue-800"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                {fmtDate(d)}
              </button>
            ))}
          </div>
        )}
      </div>

      <Row n={2} label={f.matchesPlayed}>
        <NumBox value={activeDraft.matchesPlayed} onChange={(v) => setNum("matchesPlayed", v)} />
      </Row>
      <Row n={3} label={f.matchesWon}>
        <NumBox value={activeDraft.matchesWon} onChange={(v) => setNum("matchesWon", v)} />
      </Row>

      {/* 4. Loanees for this date */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900">
          <Num n={4} /> {f.players}
        </p>
        <div className="flex flex-col gap-2">
          {activeDraft.shares.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={s.playerId}
                onChange={(e) => setLoaneePlayer(i, e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-2 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">{klc.pickPlayer}</option>
                {members
                  .filter((m) => m.id === s.playerId || !chosen.has(m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>{m.displayName}</option>
                  ))}
              </select>
              <input
                value={s.amount === 0 ? "" : String(s.amount)}
                onChange={(e) => setLoaneeAmount(i, e.target.value)}
                inputMode="numeric"
                placeholder="0"
                className="w-16 rounded-xl border border-gray-200 bg-white px-3 py-2 text-center text-sm tabular-nums focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                onClick={() => removeLoanee(i)}
                className="px-2 text-gray-600 hover:text-red-500"
                aria-label="Remove loanee"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={addLoanee}
            className="self-start rounded-lg px-1 text-[12px] font-semibold text-blue-600 hover:text-blue-700"
          >
            {klc.addLoanee}
          </button>
        </div>
      </div>

      <Row n={5} label={f.matchesDrawn}>
        <NumBox value={activeDraft.matchesDrawn} onChange={(v) => setNum("matchesDrawn", v)} />
      </Row>
      <Row n={6} label={f.matchesLost}>
        <NumBox value={activeDraft.matchesLost} onChange={(v) => setNum("matchesLost", v)} />
      </Row>
      <Row n={7} label={f.clubBonus}>
        <NumBox value={activeDraft.clubBonus} onChange={(v) => setNum("clubBonus", v)} />
      </Row>

      <p className="mt-1 text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
        {klc.thisDateHeading} · {fmtDate(activeDate)}
      </p>
      <TotalRow n={8} label={f.paidToKfandra} value={dateTotals.paidToKfandra} currency={klc.currency} />
      <TotalRow n={9} label={f.receivedFromKfandra} value={dateTotals.receivedFromKfandra} currency={klc.currency} />
      <TotalRow n={10} label={f.distributedToLoanees} value={dateTotals.distributedToLoanees} currency={klc.currency} />
    </div>
  );
}

function Num({ n }: { n: number }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
      {n}
    </span>
  );
}
function Row({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4">
      <span className="flex items-center gap-2 text-sm font-medium text-gray-800">
        <Num n={n} /> {label}
      </span>
      {children}
    </div>
  );
}
function NumBox({ value, onChange }: { value: number; onChange: (v: string) => void }) {
  return (
    <input
      value={value === 0 ? "" : String(value)}
      onChange={(e) => onChange(e.target.value)}
      inputMode="numeric"
      placeholder="0"
      className="w-24 rounded-xl border border-gray-200 bg-white px-3 py-2 text-center text-sm tabular-nums focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
    />
  );
}
function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/70 px-2 py-1.5">
      <p className="truncate text-[9px] uppercase tracking-wide text-blue-700 font-semibold">{label}</p>
      <p className="tabular-nums text-sm font-bold text-blue-900">{value.toLocaleString()}</p>
    </div>
  );
}
function OverviewLine({ label, value, currency }: { label: string; value: number; currency: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-blue-900">{label}</span>
      <span className="tabular-nums text-[13px] font-bold text-blue-900">
        {value.toLocaleString()} <span className="text-[10px] font-medium text-blue-700">{currency}</span>
      </span>
    </div>
  );
}
function TotalRow({
  n, label, value, currency,
}: { n: number; label: string; value: number; currency: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <span className="flex items-center gap-2 text-sm font-semibold text-gray-800">
        <Num n={n} /> {label}
      </span>
      <span className="tabular-nums text-sm font-bold text-gray-900">
        {value.toLocaleString()} <span className="text-[11px] font-medium text-gray-500">{currency}</span>
      </span>
    </div>
  );
}
function SyncBadge({ status }: { status: SyncStatus }) {
  const label =
    status === "saving" ? "Saving…"
    : status === "saved" ? "Saved ✓"
    : status === "error" ? "Offline — saved locally"
    : "";
  const color =
    status === "error" ? "text-amber-600"
    : status === "saved" ? "text-green-600"
    : "text-gray-600";
  return <span className={`text-[11px] font-semibold ${color}`}>{label}</span>;
}
