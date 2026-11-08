"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { clubOnBothSlots, sentSides, type MatchPermissions } from "@/lib/klcsra/access";
import { sideClubLabel } from "@/lib/klcsra/league-data";
import { leaguePointsLine } from "@/lib/klcsra/points-preview";
import type { StandingsRules } from "@/lib/klcsra/standings-rules";
import { goalTally, officialScore } from "@/lib/klcsra/tally";
import type { MatchDraft, PayoutLine, SideKey } from "@/lib/klcsra/types";
import { ErrorNote, SIDE_LABELS, fmtStamp, signed } from "./recorder-shared";

/**
 * Screen 6 — where a match moves on (spec §3).
 *
 *  - A manager sends their own team (Send my team), then waits.
 *  - Staff see the managers' goal tally next to the official score, make the
 *    match official, or send it back.
 *  - KFANDRA reopens an official match.
 *
 * The checks are ADVISORY: the buttons stay enabled whatever they say, so the
 * refusal shown is always the action's own wording.
 */
export function SubmitPanel({
  match,
  lines,
  locked,
  busy,
  perms,
  canEdit,
  isStaff,
  owned,
  hasActiveSeason,
  seasonName,
  submittedBy,
  rules,
  submitError,
  sendBackError,
  reopenError,
  deleteError,
  onSend,
  onMakeOfficial,
  onSendBack,
  onReopen,
  onDelete,
}: {
  match: MatchDraft;
  lines: PayoutLine[];
  /** The match is official (submitted). */
  locked: boolean;
  busy: boolean;
  perms: MatchPermissions;
  /** False for a read-only viewer of an official match: editor-only hints are hidden. */
  canEdit: boolean;
  isStaff: boolean;
  /** The teams led by a club this viewer manages. */
  owned: SideKey[];
  hasActiveSeason: boolean;
  seasonName: string | null;
  submittedBy: string | null;
  rules: StandingsRules;
  submitError: string | null;
  sendBackError: string | null;
  reopenError: string | null;
  deleteError: string | null;
  onSend: (side: SideKey) => void;
  onMakeOfficial: () => void;
  onSendBack: () => void;
  onReopen: () => void;
  onDelete: () => void;
}) {
  const [confirmReopen, setConfirmReopen] = useState(false);

  const totalKr = lines.reduce((n, l) => n + l.kr, 0);
  const totalMmg = lines.reduce((n, l) => n + l.mmg, 0);
  const sent = sentSides(match);

  // Sides are created lazily, so "fewer than two rows" IS "a club is missing".
  const clubsOk = match.halves.length > 0 && match.halves.every((h) => h.sides.length === 2);
  const checks: { ok: boolean; label: string }[] = [
    {
      ok: clubsOk,
      label: match.isCombined ? "Clubs picked for both halves" : "Clubs picked for both sides",
    },
  ];
  if (perms.makeOfficial) {
    checks.push({ ok: match.appearances.length > 0, label: "At least one player added" });
  } else {
    for (const side of perms.send) {
      checks.push({
        ok: match.appearances.some((a) => a.side === side),
        label: perms.send.length > 1
          ? `At least one player in the ${SIDE_LABELS[side]} team`
          : "At least one player in your team",
      });
    }
  }
  const twoSided = clubOnBothSlots(match.halves);
  if (twoSided !== null) {
    const name =
      match.halves.flatMap((h) => h.sides).find((s) => s.clubId === twoSided)?.clubName ?? "A club";
    checks.push({ ok: false, label: `${name} is on both sides of this match` });
  }
  if (perms.makeOfficial && !match.isFriendly) {
    checks.push({
      ok: hasActiveSeason,
      label: hasActiveSeason
        ? `Active season — ${seasonName}`
        : "No active season. Start one in Seasons first.",
    });
  }
  const showChecks = perms.makeOfficial || perms.send.length > 0;

  // A manager never sees a league score before it is official.
  const showPoints = match.isFriendly || isStaff || locked;
  const points = leaguePointsLine(match, rules);

  const showTally = isStaff && !locked && !match.isFriendly;
  const tally = goalTally(match);
  const score = officialScore(match);
  const mismatch = tally.home !== score.home || tally.away !== score.away;

  return (
    <section className="space-y-3">
      {locked && (
        <div
          data-testid="lock-banner"
          className="space-y-1 rounded-2xl border border-green-300 bg-green-50 px-3 py-2.5"
        >
          <p className="text-[12px] font-bold text-green-900">
            {match.isFriendly ? "Locked — submitted" : "Official"}
            {match.submittedAt ? ` ${fmtStamp(match.submittedAt)}` : ""}.
            {match.seasonName ? ` Season: ${match.seasonName}.` : ""}
            {canEdit && perms.reopen ? " Reopen it to make changes." : ""}
          </p>
          <p data-testid="audit-line" className="text-[11px] text-green-800">
            {match.isFriendly ? "Submitted by" : "Made official by"} {submittedBy ?? "—"}
            {match.submittedAt ? ` · ${fmtStamp(match.submittedAt)}` : ""}
          </p>
        </div>
      )}

      {!locked && match.status === "sent" && !isStaff && (
        <p
          data-testid="waiting-banner"
          className="rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12px] font-semibold text-amber-900"
        >
          Sent to KFANDRA. Waiting for KFANDRA to make this official.
        </p>
      )}
      {!locked && match.status === "draft" && !isStaff && canEdit && perms.send.length === 0
        && (sent.home || sent.away) && (
        <p
          data-testid="sent-note"
          className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[12px] text-gray-700"
        >
          {owned.length > 0 && owned.every((side) => sent[side])
            ? "Your team has been sent. Waiting for the other club to send theirs."
            : `${sentLabel(sent)} sent. Waiting for the other team.`}
        </p>
      )}
      {!locked && match.status === "sent" && isStaff && (
        <p
          data-testid="staff-sent-note"
          className="rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900"
        >
          Both teams have been sent. Check the match, enter the score and make it official.
        </p>
      )}

      {showChecks && (
        <div
          data-testid="submit-checks"
          className="space-y-1.5 rounded-2xl border border-gray-200 bg-white p-4"
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
            {perms.makeOfficial ? "Before submitting" : "Before sending"}
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

      {showTally && (
        <div
          data-testid="tally"
          data-mismatch={mismatch}
          className={`space-y-1 rounded-2xl border p-4 ${
            mismatch ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white"
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
            Recorded goals
          </p>
          <p data-testid="tally-line" className="text-[12px] font-semibold tabular-nums text-gray-900">
            {sideClubLabel(match, "home", { counted: true })} {tally.home} – {tally.away}{" "}
            {sideClubLabel(match, "away", { counted: true })}
          </p>
          {mismatch && (
            <p data-testid="tally-mismatch" className="text-[12px] text-amber-900">
              Differs from the recorded goals. Your score is used.
            </p>
          )}
        </div>
      )}

      {showPoints && (
        <div data-testid="league-points" className="space-y-1 rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">League points</p>
          {points.kind === "friendly" ? (
            <p className="text-[12px] text-gray-600">Friendly — no league points.</p>
          ) : points.kind === "incomplete" ? (
            <p className="text-[12px] text-gray-500">Pick both clubs to see the points.</p>
          ) : (
            <p data-testid="league-points-line" className="text-[12px] font-semibold tabular-nums text-gray-900">
              {points.text}
            </p>
          )}
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

      {perms.send.map((side) => (
        <button
          key={side}
          type="button"
          data-testid={`send-team-${side}`}
          disabled={busy}
          onClick={() => onSend(side)}
          className="w-full rounded-2xl bg-green-600 px-4 py-3.5 text-sm font-bold text-white shadow-sm disabled:opacity-40"
        >
          {perms.send.length > 1 ? `Send ${SIDE_LABELS[side]} team` : "Send my team"}
        </button>
      ))}
      {perms.send.length > 0 && (
        <p className="text-[11px] text-gray-500">
          After sending, you can&apos;t change your team. KFANDRA can send it back if needed.
        </p>
      )}

      {perms.makeOfficial && (
        <button
          type="button"
          data-testid="submit-match"
          disabled={busy}
          onClick={onMakeOfficial}
          className="w-full rounded-2xl bg-green-600 px-4 py-3.5 text-sm font-bold text-white shadow-sm disabled:opacity-40"
        >
          {match.isFriendly ? "Submit & lock" : "Make official"}
        </button>
      )}
      <ErrorNote message={submitError} testId="submit-error" />

      {perms.sendBack && (
        <>
          <button
            type="button"
            data-testid="send-back"
            disabled={busy}
            onClick={onSendBack}
            className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-bold text-gray-800 disabled:opacity-40"
          >
            Send back to managers
          </button>
          <ErrorNote message={sendBackError} testId="send-back-error" />
        </>
      )}

      {locked && perms.reopen && (
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
                  {match.isFriendly
                    ? "Reopening takes it back to Draft for both clubs, "
                    : "Reopening takes it back to Waiting for KFANDRA, "}
                  clears the season tag and re-opens totals that may already have been read
                  as final.
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
      {locked && canEdit && !perms.reopen && (
        <p className="text-[11px] text-gray-600">Only KFANDRA can reopen a match.</p>
      )}

      {perms.deleteDraft && (
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

/** "The Home team has been sent" style wording, for a viewer who sent neither. */
function sentLabel(sent: Record<SideKey, boolean>): string {
  const sides = (["home", "away"] as const).filter((s) => sent[s]);
  return sides.length === 2
    ? "Both teams have been"
    : `The ${SIDE_LABELS[sides[0]]} team has been`;
}
