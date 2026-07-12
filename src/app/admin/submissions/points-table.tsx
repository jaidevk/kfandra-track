"use client";

import { useState } from "react";
import type { SessionRowDetail } from "@/lib/admin/submissions-rows";

/** A row of category points — a player (by-date) or a session (by-player). */
export type PointsRow = {
  key: string;
  label: string;
  /** Small note after the label, e.g. "not submitted". */
  note?: string;
  /** Greys the row (non-submitters). */
  muted?: boolean;
  confirmationPoints: number;
  arrivalPoints: number;
  gamesPoints: number;
  packingPoints: number;
  otherPoints: number;
  repPoints: number;
  repReps: number;
  total: number;
  detail: SessionRowDetail | null;
};

const n = (v: number) => v.toLocaleString("en-GB");

/**
 * Category-column points table with a tap-to-expand drill-down per row. The
 * columns (Confirm · Arrival · Games · Packing · Other · Total) replace the old
 * catch-all "Games" number; expanding a row reveals what those numbers hide —
 * game result/stat split, which packing bonuses, and each Other line with its
 * description (the descriptions are the whole point).
 */
export function PointsTable({
  firstColHeader,
  rows,
  footer,
}: {
  firstColHeader: string;
  rows: PointsRow[];
  /** Optional bold summary row (e.g. season total) — not expandable, labelled "Season". */
  footer?: Omit<PointsRow, "key" | "detail" | "note" | "muted" | "label">;
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-300 bg-white">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-blue-100 text-[11px] uppercase tracking-wide text-blue-900">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">{firstColHeader}</th>
            <th className="px-2 py-2 text-right font-semibold">Confirm</th>
            <th className="px-2 py-2 text-right font-semibold">Arrival</th>
            <th className="px-2 py-2 text-right font-semibold">Games</th>
            <th className="px-2 py-2 text-right font-semibold">Packing</th>
            <th className="px-2 py-2 text-right font-semibold">Other</th>
            <th className="px-2 py-2 text-right font-semibold">Reps</th>
            <th className="px-3 py-2 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {rows.map((r) => {
            const expandable = !!r.detail || r.repReps > 0;
            const isOpen = open === r.key;
            return (
              <RowGroup
                key={r.key}
                row={r}
                expandable={expandable}
                isOpen={isOpen}
                onToggle={() => setOpen(isOpen ? null : r.key)}
              />
            );
          })}
          {footer && (
            <tr className="border-t-2 border-gray-300 bg-slate-50 font-semibold text-gray-900">
              <td className="px-3 py-2">Season</td>
              <td className="px-2 py-2 text-right tabular-nums">{n(footer.confirmationPoints)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{n(footer.arrivalPoints)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{n(footer.gamesPoints)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{n(footer.packingPoints)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{n(footer.otherPoints)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{n(footer.repPoints)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{n(footer.total)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function RowGroup({
  row,
  expandable,
  isOpen,
  onToggle,
}: {
  row: PointsRow;
  expandable: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const cls = row.muted ? "text-gray-500" : "text-gray-800";
  return (
    <>
      <tr className={`${cls} odd:bg-white even:bg-slate-50`}>
        <td className="px-3 py-2">
          {expandable ? (
            <button
              onClick={onToggle}
              className="flex items-center gap-1.5 text-left font-medium text-gray-900 hover:underline"
              aria-expanded={isOpen}
            >
              <span className="text-[10px] text-gray-400">{isOpen ? "▾" : "▸"}</span>
              {row.label}
            </button>
          ) : (
            <span className="font-medium text-gray-900">{row.label}</span>
          )}
          {row.note && (
            <span className="ml-2 text-[10px] uppercase tracking-wide">{row.note}</span>
          )}
        </td>
        <td className="px-2 py-2 text-right tabular-nums">{cell(row.confirmationPoints)}</td>
        <td className="px-2 py-2 text-right tabular-nums">{cell(row.arrivalPoints)}</td>
        <td className="px-2 py-2 text-right tabular-nums">{cell(row.gamesPoints)}</td>
        <td className="px-2 py-2 text-right tabular-nums">{cell(row.packingPoints)}</td>
        <td className="px-2 py-2 text-right tabular-nums">{cell(row.otherPoints)}</td>
        <td className="px-2 py-2 text-right tabular-nums">{cell(row.repPoints)}</td>
        <td className="px-3 py-2 text-right font-bold tabular-nums text-gray-900">
          {cell(row.total)}
        </td>
      </tr>
      {expandable && isOpen && (
        <tr className="bg-slate-50/70">
          <td colSpan={8} className="px-4 pb-3 pt-1">
            <Detail detail={row.detail} repReps={row.repReps} repPoints={row.repPoints} />
          </td>
        </tr>
      )}
    </>
  );
}

/** "—" for a zero cell keeps the table scannable. */
function cell(v: number) {
  return v === 0 ? <span className="text-gray-300">—</span> : n(v);
}

function Detail({
  detail,
  repReps,
  repPoints,
}: {
  detail: SessionRowDetail | null;
  repReps: number;
  repPoints: number;
}) {
  const games = detail?.games ?? [];
  const packing = detail?.packing ?? [];
  const otherGroups = detail?.otherGroups ?? [];
  const confirmationOrder = detail?.confirmationOrder ?? null;
  const arrivalOrder = detail?.arrivalOrder ?? null;
  const hasOrder = confirmationOrder != null || arrivalOrder != null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {repReps > 0 && (
        <Section title="Reps (gym)">
          <p className="text-gray-700">
            {n(repReps)} reps <span className="text-gray-400">= {n(repPoints)}</span>
          </p>
          <p className="text-[11px] text-gray-500">
            Exercise reps in this session&rsquo;s window (closest previous session).
          </p>
        </Section>
      )}
      {games.length > 0 && (
        <Section title={`Games · ${games.length}`}>
          {games.map((g, i) => (
            <div key={i} className="mb-1.5 last:mb-0">
              <p className="text-gray-800">
                {g.name}{" "}
                <span className="text-gray-500">
                  ({g.won}W {g.drew}D {g.lost}L
                  {g.resultPoints ? ` = ${n(g.resultPoints)}` : ""})
                </span>
              </p>
              {g.stats.map((s) => (
                <p key={s.key} className="pl-3 text-gray-600">
                  {s.key} ×{s.count} <span className="text-gray-400">= {n(s.points)}</span>
                </p>
              ))}
            </div>
          ))}
        </Section>
      )}
      {packing.length > 0 && (
        <Section title="Packing">
          {packing.map((p, i) => (
            <p key={i} className="text-gray-700">
              {p.label} <span className="text-gray-400">= {n(p.points)}</span>
            </p>
          ))}
        </Section>
      )}
      {otherGroups.length > 0 && (
        <Section title="Other · by type">
          {otherGroups.map((g) => (
            <div key={g.category} className="mb-1.5 last:mb-0">
              <p className="font-medium text-gray-800">
                {g.category} <span className="text-gray-500">· {n(g.points)}</span>
              </p>
              {g.lines.map((o, i) => (
                <p key={i} className="pl-3 text-gray-600">
                  {o.label} <span className="text-gray-400">= {n(o.points)}</span>
                </p>
              ))}
            </div>
          ))}
        </Section>
      )}
      {hasOrder && (
        <Section title="Order ladder">
          {confirmationOrder != null && (
            <p className="text-gray-700">Confirmed #{confirmationOrder}</p>
          )}
          {arrivalOrder != null && (
            <p className="text-gray-700">Arrived #{arrivalOrder}</p>
          )}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2.5">
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
        {title}
      </p>
      <div className="text-[12px] leading-relaxed">{children}</div>
    </div>
  );
}
