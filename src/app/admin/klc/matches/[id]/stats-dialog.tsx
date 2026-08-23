"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
// Straight from the pure modules, never via config.ts — that would pull
// `server-only` into the client bundle and fail the build.
import { STAT_LABELS, type StatKey, type StatRates } from "@/lib/klcsra/stat-rates";
import type { AppearanceDraft } from "@/lib/klcsra/types";
import { ErrorNote, SIDE_LABELS, signed } from "./recorder-shared";

/**
 * Screen 4 — the stats popup.
 *
 * One row per allowed stat with `+` / `−` and a live count. The KR/MMG figures
 * at the top are recomputed by the caller on every tap from the OPTIMISTIC
 * counts, so the number moves under the thumb rather than after a round-trip.
 *
 * There is no Cancel: every tap is already on its way to the server, so the
 * only honest exit is Done.
 */
export function StatsDialog({
  appearance,
  halfNo,
  isCombined,
  clubName,
  allowedStats,
  rates,
  counts,
  kr,
  mmg,
  isFriendly,
  locked,
  error,
  onSetStat,
  onDone,
}: {
  appearance: AppearanceDraft | null;
  halfNo: number;
  isCombined: boolean;
  clubName: string | null;
  allowedStats: StatKey[];
  rates: StatRates;
  /** Optimistic per-stat tallies for this appearance in this half. */
  counts: Partial<Record<StatKey, number>>;
  /** This player's running Kroopies across the whole match. */
  kr: number;
  /** This player's running MMG across the whole match. */
  mmg: number;
  isFriendly: boolean;
  locked: boolean;
  error: string | null;
  onSetStat: (statKey: StatKey, count: number) => void;
  onDone: () => void;
}) {
  const open = appearance !== null;
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onDone(); }}>
      {appearance && (
        <DialogContent
          data-testid="stats-dialog"
          data-appearance-id={appearance.id}
          data-player-id={appearance.playerId}
          showCloseButton={false}
          className="max-w-md gap-3 bg-white p-4"
        >
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900">
              {appearance.displayName}
            </DialogTitle>
            <DialogDescription className="text-[11px] text-gray-600">
              {SIDE_LABELS[appearance.side]}
              {clubName ? ` — ${clubName}` : ""}
              {isCombined ? ` · Half ${halfNo}` : ""}
            </DialogDescription>
          </DialogHeader>

          {/* Live totals — the whole point of the popup. */}
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-900 p-3 text-white">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Kroopies
              </p>
              <p data-testid="dialog-kr" className="text-xl font-black tabular-nums">
                {isFriendly ? "—" : signed(kr)}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">MMG</p>
              <p data-testid="dialog-mmg" className="text-xl font-black tabular-nums">
                {signed(mmg)}
              </p>
            </div>
          </div>
          {isFriendly && (
            <p className="text-[11px] text-gray-500">
              Friendly — MMG only, no Kroopies are credited.
            </p>
          )}

          <ul className="max-h-[46vh] divide-y divide-gray-100 overflow-y-auto">
            {allowedStats.map((key) => {
              const count = counts[key] ?? 0;
              const rate = rates[key];
              return (
                <li
                  key={key}
                  data-testid="stat-cell"
                  data-stat-key={key}
                  data-stat-count={count}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-gray-900">
                      {STAT_LABELS[key]}
                    </p>
                    <p className="text-[10px] tabular-nums text-gray-500">
                      {/* A friendly credits no Kroopies, so quoting a KR rate here would
                          promise something the payout will not pay. */}
                      {isFriendly ? "" : `${signed(rate.kr)} KR · `}
                      {signed(rate.mmg)} MMG
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!locked && (
                      <button
                        type="button"
                        data-testid="stat-dec"
                        aria-label={`Remove one ${STAT_LABELS[key]}`}
                        disabled={count === 0}
                        onClick={() => onSetStat(key, count - 1)}
                        className="h-9 w-9 rounded-full border border-gray-200 text-lg font-bold leading-none text-gray-700 disabled:opacity-30"
                      >
                        −
                      </button>
                    )}
                    <span
                      data-testid="stat-count"
                      className="w-7 text-center text-base font-black tabular-nums text-gray-900"
                    >
                      {count}
                    </span>
                    {!locked && (
                      <button
                        type="button"
                        data-testid="stat-inc"
                        aria-label={`Add one ${STAT_LABELS[key]}`}
                        onClick={() => onSetStat(key, count + 1)}
                        className="h-9 w-9 rounded-full bg-gray-900 text-lg font-bold leading-none text-white"
                      >
                        +
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <ErrorNote message={error} testId="stats-error" />

          <button
            type="button"
            data-testid="stats-done"
            onClick={onDone}
            className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-bold text-white"
          >
            Done
          </button>
        </DialogContent>
      )}
    </Dialog>
  );
}
