"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { saveDraft as saveLocalDraft } from "@/lib/drafts/storage";
import { computeDraftPoints, type ScoringConfig } from "@/lib/mmg/scoring";
import { STATS_BY_TYPE, isPenaltyStat } from "@/lib/mmg/catalog";
import {
  emptyDraft,
  emptyGame,
  type GameDraft,
  type GameResult,
  type GameResults,
  type GameTypeKey,
  type MmgDraft,
  type OtherRow,
  type Participation,
  type StatKey,
} from "@/lib/mmg/types";
import {
  loadMmgDraftAction,
  saveMmgDraftAction,
  finalizeMmgSessionAction,
} from "@/lib/mmg/actions";
import type { GameTypeOption } from "@/lib/mmg/config";
import type { SessionRow } from "@/lib/mmg/sessions";
import type { SessionOrderResult } from "@/lib/mmg/order";

type SyncStatus = "idle" | "saving" | "saved" | "error";

const STAT_LABELS: Record<StatKey, string> = {
  goals: "Goals",
  tries: "Tries",
  assists: "Assists",
  preAssists: "Pre-assists",
  saves: "Saves",
  goalLineSaves: "Goal-line saves",
  reboundWall: "Rebound wall",
  tackles: "Tackle",
  goalConceded: "Goal conceded",
  yellowCards: "Yellow card",
  redCards: "Red card",
  blueCards: "Blue card",
  lateChallenges: "Late challenge",
  fouls: "Foul",
};

const RESULT_LABELS: Record<GameResult, string> = {
  won: "Won",
  drew: "Drew",
  lost: "Lost",
};

function statLabel(type: GameTypeKey, key: StatKey): string {
  if (key === "tackles" && (type === "rugby-short" || type === "rugby-full")) {
    return "Tackle (Touch/Normal)";
  }
  return STAT_LABELS[key];
}

/** Compact "3W · 1D · 2L" summary; "—" when nothing recorded. */
function resultSummary(r: GameResults): string {
  const parts: string[] = [];
  if (r.won) parts.push(`${r.won}W`);
  if (r.drew) parts.push(`${r.drew}D`);
  if (r.lost) parts.push(`${r.lost}L`);
  return parts.length ? parts.join(" · ") : "—";
}

export default function MmgEntry({
  playerName,
  initialSession,
  initialDraft,
  config,
  gameTypes,
  sessions,
}: {
  playerName: string;
  initialSession: SessionRow;
  initialDraft: MmgDraft;
  config: ScoringConfig;
  gameTypes: GameTypeOption[];
  sessions: SessionRow[];
}) {
  const [session, setSession] = useState<SessionRow>(initialSession);
  const [draft, setDraft] = useState<MmgDraft>(initialDraft);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [switching, setSwitching] = useState(false);
  const [editing, setEditing] = useState<GameDraft | null>(null);
  const [order, setOrder] = useState<SessionOrderResult[] | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  const labelByKey = useMemo(() => {
    const m = new Map<GameTypeKey, GameTypeOption>();
    for (const g of gameTypes) m.set(g.key, g);
    return m;
  }, [gameTypes]);

  const breakdown = useMemo(() => computeDraftPoints(config, draft), [config, draft]);

  // ── Autosave: local immediately + server on a debounce ───────────────────
  const serverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSave = useRef(true); // suppress the save the initial mount triggers
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // "saving" status is set at the mutation site (mutate) — an event handler —
  // so this effect never calls setState synchronously. It just mirrors to
  // local storage and schedules the debounced server flush (whose async
  // callback sets the terminal status).
  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    saveLocalDraft(`mmg:${session.id}`, draft); // local crash-safety, synchronous
    if (serverTimer.current) clearTimeout(serverTimer.current);
    serverTimer.current = setTimeout(async () => {
      const res = await saveMmgDraftAction(session.id, draftRef.current);
      setStatus(res.ok ? "saved" : "error");
    }, 1000);
    return () => {
      if (serverTimer.current) clearTimeout(serverTimer.current);
    };
  }, [draft, session.id]);

  /** Apply a draft change from a user interaction and mark it saving. */
  const mutate = useCallback((updater: (d: MmgDraft) => MmgDraft) => {
    setStatus("saving");
    setDraft(updater);
  }, []);

  const switchSession = useCallback(async (dateKey: string) => {
    setSwitching(true);
    setOrder(null);
    const res = await loadMmgDraftAction(dateKey);
    if (res.ok) {
      skipSave.current = true; // loading isn't an edit
      const next = sessions.find((s) => s.id === res.data.sessionId);
      if (next) setSession(next);
      setDraft(res.data.draft);
      setStatus("idle");
    }
    setSwitching(false);
  }, [sessions]);

  // ── Draft mutators (all route through mutate → marks saving) ─────────────
  const updateParticipation = (patch: Partial<Participation>) =>
    mutate((d) => ({ ...d, participation: { ...d.participation, ...patch } }));

  const saveGame = (g: GameDraft) => {
    mutate((d) => {
      const exists = d.games.some((x) => x.id === g.id);
      return {
        ...d,
        games: exists ? d.games.map((x) => (x.id === g.id ? g : x)) : [...d.games, g],
      };
    });
    setEditing(null);
  };
  const deleteGame = (id: string) =>
    mutate((d) => ({ ...d, games: d.games.filter((g) => g.id !== id) }));

  const addOther = () =>
    mutate((d) => ({
      ...d,
      others: [...d.others, { id: `o-${Date.now()}`, description: "", points: "" }],
    }));
  const updateOther = (id: string, patch: Partial<OtherRow>) =>
    mutate((d) => ({
      ...d,
      others: d.others.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));
  const removeOther = (id: string) =>
    mutate((d) => ({ ...d, others: d.others.filter((o) => o.id !== id) }));

  const updateNarration = (narration: string) =>
    mutate((d) => ({ ...d, narration }));

  const resetSession = () => mutate(() => emptyDraft());

  const finalize = async () => {
    setFinalizing(true);
    if (serverTimer.current) clearTimeout(serverTimer.current);
    const res = await finalizeMmgSessionAction(session.id, draftRef.current);
    if (res.ok) {
      setStatus("saved");
      setOrder(res.data.order);
    } else {
      setStatus("error");
    }
    setFinalizing(false);
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 p-5 pb-32">
      {/* ── Scoreboard ─────────────────────────────────────────────── */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
              MMG session · {playerName}
            </p>
            <select
              value={session.session_date}
              onChange={(e) => switchSession(e.target.value)}
              disabled={switching}
              className="mt-1 -ml-1 rounded-lg bg-transparent px-1 py-0.5 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.session_date}>
                  {s.label ?? s.session_date}
                </option>
              ))}
            </select>
          </div>
          <SyncBadge status={status} switching={switching} />
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">
              Your points so far
            </p>
            <p className="font-[family-name:var(--font-display)] text-4xl font-black tabular-nums text-gray-900">
              {breakdown.total.toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-gray-400">
              + order-of-arrival points after the session settles
            </p>
          </div>
          <button
            onClick={resetSession}
            className="rounded-lg px-2 py-1 text-[11px] font-semibold text-gray-400 hover:text-red-500"
          >
            Reset
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="Participation" value={breakdown.participation} />
          <Stat label="Games" value={breakdown.games} />
          <Stat label="Other" value={breakdown.others} />
        </div>
      </div>

      {/* ── 1. Participation ───────────────────────────────────────── */}
      <SectionHeading index={1} title="Participation" subtitle="Once per session" />
      <ParticipationCard
        p={draft.participation}
        config={config}
        onChange={updateParticipation}
      />

      {/* ── 2. Performance ─────────────────────────────────────────── */}
      <SectionHeading
        index={2}
        title="Performance"
        subtitle="One card per game type · tally W/D/L"
      />
      <div className="flex flex-col gap-3">
        {draft.games.map((g) => {
          const meta = labelByKey.get(g.type);
          const sub = computeDraftPoints(config, { ...emptyDraft(), games: [g] }).games;
          return (
            <button
              key={g.id}
              onClick={() => setEditing({ ...g })}
              className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 text-left active:scale-[0.99]"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <span>{meta?.emoji}</span>
                {meta?.name ?? g.type}
                <span className="text-gray-400">· {resultSummary(g.results)}</span>
              </span>
              <span className="tabular-nums text-sm font-bold text-blue-600">
                {sub.toLocaleString()}
              </span>
            </button>
          );
        })}
        <button
          onClick={() => setEditing(emptyGame(`g-${Date.now()}`))}
          className="rounded-2xl border-2 border-dashed border-gray-300 px-4 py-3 text-sm font-semibold text-gray-500 hover:border-blue-300 hover:text-blue-600"
        >
          + Add a game
        </button>
      </div>

      {/* ── 3. Other ───────────────────────────────────────────────── */}
      <SectionHeading index={3} title="Other" subtitle="Free-form points" />
      <div className="flex flex-col gap-2">
        {draft.others.map((o) => (
          <div key={o.id} className="flex items-center gap-2">
            <input
              value={o.description}
              onChange={(e) => updateOther(o.id, { description: e.target.value })}
              placeholder="Description"
              className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <input
              value={o.points}
              onChange={(e) =>
                updateOther(o.id, { points: e.target.value.replace(/[^0-9-]/g, "") })
              }
              inputMode="numeric"
              placeholder="±pts"
              className="w-20 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm tabular-nums text-center focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              onClick={() => removeOther(o.id)}
              className="px-2 text-gray-400 hover:text-red-500"
              aria-label="Remove row"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          onClick={addOther}
          className="self-start rounded-lg px-1 text-[12px] font-semibold text-blue-600 hover:text-blue-700"
        >
          + Add other points
        </button>
      </div>

      {/* ── 4. Narration ───────────────────────────────────────────── */}
      <SectionHeading index={4} title="Narration" subtitle="Optional" />
      <textarea
        value={draft.narration}
        onChange={(e) => updateNarration(e.target.value)}
        rows={3}
        placeholder="How did the session go?"
        className="w-full rounded-2xl border border-gray-200 bg-white p-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />

      {/* ── Finalize + order result ────────────────────────────────── */}
      <button
        onClick={finalize}
        disabled={finalizing}
        className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3.5 text-center text-sm font-bold text-white shadow-lg shadow-blue-500/20 active:scale-[0.98] disabled:opacity-60"
      >
        {finalizing ? "Finalizing…" : "Finalize session"}
      </button>
      <p className="-mt-2 text-center text-[11px] text-gray-400">
        Finalize flushes your entry and shows the order-of-arrival points. It is
        not an approval — you can still edit afterwards.
      </p>

      {order && <OrderLadder order={order} playerName={playerName} />}

      {/* ── Game editor sheet ──────────────────────────────────────── */}
      {/* Mounted/unmounted directly (no AnimatePresence): framer-motion's
          exit-removal does not unmount custom-component children in this
          React 19 / Next 16 stack — even usePresence's safeToRemove is a
          no-op — so an exit-animated overlay lingers at opacity 0 and keeps
          intercepting clicks. We animate the sheet in and close it instantly. */}
      {editing && (
        <GameEditor
          key={editing.id}
          game={editing}
          config={config}
          gameTypes={gameTypes}
          onSave={saveGame}
          onDelete={draft.games.some((g) => g.id === editing.id) ? deleteGame : undefined}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-gray-50 px-2 py-2">
      <p className="text-[9px] uppercase tracking-wide text-gray-400 font-semibold">{label}</p>
      <p className="tabular-nums text-sm font-bold text-gray-800">{value.toLocaleString()}</p>
    </div>
  );
}

function SyncBadge({ status, switching }: { status: SyncStatus; switching: boolean }) {
  const label = switching
    ? "Loading…"
    : status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "Saved ✓"
        : status === "error"
          ? "Offline — saved locally"
          : "";
  const color =
    status === "error"
      ? "text-amber-600"
      : status === "saved"
        ? "text-green-600"
        : "text-gray-400";
  return <span className={`text-[11px] font-semibold ${color}`}>{label}</span>;
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
    <div className="flex items-baseline gap-2 pt-1">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">
        {index}
      </span>
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      <span className="text-[11px] text-gray-400">{subtitle}</span>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
        {label}
      </span>
      <input
        value={value ?? ""}
        onChange={(e) => {
          const cleaned = e.target.value.replace(/\D/g, "");
          onChange(cleaned === "" ? null : Number(cleaned));
        }}
        inputMode="numeric"
        placeholder="—"
        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm tabular-nums text-center focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
      />
    </label>
  );
}

function Toggle({
  label,
  points,
  value,
  onChange,
}: {
  label: string;
  points: number;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
        value
          ? "border-blue-300 bg-blue-50 text-blue-800"
          : "border-gray-200 bg-white text-gray-700"
      }`}
    >
      <span className="font-medium">{label}</span>
      <span className="flex items-center gap-2">
        <span className="tabular-nums text-[11px] font-semibold text-gray-400">
          +{points}
        </span>
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
            value ? "bg-blue-600 text-white" : "bg-gray-200 text-transparent"
          }`}
        >
          ✓
        </span>
      </span>
    </button>
  );
}

function ParticipationCard({
  p,
  config,
  onChange,
}: {
  p: Participation;
  config: ScoringConfig;
  onChange: (patch: Partial<Participation>) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Confirmation order"
          value={p.confirmationOrder}
          onChange={(v) => onChange({ confirmationOrder: v })}
        />
        <NumberField
          label="Arrival order"
          value={p.arrivalOrder}
          onChange={(v) => onChange({ arrivalOrder: v })}
        />
      </div>
      <p className="-mt-1 text-[11px] text-gray-400">
        Your place in line — points scale with how many show up.
      </p>
      <div className="grid grid-cols-1 gap-2">
        <Toggle
          label="GWW unpacking"
          points={config.participation.unpacking}
          value={p.unpacking}
          onChange={(v) => onChange({ unpacking: v })}
        />
        <Toggle
          label="GWW packing"
          points={config.participation.packingWeights}
          value={p.packingWeights}
          onChange={(v) => onChange({ packingWeights: v })}
        />
        <Toggle
          label="Session packing (PTM)"
          points={config.participation.packingKit}
          value={p.packingKit}
          onChange={(v) => onChange({ packingKit: v })}
        />
        <Toggle
          label="Confirmed availability (bonus)"
          points={config.participation.confirmedBy11am}
          value={p.confirmedBy11am}
          onChange={(v) => onChange({ confirmedBy11am: v })}
        />
      </div>
    </div>
  );
}

function GameEditor({
  game,
  config,
  gameTypes,
  onSave,
  onDelete,
  onClose,
}: {
  game: GameDraft;
  config: ScoringConfig;
  gameTypes: GameTypeOption[];
  onSave: (g: GameDraft) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}) {
  const [g, setG] = useState<GameDraft>(game);
  const keys = STATS_BY_TYPE[g.type];

  const setStat = (key: StatKey, delta: number) =>
    setG((prev) => {
      const next = Math.max(0, (prev.stats[key] ?? 0) + delta);
      return { ...prev, stats: { ...prev.stats, [key]: next } };
    });

  const setResult = (r: GameResult, delta: number) =>
    setG((prev) => ({
      ...prev,
      results: { ...prev.results, [r]: Math.max(0, prev.results[r] + delta) },
    }));

  const positives = keys.filter((k) => !isPenaltyStat(k));
  const penalties = keys.filter((k) => isPenaltyStat(k));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">Game details</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        {/* Game type */}
        <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
          Game type
        </p>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {gameTypes.map((t) => (
            <button
              key={t.key}
              onClick={() => setG((prev) => ({ ...prev, type: t.key }))}
              className={`rounded-xl border px-3 py-2 text-left text-sm font-medium ${
                g.type === t.key
                  ? "border-blue-400 bg-blue-50 text-blue-800"
                  : "border-gray-200 bg-white text-gray-700"
              }`}
            >
              {t.emoji} {t.name}
            </button>
          ))}
        </div>

        {/* Result counts — how many games of this type ended each way */}
        <p className="mt-4 text-[10px] uppercase tracking-wide text-gray-500 font-semibold">
          Result · how many games
        </p>
        <div className="mt-1.5 flex flex-col gap-2">
          {(["won", "drew", "lost"] as GameResult[]).map((r) => (
            <StatStepper
              key={r}
              label={RESULT_LABELS[r]}
              points={config.result[r] ?? 0}
              value={g.results[r]}
              onAdd={() => setResult(r, 1)}
              onSub={() => setResult(r, -1)}
            />
          ))}
        </div>

        {/* Stats */}
        <div className="mt-4 flex flex-col gap-2">
          {positives.map((k) => (
            <StatStepper
              key={k}
              label={statLabel(g.type, k)}
              points={config.statOverride[g.type]?.[k] ?? config.statDefault[k] ?? 0}
              value={g.stats[k] ?? 0}
              onAdd={() => setStat(k, 1)}
              onSub={() => setStat(k, -1)}
            />
          ))}
          {penalties.length > 0 && (
            <p className="mt-2 text-[10px] uppercase tracking-wide text-red-400 font-semibold">
              Penalties
            </p>
          )}
          {penalties.map((k) => (
            <StatStepper
              key={k}
              label={statLabel(g.type, k)}
              points={config.statOverride[g.type]?.[k] ?? config.statDefault[k] ?? 0}
              value={g.stats[k] ?? 0}
              onAdd={() => setStat(k, 1)}
              onSub={() => setStat(k, -1)}
            />
          ))}
        </div>

        <div className="mt-5 flex gap-2">
          {onDelete && (
            <button
              onClick={() => onDelete(g.id)}
              className="rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600"
            >
              Delete
            </button>
          )}
          <button
            onClick={() => onSave(g)}
            className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatStepper({
  label,
  points,
  value,
  onAdd,
  onSub,
}: {
  label: string;
  points: number;
  value: number;
  onAdd: () => void;
  onSub: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-800">{label}</p>
        <p className="tabular-nums text-[11px] text-gray-400">
          {points > 0 ? "+" : ""}
          {points} each
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onSub}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-lg text-gray-600 active:scale-90"
        >
          −
        </button>
        <span className="w-6 text-center tabular-nums text-sm font-bold text-gray-900">
          {value}
        </span>
        <button
          onClick={onAdd}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-lg text-white active:scale-90"
        >
          +
        </button>
      </div>
    </div>
  );
}

function OrderLadder({
  order,
  playerName,
}: {
  order: SessionOrderResult[];
  playerName: string;
}) {
  const sorted = [...order].sort((a, b) => b.total - a.total);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-gray-200 bg-white p-4"
    >
      <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
        Order-of-arrival points (provisional · {order.length} arrived)
      </p>
      <div className="mt-2 flex flex-col gap-1">
        {sorted.map((r) => (
          <div
            key={r.playerId}
            className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm ${
              r.name === playerName ? "bg-blue-50 font-semibold text-blue-800" : "text-gray-700"
            }`}
          >
            <span>{r.name}</span>
            <span className="tabular-nums">
              {r.confirmationPoints} + {r.arrivalPoints} ={" "}
              <span className="font-bold">{r.total}</span>
            </span>
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="text-[12px] text-gray-400">
            No arrivals recorded yet — fill in arrival order to score.
          </p>
        )}
      </div>
    </motion.div>
  );
}
