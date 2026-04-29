"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

/**
 * MMG entry — 4 sections: Participation, Performance, Other, Narration.
 * Mockup-only: state held client-side, drafts in localStorage.
 *
 * Confirmation order and arrival rank use a dynamic formula (N×100 down to 100)
 * so points are computed by KFANDRA at approval time. App captures rank only.
 *
 * Per-stat point values are placeholders KFANDRA can adjust later.
 */

// ─── Types ─────────────────────────────────────────────────────────

type Participation = {
  confirmationOrder: number | null;
  arrivalOrder: number | null;
  unpacking: boolean | null;
  packingWeights: boolean | null;
  packingKit: boolean | null;
  confirmedBy8am: boolean | null;
};

type GameType =
  | "football-short"
  | "rugby-short"
  | "fooba-big-goal"
  | "fooba-rebound"
  | "three-and-in"
  | "other";

type Result = "won" | "drew" | "lost";

type Game = {
  id: string;
  type: GameType;
  result: Result;
  goals: number;
  tries: number;
  assists: number;
  preAssists: number;
  saves: number;
  clearances: number;
};

type OtherRow = {
  id: string;
  description: string;
  points: string;
};

type Draft = {
  participation: Participation;
  games: Game[];
  others: OtherRow[];
  narration: string;
};

// ─── Constants ─────────────────────────────────────────────────────

const POINTS = {
  won: 1000,
  drew: 100,
  lost: 0,
  goal: 500,
  try: 500,
  assist: 200,
  preAssist: 100,
  save: 500,
  clearance: 500,
  packingEvent: 500,    // placeholder — KFANDRA may adjust
  confirmedBy8am: 500,  // placeholder
} as const;

const GAME_LABEL: Record<GameType, { name: string; emoji: string }> = {
  "football-short": { name: "Football short", emoji: "⚽" },
  "rugby-short": { name: "Rugby short", emoji: "🏉" },
  "fooba-big-goal": { name: "Fooba (Big Goal)", emoji: "🥅" },
  "fooba-rebound": { name: "Fooba (Rebound)", emoji: "🧱" },
  "three-and-in": { name: "3-and-in", emoji: "🎯" },
  other: { name: "Other", emoji: "✨" },
};

const RESULT_LABEL: Record<Result, string> = {
  won: "Won",
  drew: "Drew",
  lost: "Lost",
};

const DRAFT_KEY = "kfandra:mockup:mmg-draft-v2";

const emptyParticipation: Participation = {
  confirmationOrder: null,
  arrivalOrder: null,
  unpacking: null,
  packingWeights: null,
  packingKit: null,
  confirmedBy8am: null,
};

const emptyDraft: Draft = {
  participation: emptyParticipation,
  games: [],
  others: [],
  narration: "",
};

const emptyGame = (id: string): Game => ({
  id,
  type: "football-short",
  result: "won",
  goals: 0,
  tries: 0,
  assists: 0,
  preAssists: 0,
  saves: 0,
  clearances: 0,
});

// ─── Point helpers ─────────────────────────────────────────────────

function gameTotal(g: Game): number {
  return (
    POINTS[g.result] +
    g.goals * POINTS.goal +
    g.tries * POINTS.try +
    g.assists * POINTS.assist +
    g.preAssists * POINTS.preAssist +
    g.saves * POINTS.save +
    g.clearances * POINTS.clearance
  );
}

function participationFixedTotal(p: Participation): number {
  let t = 0;
  if (p.unpacking) t += POINTS.packingEvent;
  if (p.packingWeights) t += POINTS.packingEvent;
  if (p.packingKit) t += POINTS.packingEvent;
  if (p.confirmedBy8am) t += POINTS.confirmedBy8am;
  return t;
}

function othersTotal(rows: OtherRow[]): number {
  return rows.reduce((sum, r) => sum + (Number(r.points) || 0), 0);
}

// ─── Component ─────────────────────────────────────────────────────

export default function MMGSessionMockup() {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [submitted, setSubmitted] = useState(false);
  const [gameDraft, setGameDraft] = useState<Game | null>(null); // null = sheet closed

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);

  const visibleTotal = useMemo(
    () =>
      participationFixedTotal(draft.participation) +
      draft.games.reduce((s, g) => s + gameTotal(g), 0) +
      othersTotal(draft.others),
    [draft]
  );

  const hasDynamicRank =
    draft.participation.confirmationOrder !== null ||
    draft.participation.arrivalOrder !== null;

  const sectionsFilled = useMemo(() => {
    const p = draft.participation;
    const participationDone =
      p.confirmationOrder !== null &&
      p.arrivalOrder !== null &&
      p.unpacking !== null &&
      p.packingWeights !== null &&
      p.packingKit !== null &&
      p.confirmedBy8am !== null;
    return {
      participation: participationDone,
      games: draft.games.length,
      others: draft.others.length,
    };
  }, [draft]);

  const canSubmit =
    sectionsFilled.participation || draft.games.length > 0 || draft.others.length > 0;

  function updateParticipation(patch: Partial<Participation>) {
    setDraft((d) => ({ ...d, participation: { ...d.participation, ...patch } }));
  }

  function openNewGame() {
    setGameDraft(emptyGame(`g-${Date.now()}-${draft.games.length}`));
  }

  function openEditGame(g: Game) {
    setGameDraft({ ...g });
  }

  function saveGame(g: Game) {
    setDraft((d) => {
      const exists = d.games.some((x) => x.id === g.id);
      return {
        ...d,
        games: exists ? d.games.map((x) => (x.id === g.id ? g : x)) : [...d.games, g],
      };
    });
    setGameDraft(null);
  }

  function deleteGame(id: string) {
    setDraft((d) => ({ ...d, games: d.games.filter((g) => g.id !== id) }));
  }

  function addOther() {
    setDraft((d) => ({
      ...d,
      others: [
        ...d.others,
        { id: `o-${Date.now()}-${d.others.length}`, description: "", points: "" },
      ],
    }));
  }

  function updateOther(id: string, patch: Partial<OtherRow>) {
    setDraft((d) => ({
      ...d,
      others: d.others.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));
  }

  function removeOther(id: string) {
    setDraft((d) => ({ ...d, others: d.others.filter((o) => o.id !== id) }));
  }

  function submit() {
    if (!canSubmit) return;
    setSubmitted(true);
  }

  function newSession() {
    setDraft(emptyDraft);
    if (typeof window !== "undefined") window.localStorage.removeItem(DRAFT_KEY);
    setSubmitted(false);
  }

  if (submitted) {
    return <SubmittedView total={visibleTotal} hasDynamic={hasDynamicRank} onNew={newSession} />;
  }

  return (
    <div className="flex flex-col gap-5 p-5 pb-32">
      <Scoreboard
        total={visibleTotal}
        hasDynamic={hasDynamicRank}
        sectionsFilled={sectionsFilled}
        onReset={() => setDraft(emptyDraft)}
      />

      <SectionHeading
        index={1}
        title="Participation"
        subtitle="Once per session — locks after submit"
      />
      <ParticipationCard p={draft.participation} onChange={updateParticipation} />

      <SectionHeading
        index={2}
        title="Performance"
        subtitle="One card per game played"
      />
      <PerformanceList
        games={draft.games}
        onEdit={openEditGame}
        onDelete={deleteGame}
        onAdd={openNewGame}
      />

      <SectionHeading
        index={3}
        title="Other"
        subtitle="Races, team challenges, anything ad-hoc"
      />
      <OtherList
        rows={draft.others}
        onAdd={addOther}
        onUpdate={updateOther}
        onRemove={removeOther}
      />

      <SectionHeading
        index={4}
        title="Narration"
        subtitle="Optional — for KFANDRA's eyes only"
      />
      <textarea
        value={draft.narration}
        onChange={(e) => setDraft((d) => ({ ...d, narration: e.target.value }))}
        placeholder="e.g. left early at 7:25 to drop kid at school"
        rows={3}
        className="w-full rounded-2xl border border-gray-200 bg-white p-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />

      {canSubmit && (
        <div className="fixed bottom-20 left-0 right-0 z-40 px-5">
          <button
            onClick={submit}
            className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 py-4 text-sm font-bold text-white shadow-xl shadow-blue-500/30 active:scale-[0.99]"
          >
            Submit {visibleTotal.toLocaleString()}
            {hasDynamicRank ? "+ pts" : " pts"} to KFANDRA
          </button>
        </div>
      )}

      <AnimatePresence>
        {gameDraft && (
          <GameSheet
            initial={gameDraft}
            onSave={saveGame}
            onClose={() => setGameDraft(null)}
            onDelete={
              draft.games.some((g) => g.id === gameDraft.id)
                ? () => {
                    deleteGame(gameDraft.id);
                    setGameDraft(null);
                  }
                : null
            }
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────

function Scoreboard({
  total,
  hasDynamic,
  sectionsFilled,
  onReset,
}: {
  total: number;
  hasDynamic: boolean;
  sectionsFilled: { participation: boolean; games: number; others: number };
  onReset: () => void;
}) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 p-5 text-white shadow-lg shadow-blue-500/20">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200/80">
            Running total
          </p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-5xl font-black tabular-nums tracking-tight">
            {total.toLocaleString()}
            {hasDynamic && (
              <span className="ml-1 text-2xl font-bold text-blue-200/80">+</span>
            )}
          </p>
          <p className="mt-1 text-[11px] text-blue-200/60">
            Participation {sectionsFilled.participation ? "✓" : "—"} ·{" "}
            {sectionsFilled.games} {sectionsFilled.games === 1 ? "game" : "games"} ·{" "}
            {sectionsFilled.others} other
          </p>
          {hasDynamic && (
            <p className="mt-1 text-[10px] text-blue-200/60 italic">
              + arrival &amp; confirmation pts (calculated at approval)
            </p>
          )}
        </div>
        {(total > 0 || sectionsFilled.participation) && (
          <button
            onClick={onReset}
            className="rounded-lg bg-white/10 backdrop-blur px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/20"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

function SectionHeading({
  index,
  title,
  subtitle,
}: {
  index: number;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mt-2 flex items-baseline gap-3 border-b border-gray-200 pb-1">
      <span className="font-[family-name:var(--font-display)] text-2xl font-black text-gray-300 tabular-nums">
        {index}
      </span>
      <div>
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-900">{title}</h2>
        <p className="text-[10px] text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
}

function ParticipationCard({
  p,
  onChange,
}: {
  p: Participation;
  onChange: (patch: Partial<Participation>) => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
      <RankInput
        label="Order of confirmation"
        hint="Position when you confirmed — points scale with attendance"
        value={p.confirmationOrder}
        onChange={(v) => onChange({ confirmationOrder: v })}
      />
      <RankInput
        label="Arrival to ground"
        hint="Position you arrived in — points scale with attendance"
        value={p.arrivalOrder}
        onChange={(v) => onChange({ arrivalOrder: v })}
      />
      <YesNoRow
        label="Present for unpacking?"
        value={p.unpacking}
        onChange={(v) => onChange({ unpacking: v })}
      />
      <YesNoRow
        label="Present for packing weights?"
        value={p.packingWeights}
        onChange={(v) => onChange({ packingWeights: v })}
      />
      <YesNoRow
        label="Present for packing kit?"
        value={p.packingKit}
        onChange={(v) => onChange({ packingKit: v })}
      />
      <YesNoRow
        label="Confirmed by 8 am?"
        value={p.confirmedBy8am}
        onChange={(v) => onChange({ confirmedBy8am: v })}
      />
    </div>
  );
}

function RankInput({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const display = value ?? "—";
  return (
    <div>
      <p className="text-sm font-semibold text-gray-900">{label}</p>
      <p className="text-[11px] text-gray-500">{hint}</p>
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => onChange(value && value > 1 ? value - 1 : null)}
          disabled={value === null || value <= 1}
          className="h-10 w-10 rounded-xl border border-gray-200 bg-white text-lg font-bold text-gray-600 disabled:opacity-30 hover:bg-gray-50"
        >
          −
        </button>
        <div className="flex-1 text-center font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums text-gray-900">
          {display}
        </div>
        <button
          onClick={() => onChange((value ?? 0) + 1)}
          className="h-10 w-10 rounded-xl border border-gray-200 bg-white text-lg font-bold text-gray-600 hover:bg-gray-50"
        >
          +
        </button>
      </div>
    </div>
  );
}

function YesNoRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-gray-800 flex-1 min-w-0">{label}</p>
      <div className="flex shrink-0 rounded-xl bg-gray-100 p-1">
        <button
          onClick={() => onChange(true)}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            value === true ? "bg-emerald-500 text-white" : "text-gray-500"
          }`}
        >
          Yes
        </button>
        <button
          onClick={() => onChange(false)}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            value === false ? "bg-gray-700 text-white" : "text-gray-500"
          }`}
        >
          No
        </button>
      </div>
    </div>
  );
}

function PerformanceList({
  games,
  onEdit,
  onDelete,
  onAdd,
}: {
  games: Game[];
  onEdit: (g: Game) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-2.5">
      {games.map((g) => {
        const total = gameTotal(g);
        const meta = GAME_LABEL[g.type];
        const stats: string[] = [];
        if (g.goals) stats.push(`${g.goals} goal${g.goals > 1 ? "s" : ""}`);
        if (g.tries) stats.push(`${g.tries} tr${g.tries > 1 ? "ies" : "y"}`);
        if (g.assists) stats.push(`${g.assists} assist${g.assists > 1 ? "s" : ""}`);
        if (g.preAssists) stats.push(`${g.preAssists} pre-assist${g.preAssists > 1 ? "s" : ""}`);
        if (g.saves) stats.push(`${g.saves} save${g.saves > 1 ? "s" : ""}`);
        if (g.clearances) stats.push(`${g.clearances} clearance${g.clearances > 1 ? "s" : ""}`);
        return (
          <div key={g.id} className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <button
                onClick={() => onEdit(g)}
                className="flex-1 min-w-0 text-left"
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  {meta.emoji} {meta.name}
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">
                  {RESULT_LABEL[g.result]}
                  {stats.length > 0 ? ` · ${stats.join(", ")}` : ""}
                </p>
                <p className="mt-1 font-[family-name:var(--font-display)] text-xl font-bold tabular-nums text-blue-600">
                  +{total.toLocaleString()} pts
                </p>
              </button>
              <button
                onClick={() => onDelete(g.id)}
                className="text-gray-300 hover:text-rose-500 text-lg leading-none px-1"
                aria-label="Delete game"
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
      <button
        onClick={onAdd}
        className="w-full rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/40 py-4 text-sm font-semibold text-blue-700 hover:bg-blue-50"
      >
        + Add a game
      </button>
    </div>
  );
}

function OtherList({
  rows,
  onAdd,
  onUpdate,
  onRemove,
}: {
  rows: OtherRow[];
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<OtherRow>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="flex items-center gap-2">
          <input
            type="text"
            value={r.description}
            onChange={(e) => onUpdate(r.id, { description: e.target.value })}
            placeholder="Description (e.g. 1st in race)"
            className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <input
            type="number"
            inputMode="numeric"
            value={r.points}
            onChange={(e) => onUpdate(r.id, { points: e.target.value })}
            placeholder="Pts"
            className="w-20 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm tabular-nums focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <button
            onClick={() => onRemove(r.id)}
            className="text-gray-300 hover:text-rose-500 text-lg leading-none px-1"
            aria-label="Remove"
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={onAdd}
        className="w-full rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50/40 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-50"
      >
        + Add ad-hoc points
      </button>
    </div>
  );
}

function GameSheet({
  initial,
  onSave,
  onClose,
  onDelete,
}: {
  initial: Game;
  onSave: (g: Game) => void;
  onClose: () => void;
  onDelete: (() => void) | null;
}) {
  const [g, setG] = useState<Game>(initial);
  const total = gameTotal(g);

  function step(field: keyof Pick<Game, "goals" | "tries" | "assists" | "preAssists" | "saves" | "clearances">, delta: number) {
    setG((x) => ({ ...x, [field]: Math.max(0, x[field] + delta) }));
  }

  const stats: { key: "goals" | "tries" | "assists" | "preAssists" | "saves" | "clearances"; label: string; mult: number }[] = [
    { key: "goals", label: "Goals", mult: POINTS.goal },
    { key: "tries", label: "Tries", mult: POINTS.try },
    { key: "assists", label: "Assists", mult: POINTS.assist },
    { key: "preAssists", label: "Pre-assists", mult: POINTS.preAssist },
    { key: "saves", label: "Saves", mult: POINTS.save },
    { key: "clearances", label: "Clearances", mult: POINTS.clearance },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 bg-black/40 flex items-end"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-white rounded-t-3xl p-5 max-h-[92vh] overflow-y-auto"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />

        <h3 className="text-base font-bold text-gray-900 mb-1">
          {onDelete ? "Edit game" : "Add a game"}
        </h3>
        <p className="text-[11px] text-gray-500 mb-4">
          Points update as you tap.
        </p>

        {/* Game type */}
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">
          Game type
        </p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {(Object.keys(GAME_LABEL) as GameType[]).map((t) => {
            const active = g.type === t;
            return (
              <button
                key={t}
                onClick={() => setG((x) => ({ ...x, type: t }))}
                className={`text-left rounded-xl border p-2.5 transition-all ${
                  active
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-blue-200"
                }`}
              >
                <p className="text-sm font-semibold text-gray-900">
                  {GAME_LABEL[t].emoji} {GAME_LABEL[t].name}
                </p>
              </button>
            );
          })}
        </div>

        {/* Result */}
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">
          Result
        </p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {(["won", "drew", "lost"] as Result[]).map((r) => {
            const active = g.result === r;
            const tone =
              r === "won"
                ? active
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 bg-white text-gray-700"
                : r === "drew"
                ? active
                  ? "border-amber-500 bg-amber-50 text-amber-700"
                  : "border-gray-200 bg-white text-gray-700"
                : active
                ? "border-rose-500 bg-rose-50 text-rose-700"
                : "border-gray-200 bg-white text-gray-700";
            return (
              <button
                key={r}
                onClick={() => setG((x) => ({ ...x, result: r }))}
                className={`rounded-xl border py-2.5 text-center transition-all ${tone}`}
              >
                <p className="text-sm font-bold">{RESULT_LABEL[r]}</p>
                <p className="text-[10px] tabular-nums opacity-75">+{POINTS[r]}</p>
              </button>
            );
          })}
        </div>

        {/* Stats */}
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">
          Stats
        </p>
        <div className="space-y-2 mb-4">
          {stats.map((s) => (
            <div key={s.key} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{s.label}</p>
                <p className="text-[10px] text-gray-500">
                  ×{s.mult} = {(g[s.key] * s.mult).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => step(s.key, -1)}
                disabled={g[s.key] === 0}
                className="h-9 w-9 rounded-lg border border-gray-200 text-base font-bold text-gray-600 disabled:opacity-30 hover:bg-gray-50"
              >
                −
              </button>
              <p className="w-8 text-center font-[family-name:var(--font-display)] text-lg font-bold tabular-nums text-gray-900">
                {g[s.key]}
              </p>
              <button
                onClick={() => step(s.key, 1)}
                className="h-9 w-9 rounded-lg border border-gray-200 text-base font-bold text-gray-600 hover:bg-gray-50"
              >
                +
              </button>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-3 mb-4 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">
            Game total
          </p>
          <p className="font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums text-blue-700">
            +{total.toLocaleString()}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {onDelete && (
            <button
              onClick={onDelete}
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100"
            >
              Delete
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(g)}
            className="flex-1 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20"
          >
            Save game
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SubmittedView({
  total,
  hasDynamic,
  onNew,
}: {
  total: number;
  hasDynamic: boolean;
  onNew: () => void;
}) {
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
          {total.toLocaleString()}
          {hasDynamic ? "+ pts" : " pts"} to KFANDRA
        </h1>
        <p className="mt-2 text-sm text-gray-500 max-w-xs">
          KFANDRA approves by 4 pm.
          {hasDynamic && " Arrival & confirmation points are added at approval."}
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
