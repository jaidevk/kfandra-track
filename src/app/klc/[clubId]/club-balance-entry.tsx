"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveDraft as saveLocalDraft } from "@/lib/drafts/storage";
import { saveClubBalanceAction } from "@/lib/klc/actions";
import { computeClubTotals } from "@/lib/klc/compute";
import type { KlcRates } from "@/lib/klc/rates";
import type { ClubBalanceDraft, ClubSummary, MemberOption } from "@/lib/klc/types";
import { strings } from "@/content/strings";
import { Breadcrumb } from "@/components/breadcrumb";

type SyncStatus = "idle" | "saving" | "saved" | "error";

export default function ClubBalanceEntry({
  clubId,
  club,
  initialDraft,
  rates,
  members,
}: {
  clubId: string;
  club: ClubSummary;
  initialDraft: ClubBalanceDraft;
  rates: KlcRates;
  members: MemberOption[];
}) {
  const { klc } = strings;
  const f = klc.fields;
  const [draft, setDraft] = useState<ClubBalanceDraft>(initialDraft);
  const [status, setStatus] = useState<SyncStatus>("idle");

  const totals = useMemo(() => computeClubTotals(draft, rates), [draft, rates]);
  const nameById = useMemo(
    () => new Map(members.map((m) => [m.id, m.displayName])),
    [members],
  );

  // Autosave: local immediately + server on a debounce (mirrors MMG).
  const serverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSave = useRef(true);
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    saveLocalDraft(`klc:${clubId}`, draft);
    if (serverTimer.current) clearTimeout(serverTimer.current);
    serverTimer.current = setTimeout(async () => {
      const res = await saveClubBalanceAction(clubId, draftRef.current);
      setStatus(res.ok ? "saved" : "error");
    }, 1000);
    return () => {
      if (serverTimer.current) clearTimeout(serverTimer.current);
    };
  }, [draft, clubId]);

  const mutate = useCallback((updater: (d: ClubBalanceDraft) => ClubBalanceDraft) => {
    setStatus("saving");
    setDraft(updater);
  }, []);

  const setNum = (key: keyof ClubBalanceDraft, raw: string) => {
    const cleaned = raw.replace(/\D/g, "");
    mutate((d) => ({ ...d, [key]: cleaned === "" ? 0 : Number(cleaned) }));
  };

  // Loanee rows (item 4)
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

  // Members not already chosen (so each loanee appears once).
  const chosen = new Set(draft.shares.map((s) => s.playerId).filter(Boolean));

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-5 pb-32">
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
        <p className="mt-3 text-[10px] uppercase tracking-widest text-gray-600 font-semibold">
          {klc.sheetHeading}
        </p>
      </div>

      <Breadcrumb label={klc.breadcrumb} />

      <Row n={1} label={f.asOfDate}>
        <input
          type="date"
          value={draft.asOfDate ?? ""}
          onChange={(e) => mutate((d) => ({ ...d, asOfDate: e.target.value || null }))}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </Row>
      <Row n={2} label={f.matchesPlayed}>
        <NumBox value={draft.matchesPlayed} onChange={(v) => setNum("matchesPlayed", v)} />
      </Row>
      <Row n={3} label={f.matchesWon}>
        <NumBox value={draft.matchesWon} onChange={(v) => setNum("matchesWon", v)} />
      </Row>

      {/* 4. Loanees */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <p className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900">
          <Num n={4} /> {f.players}
        </p>
        <div className="flex flex-col gap-2">
          {draft.shares.map((s, i) => (
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
        <NumBox value={draft.matchesDrawn} onChange={(v) => setNum("matchesDrawn", v)} />
      </Row>
      <Row n={6} label={f.matchesLost}>
        <NumBox value={draft.matchesLost} onChange={(v) => setNum("matchesLost", v)} />
      </Row>
      <Row n={7} label={f.clubBonus}>
        <NumBox value={draft.clubBonus} onChange={(v) => setNum("clubBonus", v)} />
      </Row>

      <TotalRow n={8} label={f.paidToKfandra} value={totals.paidToKfandra} currency={klc.currency} />
      <TotalRow n={9} label={f.receivedFromKfandra} value={totals.receivedFromKfandra} currency={klc.currency} />
      <TotalRow n={10} label={f.distributedToLoanees} value={totals.distributedToLoanees} currency={klc.currency} />
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
function TotalRow({
  n, label, value, currency,
}: { n: number; label: string; value: number; currency: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <span className="flex items-center gap-2 text-sm font-semibold text-blue-900">
        <Num n={n} /> {label}
      </span>
      <span className="tabular-nums text-sm font-bold text-blue-900">
        {value.toLocaleString()} <span className="text-[11px] font-medium text-blue-700">{currency}</span>
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
