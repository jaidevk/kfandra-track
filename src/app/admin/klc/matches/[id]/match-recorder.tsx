"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
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
import { computePlayerPayout } from "@/lib/klcsra/payouts";
import type { Sport } from "@/lib/klcsra/sport-stats";
// Straight from the pure modules, never via config.ts — that would pull
// `server-only` into the client bundle and fail the build.
import type { StatKey, StatRates } from "@/lib/klcsra/stat-rates";
import type {
  HalfDraft,
  MatchDraft,
  MemberOption,
  PayoutLine,
  SideKey,
} from "@/lib/klcsra/types";
import { RecorderHeader } from "./recorder-header";
import { type RecorderClub, type Result, type SyncStatus } from "./recorder-shared";
import { StatsDialog } from "./stats-dialog";
import { SubmitPanel } from "./submit-panel";
import { TeamBoard, type SlotSummary } from "./team-board";

/**
 * The KLCSRA match recorder — Phase 3 (Screens 2 to 6).
 *
 * Phase 2's server actions are untouched underneath; this is the presentation.
 * Two things shape the whole file:
 *
 *  1. **Autosave, not Save buttons.** Header fields, scores and stat taps write
 *     on a debounce and report through one `SyncBadge` in the header. Every
 *     `ActionResult.error` still lands inline, verbatim — the action layer's
 *     wording is what KFANDRA is meant to read.
 *  2. **Optimistic stat counts.** A stat tap must move the number under the
 *     thumb, so taps write to `statOverlay` immediately and the KR/MMG figures
 *     are recomputed here with the same pure `computePlayerPayout` the server
 *     uses. A failed write drops its overlay entry, so the UI falls back to
 *     stored truth rather than lying.
 */
export function MatchRecorder({
  match,
  clubs,
  members,
  allowedStats,
  rates,
  canReopen,
  activeSeasonName,
  submittedBy,
}: {
  match: MatchDraft;
  clubs: RecorderClub[];
  members: MemberOption[];
  allowedStats: StatKey[];
  rates: StatRates;
  canReopen: boolean;
  /** The season a league match would be tagged with today, or null. */
  activeSeasonName: string | null;
  submittedBy: string | null;
}) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  // `router.refresh()` inside a transition keeps `pending` true until the new
  // server tree has committed, so a control that must not fire twice stays
  // disabled until what it shows is stored truth.
  const [pending, startTransition] = useTransition();
  const busy = working || pending;

  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [sync, setSync] = useState<SyncStatus>("idle");
  const [activeHalf, setActiveHalf] = useState(1);
  const [openAppearanceId, setOpenAppearanceId] = useState<string | null>(null);
  /** `${appearanceId}|${halfNo}|${statKey}` → optimistic tally. */
  const [statOverlay, setStatOverlay] = useState<Record<string, number>>({});

  const locked = match.status === "submitted";
  const err = (slot: string) => errors[slot] ?? null;

  // ── mutation plumbing ─────────────────────────────────────────────────────

  /** An immediate mutation (club, squad, submit): disables, then re-reads. */
  const run = useCallback(
    async (slot: string, fn: () => Promise<Result>) => {
      setWorking(true);
      setErrors((e) => ({ ...e, [slot]: null }));
      const res = await fn();
      if (!res.ok) setErrors((e) => ({ ...e, [slot]: res.error }));
      else startTransition(() => router.refresh());
      setWorking(false);
      return res.ok;
    },
    [router],
  );

  // Debounced writes, one timer per field. Held in a ref so a re-render (there
  // is one after every refresh) cannot drop a scheduled save.
  const pendingSaves = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; go: () => void }>());
  useEffect(() => {
    const saves = pendingSaves.current;
    return () => {
      for (const { timer } of saves.values()) clearTimeout(timer);
    };
  }, []);

  const autosave = useCallback(
    (
      key: string,
      slot: string,
      fn: () => Promise<Result>,
      opts: { delay?: number; refresh?: boolean; onFail?: () => void } = {},
    ) => {
      const { delay = 700, refresh = true, onFail } = opts;
      setSync("saving");
      const existing = pendingSaves.current.get(key);
      if (existing) clearTimeout(existing.timer);

      const go = async () => {
        pendingSaves.current.delete(key);
        setErrors((e) => ({ ...e, [slot]: null }));
        const res = await fn();
        if (!res.ok) {
          setErrors((e) => ({ ...e, [slot]: res.error }));
          setSync("error");
          onFail?.();
          return;
        }
        setSync("saved");
        if (refresh) startTransition(() => router.refresh());
      };

      pendingSaves.current.set(key, {
        timer: setTimeout(() => void go(), delay),
        go: () => void go(),
      });
    },
    [router],
  );

  /** Fire every scheduled save now (leaving the popup, submitting). */
  const flushSaves = useCallback(() => {
    const queued = [...pendingSaves.current.values()];
    pendingSaves.current.clear();
    for (const { timer, go } of queued) {
      clearTimeout(timer);
      go();
    }
  }, []);

  // ── derived: optimistic stats, payout lines, slot summaries ───────────────

  const { lines, summaries, countsFor } = useMemo(() => {
    const halfNos = match.halves.map((h) => h.halfNo);
    const counts = (appearanceId: string, halfNo: number, stored: Partial<Record<StatKey, number>>) => {
      const merged: Partial<Record<StatKey, number>> = { ...stored };
      for (const key of allowedStats) {
        const ov = statOverlay[`${appearanceId}|${halfNo}|${key}`];
        if (ov !== undefined) merged[key] = ov;
      }
      return merged;
    };

    const firstHalf = match.halves.find((h) => h.halfNo === 1) ?? match.halves[0];
    const clubBySide = new Map<SideKey, string | null>();
    for (const s of firstHalf?.sides ?? []) clubBySide.set(s.side, s.clubName);

    const outLines: PayoutLine[] = [];
    const outSummaries = new Map<string, SlotSummary>();

    for (const a of match.appearances) {
      let kr = 0;
      let mmg = 0;
      let events = 0;
      for (const halfNo of halfNos) {
        const merged = counts(a.id, halfNo, a.stats[halfNo] ?? {});
        const p = computePlayerPayout(merged, rates, {
          includeKR: !match.isFriendly,
          allowed: allowedStats,
        });
        kr += p.kr;
        mmg += p.mmg;
        for (const key of allowedStats) events += merged[key] ?? 0;
      }
      outSummaries.set(a.id, { events, kr, mmg });
      outLines.push({
        playerId: a.playerId,
        displayName: a.displayName,
        side: a.side,
        clubName: clubBySide.get(a.side) ?? null,
        kr,
        mmg,
      });
    }

    return {
      lines: outLines,
      summaries: outSummaries,
      countsFor: (appearanceId: string, halfNo: number, stored: Partial<Record<StatKey, number>>) =>
        counts(appearanceId, halfNo, stored),
    };
  }, [match, allowedStats, rates, statOverlay]);

  // ── handlers ──────────────────────────────────────────────────────────────

  const onMeta = (
    patch: { entryDate?: string; sport?: Sport; durationMinutes?: number | null },
    immediate: boolean,
  ) => {
    autosave("header", "header", () => updateMatchMetaAction(match.id, patch), {
      delay: immediate ? 0 : 700,
    });
  };

  /**
   * Pick the club leading a side — and put its manager in the squad.
   *
   * Skipped when the club has no manager account ("Deep Waters" has none) or
   * when that person is already in this match on either side: squads are
   * match-level, so a second appearance would be refused. Nothing stops the
   * user removing them afterwards.
   */
  const onClub = async (half: HalfDraft, side: SideKey, clubId: string) => {
    const slot = `half-${half.halfNo}`;
    const ok = await run(slot, () => setSideClubAction(match.id, half.id, side, clubId));
    if (!ok) return;
    const manager = clubs.find((c) => c.id === clubId)?.managerPlayerId ?? null;
    if (!manager) return;
    if (match.appearances.some((a) => a.playerId === manager)) return;
    await run(`squad-${side}`, () => addAppearanceAction(match.id, manager, side));
  };

  const onScore = (half: HalfDraft, side: SideKey, score: number) => {
    autosave(
      `score-${half.id}-${side}`,
      `half-${half.halfNo}`,
      () => setSideScoreAction(match.id, half.id, side, score),
    );
  };

  const onSwapClubs = async () => {
    const h1 = match.halves.find((h) => h.halfNo === 1);
    const h2 = match.halves.find((h) => h.halfNo === 2);
    if (!h1 || !h2) return;
    const homeClub = h1.sides.find((s) => s.side === "home")?.clubId;
    const awayClub = h1.sides.find((s) => s.side === "away")?.clubId;
    if (!homeClub || !awayClub) return;
    // Half 2 has no sides yet, so home-then-away can never collide with the
    // "already on the other side of this half" constraint.
    const ok = await run("half-2", () => setSideClubAction(match.id, h2.id, "home", awayClub));
    if (ok) await run("half-2", () => setSideClubAction(match.id, h2.id, "away", homeClub));
  };

  const onSetStat = (appearanceId: string, halfNo: number, statKey: StatKey, count: number) => {
    const value = Math.max(0, count);
    const key = `${appearanceId}|${halfNo}|${statKey}`;
    setStatOverlay((o) => ({ ...o, [key]: value }));
    autosave(
      key,
      `player-${appearanceId}`,
      () => setStatAction(match.id, appearanceId, halfNo, statKey, value),
      {
        delay: 400,
        // No re-read per tap: the totals on screen are computed from the
        // overlay, so a refresh would buy nothing and interrupt the tapping.
        // Closing the popup re-reads.
        refresh: false,
        onFail: () =>
          setStatOverlay((o) => {
            const next = { ...o };
            delete next[key];
            return next;
          }),
      },
    );
  };

  const onDone = () => {
    setOpenAppearanceId(null);
    flushSaves();
    startTransition(() => router.refresh());
  };

  const onSubmit = async () => {
    flushSaves();
    setWorking(true);
    setErrors((e) => ({ ...e, submit: null }));
    const res = await submitMatchAction(match.id);
    if (res.ok) startTransition(() => router.refresh());
    else setErrors((e) => ({ ...e, submit: res.error }));
    setWorking(false);
  };

  const openAppearance =
    match.appearances.find((a) => a.id === openAppearanceId) ?? null;
  const openClubName =
    openAppearance
      ? (match.halves.find((h) => h.halfNo === activeHalf)?.sides.find(
          (s) => s.side === openAppearance.side,
        )?.clubName ?? null)
      : null;
  const openSummary = openAppearance ? summaries.get(openAppearance.id) : undefined;

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <RecorderHeader
        match={match}
        seasonName={locked ? match.seasonName : activeSeasonName}
        locked={locked}
        sync={sync}
        error={err("header")}
        onMeta={onMeta}
      />

      <TeamBoard
        match={match}
        clubs={clubs}
        members={members}
        activeHalf={activeHalf}
        onHalf={setActiveHalf}
        locked={locked}
        busy={busy}
        summaries={summaries}
        errorFor={err}
        onClub={onClub}
        onScore={onScore}
        onAdd={(side, playerId) =>
          void run(`squad-${side}`, () => addAppearanceAction(match.id, playerId, side))
        }
        onRemove={(appearanceId) =>
          void run(`player-${appearanceId}`, () =>
            removeAppearanceAction(match.id, appearanceId),
          )
        }
        onOpenStats={setOpenAppearanceId}
        onSwapClubs={onSwapClubs}
      />

      <StatsDialog
        appearance={openAppearance}
        halfNo={activeHalf}
        isCombined={match.isCombined}
        clubName={openClubName}
        allowedStats={allowedStats}
        rates={rates}
        counts={
          openAppearance
            ? countsFor(openAppearance.id, activeHalf, openAppearance.stats[activeHalf] ?? {})
            : {}
        }
        kr={openSummary?.kr ?? 0}
        mmg={openSummary?.mmg ?? 0}
        isFriendly={match.isFriendly}
        locked={locked}
        error={openAppearance ? err(`player-${openAppearance.id}`) : null}
        onSetStat={(statKey, count) =>
          openAppearance && onSetStat(openAppearance.id, activeHalf, statKey, count)
        }
        onDone={onDone}
      />

      <SubmitPanel
        match={match}
        lines={lines}
        locked={locked}
        busy={busy}
        canReopen={canReopen}
        hasActiveSeason={activeSeasonName !== null}
        seasonName={activeSeasonName}
        submittedBy={submittedBy}
        submitError={err("submit")}
        reopenError={err("reopen")}
        deleteError={err("delete")}
        onSubmit={() => void onSubmit()}
        onReopen={() => void run("reopen", () => reopenMatchAction(match.id))}
        onDelete={async () => {
          if (!confirm("Delete this draft match?")) return;
          const ok = await run("delete", () => deleteMatchAction(match.id));
          if (ok) router.push("/admin/klc/matches");
        }}
      />
    </div>
  );
}
