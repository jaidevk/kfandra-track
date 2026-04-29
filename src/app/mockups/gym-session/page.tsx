"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

/**
 * Gym performance entry mockup.
 * Catalog source: Jaidev's GWW/GWtW routines sheet.
 * Player picks body part → logs sets/reps + optional notes per row →
 * submits the whole session to Coach.
 */

type BodyPart =
  | "Shoulders" | "Biceps" | "Triceps" | "Chest"
  | "Thighs" | "Calves" | "Abs"
  | "Press Ups" | "Reverse Zor" | "Zor"
  | "Baithaks" | "Lunges"
  | "Full Burpees" | "Half Burpees" | "Sumo Walk";

const bodyParts: BodyPart[] = [
  "Shoulders", "Biceps", "Triceps", "Chest",
  "Thighs", "Calves", "Abs",
  "Press Ups", "Reverse Zor", "Zor",
  "Baithaks", "Lunges",
  "Full Burpees", "Half Burpees", "Sumo Walk",
];

const bodyPartIcon: Record<BodyPart, string> = {
  "Shoulders": "💪", "Biceps": "💪", "Triceps": "💪",
  "Chest": "🫀", "Thighs": "🦵", "Calves": "🦵",
  "Abs": "🧱", "Press Ups": "📐", "Reverse Zor": "↩️",
  "Zor": "↪️", "Baithaks": "🪑", "Lunges": "🚶",
  "Full Burpees": "🔥", "Half Burpees": "🔥", "Sumo Walk": "🦍",
};

type ExerciseRow = {
  id: string;
  bodyPart: BodyPart;
  sets: string;
  reps: string;
  notes: string;
};

const DRAFT_KEY = "kfandra:mockup:gym-draft";

type Draft = {
  rows: ExerciseRow[];
  narration: string;
};

const emptyDraft: Draft = { rows: [], narration: "" };

export default function GymSessionMockup() {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [picker, setPicker] = useState<BodyPart | null>(null);
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

  const totalSets = useMemo(
    () => draft.rows.reduce((s, r) => s + (Number(r.sets) || 0), 0),
    [draft.rows]
  );

  function addRow(part: BodyPart) {
    setDraft((d) => ({
      ...d,
      rows: [
        ...d.rows,
        { id: `${part}-${Date.now()}-${d.rows.length}`, bodyPart: part, sets: "", reps: "", notes: "" },
      ],
    }));
    setPicker(null);
  }

  function updateRow(id: string, patch: Partial<ExerciseRow>) {
    setDraft((d) => ({
      ...d,
      rows: d.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  }

  function removeRow(id: string) {
    setDraft((d) => ({ ...d, rows: d.rows.filter((r) => r.id !== id) }));
  }

  function submit() {
    if (draft.rows.length === 0) return;
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
    return <SubmittedView count={draft.rows.length} totalSets={totalSets} onNew={newSession} />;
  }

  return (
    <div className="flex flex-col gap-5 p-5 pb-32">
      {/* Header summary */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 p-5 text-white shadow-lg shadow-emerald-500/20">
        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200/80">
          Gym session &middot; today
        </p>
        <div className="mt-1 flex items-end gap-4">
          <div>
            <p className="font-[family-name:var(--font-display)] text-5xl font-black tabular-nums tracking-tight">
              {draft.rows.length}
            </p>
            <p className="text-[11px] text-emerald-200/60">exercises</p>
          </div>
          <div className="border-l border-white/20 pl-4">
            <p className="font-[family-name:var(--font-display)] text-3xl font-black tabular-nums tracking-tight">
              {totalSets}
            </p>
            <p className="text-[11px] text-emerald-200/60">total sets</p>
          </div>
        </div>
      </div>

      {/* Logged rows */}
      {draft.rows.length > 0 && (
        <section className="space-y-2.5">
          {draft.rows.map((r) => (
            <div key={r.id} className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{bodyPartIcon[r.bodyPart]}</span>
                  <p className="text-sm font-bold text-gray-900">{r.bodyPart}</p>
                </div>
                <button
                  onClick={() => removeRow(r.id)}
                  className="text-gray-300 hover:text-rose-500 text-lg leading-none"
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Sets
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={r.sets}
                    onChange={(e) => updateRow(r.id, { sets: e.target.value })}
                    placeholder="6"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm tabular-nums focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Reps (per set)
                  </label>
                  <input
                    type="text"
                    inputMode="text"
                    value={r.reps}
                    onChange={(e) => updateRow(r.id, { reps: e.target.value })}
                    placeholder="8, 8, 8, 8"
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm tabular-nums focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>
              <div className="mt-2">
                <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={r.notes}
                  onChange={(e) => updateRow(r.id, { notes: e.target.value })}
                  placeholder="z-bar 10-8-8-8-8-10"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Add exercise button */}
      <button
        onClick={() => setPicker(bodyParts[0])}
        className="rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 py-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors"
      >
        + Add exercise
      </button>

      {/* Empty state hint */}
      {draft.rows.length === 0 && (
        <p className="text-center text-xs text-gray-400 -mt-2">
          Pick a body part to start logging
        </p>
      )}

      {/* Narration */}
      {draft.rows.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-900">Narration (optional)</h2>
          <p className="text-[11px] text-gray-500 mb-2">
            Notes for the Coach — does not affect points
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
            Submit {draft.rows.length} {draft.rows.length === 1 ? "exercise" : "exercises"} to Coach
          </button>
        </div>
      )}

      {/* Body-part picker sheet */}
      <AnimatePresence>
        {picker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-end"
            onClick={() => setPicker(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-white rounded-t-3xl p-5 max-h-[80vh] overflow-y-auto"
            >
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
              <h3 className="text-base font-bold text-gray-900 mb-1">Pick body part / exercise</h3>
              <p className="text-[11px] text-gray-500 mb-4">
                From the GWW/GWtW catalog. Coach can add more in V1.1.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {bodyParts.map((p) => (
                  <button
                    key={p}
                    onClick={() => addRow(p)}
                    className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 text-left hover:border-emerald-300 hover:bg-emerald-50/40 transition-all"
                  >
                    <span className="text-xl">{bodyPartIcon[p]}</span>
                    <span className="text-sm font-semibold text-gray-900">{p}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
          {totalSets} sets logged &middot; awaiting Coach approval
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
