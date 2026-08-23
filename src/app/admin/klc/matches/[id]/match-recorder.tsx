"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addAppearanceAction,
  deleteMatchAction,
  removeAppearanceAction,
  reopenMatchAction,
  setSideClubAction,
  setSideScoreAction,
  setStatAction,
  submitMatchAction,
  updateMatchMetaAction,
} from "@/lib/klcsra/actions";
import { SPORTS, SPORT_LABELS, type Sport } from "@/lib/klcsra/sport-stats";
// Straight from the pure modules, never via config.ts — that would pull
// `server-only` into the client bundle and fail the build.
import { STAT_LABELS, type StatKey } from "@/lib/klcsra/stat-rates";
import type {
  AppearanceDraft,
  ClubOption,
  HalfDraft,
  MatchDraft,
  MemberOption,
  PayoutLine,
  SideKey,
} from "@/lib/klcsra/types";
import { ErrorNote } from "../notice";

/** Structural shape of every `ActionResult`; `data` is not needed here. */
type Result = { ok: true } | { ok: false; error: string };

const SIDES: SideKey[] = ["home", "away"];
const SIDE_LABELS: Record<SideKey, string> = { home: "Home", away: "Away" };

export function MatchRecorder({
  match,
  clubs,
  members,
  allowedStats,
  preview,
  canReopen,
}: {
  match: MatchDraft;
  clubs: ClubOption[];
  members: MemberOption[];
  allowedStats: StatKey[];
  preview: PayoutLine[];
  canReopen: boolean;
}) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  // `router.refresh()` inside a transition keeps `pending` true until the new
  // server tree has actually committed, so the controls stay disabled until
  // what they show is the stored truth — a stepper must never send a stale count.
  const [pending, startTransition] = useTransition();
  const busy = working || pending;
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [submitted, setSubmitted] = useState<PayoutLine[] | null>(null);
  const [activeHalf, setActiveHalf] = useState(1);

  const locked = match.status === "submitted";
  const err = (slot: string) => errors[slot] ?? null;

  /**
   * Every mutation goes through here so that no `ActionResult.error` can be
   * dropped: a failure parks the message in its slot, a success re-reads the
   * server (the actions already revalidated it).
   */
  const run = async (slot: string, fn: () => Promise<Result>) => {
    setWorking(true);
    setErrors((e) => ({ ...e, [slot]: null }));
    const res = await fn();
    if (!res.ok) setErrors((e) => ({ ...e, [slot]: res.error }));
    else startTransition(() => router.refresh());
    setWorking(false);
    return res.ok;
  };

  const squad = (side: SideKey) => match.appearances.filter((a) => a.side === side);
  const lines = submitted ?? preview;
  const totalKr = lines.reduce((n, l) => n + l.kr, 0);
  const totalMmg = lines.reduce((n, l) => n + l.mmg, 0);

  return (
    <div className="space-y-5">
      {/* ── 1. Header ─────────────────────────────────────────────────── */}
      <section data-testid="match-header" className="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            data-testid="match-status"
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              locked ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
            }`}
          >
            {match.status}
          </span>
          {match.isCombined && <Tag testId="flag-combined">Combined</Tag>}
          {match.isFriendly && <Tag testId="flag-friendly">Friendly — no Kroopies</Tag>}
          {match.seasonName && <Tag testId="flag-season">{match.seasonName}</Tag>}
        </div>

        <HeaderFields
          key={`${match.entryDate}|${match.sport}|${match.durationMinutes ?? ""}`}
          match={match}
          locked={locked}
          busy={busy}
          onSave={(patch) => run("header", () => updateMatchMetaAction(match.id, patch))}
        />
        <ErrorNote message={err("header")} testId="header-error" />

        {!locked && (
          <div>
            <button
              data-testid="delete-match"
              disabled={busy}
              onClick={async () => {
                if (!confirm("Delete this draft match?")) return;
                const ok = await run("delete", () => deleteMatchAction(match.id));
                if (ok) router.push("/admin/klc/matches");
              }}
              className="text-[11px] font-semibold text-red-700 hover:underline disabled:opacity-40"
            >
              Delete match
            </button>
            <ErrorNote message={err("delete")} testId="delete-error" />
          </div>
        )}
      </section>

      {/* ── 2. Halves: club + score per side ──────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-gray-900">Clubs &amp; score</h3>
        {match.halves.map((half) => (
          <div
            key={half.id}
            data-testid={`half-${half.halfNo}`}
            data-half-no={half.halfNo}
            className="space-y-2 rounded-xl border border-gray-200 bg-white p-3"
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-600">
              {match.isCombined ? `Half ${half.halfNo}` : "Match"}
            </p>
            {SIDES.map((side) => (
              <SideRow
                key={side}
                half={half}
                side={side}
                clubs={clubs}
                locked={locked}
                busy={busy}
                onClub={(clubId) =>
                  run(`half-${half.halfNo}`, () =>
                    setSideClubAction(match.id, half.id, side, clubId),
                  )
                }
                onScore={(score) =>
                  run(`half-${half.halfNo}`, () =>
                    setSideScoreAction(match.id, half.id, side, score),
                  )
                }
              />
            ))}
            <ErrorNote message={err(`half-${half.halfNo}`)} testId={`half-error-${half.halfNo}`} />
          </div>
        ))}
      </section>

      {/* ── 3. Squads ─────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-gray-900">Squads &amp; stats</h3>
          {match.isCombined && (
            <div data-testid="half-toggle" className="flex items-center gap-1">
              <span className="text-[11px] text-gray-600">Recording stats for</span>
              {match.halves.map((h) => (
                <button
                  key={h.id}
                  data-testid={`half-toggle-${h.halfNo}`}
                  onClick={() => setActiveHalf(h.halfNo)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    activeHalf === h.halfNo
                      ? "bg-gray-900 text-white"
                      : "border border-gray-200 bg-white text-gray-700"
                  }`}
                >
                  H{h.halfNo}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="text-[11px] text-gray-600">
          A player belongs to one side for the whole match — adding someone who is
          already on the other side moves them across.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {SIDES.map((side) => (
            <div
              key={side}
              data-testid={`squad-${side}`}
              className="space-y-2 rounded-xl border border-gray-200 bg-white p-3"
            >
              <p className="text-[11px] font-bold uppercase tracking-wide text-gray-600">
                {SIDE_LABELS[side]} — {sideClubLabel(match.halves, side)}
              </p>

              {!locked && (
                <AddPlayer
                  side={side}
                  members={members}
                  appearances={match.appearances}
                  busy={busy}
                  onAdd={(playerId) =>
                    run(`squad-${side}`, () => addAppearanceAction(match.id, playerId, side))
                  }
                />
              )}
              <ErrorNote message={err(`squad-${side}`)} testId={`squad-error-${side}`} />

              {squad(side).length === 0 ? (
                <p className="text-[12px] text-gray-500">No players yet.</p>
              ) : (
                <ul className="space-y-2">
                  {squad(side).map((a) => (
                    <PlayerRow
                      key={a.id}
                      appearance={a}
                      halfNo={activeHalf}
                      allowedStats={allowedStats}
                      locked={locked}
                      busy={busy}
                      error={err(`player-${a.id}`)}
                      onStat={(statKey, count) =>
                        run(`player-${a.id}`, () =>
                          setStatAction(match.id, a.id, activeHalf, statKey, count),
                        )
                      }
                      onRemove={() =>
                        run(`player-${a.id}`, () => removeAppearanceAction(match.id, a.id))
                      }
                    />
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. Submit / Reopen + payouts ──────────────────────────────── */}
      <section className="space-y-2">
        <h3 className="text-sm font-bold text-gray-900">
          {submitted ? "Payouts — submitted" : "Payouts — computed from recorded stats"}
        </h3>

        {locked && (
          <p
            data-testid="lock-banner"
            className="rounded-xl border border-green-300 bg-green-50 px-3 py-2 text-[12px] font-semibold text-green-900"
          >
            Locked — submitted{match.submittedAt ? ` ${fmtStamp(match.submittedAt)}` : ""}.
            {match.seasonName ? ` Season: ${match.seasonName}.` : ""} Reopen it to make changes.
          </p>
        )}
        {match.isFriendly && (
          <p className="text-[11px] text-gray-600">
            Friendly — MMG only, no Kroopies are credited.
          </p>
        )}

        {lines.length === 0 ? (
          <p className="text-[12px] text-gray-500">No players yet — nothing to pay.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table data-testid="payout-table" className="w-full text-[12px]">
              <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="px-3 py-1.5 text-left">Player</th>
                  <th className="px-3 py-1.5 text-left">Club</th>
                  <th className="px-3 py-1.5 text-right">KR</th>
                  <th className="px-3 py-1.5 text-right">MMG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lines.map((l) => (
                  <tr key={l.playerId} data-testid="payout-row" data-player-id={l.playerId}>
                    <td data-testid="payout-player" className="px-3 py-1.5 text-gray-900">
                      {l.displayName}
                    </td>
                    <td data-testid="payout-club" className="px-3 py-1.5 text-gray-600">
                      {l.clubName ?? "—"}
                    </td>
                    <td data-testid="payout-kr" className="px-3 py-1.5 text-right tabular-nums">
                      {l.kr}
                    </td>
                    <td data-testid="payout-mmg" className="px-3 py-1.5 text-right tabular-nums">
                      {l.mmg}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-bold text-gray-900">
                <tr data-testid="payout-total">
                  <td className="px-3 py-1.5" colSpan={2}>
                    Total
                  </td>
                  <td data-testid="payout-total-kr" className="px-3 py-1.5 text-right tabular-nums">
                    {totalKr}
                  </td>
                  <td data-testid="payout-total-mmg" className="px-3 py-1.5 text-right tabular-nums">
                    {totalMmg}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {!locked && (
            <button
              data-testid="submit-match"
              disabled={busy}
              onClick={async () => {
                setWorking(true);
                setErrors((e) => ({ ...e, submit: null }));
                const res = await submitMatchAction(match.id);
                if (res.ok) {
                  setSubmitted(res.data);
                  startTransition(() => router.refresh());
                } else {
                  setErrors((e) => ({ ...e, submit: res.error }));
                }
                setWorking(false);
              }}
              className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              Submit match
            </button>
          )}
          {locked && canReopen && (
            <button
              data-testid="reopen-match"
              disabled={busy}
              onClick={async () => {
                const ok = await run("reopen", () => reopenMatchAction(match.id));
                if (ok) setSubmitted(null);
              }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 disabled:opacity-40"
            >
              Reopen match
            </button>
          )}
          {locked && !canReopen && (
            <span className="text-[11px] text-gray-600">Only KFANDRA can reopen a match.</span>
          )}
        </div>
        <ErrorNote message={err("submit")} testId="submit-error" />
        <ErrorNote message={err("reopen")} testId="reopen-error" />
      </section>
    </div>
  );
}

// ── header ──────────────────────────────────────────────────────────────────

function HeaderFields({
  match,
  locked,
  busy,
  onSave,
}: {
  match: MatchDraft;
  locked: boolean;
  busy: boolean;
  onSave: (patch: { entryDate: string; sport: Sport; durationMinutes: number | null }) => void;
}) {
  const [date, setDate] = useState(match.entryDate);
  const [sport, setSport] = useState<Sport>(match.sport);
  const [duration, setDuration] = useState(
    match.durationMinutes === null ? "" : String(match.durationMinutes),
  );

  const dirty =
    date !== match.entryDate ||
    sport !== match.sport ||
    duration.trim() !== (match.durationMinutes === null ? "" : String(match.durationMinutes));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        data-testid="header-date"
        aria-label="Match date"
        value={date}
        disabled={locked}
        onChange={(e) => setDate(e.target.value)}
        className="rounded-lg border border-gray-200 px-2 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-500"
      />
      <select
        data-testid="header-sport"
        aria-label="Sport"
        value={sport}
        disabled={locked}
        onChange={(e) => setSport(e.target.value as Sport)}
        className="rounded-lg border border-gray-200 px-2 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-500"
      >
        {SPORTS.map((s) => (
          <option key={s} value={s}>
            {SPORT_LABELS[s]}
          </option>
        ))}
      </select>
      <input
        type="number"
        min={1}
        data-testid="header-duration"
        aria-label="Duration in minutes"
        placeholder="mins"
        value={duration}
        disabled={locked}
        onChange={(e) => setDuration(e.target.value)}
        className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm tabular-nums disabled:bg-gray-50 disabled:text-gray-500"
      />
      {!locked && (
        <button
          data-testid="header-save"
          disabled={busy || !dirty}
          onClick={() =>
            onSave({
              entryDate: date,
              sport,
              // Empty clears the duration; the action rejects 0.
              durationMinutes: duration.trim() === "" ? null : Number(duration),
            })
          }
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          Save
        </button>
      )}
    </div>
  );
}

// ── one side of one half ────────────────────────────────────────────────────

function SideRow({
  half,
  side,
  clubs,
  locked,
  busy,
  onClub,
  onScore,
}: {
  half: HalfDraft;
  side: SideKey;
  clubs: ClubOption[];
  locked: boolean;
  busy: boolean;
  onClub: (clubId: string) => void;
  onScore: (score: number) => void;
}) {
  // Sides are created lazily: a side with no club chosen has NO row at all.
  const stored = half.sides.find((s) => s.side === side) ?? null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-12 text-[11px] font-semibold text-gray-600">
        {SIDE_LABELS[side]}
      </span>
      <select
        data-testid={`club-select-${half.halfNo}-${side}`}
        aria-label={`${SIDE_LABELS[side]} club, half ${half.halfNo}`}
        value={stored?.clubId ?? ""}
        disabled={locked || busy}
        onChange={(e) => onClub(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1 text-sm disabled:bg-gray-50 disabled:text-gray-500"
      >
        <option value="">— pick a club —</option>
        {clubs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <ScoreInput
        key={`${half.id}-${side}-${stored?.score ?? 0}`}
        halfNo={half.halfNo}
        side={side}
        score={stored?.score ?? 0}
        locked={locked}
        busy={busy}
        onScore={onScore}
      />
    </div>
  );
}

function ScoreInput({
  halfNo,
  side,
  score,
  locked,
  busy,
  onScore,
}: {
  halfNo: number;
  side: SideKey;
  score: number;
  locked: boolean;
  busy: boolean;
  onScore: (score: number) => void;
}) {
  const [value, setValue] = useState(String(score));
  const dirty = value.trim() !== "" && Number(value) !== score;
  return (
    <>
      <input
        type="number"
        min={0}
        data-testid={`score-input-${halfNo}-${side}`}
        aria-label={`${SIDE_LABELS[side]} score, half ${halfNo}`}
        value={value}
        disabled={locked}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && dirty) onScore(Number(value));
        }}
        className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-right text-sm tabular-nums disabled:bg-gray-50 disabled:text-gray-500"
      />
      {!locked && (
        <button
          data-testid={`score-save-${halfNo}-${side}`}
          disabled={busy || !dirty}
          onClick={() => onScore(Number(value))}
          className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold text-gray-800 disabled:opacity-40"
        >
          Save
        </button>
      )}
    </>
  );
}

// ── squad ───────────────────────────────────────────────────────────────────

function AddPlayer({
  side,
  members,
  appearances,
  busy,
  onAdd,
}: {
  side: SideKey;
  members: MemberOption[];
  appearances: AppearanceDraft[];
  busy: boolean;
  onAdd: (playerId: string) => void;
}) {
  const [playerId, setPlayerId] = useState("");
  const bySide = new Map(appearances.map((a) => [a.playerId, a.side]));
  return (
    <div className="flex items-center gap-2">
      <select
        data-testid={`member-select-${side}`}
        aria-label={`Add a player to ${SIDE_LABELS[side]}`}
        value={playerId}
        disabled={busy}
        onChange={(e) => setPlayerId(e.target.value)}
        className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1 text-sm"
      >
        <option value="">— pick a player —</option>
        {members.map((m) => {
          const on = bySide.get(m.id);
          return (
            <option key={m.id} value={m.id}>
              {m.displayName}
              {on ? ` (${SIDE_LABELS[on].toLowerCase()})` : ""}
            </option>
          );
        })}
      </select>
      <button
        data-testid={`add-player-${side}`}
        disabled={busy || !playerId}
        onClick={() => {
          onAdd(playerId);
          setPlayerId("");
        }}
        className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
      >
        Add
      </button>
    </div>
  );
}

function PlayerRow({
  appearance,
  halfNo,
  allowedStats,
  locked,
  busy,
  error,
  onStat,
  onRemove,
}: {
  appearance: AppearanceDraft;
  halfNo: number;
  allowedStats: StatKey[];
  locked: boolean;
  busy: boolean;
  error: string | null;
  onStat: (statKey: StatKey, count: number) => void;
  onRemove: () => void;
}) {
  const counts = appearance.stats[halfNo] ?? {};
  return (
    <li
      data-testid="player-row"
      data-appearance-id={appearance.id}
      data-player-id={appearance.playerId}
      className="rounded-lg border border-gray-100 bg-gray-50 p-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span data-testid="player-name" className="text-sm font-semibold text-gray-900">
          {appearance.displayName}
        </span>
        {!locked && (
          <button
            data-testid="remove-player"
            disabled={busy}
            onClick={onRemove}
            className="text-[11px] font-semibold text-red-700 hover:underline disabled:opacity-40"
          >
            Remove
          </button>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {allowedStats.map((key) => {
          const count = counts[key] ?? 0;
          return (
            <span
              key={key}
              data-testid="stat-cell"
              data-stat-key={key}
              data-stat-count={count}
              className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] ${
                count > 0 ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-white"
              }`}
            >
              {!locked && (
                <button
                  data-testid="stat-dec"
                  aria-label={`Remove one ${STAT_LABELS[key]}`}
                  disabled={busy || count === 0}
                  onClick={() => onStat(key, count - 1)}
                  className="px-0.5 font-bold text-gray-700 disabled:opacity-30"
                >
                  −
                </button>
              )}
              <span className="text-gray-700">{STAT_LABELS[key]}</span>
              <span data-testid="stat-count" className="font-bold tabular-nums text-gray-900">
                {count}
              </span>
              {!locked && (
                <button
                  data-testid="stat-inc"
                  aria-label={`Add one ${STAT_LABELS[key]}`}
                  disabled={busy}
                  onClick={() => onStat(key, count + 1)}
                  className="px-0.5 font-bold text-gray-700 disabled:opacity-30"
                >
                  +
                </button>
              )}
            </span>
          );
        })}
      </div>
      <ErrorNote message={error} testId="player-error" />
    </li>
  );
}

// ── bits ────────────────────────────────────────────────────────────────────

function Tag({ children, testId }: { children: React.ReactNode; testId: string }) {
  return (
    <span
      data-testid={testId}
      className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800"
    >
      {children}
    </span>
  );
}

/** "Cicadas / Hornets" — every distinct club that led this side, in half order. */
function sideClubLabel(halves: HalfDraft[], side: SideKey): string {
  const names: string[] = [];
  for (const h of halves) {
    const name = h.sides.find((s) => s.side === side)?.clubName;
    if (name && !names.includes(name)) names.push(name);
  }
  return names.length > 0 ? names.join(" / ") : "TBD";
}

/**
 * UTC, formatted identically on the server and in the browser. A locale-aware
 * format would hydrate differently whenever the two disagree on timezone.
 */
function fmtStamp(iso: string): string {
  return `${new Date(iso).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
