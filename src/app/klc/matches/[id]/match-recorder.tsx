"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  addAppearanceAction,
  deleteMatchAction,
  makeOfficialAction,
  removeAppearanceAction,
  reopenMatchAction,
  sendBackAction,
  sendTeamAction,
  setGoalTimesAction,
  setSideClubAction,
  setSideScoreAction,
  setStatAction,
  updateMatchMetaAction,
} from "@/lib/klcsra/actions";
import { ownedSides, type MatchPermissions } from "@/lib/klcsra/access";
import type { DuplicateCandidate } from "@/lib/klcsra/duplicates";
import { isTimed, trimTimes } from "@/lib/klcsra/goal-times";
import { computePlayerPayout } from "@/lib/klcsra/payouts";
import type { Sport } from "@/lib/klcsra/sport-stats";
// Straight from the pure modules, never via config.ts — that would pull
// `server-only` into the client bundle and fail the build.
import type { StatKey, StatRates } from "@/lib/klcsra/stat-rates";
import type { StandingsRules } from "@/lib/klcsra/standings-rules";
import type {
  HalfDraft,
  MatchDraft,
  MemberOption,
  PayoutLine,
  SideKey,
} from "@/lib/klcsra/types";
import { DuplicateBanner } from "./duplicate-banner";
import { RecorderHeader } from "./recorder-header";
import { type RecorderClub, type Result, type SyncStatus } from "./recorder-shared";
import { StatsDialog } from "./stats-dialog";
import { SubmitPanel } from "./submit-panel";
import { TeamBoard, type SlotSummary } from "./team-board";

/** Shown when a server action throws instead of returning an error. */
const UNEXPECTED = "Something went wrong. Try again.";

type MetaPatch = {
  entryDate?: string;
  sport?: Sport;
  durationMinutes?: number | null;
  isFriendly?: boolean;
};

/**
 * The KLCSRA match recorder — Phase 3 (Screens 2 to 6).
 *
 * This is the presentation only: every write goes through the server actions
 * in `@/lib/klcsra/actions`, which own auth, the submit lock and the club rules
 * (pair rule, keep-your-own-club). Two things shape the whole file:
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
  perms,
  canEdit,
  isStaff,
  duplicates,
  managedClubIds,
  activeSeasonName,
  submittedBy,
  rules,
}: {
  match: MatchDraft;
  clubs: RecorderClub[];
  members: MemberOption[];
  allowedStats: StatKey[];
  rates: StatRates;
  /** What this viewer may change right now (the server actions apply the same rule). */
  perms: MatchPermissions;
  /** False for a read-only viewer (only ever a submitted match). */
  canEdit: boolean;
  isStaff: boolean;
  /** Other matches between the same two clubs that day. */
  duplicates: DuplicateCandidate[];
  /** Clubs the viewer manages; the club picker greys out what the server would refuse. */
  managedClubIds: string[];
  /** The season a league match would be tagged with today, or null. */
  activeSeasonName: string | null;
  submittedBy: string | null;
  rules: StandingsRules;
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
  const editable =
    perms.details || perms.score || perms.team.home || perms.team.away ||
    perms.times.home || perms.times.away;
  const timedStats = allowedStats.filter((k) => isTimed(match.sport, k, match.isFriendly));
  /** `${appearanceId}|${halfNo}|${statKey}` → optimistic minutes. */
  const [timesOverlay, setTimesOverlay] = useState<Record<string, (number | null)[]>>({});
  // Once a re-read shows a minutes overlay as stored, drop it, so a later
  // change from elsewhere isn't masked by it. (Adjusted during render, not in
  // an effect, so the stale overlay never paints.)
  const [timesSeen, setTimesSeen] = useState(match);
  if (timesSeen !== match) {
    setTimesSeen(match);
    setTimesOverlay((o) => {
      const next = { ...o };
      for (const [key, minutes] of Object.entries(o)) {
        const [appearanceId, halfNo, statKey] = key.split("|");
        const stored = match.appearances.find((a) => a.id === appearanceId)
          ?.times?.[Number(halfNo)]?.[statKey as StatKey] ?? [];
        const sent = trimTimes(minutes, minutes.length);
        if (sent.length === stored.length && sent.every((m, i) => m === stored[i])) delete next[key];
      }
      return next;
    });
  }
  const err = (slot: string) => errors[slot] ?? null;

  // ── mutation plumbing ─────────────────────────────────────────────────────

  /** An immediate mutation (club, squad, submit): disables, then re-reads. */
  const run = useCallback(
    async (slot: string, fn: () => Promise<Result>) => {
      setWorking(true);
      setErrors((e) => ({ ...e, [slot]: null }));
      try {
        const res = await fn();
        if (!res.ok) setErrors((e) => ({ ...e, [slot]: res.error }));
        else startTransition(() => router.refresh());
        return res.ok;
      } catch {
        // A thrown action (network drop, server crash) must not leave every
        // control disabled.
        setErrors((e) => ({ ...e, [slot]: UNEXPECTED }));
        return false;
      } finally {
        setWorking(false);
      }
    },
    [router],
  );

  // Debounced writes, one timer per field. Held in a ref so a re-render (there
  // is one after every refresh) cannot drop a scheduled save.
  const pendingSaves = useRef(
    new Map<string, { timer: ReturnType<typeof setTimeout>; go: () => Promise<boolean>; after?: string }>(),
  );
  /** Saves that have fired and not yet landed, by key; each resolves to whether it stored. */
  const inFlight = useRef(new Map<string, Promise<boolean>>());
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
      // `after`: another save's key that must land first (a goal's times go
      // after its count, or the count save could see stale times).
      opts: { delay?: number; refresh?: boolean; onFail?: () => void; after?: string } = {},
    ) => {
      const { delay = 700, refresh = true, onFail, after } = opts;
      setSync("saving");
      const existing = pendingSaves.current.get(key);
      if (existing) clearTimeout(existing.timer);

      const save = async (): Promise<boolean> => {
        if (after) {
          const first = pendingSaves.current.get(after);
          let ok = true;
          if (first) {
            clearTimeout(first.timer);
            ok = await first.go();
          } else {
            ok = (await inFlight.current.get(after)) ?? true;
          }
          // The save this one depends on was refused: its error is already
          // showing, so roll this one back without sending or clearing it.
          if (!ok) {
            onFail?.();
            return false;
          }
        }
        setErrors((e) => ({ ...e, [slot]: null }));
        // A throw counts as a refusal, so the overlay rolls back.
        const res = await fn().catch((): Result => ({ ok: false, error: UNEXPECTED }));
        if (!res.ok) {
          setErrors((e) => ({ ...e, [slot]: res.error }));
          setSync("error");
          onFail?.();
          return false;
        }
        setSync("saved");
        if (refresh) startTransition(() => router.refresh());
        return true;
      };

      const go = () => {
        pendingSaves.current.delete(key);
        const p = save();
        inFlight.current.set(key, p);
        void p.finally(() => {
          if (inFlight.current.get(key) === p) inFlight.current.delete(key);
        });
        return p;
      };

      pendingSaves.current.set(key, {
        timer: setTimeout(() => void go(), delay),
        go,
        after,
      });
    },
    [router],
  );

  /**
   * Fire every scheduled save now (leaving the popup, submitting) and resolve
   * once they have all landed.
   *
   * Awaiting matters on Send and Make official: both move the match on, and a
   * stat write still in flight would then be refused and be missing from the
   * team sent or the payout just computed. Fire-and-forget here means a goal
   * tapped seconds before Make official can go unpaid.
   */
  const flushSaves = useCallback(async () => {
    // Saves with an `after` start last, so the save they wait on is already
    // in flight.
    const queued = [...pendingSaves.current.values()].sort(
      (a, b) => Number(Boolean(a.after)) - Number(Boolean(b.after)),
    );
    pendingSaves.current.clear();
    await Promise.all(
      queued.map(({ timer, go }) => {
        clearTimeout(timer);
        return go();
      }),
    );
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

  // Every header field shares the one "header" autosave key, so a later call
  // replaces an earlier one still waiting on its debounce. Without merging, a
  // Friendly/sport tap (immediate) would drop a date or duration typed just
  // before it. So pending fields accumulate here, the save that finally fires
  // sends their union (read at send time), and on failure every contributing
  // field's rollback runs.
  const pendingMeta = useRef<MetaPatch>({});
  const pendingMetaFails = useRef<(() => void)[]>([]);
  const onMeta = (patch: MetaPatch, immediate: boolean, onFail?: () => void) => {
    pendingMeta.current = { ...pendingMeta.current, ...patch };
    if (onFail) pendingMetaFails.current.push(onFail);
    let sentFails: (() => void)[] = [];
    autosave(
      "header",
      "header",
      () => {
        const union = pendingMeta.current;
        sentFails = pendingMetaFails.current;
        pendingMeta.current = {};
        pendingMetaFails.current = [];
        return updateMatchMetaAction(match.id, union);
      },
      {
        delay: immediate ? 0 : 700,
        onFail: () => {
          for (const f of sentFails) f();
        },
      },
    );
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

  // The newest minutes per stat, trimmed as counts drop. A minutes save reads
  // these when it fires, not when it was scheduled, so a count change in
  // between can't make it send times the server has already trimmed away.
  const latestTimes = useRef<Record<string, (number | null)[]>>({});

  const onSetStat = (appearanceId: string, halfNo: number, statKey: StatKey, count: number) => {
    const value = Math.max(0, count);
    const key = `${appearanceId}|${halfNo}|${statKey}`;
    setStatOverlay((o) => ({ ...o, [key]: value }));
    // Fewer goals keep fewer minutes, as the server will store them.
    setTimesOverlay((o) => (key in o ? { ...o, [key]: trimTimes(o[key], value) } : o));
    if (key in latestTimes.current) latestTimes.current[key] = trimTimes(latestTimes.current[key], value);
    // A minutes save already sent may be longer than this count; let it land
    // first, or the server would refuse it after trimming to the new count.
    // (Only one in flight: a pending one already waits on this count.)
    const timesInFlight = inFlight.current.get(`times-${key}`);
    autosave(
      key,
      `player-${appearanceId}`,
      async () => {
        await timesInFlight;
        return setStatAction(match.id, appearanceId, halfNo, statKey, value);
      },
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
    void flushSaves();
    startTransition(() => router.refresh());
  };

  /** A workflow step (send, make official, send back): flush typing first. */
  const step = async (slot: string, fn: () => Promise<Result>) => {
    setWorking(true);
    try {
      // Await: a write still in flight would be refused once the match moves on.
      await flushSaves();
      setErrors((e) => ({ ...e, [slot]: null }));
      const res = await fn();
      if (res.ok) startTransition(() => router.refresh());
      else setErrors((e) => ({ ...e, [slot]: res.error }));
    } catch {
      setErrors((e) => ({ ...e, [slot]: UNEXPECTED }));
    } finally {
      setWorking(false);
    }
  };

  const onSetTimes = (appearanceId: string, halfNo: number, statKey: StatKey, minutes: (number | null)[]) => {
    const key = `${appearanceId}|${halfNo}|${statKey}`;
    setTimesOverlay((o) => ({ ...o, [key]: minutes }));
    latestTimes.current[key] = minutes;
    autosave(
      `times-${key}`,
      `player-${appearanceId}`,
      () => {
        const latest = latestTimes.current[key] ?? minutes;
        return setGoalTimesAction(match.id, appearanceId, halfNo, statKey, trimTimes(latest, latest.length));
      },
      {
        refresh: false,
        after: key,
        onFail: () =>
          setTimesOverlay((o) => {
            const next = { ...o };
            delete next[key];
            return next;
          }),
      },
    );
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
      <DuplicateBanner matchId={match.id} duplicates={duplicates} />

      <RecorderHeader
        match={match}
        seasonName={locked ? match.seasonName : activeSeasonName}
        locked={!perms.details}
        showSync={editable}
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
        isStaff={isStaff}
        perms={perms}
        managedClubIds={managedClubIds}
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
        locked={!openAppearance || !perms.team[openAppearance.side]}
        timedStats={timedStats}
        times={
          openAppearance
            ? Object.fromEntries(
                timedStats.map((k) => {
                  const key = `${openAppearance.id}|${activeHalf}|${k}`;
                  const stored = openAppearance.times?.[activeHalf]?.[k] ?? [];
                  const count = countsFor(openAppearance.id, activeHalf, openAppearance.stats[activeHalf] ?? {})[k] ?? 0;
                  return [k, trimTimes(timesOverlay[key] ?? stored, count)];
                }),
              )
            : {}
        }
        timesEditable={openAppearance ? perms.times[openAppearance.side] : false}
        onSetTimes={(statKey, minutes) =>
          openAppearance && onSetTimes(openAppearance.id, activeHalf, statKey, minutes)
        }
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
        perms={perms}
        canEdit={canEdit}
        isStaff={isStaff}
        owned={ownedSides(match.halves, new Set(managedClubIds))}
        hasActiveSeason={activeSeasonName !== null}
        seasonName={activeSeasonName}
        submittedBy={submittedBy}
        rules={rules}
        submitError={err("submit")}
        sendBackError={err("send-back")}
        reopenError={err("reopen")}
        deleteError={err("delete")}
        onSend={(side) => void step("submit", () => sendTeamAction(match.id, side))}
        onMakeOfficial={() => void step("submit", () => makeOfficialAction(match.id))}
        onSendBack={() => void step("send-back", () => sendBackAction(match.id))}
        onReopen={() => void run("reopen", () => reopenMatchAction(match.id))}
        onDelete={async () => {
          if (!confirm("Delete this draft match?")) return;
          const ok = await run("delete", () => deleteMatchAction(match.id));
          if (ok) router.push("/klc/matches");
        }}
      />
    </div>
  );
}
