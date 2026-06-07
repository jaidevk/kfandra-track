"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  MEAL_SLOTS,
  blankDay,
  compactSummary,
  currentMealId,
  loadDay,
  saveDay,
  setSkipped,
  todayKey,
  totalUnits,
  type DayLog,
} from "./data";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: "easeOut" as const } },
};

function todayLabel(): string {
  const d = new Date();
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

export default function DietHubMockup() {
  const dateKey = todayKey();
  const [day, setDay] = useState<DayLog>(blankDay(dateKey));
  const [hydrated, setHydrated] = useState(false);
  const current = currentMealId();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage rehydration on mount
    setDay(loadDay(dateKey));
    setHydrated(true);
  }, [dateKey]);

  function toggleSkip(mealId: string, skipped: boolean) {
    setDay((d) => {
      const next = setSkipped(d, mealId, skipped);
      saveDay(next);
      return next;
    });
  }

  const totalItems = MEAL_SLOTS.reduce(
    (sum, s) => sum + totalUnits(day.meals[s.id]),
    0
  );
  const loggedMealCount = MEAL_SLOTS.filter((s) => {
    const m = day.meals[s.id];
    return m && (m.skipped || m.items.length > 0);
  }).length;

  return (
    <motion.div
      className="flex flex-col gap-5 p-5 pb-32"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div
        variants={fadeUp}
        className="rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-orange-700 p-5 text-white shadow-lg shadow-orange-500/20"
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-amber-100/90">
          Daily Diet · {todayLabel()}
        </p>
        <div className="mt-1 flex items-end gap-4">
          <div>
            <p className="font-[family-name:var(--font-display)] text-5xl font-black tabular-nums tracking-tight">
              {totalItems}
            </p>
            <p className="text-[11px] text-amber-100/70">items today</p>
          </div>
          <div className="border-l border-white/20 pl-4">
            <p className="font-[family-name:var(--font-display)] text-3xl font-black tabular-nums tracking-tight">
              {loggedMealCount}/8
            </p>
            <p className="text-[11px] text-amber-100/70">meals touched</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-amber-100/80 italic">
          Tap a meal to log what you ate. Saved as you go — no submit needed.
        </p>
      </motion.div>

      {/* Meal cards */}
      <div className="space-y-2.5">
        {MEAL_SLOTS.map((slot) => {
          const meal = day.meals[slot.id];
          const summary = compactSummary(meal, 3);
          const isCurrent = current === slot.id;
          const itemCount = totalUnits(meal);
          const isLogged = (meal && (meal.items.length > 0 || meal.skipped)) ?? false;

          return (
            <motion.div key={slot.id} variants={fadeUp}>
              <div
                className={`group relative overflow-hidden rounded-2xl border bg-white transition-all ${
                  isCurrent
                    ? "border-orange-300 shadow-md shadow-orange-500/10"
                    : "border-gray-200 shadow-sm"
                }`}
              >
                {isCurrent && (
                  <span className="absolute right-3 top-3 rounded-full bg-orange-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-orange-700">
                    Now
                  </span>
                )}

                <Link
                  href={`/mockups/diet/${slot.id}`}
                  className="flex items-start gap-3 p-4"
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${
                      meal?.skipped
                        ? "bg-gray-100"
                        : meal && meal.items.length > 0
                        ? "bg-amber-50"
                        : "bg-gray-50"
                    }`}
                  >
                    {meal?.skipped ? "⏭️" : slot.emoji}
                  </div>
                  <div className="flex-1 min-w-0 pr-12">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <p className="text-[15px] font-bold text-gray-900">
                        {slot.name}
                      </p>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                        {slot.window}
                      </p>
                    </div>
                    {meal?.skipped ? (
                      <p className="mt-1 text-sm italic text-gray-500">
                        Marked as skipped
                      </p>
                    ) : itemCount > 0 ? (
                      <p className="mt-1 text-sm text-gray-700 line-clamp-2">
                        {summary}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm italic text-gray-400">
                        Not logged yet
                      </p>
                    )}
                  </div>
                </Link>

                {/* Skipped toggle row */}
                <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between">
                  <p className="text-[11px] text-gray-400">
                    {itemCount > 0
                      ? `${itemCount} ${itemCount === 1 ? "item" : "items"} logged`
                      : isLogged
                      ? "—"
                      : "Tap to log · or skip"}
                  </p>
                  <button
                    onClick={() => toggleSkip(slot.id, !meal?.skipped)}
                    className={`text-[11px] font-semibold rounded-full px-2.5 py-1 transition-colors ${
                      meal?.skipped
                        ? "bg-gray-700 text-white"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {meal?.skipped ? "Unskip" : "Skipped"}
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Autosave footer */}
      <motion.div variants={fadeUp} className="flex items-center justify-center gap-2 text-[11px] text-gray-400">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
        {hydrated ? "Autosaved on this device" : "Loading…"}
      </motion.div>
    </motion.div>
  );
}
