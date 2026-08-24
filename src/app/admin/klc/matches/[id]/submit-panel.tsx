"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MatchDraft, PayoutLine } from "@/lib/klcsra/types";
import { ErrorNote, fmtStamp, signed } from "./recorder-shared";

/**
 * Screen 6 — pre-submit checks, the totals preview, and the lock.
 *
 * The checks are ADVISORY: `submit-match` stays enabled whatever they say, so
 * the refusal KFANDRA reads is always the action's own wording ("No active
 * season. Start one in Seasons first.") rather than a guess made here.
 *
 * Copy match report (Phase 4) and View balance sheets (Phase 5) are
 * deliberately absent — not stubbed.
 */
export function SubmitPanel({
  match,
  lines,
  locked,
  busy,
  canReopen,
  hasActiveSeason,
  seasonName,
  submittedBy,
  submitError,
  reopenError,
  deleteError,
  onSubmit,
  onReopen,
  onDelete,
}: {
  match: MatchDraft;
  lines: PayoutLine[];
  locked: boolean;
  busy: boolean;
  canReopen: boolean;
  hasActiveSeason: boolean;
  seasonName: string | null;
  submittedBy: string | null;
  submitError: string | null;
  reopenError: string | null;
  deleteError: string | null;
  onSubmit: () => void;
  onReopen: () => void;
  onDelete: () => void;
}) {
  const [confirmReopen, setConfirmReopen] = useState(false);

  const totalKr = lines.reduce((n, l) => n + l.kr, 0);
  const totalMmg = lines.reduce((n, l) => n + l.mmg, 0);

  // Sides are created lazily, so "fewer than two rows" IS "a club is missing".
  const clubsOk = match.halves.length > 0 && match.halves.every((h) => h.sides.length === 2);
  const checks: { ok: boolean; label: string }[] = [
    {
      ok: clubsOk,
      label: match.isCombined ? "Clubs picked for both halves" : "Clubs picked for both sides",
    },
    { ok: match.appearances.length > 0, label: "At least one player added" },
  ];
  if (!match.isFriendly) {
    checks.push({
      ok: hasActiveSeason,
      label: hasActiveSeason
        ? `Active season — ${seasonName}`
        : "No active season. Start one in Seasons first.",
    });
  }

  return (
    <section className="space-y-3">
      {locked && (
        <div
          data-testid="lock-banner"
          className="space-y-1 rounded-2xl border border-green-300 bg-green-50 px-3 py-2.5"
        >
          <p className="text-[12px] font-bold text-green-900">
            Locked — submitted{match.submittedAt ? ` ${fmtStamp(match.submittedAt)}` : ""}.
            {match.seasonName ? ` Season: ${match.seasonName}.` : ""} Reopen it to make changes.
          </p>
          <p data-testid="audit-line" className="text-[11px] text-green-800">
            Submitted by {submittedBy ?? "—"}
            {match.submittedAt ? ` · ${fmtStamp(match.submittedAt)}` : ""}
          </p>
        </div>
      )}

      {!locked && (
        <div
          data-testid="submit-checks"
          className="space-y-1.5 rounded-2xl border border-gray-200 bg-white p-4"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
            Before submitting
          </p>
          {checks.map((c) => (
            <p
              key={c.label}
              data-testid="submit-check"
              data-ok={c.ok}
              className={`flex items-start gap-2 text-[12px] ${
                c.ok ? "text-gray-700" : "text-amber-800"
              }`}
            >
              <span className="font-bold">{c.ok ? "✓" : "•"}</span>
              <span>{c.label}</span>
            </p>
          ))}
        </div>
      )}

      <div className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4">
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
          {locked ? "Final totals" : "Totals preview"}
        </p>
        {match.isFriendly && (
          <p className="text-[11px] text-gray-500">
            Friendly — MMG only, no Kroopies are credited.
          </p>
        )}
        {lines.length === 0 ? (
          <p className="text-[12px] text-gray-500">No players yet — nothing to pay.</p>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table data-testid="payout-table" className="w-full text-[12px]">
              <thead className="text-[10px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-1 py-1 text-left">Player</th>
                  <th className="px-1 py-1 text-left">Club</th>
                  <th className="px-1 py-1 text-right">KR</th>
                  <th className="px-1 py-1 text-right">MMG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((l) => (
                  <tr key={l.playerId} data-testid="payout-row" data-player-id={l.playerId}>
                    <td data-testid="payout-player" className="px-1 py-1.5 font-semibold text-gray-900">
                      {l.displayName}
                    </td>
                    <td data-testid="payout-club" className="px-1 py-1.5 text-gray-500">
                      {l.clubName ?? "—"}
                    </td>
                    <td data-testid="payout-kr" className="px-1 py-1.5 text-right tabular-nums">
                      {l.kr}
                    </td>
                    <td data-testid="payout-mmg" className="px-1 py-1.5 text-right tabular-nums">
                      {l.mmg}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200 font-bold text-gray-900">
                <tr data-testid="payout-total">
                  <td className="px-1 py-1.5" colSpan={2}>
                    Total
                  </td>
                  <td data-testid="payout-total-kr" className="px-1 py-1.5 text-right tabular-nums">
                    {totalKr}
                  </td>
                  <td
                    data-testid="payout-total-mmg"
                    className="px-1 py-1.5 text-right tabular-nums"
                  >
                    {totalMmg}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {!locked && lines.length > 0 && (
          <p className="text-[11px] text-gray-500">
            Running totals from the stats recorded so far ({signed(totalKr)} KR ·{" "}
            {signed(totalMmg)} MMG).
          </p>
        )}
      </div>

      {!locked && (
        <>
          <button
            type="button"
            data-testid="submit-match"
            disabled={busy}
            onClick={onSubmit}
            className="w-full rounded-2xl bg-green-600 px-4 py-3.5 text-sm font-bold text-white shadow-sm disabled:opacity-40"
          >
            Submit &amp; lock
          </button>
          <ErrorNote message={submitError} testId="submit-error" />
        </>
      )}

      {locked && canReopen && (
        <>
          <button
            type="button"
            data-testid="reopen-match"
            disabled={busy}
            onClick={() => setConfirmReopen(true)}
            className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-bold text-gray-800 disabled:opacity-40"
          >
            Reopen match
          </button>
          <Dialog open={confirmReopen} onOpenChange={setConfirmReopen}>
            <DialogContent
              data-testid="reopen-dialog"
              showCloseButton={false}
              className="max-w-sm gap-3 bg-white p-4"
            >
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-gray-900">
                  Reopen this match?
                </DialogTitle>
                <DialogDescription className="text-[12px] text-gray-600">
                  Reopening clears the season tag and the submitted timestamp, and re-opens
                  totals KFANDRA may already have read as final.
                </DialogDescription>
              </DialogHeader>
              <ErrorNote message={reopenError} testId="reopen-error" />
              <div className="flex gap-2">
                <button
                  type="button"
                  data-testid="reopen-cancel"
                  onClick={() => setConfirmReopen(false)}
                  className="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-[13px] font-bold text-gray-800"
                >
                  Keep locked
                </button>
                <button
                  type="button"
                  data-testid="reopen-confirm"
                  disabled={busy}
                  onClick={onReopen}
                  className="flex-1 rounded-xl bg-amber-600 px-3 py-2.5 text-[13px] font-bold text-white disabled:opacity-40"
                >
                  Reopen match
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
      {locked && !canReopen && (
        <p className="text-[11px] text-gray-600">Only KFANDRA can reopen a match.</p>
      )}

      {!locked && (
        <div className="pt-1">
          <button
            type="button"
            data-testid="delete-match"
            disabled={busy}
            onClick={onDelete}
            className="text-[11px] font-semibold text-red-700 hover:underline disabled:opacity-40"
          >
            Delete this draft match
          </button>
          <ErrorNote message={deleteError} testId="delete-error" />
        </div>
      )}
    </section>
  );
}
