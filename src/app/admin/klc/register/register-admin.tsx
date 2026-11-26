"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import type { ActionResult } from "@/lib/klcsra/actions";
import { formatChange, formatKr, type PlayerValue, type RegisterPlayer, type ValueChange } from "@/lib/klcsra/player-values";
import type { Season } from "@/lib/klcsra/types";
import {
  addValueChangeAction, setBaseValueAction, setKlcNameAction, voidValueChangeAction,
} from "@/lib/klcsra/value-actions";

/**
 * The KLC register: one row per manager of an active club. Plain forms in
 * the house style (see seasons-admin.tsx); every action error is shown
 * verbatim next to its row.
 */
export default function RegisterAdmin({
  seasons, season, register, changes, values,
}: {
  seasons: Season[]; season: Season; register: RegisterPlayer[];
  changes: ValueChange[]; values: PlayerValue[];
}) {
  const hydrated = useHydrated();
  const router = useRouter();
  const valueOf = new Map(values.map((v) => [v.playerId, v]));
  return (
    <div data-testid="register-admin" data-hydrated={hydrated} className="space-y-4">
      <Link href="/admin/klc" className="text-[12px] text-gray-600 hover:underline">← KLC admin</Link>
      <div className="flex items-end justify-between gap-2">
        <h2 className="text-lg font-bold text-gray-900">Register</h2>
        <select
          data-testid="register-season"
          value={season.id}
          onChange={(e) => router.push(`/admin/klc/register?season=${e.target.value}`)}
          className="rounded-lg border border-gray-300 px-2 py-1 text-[12px]"
        >
          {seasons.map((s) => <option key={s.id} value={s.id}>S{s.seasonNo} · {s.name} ({s.status})</option>)}
        </select>
      </div>
      <p className="text-[11px] text-gray-600">
        Each manager&apos;s base value and official name for this season. Values move with every
        league match and official friendly.
      </p>
      <ul className="space-y-3">
        {register.map((p) => (
          <RegisterRow
            key={p.playerId}
            season={season}
            player={p}
            value={valueOf.get(p.playerId)}
            changes={changes.filter((c) => c.playerId === p.playerId)}
          />
        ))}
      </ul>
    </div>
  );
}

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        setError(null);
        after?.();
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  return { pending, error, run };
}

function RegisterRow({
  season, player, value, changes,
}: {
  season: Season; player: RegisterPlayer; value: PlayerValue | undefined; changes: ValueChange[];
}) {
  const { pending, error, run } = useAction();
  const [name, setName] = useState(player.klcName ?? "");
  const [base, setBase] = useState(player.baseValue === null ? "" : String(player.baseValue));
  const [open, setOpen] = useState(false);

  return (
    <li data-testid="register-row" data-player-id={player.playerId} className="rounded-xl border border-gray-200 bg-white p-3 text-[12px]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold text-gray-900">{player.displayName} · {player.clubName}</p>
        <p className="text-gray-700">
          {value?.current != null ? (
            <>Now <span data-testid="register-current" className="font-bold">{formatKr(value.current)}</span>
              {value.lastSession && <> · last {formatChange(value.lastSession.change)}</>}</>
          ) : null}
        </p>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {player.baseValue === null && <Flag testId="register-flag-nobase" text="No base value yet" />}
        {value?.playedWithoutBase && <Flag testId="register-flag-played" text="Played without a base value" />}
        {player.manyClubs && <Flag testId="register-flag-clubs" text="Manages more than one club" />}
      </div>
      <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
        <input data-testid="name-input" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="Official KLC name" aria-label="Official KLC name"
          className="rounded-lg border border-gray-300 px-2 py-1" />
        <button data-testid="name-save" disabled={pending}
          onClick={() => run(() => setKlcNameAction(player.playerId, name))}
          className="rounded-lg bg-gray-900 px-3 py-1 font-semibold text-white disabled:opacity-50">Save name</button>
        <input data-testid="base-input" value={base} onChange={(e) => setBase(e.target.value)} inputMode="decimal"
          placeholder="Base value (KR)" aria-label="Base value"
          className="rounded-lg border border-gray-300 px-2 py-1" />
        <button data-testid="base-save" disabled={pending}
          onClick={() => run(() => setBaseValueAction(season.id, player.playerId, base))}
          className="rounded-lg bg-gray-900 px-3 py-1 font-semibold text-white disabled:opacity-50">Save value</button>
      </div>
      {error && <p data-testid="register-error" role="alert" className="mt-1 text-red-700">{error}</p>}
      <button data-testid="changes-toggle" onClick={() => setOpen(!open)} className="mt-2 text-blue-700 hover:underline">
        {open ? "Hide" : "Value changes"} ({changes.filter((c) => c.voidedAt === null).length})
      </button>
      {open && <Changes season={season} playerId={player.playerId} changes={changes} />}
    </li>
  );
}

function Flag({ testId, text }: { testId: string; text: string }) {
  return <span data-testid={testId} className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">{text}</span>;
}

function Changes({ season, playerId, changes }: { season: Season; playerId: string; changes: ValueChange[] }) {
  const { pending, error, run } = useAction();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [voiding, setVoiding] = useState<string | null>(null);
  const [voidNote, setVoidNote] = useState("");

  return (
    <div className="mt-2 space-y-2 border-t border-gray-100 pt-2">
      <ul className="space-y-1">
        {changes.map((c) => (
          <li key={c.id} data-testid="change-row" data-voided={c.voidedAt !== null}
            className={c.voidedAt ? "text-gray-400 line-through" : "text-gray-800"}>
            {c.effectiveDate} · {formatChange(c.amount)} · {c.note}
            {c.voidedAt && <span className="no-underline"> (voided: {c.voidNote})</span>}
            {!c.voidedAt && voiding !== c.id && (
              <button data-testid="change-void" onClick={() => setVoiding(c.id)} className="ml-2 text-red-700 hover:underline">Void</button>
            )}
            {voiding === c.id && (
              <span className="ml-2 inline-flex gap-1">
                <input data-testid="void-note" value={voidNote} onChange={(e) => setVoidNote(e.target.value)}
                  placeholder="Why?" className="rounded border border-gray-300 px-1" />
                <button data-testid="void-confirm" disabled={pending}
                  onClick={() => run(() => voidValueChangeAction(c.id, voidNote), () => { setVoiding(null); setVoidNote(""); })}
                  className="text-red-700">Confirm</button>
              </span>
            )}
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-2 gap-2">
        <input data-testid="change-date" type="date" value={date} min={season.startDate} max={season.endDate ?? undefined}
          onChange={(e) => setDate(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1" />
        <input data-testid="change-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal"
          placeholder="+/− amount" className="rounded-lg border border-gray-300 px-2 py-1" />
        <input data-testid="change-note" value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Note (required)" className="col-span-2 rounded-lg border border-gray-300 px-2 py-1" />
        <button data-testid="change-add" disabled={pending}
          onClick={() => run(() => addValueChangeAction(season.id, playerId, date, amount, note), () => { setAmount(""); setNote(""); })}
          className="col-span-2 rounded-lg bg-gray-900 px-3 py-1 font-semibold text-white disabled:opacity-50">Add change</button>
      </div>
      {error && <p data-testid="change-error" role="alert" className="text-red-700">{error}</p>}
    </div>
  );
}
