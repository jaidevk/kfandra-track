"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { saveDraft as saveLocalDraft } from "@/lib/drafts/storage";
import {
  emptyDraft,
  newExercise,
  weightStep,
  type ExerciseRow,
  type GymDraft,
  type WeightUnit,
} from "@/lib/gym/types";
import { exerciseCount, totalSets, hasWeight } from "@/lib/gym/summary";
import { loadGymLogAction, saveGymLogAction } from "@/lib/gym/actions";
import { dateLabel, todayKey } from "@/lib/gym/dates";
import type { GymCatalog } from "@/lib/gym/config";
import { AnalyticsEvent, capture } from "@/lib/observability/analytics";

type SyncStatus = "idle" | "saving" | "saved" | "error";

export default function GymEntry({
  playerName,
  initialDate,
  initialDraft,
  catalog,
}: {
  playerName: string;
  initialDate: string;
  initialDraft: GymDraft;
  catalog: GymCatalog;
}) {
  const [dateKey, setDateKey] = useState<string>(initialDate);
  const [draft, setDraft] = useState<GymDraft>(initialDraft);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [switching, setSwitching] = useState(false);
  const [editing, setEditing] = useState<ExerciseRow | null>(null);

  const iconByBodyPart = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const b of catalog.bodyParts) m.set(b.value, b.icon);
    return m;
  }, [catalog.bodyParts]);

  const defaults = useMemo(
    () => ({
      bodyPart: catalog.bodyParts[0]?.value ?? "Shoulders",
      scheme: catalog.schemes[0] ?? "",
    }),
    [catalog.bodyParts, catalog.schemes],
  );

  const count = exerciseCount(draft);
  const sets = totalSets(draft);

  // ── Autosave: local immediately + server on a debounce ───────────────────
  const serverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSave = useRef(true); // suppress the save the initial mount triggers
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // "saving" status is set at the mutation site (mutate) — an event handler —
  // so this effect never calls setState synchronously. It mirrors to local
  // storage and schedules the debounced server flush.
  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    saveLocalDraft(`gym:${dateKey}`, draft); // local crash-safety, synchronous
    if (serverTimer.current) clearTimeout(serverTimer.current);
    serverTimer.current = setTimeout(async () => {
      const res = await saveGymLogAction(dateKey, draftRef.current);
      setStatus(res.ok ? "saved" : "error");
    }, 1000);
    return () => {
      if (serverTimer.current) clearTimeout(serverTimer.current);
    };
  }, [draft, dateKey]);

  /** Apply a draft change from a user interaction and mark it saving. */
  const mutate = useCallback((updater: (d: GymDraft) => GymDraft) => {
    setStatus("saving");
    setDraft(updater);
  }, []);

  const switchDate = useCallback(async (nextDate: string) => {
    if (!nextDate) return;
    setSwitching(true);
    const res = await loadGymLogAction(nextDate);
    if (res.ok) {
      skipSave.current = true; // loading isn't an edit
      setDateKey(nextDate);
      setDraft(res.data.draft);
      setStatus("idle");
    }
    setSwitching(false);
  }, []);

  // ── Draft mutators (all route through mutate → marks saving) ─────────────
  const saveExercise = (r: ExerciseRow) => {
    const isNew = !draft.rows.some((x) => x.id === r.id);
    mutate((d) => {
      const exists = d.rows.some((x) => x.id === r.id);
      return {
        ...d,
        rows: exists ? d.rows.map((x) => (x.id === r.id ? r : x)) : [...d.rows, r],
      };
    });
    setEditing(null);
    capture(AnalyticsEvent.GymExerciseLogged, {
      body_part: r.bodyPart,
      equipment: r.equipment ?? null,
      is_new: isNew,
    });
  };
  const deleteExercise = (id: string) => {
    mutate((d) => ({ ...d, rows: d.rows.filter((r) => r.id !== id) }));
    setEditing(null);
  };
  const updateBodyWeight = (patch: Partial<GymDraft>) =>
    mutate((d) => ({ ...d, ...patch }));
  const updateNarration = (narration: string) =>
    mutate((d) => ({ ...d, narration }));
  const resetDay = () => mutate(() => emptyDraft());

  const isToday = dateKey === todayKey();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 p-5 pb-32">
      {/* ── Header card ────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 p-5 text-white shadow-lg shadow-emerald-500/20">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200/80">
                Gym log · {playerName}
              </p>
              <SyncBadge status={status} switching={switching} />
            </div>
            <input
              type="date"
              value={dateKey}
              max={todayKey()}
              onChange={(e) => switchDate(e.target.value)}
              disabled={switching}
              className="mt-1 rounded-lg bg-white/10 px-2 py-0.5 text-sm font-bold text-white backdrop-blur focus:outline-none focus:ring-2 focus:ring-white/30 [color-scheme:dark]"
            />
            <p className="mt-1 text-[11px] text-emerald-200/60">
              {dateLabel(dateKey)}
              {isToday ? " · today" : ""}
            </p>
            <div className="mt-3 flex items-end gap-4">
              <div>
                <p className="font-[family-name:var(--font-display)] text-5xl font-black tabular-nums tracking-tight">
                  {count}
                </p>
                <p className="text-[11px] text-emerald-200/60">exercises</p>
              </div>
              <div className="border-l border-white/20 pl-4">
                <p className="font-[family-name:var(--font-display)] text-3xl font-black tabular-nums tracking-tight">
                  {sets}
                </p>
                <p className="text-[11px] text-emerald-200/60">est. sets</p>
              </div>
            </div>
          </div>
          {count > 0 && (
            <button
              onClick={resetDay}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur hover:bg-white/20"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Body weight ────────────────────────────────────────────── */}
      <BodyWeightCard
        weight={draft.bodyWeight}
        unit={draft.bodyWeightUnit}
        onChange={updateBodyWeight}
      />

      {/* ── Logged exercises ───────────────────────────────────────── */}
      {draft.rows.length > 0 && (
        <div className="flex flex-col gap-2.5">
          {draft.rows.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-gray-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  onClick={() => setEditing({ ...r })}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg">{iconByBodyPart.get(r.bodyPart) ?? "🏋️"}</span>
                    <p className="text-sm font-bold text-gray-900">{r.bodyPart}</p>
                    {r.equipment && r.equipment !== "None" && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                        · {r.equipment}
                      </span>
                    )}
                    {hasWeight(r) && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                        · {r.weight} {r.weightUnit}
                      </span>
                    )}
                  </div>
                  {r.scheme && <p className="mt-1 text-sm text-gray-700">{r.scheme}</p>}
                  {r.notes && (
                    <p className="mt-0.5 text-[11px] italic text-gray-500">{r.notes}</p>
                  )}
                </button>
                <button
                  onClick={() => deleteExercise(r.id)}
                  className="px-1 text-lg leading-none text-gray-300 hover:text-rose-500"
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setEditing(newExercise(`r-${Date.now()}`, defaults))}
        className="rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 py-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
      >
        + Add exercise
      </button>
      {draft.rows.length === 0 && (
        <p className="-mt-2 text-center text-xs text-gray-400">
          Tap to log your first exercise
        </p>
      )}

      {/* ── Narration ──────────────────────────────────────────────── */}
      {draft.rows.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-900">Narration (optional)</h2>
          <p className="mb-2 text-[11px] text-gray-500">
            Your reference — helps KFANDRA cross-check later
          </p>
          <textarea
            value={draft.narration}
            onChange={(e) => updateNarration(e.target.value)}
            placeholder="e.g. shoulder feeling tight, kept weights light"
            rows={3}
            className="w-full rounded-2xl border border-gray-200 bg-white p-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </section>
      )}

      <p className="text-center text-[11px] italic text-gray-400">
        Gym tracking is not scored — KFANDRA reviews it separately.
      </p>

      {/* ── Exercise editor sheet ──────────────────────────────────── */}
      {/* Mounted/unmounted directly (no AnimatePresence): framer-motion's
          exit-removal does not unmount custom-component children in this
          React 19 / Next 16 stack — even usePresence's safeToRemove is a
          no-op — so an exit-animated overlay lingers at opacity 0 and keeps
          intercepting clicks. We animate the sheet in and close it instantly. */}
      {editing && (
        <ExerciseSheet
          key={editing.id}
          initial={editing}
          catalog={catalog}
          onSave={saveExercise}
          onClose={() => setEditing(null)}
          onDelete={
            draft.rows.some((r) => r.id === editing.id)
              ? () => deleteExercise(editing.id)
              : null
          }
        />
      )}
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────

function SyncBadge({ status, switching }: { status: SyncStatus; switching: boolean }) {
  const label = switching
    ? "Loading…"
    : status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "Saved ✓"
        : status === "error"
          ? "Offline — saved locally"
          : "Auto";
  const color =
    status === "error"
      ? "text-amber-200"
      : status === "saved"
        ? "text-emerald-200"
        : "text-emerald-200/60";
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide ${color}`}>
      {label}
    </span>
  );
}

function BodyWeightCard({
  weight,
  unit,
  onChange,
}: {
  weight: string;
  unit: WeightUnit;
  onChange: (patch: Partial<GymDraft>) => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Body weight</h2>
        <p className="text-[10px] uppercase tracking-wide text-gray-400">Optional</p>
      </div>
      <p className="mb-3 text-[11px] text-gray-500">
        Note your weight today — KFANDRA tracks your trend.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={weight}
          onChange={(e) =>
            onChange({ bodyWeight: e.target.value.replace(/[^0-9.]/g, "") })
          }
          placeholder="—"
          className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm tabular-nums focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
        <div className="flex shrink-0 rounded-xl bg-gray-100 p-1">
          {(["kg", "lb"] as WeightUnit[]).map((u) => (
            <button
              key={u}
              onClick={() => onChange({ bodyWeightUnit: u })}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                unit === u ? "bg-emerald-500 text-white" : "text-gray-500"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExerciseSheet({
  initial,
  catalog,
  onSave,
  onClose,
  onDelete,
}: {
  initial: ExerciseRow;
  catalog: GymCatalog;
  onSave: (r: ExerciseRow) => void;
  onClose: () => void;
  onDelete: (() => void) | null;
}) {
  const [r, setR] = useState<ExerciseRow>(initial);

  const supportsWeight = useMemo(() => {
    const eq = catalog.equipment.find((e) => e.value === r.equipment);
    return eq ? eq.supportsWeight : false;
  }, [catalog.equipment, r.equipment]);

  const usingCustom = !catalog.schemes.includes(r.scheme);

  function setEquipment(eq: string) {
    const meta = catalog.equipment.find((e) => e.value === eq);
    const eqSupportsWeight = meta ? meta.supportsWeight : false;
    setR((x) => ({
      ...x,
      equipment: eq,
      weight: eqSupportsWeight ? x.weight : 0,
    }));
  }

  function stepWeight(direction: 1 | -1) {
    setR((x) => {
      const step = weightStep(x.weightUnit);
      return { ...x, weight: Math.max(0, x.weight + direction * step) };
    });
  }

  const weightSectionNo = supportsWeight ? "3." : null;
  const schemeNo = supportsWeight ? "4." : "3.";
  const notesNo = supportsWeight ? "5." : "4.";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
        <h3 className="mb-1 text-base font-bold text-gray-900">
          {onDelete ? "Edit exercise" : "Add exercise"}
        </h3>
        <p className="mb-4 text-[11px] text-gray-500">
          From the GWW/GWtW catalog. KFANDRA can promote new schemes later.
        </p>

        {/* Body part */}
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
          1. Body part / movement
        </p>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {catalog.bodyParts.map((b) => {
            const active = r.bodyPart === b.value;
            return (
              <button
                key={b.value}
                onClick={() => setR((x) => ({ ...x, bodyPart: b.value }))}
                className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition-all ${
                  active
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-gray-200 bg-white hover:border-emerald-200"
                }`}
              >
                <span className="text-lg">{b.icon ?? "🏋️"}</span>
                <span className="text-sm font-semibold text-gray-900">{b.value}</span>
              </button>
            );
          })}
        </div>

        {/* Equipment */}
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
          2. Equipment
        </p>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {catalog.equipment.map((eq) => {
            const active = r.equipment === eq.value;
            return (
              <button
                key={eq.value}
                onClick={() => setEquipment(eq.value)}
                className={`rounded-xl border py-2 text-center text-xs font-semibold transition-all ${
                  active
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 bg-white text-gray-700 hover:border-emerald-200"
                }`}
              >
                {eq.value}
              </button>
            );
          })}
        </div>

        {/* Weight */}
        {supportsWeight && (
          <>
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                {weightSectionNo} Weight ({weightStep(r.weightUnit)} {r.weightUnit} steps)
              </p>
              <div className="flex shrink-0 rounded-lg bg-gray-100 p-0.5">
                {(["kg", "lb"] as WeightUnit[]).map((u) => (
                  <button
                    key={u}
                    onClick={() => setR((x) => ({ ...x, weightUnit: u }))}
                    className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                      r.weightUnit === u ? "bg-emerald-500 text-white" : "text-gray-500"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
              <button
                onClick={() => stepWeight(-1)}
                disabled={r.weight <= 0}
                className="h-10 w-10 rounded-xl border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-30"
              >
                −
              </button>
              <div className="flex-1 text-center">
                <p className="font-[family-name:var(--font-display)] text-3xl font-bold tabular-nums text-gray-900">
                  {r.weight}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-gray-400">
                  {r.weightUnit}
                </p>
              </div>
              <button
                onClick={() => stepWeight(1)}
                className="h-10 w-10 rounded-xl border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-50"
              >
                +
              </button>
            </div>
          </>
        )}

        {/* Scheme */}
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
          {schemeNo} Set / rep scheme
        </p>
        <div className="mb-2 grid grid-cols-1 gap-2">
          {catalog.schemes.map((s) => {
            const active = !usingCustom && r.scheme === s;
            return (
              <button
                key={s}
                onClick={() => setR((x) => ({ ...x, scheme: s }))}
                className={`rounded-xl border px-3 py-2 text-left text-sm transition-all ${
                  active
                    ? "border-emerald-500 bg-emerald-50 font-semibold text-emerald-700"
                    : "border-gray-200 bg-white text-gray-700 hover:border-emerald-200"
                }`}
              >
                {s}
              </button>
            );
          })}
          <button
            onClick={() => setR((x) => ({ ...x, scheme: usingCustom ? x.scheme : "" }))}
            className={`rounded-xl border px-3 py-2 text-left text-sm transition-all ${
              usingCustom
                ? "border-emerald-500 bg-emerald-50 font-semibold text-emerald-700"
                : "border-gray-200 bg-white text-gray-700 hover:border-emerald-200"
            }`}
          >
            Custom…
          </button>
        </div>
        {usingCustom && (
          <input
            type="text"
            value={r.scheme}
            onChange={(e) => setR((x) => ({ ...x, scheme: e.target.value }))}
            placeholder="e.g. 5 sets, 12-10-8-8-6"
            className="mb-4 w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        )}
        {!usingCustom && <div className="mb-4" />}

        {/* Notes */}
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-500">
          {notesNo} Notes (optional)
        </p>
        <input
          type="text"
          value={r.notes}
          onChange={(e) => setR((x) => ({ ...x, notes: e.target.value }))}
          placeholder="e.g. z-bar 10-8-8-8-8-10"
          className="mb-5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />

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
            onClick={() => onSave(r)}
            disabled={!r.bodyPart || !r.scheme.trim()}
            className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
