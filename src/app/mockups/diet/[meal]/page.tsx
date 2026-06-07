"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CUSTOM_UNIT_OPTIONS,
  FOOD_CATALOG,
  addCatalogTap,
  addCustom,
  adjustLogged,
  blankDay,
  describeLogged,
  getMealSlot,
  loadDay,
  removeLogged,
  saveDay,
  setSkipped,
  todayKey,
  totalUnits,
  type DayLog,
  type LoggedItem,
} from "../data";

export default function DietMealMockup() {
  const params = useParams<{ meal: string }>();
  const maybeSlot = getMealSlot(params.meal);
  if (!maybeSlot) notFound();
  const slot = maybeSlot;

  const dateKey = todayKey();
  const [day, setDay] = useState<DayLog>(blankDay(dateKey));
  const [showCustom, setShowCustom] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setDay(loadDay(dateKey));
  }, [dateKey]);

  const meal = day.meals[slot.id] ?? { skipped: false, items: [] };
  const totalItems = totalUnits(meal);

  function commit(updater: (d: DayLog) => DayLog) {
    setDay((d) => {
      const next = updater(d);
      saveDay(next);
      return next;
    });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  }

  function tapFood(foodId: string) {
    commit((d) => addCatalogTap(d, slot.id, foodId));
  }

  function changeCount(loggedId: string, delta: number) {
    commit((d) => adjustLogged(d, slot.id, loggedId, delta));
  }

  function removeItem(loggedId: string) {
    commit((d) => removeLogged(d, slot.id, loggedId));
  }

  function addCustomItem(c: { name: string; quantity: number; unit: string; notes?: string }) {
    commit((d) => addCustom(d, slot.id, c));
    setShowCustom(false);
  }

  function toggleSkip() {
    commit((d) => setSkipped(d, slot.id, !meal.skipped));
  }

  return (
    <div className="flex flex-col gap-4 p-5 pb-32">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link
          href="/mockups/diet"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          aria-label="Back to meal hub"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600">
            Logging
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-gray-900 leading-tight">
            {slot.emoji} {slot.name}
          </h1>
          <p className="text-[11px] text-gray-500">{slot.window} · informational only</p>
        </div>
        <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full transition-colors ${
              savedFlash ? "bg-emerald-500" : "bg-emerald-300"
            }`}
          />
          {savedFlash ? "Saved" : "Auto"}
        </div>
      </div>

      {/* Skipped banner */}
      {meal.skipped && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-gray-900">Marked as skipped</p>
              <p className="mt-1 text-[11px] text-gray-500">
                FDrK sees this as an intentional skip, not a forgotten log.
              </p>
            </div>
            <button
              onClick={toggleSkip}
              className="rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
            >
              Unskip
            </button>
          </div>
        </div>
      )}

      {/* Logged so far */}
      {!meal.skipped && (
        <section>
          <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
            Logged so far
          </h2>
          {meal.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-6 text-center">
              <p className="text-sm text-gray-400">
                Nothing logged yet. Tap an item below to add it.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {meal.items.map((it) => (
                <LoggedRow
                  key={it.id}
                  item={it}
                  onPlus={() => changeCount(it.id, 1)}
                  onMinus={() => changeCount(it.id, -1)}
                  onRemove={() => removeItem(it.id)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Add custom item */}
      {!meal.skipped && (
        <button
          onClick={() => setShowCustom(true)}
          className="flex w-full items-center justify-between rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50/40 px-4 py-3 text-sm font-semibold text-orange-700 hover:bg-orange-50"
        >
          <span className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 text-base">
              ✏️
            </span>
            Add custom item
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-orange-600">
            Not in the list?
          </span>
        </button>
      )}

      {/* Catalog */}
      {!meal.skipped && (
        <section>
          <h2 className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
            Tap to add
          </h2>
          <div className="space-y-4">
            {FOOD_CATALOG.map((section) => (
              <div key={section.label}>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-600">
                  {section.label}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {section.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => tapFood(item.id)}
                      className="group flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white p-2.5 text-left transition-all hover:border-orange-300 hover:bg-orange-50/40 active:scale-[0.98]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-lg group-hover:bg-orange-100">
                        {item.emoji}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-gray-900 leading-tight">
                          {item.name}
                        </p>
                        <p className="text-[10px] text-gray-500 leading-tight">
                          {item.unit}
                          {item.unitDetail ? ` · ${item.unitDetail}` : ""}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Skip CTA when not skipped and nothing logged */}
      {!meal.skipped && meal.items.length === 0 && (
        <button
          onClick={toggleSkip}
          className="rounded-xl border border-gray-200 bg-white py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 hover:bg-gray-50"
        >
          Skip this meal
        </button>
      )}

      {/* Floating bottom action — Done */}
      <div className="fixed bottom-20 left-0 right-0 z-40 px-5">
        <Link
          href="/mockups/diet"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-sm font-bold text-white shadow-xl shadow-orange-500/30 active:scale-[0.99]"
        >
          {totalItems > 0
            ? `Done · ${totalItems} ${totalItems === 1 ? "item" : "items"} saved`
            : meal.skipped
            ? "Done · skipped"
            : "Back to meals"}
        </Link>
      </div>

      <AnimatePresence>
        {showCustom && (
          <CustomItemSheet
            onCancel={() => setShowCustom(false)}
            onSave={addCustomItem}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function LoggedRow({
  item,
  onPlus,
  onMinus,
  onRemove,
}: {
  item: LoggedItem;
  onPlus: () => void;
  onMinus: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { name, unit } = describeLogged(item);
  const isCustom = item.itemId === "custom";

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        <p className="flex-1 min-w-0 text-sm font-semibold text-gray-900">
          {name}
          {isCustom && (
            <span className="ml-1.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-700">
              Custom
            </span>
          )}
        </p>
        <p className="text-xs text-gray-500">{unit}</p>
        <p className="font-[family-name:var(--font-display)] text-lg font-bold tabular-nums text-orange-600 min-w-[2.5ch] text-right">
          × {item.count}
        </p>
        <svg
          className={`w-4 h-4 text-gray-300 transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>
      {open && (
        <div className="flex items-center gap-2 border-t border-gray-100 bg-gray-50/60 px-3 py-2">
          <button
            onClick={onMinus}
            className="h-9 w-9 rounded-lg border border-gray-200 bg-white text-base font-bold text-gray-600 hover:bg-gray-50"
            aria-label="Decrease"
          >
            −
          </button>
          <p className="flex-1 text-center font-[family-name:var(--font-display)] text-xl font-bold tabular-nums text-gray-900">
            {item.count}
          </p>
          <button
            onClick={onPlus}
            className="h-9 w-9 rounded-lg border border-gray-200 bg-white text-base font-bold text-gray-600 hover:bg-gray-50"
            aria-label="Increase"
          >
            +
          </button>
          <button
            onClick={onRemove}
            className="ml-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
          >
            Remove
          </button>
          {item.customNotes && (
            <p className="ml-2 text-[11px] italic text-gray-500 truncate">
              “{item.customNotes}”
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CustomItemSheet({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (c: { name: string; quantity: number; unit: string; notes?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unit, setUnit] = useState<typeof CUSTOM_UNIT_OPTIONS[number]>("piece");
  const [notes, setNotes] = useState("");

  const canSave = useMemo(() => name.trim().length > 0 && quantity > 0, [name, quantity]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[60] bg-black/40 flex items-end"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-white rounded-t-3xl p-5 max-h-[88vh] overflow-y-auto"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
        <h3 className="text-base font-bold text-gray-900 mb-1">Add a custom item</h3>
        <p className="text-[11px] text-gray-500 mb-4">
          Anything not in the list. KFANDRA can promote frequently-used customs into the catalog later.
        </p>

        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">
          What did you eat?
        </p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sabudana khichadi"
          className="w-full mb-4 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          autoFocus
        />

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">
              Quantity
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="h-10 w-10 rounded-xl border border-gray-200 text-base font-bold text-gray-600 hover:bg-gray-50"
              >
                −
              </button>
              <p className="flex-1 text-center font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums text-gray-900">
                {quantity}
              </p>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="h-10 w-10 rounded-xl border border-gray-200 text-base font-bold text-gray-600 hover:bg-gray-50"
              >
                +
              </button>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">
              Unit
            </p>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as typeof CUSTOM_UNIT_OPTIONS[number])}
              className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm capitalize focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            >
              {CUSTOM_UNIT_OPTIONS.map((u) => (
                <option key={u} value={u} className="capitalize">
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">
          Notes (optional)
        </p>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. with green chutney"
          className="w-full mb-5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        />

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              canSave &&
              onSave({
                name: name.trim(),
                quantity,
                unit,
                notes: notes.trim() || undefined,
              })
            }
            disabled={!canSave}
            className="flex-1 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
