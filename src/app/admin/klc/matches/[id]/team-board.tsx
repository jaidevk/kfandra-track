"use client";

import { useState } from "react";
import type {
  AppearanceDraft,
  HalfDraft,
  MatchDraft,
  MemberOption,
  SideKey,
} from "@/lib/klcsra/types";
import {
  ErrorNote,
  SIDES,
  SIDE_LABELS,
  SQUAD_SLOTS,
  signed,
  type RecorderClub,
} from "./recorder-shared";

/** What a squad slot shows beside the player's name. */
export interface SlotSummary {
  events: number;
  kr: number;
  mmg: number;
}

/**
 * Screens 3 and 5 — the scoreboard, the H1/H2 tabs and the two team cards.
 *
 * Squads are MATCH-level (`unique (match_id, player_id)`), so the roster is
 * drawn once and carries across both halves; only the club leading a side and
 * the stats are per-half. The copy under the tabs says so, because the tabs
 * would otherwise imply two separate squads.
 */
export function TeamBoard({
  match,
  clubs,
  members,
  activeHalf,
  onHalf,
  locked,
  busy,
  summaries,
  errorFor,
  onClub,
  onScore,
  onAdd,
  onRemove,
  onOpenStats,
  onSwapClubs,
}: {
  match: MatchDraft;
  clubs: RecorderClub[];
  members: MemberOption[];
  activeHalf: number;
  onHalf: (halfNo: number) => void;
  locked: boolean;
  busy: boolean;
  summaries: Map<string, SlotSummary>;
  errorFor: (slot: string) => string | null;
  onClub: (half: HalfDraft, side: SideKey, clubId: string) => void;
  onScore: (half: HalfDraft, side: SideKey, score: number) => void;
  onAdd: (side: SideKey, playerId: string) => void;
  onRemove: (appearanceId: string) => void;
  onOpenStats: (appearanceId: string) => void;
  onSwapClubs: () => void;
}) {
  const half = match.halves.find((h) => h.halfNo === activeHalf) ?? match.halves[0];
  const [swapDismissed, setSwapDismissed] = useState(false);

  const clubOf = (h: HalfDraft, side: SideKey) => h.sides.find((s) => s.side === side) ?? null;
  const aggregate = (side: SideKey) =>
    match.halves.reduce((n, h) => n + (clubOf(h, side)?.score ?? 0), 0);

  const firstHalf = match.halves.find((h) => h.halfNo === 1);
  // The one-time prompt: half 2 is open, half 1 has both clubs, half 2 has none.
  const canSwap =
    !locked &&
    match.isCombined &&
    half !== undefined &&
    half.halfNo === 2 &&
    half.sides.length === 0 &&
    (firstHalf?.sides.length ?? 0) === 2 &&
    !swapDismissed;

  if (!half) {
    return (
      <p className="rounded-2xl border border-gray-200 bg-white p-4 text-[12px] text-gray-600">
        This match has no halves.
      </p>
    );
  }

  return (
    <section className="space-y-3">
      {match.isCombined && (
        <>
          <p
            data-testid="aggregate-line"
            className="text-center text-[11px] font-semibold text-gray-600"
          >
            Aggregate {aggregate("home")} – {aggregate("away")}
            {match.halves.map((h) => (
              <span key={h.id} className="text-gray-400">
                {" "}
                · H{h.halfNo} {clubOf(h, "home")?.score ?? 0}–{clubOf(h, "away")?.score ?? 0}
              </span>
            ))}
          </p>
          <div
            data-testid="half-toggle"
            role="tablist"
            aria-label="Half"
            className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1"
          >
            {match.halves.map((h) => {
              const on = h.halfNo === half.halfNo;
              return (
                <button
                  key={h.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  data-testid={`half-toggle-${h.halfNo}`}
                  onClick={() => onHalf(h.halfNo)}
                  className={`rounded-lg py-2 text-[12px] font-bold ${
                    on ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                  }`}
                >
                  Half {h.halfNo}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Unified dark scoreboard bar, spanning both teams. */}
      <div data-testid="scoreboard" className="rounded-2xl bg-gray-900 px-3 py-3 text-white">
        <p className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">
          {match.isCombined ? `Half ${half.halfNo}` : "Match"}
        </p>
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <p className="min-w-0 truncate text-right text-[12px] font-bold">
            {clubOf(half, "home")?.clubName ?? <span className="text-gray-500">Home TBD</span>}
          </p>
          <div className="flex items-center gap-1.5">
            <ScoreInput
              key={`${half.id}-home`}
              halfNo={half.halfNo}
              side="home"
              score={clubOf(half, "home")?.score ?? 0}
              locked={locked}
              onScore={(n) => onScore(half, "home", n)}
            />
            <span className="text-lg font-black text-gray-600">–</span>
            <ScoreInput
              key={`${half.id}-away`}
              halfNo={half.halfNo}
              side="away"
              score={clubOf(half, "away")?.score ?? 0}
              locked={locked}
              onScore={(n) => onScore(half, "away", n)}
            />
          </div>
          <p className="min-w-0 truncate text-left text-[12px] font-bold">
            {clubOf(half, "away")?.clubName ?? <span className="text-gray-500">Away TBD</span>}
          </p>
        </div>
      </div>
      <ErrorNote message={errorFor(`half-${half.halfNo}`)} testId={`half-error-${half.halfNo}`} />

      {canSwap && firstHalf && (
        <div
          data-testid="swap-prompt"
          className="space-y-2 rounded-2xl border border-blue-200 bg-blue-50 p-3"
        >
          <p className="text-[12px] font-semibold text-blue-900">
            Second half — swap the clubs over? Home would lead with{" "}
            {clubOf(firstHalf, "away")?.clubName ?? "—"} and away with{" "}
            {clubOf(firstHalf, "home")?.clubName ?? "—"}.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              data-testid="swap-clubs"
              disabled={busy}
              onClick={() => {
                setSwapDismissed(true);
                onSwapClubs();
              }}
              className="rounded-lg bg-blue-700 px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-40"
            >
              Swap clubs
            </button>
            <button
              type="button"
              data-testid="swap-dismiss"
              onClick={() => setSwapDismissed(true)}
              className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-[12px] font-bold text-blue-800"
            >
              Keep as is
            </button>
          </div>
        </div>
      )}

      {match.isCombined && (
        <p className="text-[11px] text-gray-500">
          The squad is the same for both halves — only the clubs and the stats change at
          half-time.
        </p>
      )}

      <div className="grid gap-3">
        {SIDES.map((side) => (
          <TeamCard
            key={side}
            match={match}
            half={half}
            side={side}
            clubs={clubs}
            members={members}
            locked={locked}
            busy={busy}
            summaries={summaries}
            errorFor={errorFor}
            onClub={(clubId) => onClub(half, side, clubId)}
            onAdd={(playerId) => onAdd(side, playerId)}
            onRemove={onRemove}
            onOpenStats={onOpenStats}
          />
        ))}
      </div>
    </section>
  );
}

// ── one team ────────────────────────────────────────────────────────────────

function TeamCard({
  match,
  half,
  side,
  clubs,
  members,
  locked,
  busy,
  summaries,
  errorFor,
  onClub,
  onAdd,
  onRemove,
  onOpenStats,
}: {
  match: MatchDraft;
  half: HalfDraft;
  side: SideKey;
  clubs: RecorderClub[];
  members: MemberOption[];
  locked: boolean;
  busy: boolean;
  summaries: Map<string, SlotSummary>;
  errorFor: (slot: string) => string | null;
  onClub: (clubId: string) => void;
  onAdd: (playerId: string) => void;
  onRemove: (appearanceId: string) => void;
  onOpenStats: (appearanceId: string) => void;
}) {
  const stored = half.sides.find((s) => s.side === side) ?? null;
  const club = clubs.find((c) => c.id === stored?.clubId) ?? null;
  const squad = match.appearances.filter((a) => a.side === side);
  const slots = squad.slice(0, SQUAD_SLOTS);
  const overflow = squad.slice(SQUAD_SLOTS);
  const empties = Math.max(0, SQUAD_SLOTS - slots.length);

  return (
    <div
      data-testid={`squad-${side}`}
      className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-700">
          {SIDE_LABELS[side]}
        </span>
        <span className="text-[11px] font-semibold text-gray-500">
          {squad.length} {squad.length === 1 ? "player" : "players"}
        </span>
      </div>

      <select
        data-testid={`club-select-${half.halfNo}-${side}`}
        aria-label={`${SIDE_LABELS[side]} club, half ${half.halfNo}`}
        value={stored?.clubId ?? ""}
        disabled={locked || busy}
        onChange={(e) => onClub(e.target.value)}
        className="w-full rounded-xl border border-gray-200 px-2 py-2 text-sm font-semibold disabled:bg-gray-50 disabled:text-gray-500"
      >
        <option value="">— pick a club —</option>
        {clubs.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-gray-600">
        Manager — <span className="font-semibold text-gray-800">{club?.managerName || "—"}</span>
      </p>

      <div className="grid grid-cols-2 gap-2">
        {slots.map((a) => (
          <Slot
            key={a.id}
            appearance={a}
            summary={summaries.get(a.id)}
            isFriendly={match.isFriendly}
            locked={locked}
            busy={busy}
            error={errorFor(`player-${a.id}`)}
            onRemove={() => onRemove(a.id)}
            onOpen={() => onOpenStats(a.id)}
          />
        ))}
        {/* A locked match is a record, not a form — no placeholders. */}
        {Array.from({ length: locked ? 0 : empties }, (_, i) => (
          <div
            key={`empty-${i}`}
            data-testid="empty-slot"
            className="flex min-h-[74px] items-center justify-center rounded-xl border border-dashed border-gray-300 text-[10px] font-bold uppercase tracking-wide text-gray-400"
          >
            Empty
          </div>
        ))}
      </div>

      {overflow.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
            Extra players
          </p>
          {overflow.map((a) => (
            <Slot
              key={a.id}
              appearance={a}
              summary={summaries.get(a.id)}
              isFriendly={match.isFriendly}
              locked={locked}
              busy={busy}
              error={errorFor(`player-${a.id}`)}
              onRemove={() => onRemove(a.id)}
              onOpen={() => onOpenStats(a.id)}
            />
          ))}
        </div>
      )}

      {!locked && (
        <AddPlayer
          side={side}
          members={members}
          appearances={match.appearances}
          busy={busy}
          onAdd={onAdd}
        />
      )}
      <ErrorNote message={errorFor(`squad-${side}`)} testId={`squad-error-${side}`} />
    </div>
  );
}

/**
 * One squad slot: the player, their event count, and the KR delta they have
 * earned so far. A friendly pays no Kroopies, so its pill shows MMG instead —
 * a permanent `0 KR` would read as "this player did nothing".
 */
function Slot({
  appearance,
  summary,
  isFriendly,
  locked,
  busy,
  error,
  onRemove,
  onOpen,
}: {
  appearance: AppearanceDraft;
  summary: SlotSummary | undefined;
  isFriendly: boolean;
  locked: boolean;
  busy: boolean;
  error: string | null;
  onRemove: () => void;
  onOpen: () => void;
}) {
  const events = summary?.events ?? 0;
  const delta = isFriendly ? (summary?.mmg ?? 0) : (summary?.kr ?? 0);
  const unit = isFriendly ? "MMG" : "KR";
  const tone =
    delta > 0
      ? "bg-green-100 text-green-800"
      : delta < 0
        ? "bg-red-100 text-red-800"
        : "bg-gray-100 text-gray-500";

  return (
    <div
      data-testid="player-row"
      data-appearance-id={appearance.id}
      data-player-id={appearance.playerId}
      className="relative rounded-xl border border-gray-200 bg-gray-50"
    >
      {!locked && (
        <button
          type="button"
          data-testid="remove-player"
          aria-label={`Remove ${appearance.displayName}`}
          disabled={busy}
          onClick={onRemove}
          className="absolute right-1 top-1 z-10 h-5 w-5 rounded-full text-[13px] font-bold leading-none text-gray-400 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
        >
          ×
        </button>
      )}
      <button
        type="button"
        data-testid="open-stats"
        onClick={onOpen}
        className="block w-full min-h-[74px] rounded-xl p-2 text-left"
      >
        <span
          data-testid="player-name"
          className="block truncate pr-5 text-[12px] font-bold text-gray-900"
        >
          {appearance.displayName}
        </span>
        <span data-testid="event-count" className="mt-0.5 block text-[10px] text-gray-500">
          {events} {events === 1 ? "event" : "events"}
        </span>
        <span
          data-testid="kr-delta"
          className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${tone}`}
        >
          {signed(delta)} {unit}
        </span>
      </button>
      <ErrorNote message={error} testId="player-error" />
    </div>
  );
}

/**
 * One flat list of every active member.
 *
 * A player already in the match is DISABLED with a `(home)` / `(away)` suffix:
 * `unique (match_id, player_id)` means they cannot be on both sides, and
 * showing that is kinder than letting the write fail. To move someone, remove
 * them from their current side first.
 */
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
        className="min-w-0 flex-1 rounded-xl border border-gray-200 px-2 py-2 text-sm"
      >
        <option value="">— add a player —</option>
        {members.map((m) => {
          const on = bySide.get(m.id);
          return (
            <option key={m.id} value={m.id} disabled={on !== undefined}>
              {m.displayName}
              {on ? ` (${on})` : ""}
            </option>
          );
        })}
      </select>
      <button
        type="button"
        data-testid={`add-player-${side}`}
        disabled={busy || !playerId}
        onClick={() => {
          onAdd(playerId);
          setPlayerId("");
        }}
        className="rounded-xl bg-gray-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
      >
        Add
      </button>
    </div>
  );
}

/**
 * A score box in the dark bar. Autosaves on a debounce (the caller owns the
 * timer), so there is no Save button — the badge in the header reports it.
 */
function ScoreInput({
  halfNo,
  side,
  score,
  locked,
  onScore,
}: {
  halfNo: number;
  side: SideKey;
  score: number;
  locked: boolean;
  onScore: (score: number) => void;
}) {
  const [value, setValue] = useState(String(score));
  return (
    <input
      type="number"
      min={0}
      inputMode="numeric"
      data-testid={`score-input-${halfNo}-${side}`}
      aria-label={`${SIDE_LABELS[side]} score, half ${halfNo}`}
      value={value}
      disabled={locked}
      onChange={(e) => {
        setValue(e.target.value);
        const raw = e.target.value.trim();
        if (raw !== "" && Number.isFinite(Number(raw))) onScore(Number(raw));
      }}
      className="w-14 rounded-xl bg-white/10 px-1 py-1.5 text-center text-xl font-black tabular-nums text-white outline-none focus:bg-white/20 disabled:opacity-70"
    />
  );
}
