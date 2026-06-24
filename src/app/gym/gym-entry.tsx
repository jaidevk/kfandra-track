"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { saveDraft as saveLocalDraft } from "@/lib/drafts/storage";
import {
  emptyDraft,
  newExercise,
  weightStep,
  type ExerciseRow,
  type ExerciseSet,
  type GymDraft,
  type WeightUnit,
} from "@/lib/gym/types";
import {
  newSet,
  addSet,
  removeSet,
  stepReps,
  stepSetWeight,
  repsDelta,
  weightDelta,
  MIN_SETS,
  MAX_SETS,
} from "@/lib/gym/sets";
import { exerciseCount, totalSets, buildSchemeSummary } from "@/lib/gym/summary";
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
    () => ({ bodyPart: catalog.bodyParts[0]?.value ?? "Shoulders" }),
    [catalog.bodyParts],
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
                <p className="text-[11px] text-emerald-200/60">sets</p>
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
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                        · {r.equipment}
                      </span>
                    )}
                  </div>
                  {(() => {
                    const summary = r.sets.length > 0 ? buildSchemeSummary(r) : r.scheme;
                    return summary ? (
                      <p className="mt-1 text-sm text-gray-700">{summary}</p>
                    ) : null;
                  })()}
                  {r.notes && (
                    <p className="mt-0.5 text-[11px] italic text-gray-600">{r.notes}</p>
                  )}
                </button>
                <button
                  onClick={() => deleteExercise(r.id)}
                  className="px-1 text-lg leading-none text-gray-500 hover:text-rose-500"
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
        <p className="-mt-2 text-center text-xs text-gray-600">
          Tap to log your first exercise
        </p>
      )}

      {/* ── Narration ──────────────────────────────────────────────── */}
      {draft.rows.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-900">Narration (optional)</h2>
          <p className="mb-2 text-[11px] text-gray-600">
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

      <p className="text-center text-[11px] italic text-gray-600">
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
        <p className="text-[10px] uppercase tracking-wide text-gray-600">Optional</p>
      </div>
      <p className="mb-3 text-[11px] text-gray-600">
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
                unit === u ? "bg-emerald-500 text-white" : "text-gray-600"
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

function fmtDelta(d: number): string {
  return d > 0 ? `+${d}` : `−${Math.abs(d)}`;
}

function SetRow({
  index,
  set,
  unit,
  supportsWeight,
  repsD,
  weightD,
  onStepReps,
  onStepWeight,
}: {
  index: number;
  set: ExerciseSet;
  unit: WeightUnit;
  supportsWeight: boolean;
  repsD: number | null;
  weightD: number | null;
  onStepReps: (dir: 1 | -1) => void;
  onStepWeight: (dir: 1 | -1) => void;
}) {
  const stepBtn =
    "h-8 w-8 shrink-0 rounded-lg border border-gray-200 text-base font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-30";
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-2.5">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-600">
        Set {index + 1}
      </p>
      <div className="flex items-center gap-2">
        <span className="w-12 text-[11px] text-gray-600">Reps</span>
        <button onClick={() => onStepReps(-1)} disabled={set.reps <= 1} className={stepBtn}>
          −
        </button>
        <span className="flex-1 text-center text-lg font-bold tabular-nums text-gray-900">
          {set.reps}
        </span>
        <button onClick={() => onStepReps(1)} className={stepBtn}>
          +
        </button>
        {repsD !== null && repsD !== 0 && (
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
              repsD > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
            }`}
          >
            {fmtDelta(repsD)}
          </span>
        )}
      </div>
      {supportsWeight && (
        <div className="mt-1.5 flex items-center gap-2">
          <span className="w-12 text-[11px] text-gray-600">Weight</span>
          <button
            onClick={() => onStepWeight(-1)}
            disabled={set.weight <= 0}
            className={stepBtn}
          >
            −
          </button>
          <span className="flex-1 text-center text-lg font-bold tabular-nums text-gray-900">
            {set.weight} <span className="text-[11px] text-gray-600">{unit}</span>
          </span>
          <button onClick={() => onStepWeight(1)} className={stepBtn}>
            +
          </button>
          {weightD !== null && weightD !== 0 && (
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                weightD > 0 ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
              }`}
            >
              {fmtDelta(weightD)}
            </span>
          )}
        </div>
      )}
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
  // Guarantee at least one set so the editor is always usable — legacy rows
  // saved before per-set logging load with sets:[] and would otherwise leave
  // Save disabled with nothing to edit.
  const [r, setR] = useState<ExerciseRow>(() =>
    initial.sets.length > 0 ? initial : { ...initial, sets: [newSet()] },
  );

  const supportsWeight = useMemo(() => {
    const eq = catalog.equipment.find((e) => e.value === r.equipment);
    return eq ? eq.supportsWeight : false;
  }, [catalog.equipment, r.equipment]);

  function setEquipment(eq: string) {
    const meta = catalog.equipment.find((e) => e.value === eq);
    const eqSupportsWeight = meta ? meta.supportsWeight : false;
    setR((x) => ({
      ...x,
      equipment: eq,
      // No-weight equipment: zero every set's weight (reps-only).
      sets: eqSupportsWeight ? x.sets : x.sets.map((s) => ({ ...s, weight: 0 })),
    }));
  }

  const onAddSet = () => setR((x) => ({ ...x, sets: addSet(x.sets) }));
  const onRemoveSet = () => setR((x) => ({ ...x, sets: removeSet(x.sets) }));
  const onStepReps = (i: number, dir: 1 | -1) =>
    setR((x) => ({ ...x, sets: stepReps(x.sets, i, dir) }));
  const onStepWeight = (i: number, dir: 1 | -1) =>
    setR((x) => ({ ...x, sets: stepSetWeight(x.sets, i, dir, x.weightUnit) }));

  const livePreview = buildSchemeSummary(r);

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
        <p className="mb-4 text-[11px] text-gray-600">
          From the GWW/GWtW movement & equipment catalog.
        </p>

        {/* Body part */}
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-600">
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
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-600">
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

        {/* Sets */}
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
            3. Sets {supportsWeight && `(${weightStep(r.weightUnit)} ${r.weightUnit} weight steps)`}
          </p>
          {supportsWeight && (
            <div className="flex shrink-0 rounded-lg bg-gray-100 p-0.5">
              {(["kg", "lb"] as WeightUnit[]).map((u) => (
                <button
                  key={u}
                  onClick={() => setR((x) => ({ ...x, weightUnit: u }))}
                  className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                    r.weightUnit === u ? "bg-emerald-500 text-white" : "text-gray-600"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="mb-2 text-[11px] text-gray-600">
          Each set starts from the one above — just tap what changed.
        </p>
        <div className="mb-3 flex flex-col gap-2">
          {r.sets.map((s, i) => (
            <SetRow
              key={i}
              index={i}
              set={s}
              unit={r.weightUnit}
              supportsWeight={supportsWeight}
              repsD={repsDelta(r.sets, i)}
              weightD={weightDelta(r.sets, i)}
              onStepReps={(dir) => onStepReps(i, dir)}
              onStepWeight={(dir) => onStepWeight(i, dir)}
            />
          ))}
        </div>
        <div className="mb-3 flex gap-2">
          <button
            onClick={onAddSet}
            disabled={r.sets.length >= MAX_SETS}
            className="flex-1 rounded-xl border border-emerald-300 bg-emerald-50/40 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
          >
            + Add set
          </button>
          <button
            onClick={onRemoveSet}
            disabled={r.sets.length <= MIN_SETS}
            className="flex-1 rounded-xl border border-gray-200 bg-white py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
          >
            − Remove set
          </button>
        </div>
        {livePreview && (
          <div className="mb-4 rounded-xl bg-gray-50 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
              Saves as
            </p>
            <p className="text-sm font-semibold text-gray-800">{livePreview}</p>
          </div>
        )}

        {/* Notes */}
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-gray-600">
          4. Notes (optional)
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
            disabled={!r.bodyPart || r.sets.length === 0}
            className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
