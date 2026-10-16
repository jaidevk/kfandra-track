"use client";

import { motion } from "framer-motion";
import { strings } from "@/content/strings";
import { formatGrams, formatKcal, type FlaggedItem, type NutritionSummary } from "@/lib/diet/nutrition";
import type { Verdict } from "@/lib/diet/types";

/**
 * Presentational pieces for Diet nutrition (spec §5). No data loading here:
 * callers pass NutritionSummary values computed by src/lib/diet/nutrition.ts.
 */

const t = strings.dietNutrition;

const DOT: Record<Verdict, string> = {
  good: "bg-emerald-500",
  watch: "bg-amber-500",
  avoid: "bg-red-500",
};
const VERDICT_LABEL: Record<Verdict, string> = {
  good: t.verdictGood,
  watch: t.verdictWatch,
  avoid: t.verdictAvoid,
};

export function VerdictDot({ verdict }: { verdict: Verdict | null | undefined }) {
  if (!verdict) return null;
  return (
    <span
      role="img"
      aria-label={VERDICT_LABEL[verdict]}
      title={VERDICT_LABEL[verdict]}
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT[verdict]}`}
    />
  );
}

export function countedLine(s: NutritionSummary): string {
  return `${s.counted} ${t.of} ${s.total} ${t.itemsCounted}`;
}

export function MacroChips({ summary }: { summary: NutritionSummary }) {
  if (summary.counted === 0) return null;
  const chips: Array<[string, number]> = [
    [t.protein, summary.totals.protein],
    [t.carbs, summary.totals.carbs],
    [t.fat, summary.totals.fat],
  ];
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {chips.map(([label, grams]) => (
        <span key={label} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-gray-700">
          {label} {formatGrams(grams)}
        </span>
      ))}
    </div>
  );
}

export function FlaggedList({ flagged }: { flagged: FlaggedItem[] }) {
  if (flagged.length === 0) return null;
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-600">{t.flaggedHeading}</p>
      <ul className="space-y-1.5">
        {flagged.map((f) => (
          <li key={f.foodKey} className="flex items-start gap-2 text-[13px] text-gray-800">
            <span className="mt-1.5"><VerdictDot verdict={f.verdict} /></span>
            <span>
              <span className="font-semibold">{f.name}</span>
              {f.note ? <span className="block text-[12px] text-gray-600">{f.note}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DayNutritionCard({ summary }: { summary: NutritionSummary }) {
  if (summary.total === 0) return null;
  return (
    <section data-testid="day-nutrition-card" className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">{t.dayCardTitle}</p>
      <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-black tabular-nums tracking-tight text-gray-900">
        {formatKcal(summary)}
      </p>
      <MacroChips summary={summary} />
      <p className="mt-1.5 text-[11px] text-gray-600">{countedLine(summary)}</p>
    </section>
  );
}

/**
 * Bottom sheet shell. Same pattern as CustomItemSheet in diet-entry.tsx:
 * rendered conditionally with no AnimatePresence (an exit-animated overlay
 * lingers and intercepts clicks in this React 19 / framer-motion stack).
 */
function Sheet({ testId, onClose, children }: { testId: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] flex items-end bg-black/40"
      onClick={onClose}
    >
      <motion.div
        data-testid={testId}
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
        {children}
        <p className="mt-4 text-[10px] italic text-gray-600">{t.disclaimer}</p>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-3 text-sm font-bold text-white"
        >
          {t.done}
        </button>
      </motion.div>
    </motion.div>
  );
}

export function MealSummarySheet({ slotName, summary, onDone }: { slotName: string; summary: NutritionSummary; onDone: () => void }) {
  return (
    <Sheet testId="meal-summary-sheet" onClose={onDone}>
      <h3 className="text-base font-bold text-gray-900">{`${slotName} · ${formatKcal(summary)}`}</h3>
      <MacroChips summary={summary} />
      <p className="mt-1.5 text-[11px] text-gray-600">{countedLine(summary)}</p>
      <FlaggedList flagged={summary.flagged} />
    </Sheet>
  );
}

export function RecapSheet({
  dateLabel, day, meals, onClose,
}: {
  dateLabel: string;
  day: NutritionSummary;
  meals: Array<{ key: string; name: string; summary: NutritionSummary }>;
  onClose: () => void;
}) {
  return (
    <Sheet testId="recap-sheet" onClose={onClose}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600">{t.recapTitle}</p>
      <h3 className="text-base font-bold text-gray-900">{dateLabel}</h3>
      <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-black tabular-nums text-gray-900">
        {formatKcal(day)}
      </p>
      <MacroChips summary={day} />
      <p className="mt-1.5 text-[11px] text-gray-600">{countedLine(day)}</p>
      <p className="mb-1.5 mt-4 text-[10px] font-bold uppercase tracking-widest text-gray-600">{t.recapMealsHeading}</p>
      <ul className="divide-y divide-gray-100 text-[13px]">
        {meals.map((m) => (
          <li key={m.key} className="flex justify-between py-1.5">
            <span className="text-gray-800">{m.name}</span>
            <span className="tabular-nums text-gray-700">{formatKcal(m.summary)}</span>
          </li>
        ))}
      </ul>
      <FlaggedList flagged={day.flagged} />
    </Sheet>
  );
}
