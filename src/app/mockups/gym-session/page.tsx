"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

/**
 * Gym session entry — body part / equipment / weight / set·rep scheme.
 * Catalog source: Jaidev's GWW/GWtW routines sheet, expanded with KFANDRA's
 * round-2 feedback (Back, Forearms, Hamstrings, Glutes, Pecs, Stamina,
 * Plank/Upper-body/Lower-body Variations).
 *
 * Weight steps: 2 kg / 5 lb. Per-row unit toggle.
 * Optional body-weight + date entry at the top of the session.
 */

type BodyPart =
  | "Shoulders" | "Biceps" | "Triceps" | "Chest/Pecs"
  | "Back" | "Forearms"
  | "Thighs" | "Hamstrings" | "Glutes" | "Calves" | "Abs"
  | "Press Ups" | "Reverse Zor" | "Zor"
  | "Baithaks" | "Lunges"
  | "Full Burpees" | "Half Burpees" | "Sumo Walk"
  | "Stamina"
  | "Plank Variations"
  | "Upper Body Variations"
  | "Lower Body Variations";

type Equipment =
  | "Lbb" | "Sbb" | "Z-bar" | "Dumbbells"
  | "T-Bar" | "Dead-Lift" | "Weight plates"
  | "Resistance bands" | "None";

type WeightUnit = "kg" | "lb";

type ExerciseRow = {
  id: string;
  bodyPart: BodyPart;
  equipment: Equipment;
  weight: number;       // 0 if not applicable
  weightUnit: WeightUnit;
  scheme: string;       // sheet preset or custom
  notes: string;
};

type Draft = {
  rows: ExerciseRow[];
  bodyWeight: string;     // free-form so the player can type 78.5 etc.
  bodyWeightUnit: WeightUnit;
  bodyWeightDate: string; // ISO yyyy-mm-dd
  narration: string;
};

const bodyParts: BodyPart[] = [
  "Shoulders", "Biceps", "Triceps", "Chest/Pecs",
  "Back", "Forearms",
  "Thighs", "Hamstrings", "Glutes", "Calves", "Abs",
  "Press Ups", "Reverse Zor", "Zor",
  "Baithaks", "Lunges",
  "Full Burpees", "Half Burpees", "Sumo Walk",
  "Stamina",
  "Plank Variations",
  "Upper Body Variations",
  "Lower Body Variations",
];

const equipmentList: Equipment[] = [
  "Lbb", "Sbb", "Z-bar", "Dumbbells",
  "T-Bar", "Dead-Lift", "Weight plates",
  "Resistance bands", "None",
];

const equipmentSupportsWeight = (eq: Equipment) =>
  eq !== "Resistance bands" && eq !== "None";

const presetSchemes = [
  "6 sets, 8, 4×6, 8",
  "6 sets, 12, 4×8, 12",
  "6 sets, 14, 4×8, 12",
  "6 sets, All 6",
  "4 sets, super 4's",
  "4 sets, super 7's",
  "Variation!",
];

const bodyPartIcon: Record<BodyPart, string> = {
  "Shoulders": "💪", "Biceps": "💪", "Triceps": "💪",
  "Chest/Pecs": "🫀", "Back": "🧍", "Forearms": "🤜",
  "Thighs": "🦵", "Hamstrings": "🦵", "Glutes": "🍑",
  "Calves": "🦵", "Abs": "🧱",
  "Press Ups": "📐", "Reverse Zor": "↩️", "Zor": "↪️",
  "Baithaks": "🪑", "Lunges": "🚶",
  "Full Burpees": "🔥", "Half Burpees": "🔥", "Sumo Walk": "🦍",
  "Stamina": "🏃",
  "Plank Variations": "🪵",
  "Upper Body Variations": "🙆",
  "Lower Body Variations": "🦿",
};

const DRAFT_KEY = "kfandra:mockup:gym-draft-v3";

const todayISO = () => new Date().toISOString().slice(0, 10);

const emptyDraft: Draft = {
  rows: [],
  bodyWeight: "",
  bodyWeightUnit: "kg",
  bodyWeightDate: todayISO(),
  narration: "",
};

const newRow = (id: string): ExerciseRow => ({
  id,
  bodyPart: "Shoulders",
  equipment: "None",
  weight: 0,
  weightUnit: "kg",
  scheme: presetSchemes[0],
  notes: "",
});

function weightStep(unit: WeightUnit): number {
  return unit === "kg" ? 2 : 5;
}

export default function GymSessionMockup() {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<ExerciseRow | null>(null);
  const [submitted, setSubmitted] = useState(false);

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

  const exerciseCount = draft.rows.length;
  const totalSets = useMemo(
    () => draft.rows.reduce((s, r) => s + estimateSets(r.scheme), 0),
    [draft.rows]
  );

  function openNewRow() {
    setEditing(newRow(`r-${Date.now()}-${draft.rows.length}`));
  }

  function openEditRow(r: ExerciseRow) {
    setEditing({ ...r });
  }

  function saveRow(r: ExerciseRow) {
    setDraft((d) => {
      const exists = d.rows.some((x) => x.id === r.id);
      return {
        ...d,
        rows: exists ? d.rows.map((x) => (x.id === r.id ? r : x)) : [...d.rows, r],
      };
    });
    setEditing(null);
  }

  function deleteRow(id: string) {
    setDraft((d) => ({ ...d, rows: d.rows.filter((r) => r.id !== id) }));
    setEditing(null);
  }

  function submit() {
    if (exerciseCount === 0) return;
    setSubmitted(true);
  }

  function newSession() {
    setDraft({ ...emptyDraft, bodyWeightDate: todayISO() });
    if (typeof window !== "undefined") window.localStorage.removeItem(DRAFT_KEY);
    setSubmitted(false);
  }

  if (submitted) {
    return (
      <SubmittedView count={exerciseCount} totalSets={totalSets} onNew={newSession} />
    );
  }

  return (
    <div className="flex flex-col gap-5 p-5 pb-32">
      {/* Header card */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 p-5 text-white shadow-lg shadow-emerald-500/20">
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200/80">
          Gym session · today
        </p>
        <div className="mt-1 flex items-end gap-4">
          <div>
            <p className="font-[family-name:var(--font-display)] text-5xl font-black tabular-nums tracking-tight">
              {exerciseCount}
            </p>
            <p className="text-[11px] text-emerald-200/60">exercises</p>
          </div>
          <div className="border-l border-white/20 pl-4">
            <p className="font-[family-name:var(--font-display)] text-3xl font-black tabular-nums tracking-tight">
              {totalSets}
            </p>
            <p className="text-[11px] text-emerald-200/60">est. sets</p>
          </div>
        </div>
      </div>

      {/* Body-weight log */}
      <BodyWeightCard
        weight={draft.bodyWeight}
        unit={draft.bodyWeightUnit}
        date={draft.bodyWeightDate}
        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
      />

      {/* Logged rows */}
      {draft.rows.length > 0 && (
        <div className="space-y-2.5">
          {draft.rows.map((r) => (
            <div key={r.id} className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <button onClick={() => openEditRow(r)} className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg">{bodyPartIcon[r.bodyPart]}</span>
                    <p className="text-sm font-bold text-gray-900">{r.bodyPart}</p>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      · {r.equipment}
                    </span>
                    {equipmentSupportsWeight(r.equipment) && r.weight > 0 && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                        · {r.weight} {r.weightUnit}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-700">{r.scheme}</p>
                  {r.notes && (
                    <p className="mt-0.5 text-[11px] italic text-gray-500">{r.notes}</p>
                  )}
                </button>
                <button
                  onClick={() => deleteRow(r.id)}
                  className="text-gray-300 hover:text-rose-500 text-lg leading-none px-1"
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
        onClick={openNewRow}
        className="rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 py-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
      >
        + Add exercise
      </button>

      {draft.rows.length === 0 && (
        <p className="text-center text-xs text-gray-400 -mt-2">
          Tap to log your first exercise
        </p>
      )}

      {/* Narration */}
      {draft.rows.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-900">Narration (optional)</h2>
          <p className="text-[11px] text-gray-500 mb-2">
            Notes for KFANDRA — does not affect points
          </p>
          <textarea
            value={draft.narration}
            onChange={(e) => setDraft((d) => ({ ...d, narration: e.target.value }))}
            placeholder="e.g. shoulder feeling tight, kept weights light"
            rows={3}
            className="w-full rounded-2xl border border-gray-200 bg-white p-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </section>
      )}

      {/* Submit */}
      {draft.rows.length > 0 && (
        <div className="fixed bottom-20 left-0 right-0 z-40 px-5">
          <button
            onClick={submit}
            className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 py-4 text-sm font-bold text-white shadow-xl shadow-emerald-500/30 active:scale-[0.99]"
          >
            Submit {exerciseCount} {exerciseCount === 1 ? "exercise" : "exercises"} to KFANDRA
          </button>
        </div>
      )}

      {/* Edit / add sheet */}
      <AnimatePresence>
        {editing && (
          <ExerciseSheet
            initial={editing}
            onSave={saveRow}
            onClose={() => setEditing(null)}
            onDelete={
              draft.rows.some((r) => r.id === editing.id) ? () => deleteRow(editing.id) : null
            }
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function BodyWeightCard({
  weight,
  unit,
  date,
  onChange,
}: {
  weight: string;
  unit: WeightUnit;
  date: string;
  onChange: (patch: Partial<Draft>) => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-900">Body weight</h2>
        <p className="text-[10px] uppercase tracking-wide text-gray-400">Optional</p>
      </div>
      <p className="text-[11px] text-gray-500 mb-3">
        Note your weight today — KFANDRA tracks your trend.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          value={weight}
          onChange={(e) => onChange({ bodyWeight: e.target.value })}
          placeholder="—"
          className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm tabular-nums focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
        <div className="flex shrink-0 rounded-xl bg-gray-100 p-1">
          {(["kg", "lb"] as WeightUnit[]).map((u) => (
            <button
              key={u}
              onClick={() => onChange({ bodyWeightUnit: u })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                unit === u ? "bg-emerald-500 text-white" : "text-gray-500"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => onChange({ bodyWeightDate: e.target.value })}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        />
      </div>
    </div>
  );
}

function ExerciseSheet({
  initial,
  onSave,
  onClose,
  onDelete,
}: {
  initial: ExerciseRow;
  onSave: (r: ExerciseRow) => void;
  onClose: () => void;
  onDelete: (() => void) | null;
}) {
  const [r, setR] = useState<ExerciseRow>(initial);
  const [customScheme, setCustomScheme] = useState(
    presetSchemes.includes(initial.scheme) ? "" : initial.scheme
  );
  const usingCustom =
    customScheme !== "" || (!presetSchemes.includes(r.scheme) && r.scheme !== "");

  function setEquipment(eq: Equipment) {
    setR((x) => ({
      ...x,
      equipment: eq,
      weight: equipmentSupportsWeight(eq) ? x.weight : 0,
    }));
  }

  function stepWeight(direction: 1 | -1) {
    setR((x) => {
      const step = weightStep(x.weightUnit);
      return { ...x, weight: Math.max(0, x.weight + direction * step) };
    });
  }

  function setUnit(unit: WeightUnit) {
    setR((x) => (x.weightUnit === unit ? x : { ...x, weightUnit: unit }));
  }

  function pickScheme(s: string) {
    setR((x) => ({ ...x, scheme: s }));
    setCustomScheme("");
  }

  function pickCustom() {
    setCustomScheme(r.scheme && !presetSchemes.includes(r.scheme) ? r.scheme : "");
    setR((x) => ({ ...x, scheme: customScheme || "" }));
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] bg-black/40 flex items-end"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-white rounded-t-3xl p-5 max-h-[92vh] overflow-y-auto"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
        <h3 className="text-base font-bold text-gray-900 mb-1">
          {onDelete ? "Edit exercise" : "Add exercise"}
        </h3>
        <p className="text-[11px] text-gray-500 mb-4">
          From the GWW/GWtW catalog. KFANDRA can promote new schemes later.
        </p>

        {/* Body part */}
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">
          1. Body part / movement
        </p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {bodyParts.map((p) => {
            const active = r.bodyPart === p;
            return (
              <button
                key={p}
                onClick={() => setR((x) => ({ ...x, bodyPart: p }))}
                className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition-all ${
                  active
                    ? "border-emerald-500 bg-emerald-50"
                    : "border-gray-200 bg-white hover:border-emerald-200"
                }`}
              >
                <span className="text-lg">{bodyPartIcon[p]}</span>
                <span className="text-sm font-semibold text-gray-900">{p}</span>
              </button>
            );
          })}
        </div>

        {/* Equipment */}
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">
          2. Equipment
        </p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {equipmentList.map((eq) => {
            const active = r.equipment === eq;
            return (
              <button
                key={eq}
                onClick={() => setEquipment(eq)}
                className={`rounded-xl border py-2 text-center text-xs font-semibold transition-all ${
                  active
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 bg-white text-gray-700 hover:border-emerald-200"
                }`}
              >
                {eq}
              </button>
            );
          })}
        </div>

        {/* Weight */}
        {equipmentSupportsWeight(r.equipment) && (
          <>
            <div className="mb-2 flex items-baseline justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                3. Weight ({weightStep(r.weightUnit)} {r.weightUnit} steps)
              </p>
              <div className="flex shrink-0 rounded-lg bg-gray-100 p-0.5">
                {(["kg", "lb"] as WeightUnit[]).map((u) => (
                  <button
                    key={u}
                    onClick={() => setUnit(u)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors ${
                      r.weightUnit === u ? "bg-emerald-500 text-white" : "text-gray-500"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 mb-4 rounded-xl border border-gray-200 bg-white p-3">
              <button
                onClick={() => stepWeight(-1)}
                disabled={r.weight <= 0}
                className="h-10 w-10 rounded-xl border border-gray-200 text-lg font-bold text-gray-600 disabled:opacity-30 hover:bg-gray-50"
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
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">
          {equipmentSupportsWeight(r.equipment) ? "4." : "3."} Set / rep scheme
        </p>
        <div className="grid grid-cols-1 gap-2 mb-2">
          {presetSchemes.map((s) => {
            const active = !usingCustom && r.scheme === s;
            return (
              <button
                key={s}
                onClick={() => pickScheme(s)}
                className={`rounded-xl border px-3 py-2 text-left text-sm transition-all ${
                  active
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold"
                    : "border-gray-200 bg-white text-gray-700 hover:border-emerald-200"
                }`}
              >
                {s}
              </button>
            );
          })}
          <button
            onClick={pickCustom}
            className={`rounded-xl border px-3 py-2 text-left text-sm transition-all ${
              usingCustom
                ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold"
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
            onChange={(e) => {
              setR((x) => ({ ...x, scheme: e.target.value }));
              setCustomScheme(e.target.value);
            }}
            placeholder="e.g. 5 sets, 12-10-8-8-6"
            className="w-full mb-4 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        )}
        {!usingCustom && <div className="mb-4" />}

        {/* Notes */}
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">
          {equipmentSupportsWeight(r.equipment) ? "5." : "4."} Notes (optional)
        </p>
        <input
          type="text"
          value={r.notes}
          onChange={(e) => setR((x) => ({ ...x, notes: e.target.value }))}
          placeholder="e.g. z-bar 10-8-8-8-8-10"
          className="w-full mb-5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
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
            disabled={!r.scheme.trim()}
            className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SubmittedView({
  count,
  totalSets,
  onNew,
}: {
  count: number;
  totalSets: number;
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
          {count} {count === 1 ? "exercise" : "exercises"}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          ~{totalSets} sets logged · awaiting KFANDRA
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

function estimateSets(scheme: string): number {
  // Best-effort: match leading "N sets" pattern; default 4.
  const m = scheme.match(/^(\d+)\s*sets/i);
  if (m) return parseInt(m[1], 10);
  return 4;
}
