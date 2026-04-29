"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

/**
 * Calculator-style MMG entry mockup.
 *
 * Flow:
 *   1. Pick game type → relevant button set appears.
 *   2. Tap buttons (e.g. Goal +500) — repeated taps accumulate.
 *   3. Self-declare order-of-arrival rank (Coach approves later).
 *   4. Optional free-form "Other +N" entry for blip points.
 *   5. Optional narration at the end.
 *   6. Submit → reset to zero, draft cleared from localStorage.
 *
 * Mockup-only: no real submission, all state held client-side.
 */

type GameType =
  | "fooba-big-goal"
  | "fooba-rebound"
  | "short-game"
  | "end-game-drill"
  | "three-and-in";

type Button = {
  id: string;
  label: string;
  points: number;
  /** repeatable = tap-to-add accumulates (e.g. Goal, MMG drill 100) */
  repeatable?: boolean;
  tone?: "blue" | "emerald" | "amber" | "rose" | "violet";
};

type EventEntry = {
  id: string;
  label: string;
  points: number;
  ts: number;
};

const games: { id: GameType; name: string; subtitle: string }[] = [
  { id: "fooba-big-goal", name: "Fooba", subtitle: "Big Goal" },
  { id: "fooba-rebound", name: "Fooba", subtitle: "Rebound Wall" },
  { id: "short-game", name: "Short Game", subtitle: "Half pitch" },
  { id: "end-game-drill", name: "End-game Drill", subtitle: "Closing" },
  { id: "three-and-in", name: "3-and-in", subtitle: "Mini" },
];

// Pre-session / packing buttons appear for every game type
const sessionButtons: Button[] = [
  { id: "pre-unpack", label: "Pre-session unpacking", points: 500, tone: "amber" },
  { id: "gww-unpack", label: "GWW unpacking", points: 500, tone: "amber" },
  { id: "post-pack", label: "Post-GWW packing", points: 500, tone: "amber" },
  { id: "confirmation", label: "Confirmation", points: 500, tone: "violet" },
];

const orderOfArrivalPoints: Record<number, number> = {
  1: 800, 2: 700, 3: 600, 4: 500, 5: 400, 6: 300, 7: 200, 8: 100,
};

const matchButtons: Button[] = [
  { id: "goal", label: "Goal", points: 500, repeatable: true, tone: "emerald" },
  { id: "assist", label: "Assist", points: 200, repeatable: true, tone: "blue" },
  { id: "pre-assist", label: "Pre-assist", points: 100, repeatable: true, tone: "blue" },
  { id: "save", label: "Save", points: 500, repeatable: true, tone: "emerald" },
  { id: "clearance", label: "Goal-line clearance", points: 500, repeatable: true, tone: "emerald" },
  { id: "win-bonus-1k", label: "Win bonus", points: 1000, tone: "amber" },
  { id: "win-bonus-500", label: "Win bonus (½)", points: 500, tone: "amber" },
];

const drillButtons: Button[] = [
  { id: "mmg-drill-100", label: "MMG drill", points: 100, repeatable: true, tone: "rose" },
  { id: "goal-bonus", label: "Goal bonus", points: 500, repeatable: true, tone: "emerald" },
];

const buttonsByGame: Record<GameType, Button[]> = {
  "fooba-big-goal": [...sessionButtons, ...matchButtons, ...drillButtons],
  "fooba-rebound": [...sessionButtons, ...matchButtons, ...drillButtons],
  "short-game": [...sessionButtons, ...matchButtons.filter(b => b.id !== "win-bonus-1k"), ...drillButtons],
  "end-game-drill": [...sessionButtons, ...drillButtons],
  "three-and-in": [...sessionButtons, ...drillButtons.filter(b => b.id === "mmg-drill-100"), ...matchButtons.filter(b => b.id === "goal")],
};

const toneClass: Record<NonNullable<Button["tone"]>, string> = {
  blue: "from-blue-50 to-white text-blue-700 border-blue-200 hover:border-blue-300",
  emerald: "from-emerald-50 to-white text-emerald-700 border-emerald-200 hover:border-emerald-300",
  amber: "from-amber-50 to-white text-amber-700 border-amber-200 hover:border-amber-300",
  rose: "from-rose-50 to-white text-rose-700 border-rose-200 hover:border-rose-300",
  violet: "from-violet-50 to-white text-violet-700 border-violet-200 hover:border-violet-300",
};

const DRAFT_KEY = "kfandra:mockup:mmg-draft";

type Draft = {
  game: GameType | null;
  events: EventEntry[];
  arrivalRank: number | null;
  narration: string;
};

const emptyDraft: Draft = { game: null, events: [], arrivalRank: null, narration: "" };

export default function MMGSessionMockup() {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [otherPoints, setOtherPoints] = useState("");
  const [otherLabel, setOtherLabel] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Restore draft on mount (SSR: must rehydrate after first client render)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (raw) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage rehydration on mount
        setDraft(JSON.parse(raw));
      } catch { /* ignore */ }
    }
  }, []);

  // Persist draft on change (mockup behaviour: drafts survive a refresh)
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);

  const total = useMemo(() => {
    const base = draft.events.reduce((sum, e) => sum + e.points, 0);
    const arrival = draft.arrivalRank ? orderOfArrivalPoints[draft.arrivalRank] ?? 0 : 0;
    return base + arrival;
  }, [draft]);

  const buttons = draft.game ? buttonsByGame[draft.game] : [];

  function tapButton(btn: Button) {
    setDraft((d) => ({
      ...d,
      events: [
        ...d.events,
        {
          id: `${btn.id}-${Date.now()}-${d.events.length}`,
          label: btn.label,
          points: btn.points,
          ts: Date.now(),
        },
      ],
    }));
  }

  function removeEvent(id: string) {
    setDraft((d) => ({ ...d, events: d.events.filter((e) => e.id !== id) }));
  }

  function addOther() {
    const n = Number(otherPoints);
    if (!Number.isFinite(n) || n === 0) return;
    setDraft((d) => ({
      ...d,
      events: [
        ...d.events,
        {
          id: `other-${Date.now()}-${d.events.length}`,
          label: otherLabel.trim() || "Other",
          points: n,
          ts: Date.now(),
        },
      ],
    }));
    setOtherPoints("");
    setOtherLabel("");
  }

  function submit() {
    if (!draft.game || draft.events.length === 0) return;
    setSubmitted(true);
  }

  function newSession() {
    setDraft(emptyDraft);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(DRAFT_KEY);
    }
    setSubmitted(false);
  }

  if (submitted) {
    return <SubmittedView total={total} onNew={newSession} />;
  }

  return (
    <div className="flex flex-col gap-5 p-5 pb-32">
      {/* Running total — sticky-ish scoreboard */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 p-5 text-white shadow-lg shadow-blue-500/20">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200/80">
              Running total
            </p>
            <p className="mt-1 font-[family-name:var(--font-display)] text-5xl font-black tabular-nums tracking-tight">
              {total.toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-blue-200/60">
              {draft.events.length} {draft.events.length === 1 ? "tap" : "taps"} &middot; {draft.arrivalRank ? `arrived ${ordinal(draft.arrivalRank)}` : "no arrival rank"}
            </p>
          </div>
          {draft.events.length > 0 && (
            <button
              onClick={() => setDraft((d) => ({ ...d, events: d.events.slice(0, -1) }))}
              className="rounded-lg bg-white/10 backdrop-blur px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/20 transition-colors"
            >
              ← Undo
            </button>
          )}
        </div>
      </div>

      {/* Step 1 — Game type */}
      <Section title="1. Pick the game" subtitle="Different games show different buttons">
        <div className="grid grid-cols-2 gap-2.5">
          {games.map((g) => {
            const active = draft.game === g.id;
            return (
              <button
                key={g.id}
                onClick={() => setDraft((d) => ({ ...d, game: g.id }))}
                className={`text-left rounded-xl border p-3 transition-all ${
                  active
                    ? "border-blue-500 bg-blue-50 shadow-sm shadow-blue-500/10"
                    : "border-gray-200 bg-white hover:border-blue-200"
                }`}
              >
                <p className="text-sm font-bold text-gray-900">{g.name}</p>
                <p className="text-[11px] text-gray-500">{g.subtitle}</p>
                {active && (
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-blue-600">
                    Selected
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </Section>

      {/* Step 2 — Tap buttons */}
      <AnimatePresence>
        {draft.game && (
          <motion.div
            key="buttons"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            <Section title="2. Tap to add points" subtitle="Repeated taps accumulate (e.g. 2 goals = 2 taps)">
              <div className="grid grid-cols-2 gap-2.5">
                {buttons.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => tapButton(b)}
                    className={`relative overflow-hidden rounded-xl border bg-gradient-to-br p-3 text-left transition-all active:scale-[0.97] ${toneClass[b.tone ?? "blue"]}`}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                      {b.label}
                    </p>
                    <p className="mt-1 font-[family-name:var(--font-display)] text-2xl font-black tabular-nums">
                      +{b.points}
                    </p>
                    {b.repeatable && (
                      <span className="absolute right-2 top-2 rounded-full bg-white/70 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-gray-500">
                        Repeat
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </Section>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Step 3 — Order of arrival */}
      {draft.game && (
        <Section title="3. Order of arrival" subtitle="Self-declare — Coach confirms against the sheet">
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((rank) => {
              const active = draft.arrivalRank === rank;
              return (
                <button
                  key={rank}
                  onClick={() => setDraft((d) => ({ ...d, arrivalRank: active ? null : rank }))}
                  className={`rounded-xl border py-2.5 text-center transition-all ${
                    active
                      ? "border-violet-500 bg-violet-50 text-violet-700 shadow-sm shadow-violet-500/10"
                      : "border-gray-200 bg-white text-gray-700 hover:border-violet-200"
                  }`}
                >
                  <p className="text-sm font-bold">{ordinal(rank)}</p>
                  <p className="text-[10px] tabular-nums opacity-75">+{orderOfArrivalPoints[rank]}</p>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {/* Step 4 — Other free-form */}
      {draft.game && (
        <Section title="4. Other points" subtitle="Free-form for one-off Coach awards (Coach to confirm format)">
          <div className="rounded-2xl border border-gray-200 bg-white p-3 space-y-2">
            <input
              type="text"
              value={otherLabel}
              onChange={(e) => setOtherLabel(e.target.value)}
              placeholder="Reason (e.g. extra reps)"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <div className="flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                value={otherPoints}
                onChange={(e) => setOtherPoints(e.target.value)}
                placeholder="Points"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm tabular-nums focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                onClick={addOther}
                disabled={!otherPoints}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-800"
              >
                Add
              </button>
            </div>
          </div>
        </Section>
      )}

      {/* Tap history */}
      {draft.events.length > 0 && (
        <Section title="Taps so far" subtitle="Tap × to remove">
          <div className="rounded-xl border border-gray-100 bg-white divide-y divide-gray-100 overflow-hidden">
            {draft.events.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-3.5 py-2.5">
                <p className="text-sm text-gray-700">{e.label}</p>
                <div className="flex items-center gap-3">
                  <span className="font-[family-name:var(--font-display)] text-sm font-bold tabular-nums text-gray-900">
                    {e.points >= 0 ? `+${e.points}` : e.points}
                  </span>
                  <button
                    onClick={() => removeEvent(e.id)}
                    className="text-gray-300 hover:text-rose-500 text-lg leading-none"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Step 5 — Narration */}
      {draft.game && (
        <Section title="5. Narration (optional)" subtitle="Notes for the Coach — does not affect points">
          <textarea
            value={draft.narration}
            onChange={(e) => setDraft((d) => ({ ...d, narration: e.target.value }))}
            placeholder="e.g. left early at 7:25 to drop kid at school"
            rows={3}
            className="w-full rounded-2xl border border-gray-200 bg-white p-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </Section>
      )}

      {/* Sticky submit bar */}
      {draft.game && draft.events.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 z-40 px-5">
          <button
            onClick={submit}
            className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 py-4 text-sm font-bold text-white shadow-xl shadow-blue-500/30 active:scale-[0.99]"
          >
            Submit {total.toLocaleString()} pts to Coach
          </button>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {subtitle && <p className="text-[11px] text-gray-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function SubmittedView({ total, onNew }: { total: number; onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 gap-6">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 250, damping: 18 }}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30"
      >
        <svg className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </motion.div>
      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Sent</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold text-gray-900">
          {total.toLocaleString()} pts to Coach
        </h1>
        <p className="mt-2 text-sm text-gray-500 max-w-xs">
          Coach approves by 4 pm. You&rsquo;ll see the result in History.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <button
          onClick={onNew}
          className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800"
        >
          Start new session
        </button>
        <Link
          href="/mockups/my-submissions"
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          View submission
        </Link>
      </div>
    </div>
  );
}
