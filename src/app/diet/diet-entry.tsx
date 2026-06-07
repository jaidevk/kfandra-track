"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { saveDraft as saveLocalDraft } from "@/lib/drafts/storage";
import {
  CUSTOM_UNIT_OPTIONS,
  emptyDraft,
  getMeal,
  indexFoods,
  type CustomUnit,
  type DietCatalog,
  type DietDraft,
  type FoodItemInfo,
  type LoggedItem,
  type MealLog,
  type MealSlotInfo,
} from "@/lib/diet/types";
import {
  compactSummary,
  currentMealKey,
  dayTotalUnits,
  describeLogged,
  loggedMealCount,
  totalUnits,
} from "@/lib/diet/summary";
import { saveDietLogAction } from "@/lib/diet/actions";
import { dateLabel } from "@/lib/diet/dates";

type SyncStatus = "idle" | "saving" | "saved" | "error";

/* ── Pure draft mutators on the sparse, key-addressed meals map ───────────── */

function setMealIn(draft: DietDraft, slotKey: string, meal: MealLog): DietDraft {
  return { ...draft, meals: { ...draft.meals, [slotKey]: meal } };
}

function tapFood(draft: DietDraft, slotKey: string, foodKey: string): DietDraft {
  const meal = getMeal(draft, slotKey);
  const existing = meal.items.find((it) => it.foodKey === foodKey);
  const items = existing
    ? meal.items.map((it) =>
        it.foodKey === foodKey ? { ...it, count: it.count + 1 } : it,
      )
    : [
        ...meal.items,
        { id: `${foodKey}-${Date.now()}`, foodKey, count: 1 } as LoggedItem,
      ];
  return setMealIn(draft, slotKey, { skipped: false, items });
}

function adjustLogged(
  draft: DietDraft,
  slotKey: string,
  loggedId: string,
  delta: number,
): DietDraft {
  const meal = getMeal(draft, slotKey);
  const items = meal.items
    .map((it) => (it.id === loggedId ? { ...it, count: it.count + delta } : it))
    .filter((it) => it.count > 0);
  return setMealIn(draft, slotKey, { ...meal, items });
}

function removeLogged(
  draft: DietDraft,
  slotKey: string,
  loggedId: string,
): DietDraft {
  const meal = getMeal(draft, slotKey);
  return setMealIn(draft, slotKey, {
    ...meal,
    items: meal.items.filter((it) => it.id !== loggedId),
  });
}

function addCustomItem(
  draft: DietDraft,
  slotKey: string,
  custom: { name: string; quantity: number; unit: string; notes?: string },
): DietDraft {
  const meal = getMeal(draft, slotKey);
  const item: LoggedItem = {
    id: `custom-${Date.now()}`,
    foodKey: null,
    customName: custom.name,
    customUnit: custom.unit,
    customNotes: custom.notes,
    count: custom.quantity,
  };
  return setMealIn(draft, slotKey, { skipped: false, items: [...meal.items, item] });
}

function setSkipped(draft: DietDraft, slotKey: string, skipped: boolean): DietDraft {
  const meal = getMeal(draft, slotKey);
  return setMealIn(draft, slotKey, {
    ...meal,
    skipped,
    items: skipped ? [] : meal.items,
  });
}

/* ── Root component ──────────────────────────────────────────────────────── */

export default function DietEntry({
  playerName,
  initialDate,
  initialDraft,
  catalog,
}: {
  playerName: string;
  initialDate: string;
  initialDraft: DietDraft;
  catalog: DietCatalog;
}) {
  const [dateKey] = useState<string>(initialDate);
  const [draft, setDraft] = useState<DietDraft>(initialDraft);
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [openSlot, setOpenSlot] = useState<string | null>(null); // null = hub

  const foodById = useMemo(() => indexFoods(catalog), [catalog]);

  // Compute the "current" slot only after mount so SSR/CSR markup matches.
  const [currentSlot, setCurrentSlot] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-clock derivation deferred to mount to avoid SSR/CSR hydration mismatch
    setCurrentSlot(currentMealKey(catalog.slots));
  }, [catalog.slots]);

  // ── Autosave: local immediately + server on a debounce (mirrors Gym) ──────
  const serverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSave = useRef(true); // suppress the save the initial mount triggers
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    saveLocalDraft(`diet:${dateKey}`, draft); // local crash-safety, synchronous
    if (serverTimer.current) clearTimeout(serverTimer.current);
    serverTimer.current = setTimeout(async () => {
      const res = await saveDietLogAction(dateKey, draftRef.current);
      setStatus(res.ok ? "saved" : "error");
    }, 1000);
    return () => {
      if (serverTimer.current) clearTimeout(serverTimer.current);
    };
  }, [draft, dateKey]);

  /** Apply a draft change from a user interaction and mark it saving. */
  const mutate = useCallback((updater: (d: DietDraft) => DietDraft) => {
    setStatus("saving");
    setDraft(updater);
  }, []);

  const openMeal = catalog.slots.find((s) => s.key === openSlot) ?? null;

  return (
    <div className="mx-auto max-w-md">
      {openMeal ? (
        <MealDetail
          slot={openMeal}
          meal={getMeal(draft, openMeal.key)}
          sections={catalog.sections}
          foodById={foodById}
          status={status}
          onBack={() => setOpenSlot(null)}
          onTap={(foodKey) => mutate((d) => tapFood(d, openMeal.key, foodKey))}
          onAdjust={(id, delta) =>
            mutate((d) => adjustLogged(d, openMeal.key, id, delta))
          }
          onRemove={(id) => mutate((d) => removeLogged(d, openMeal.key, id))}
          onAddCustom={(c) => mutate((d) => addCustomItem(d, openMeal.key, c))}
          onToggleSkip={() =>
            mutate((d) =>
              setSkipped(d, openMeal.key, !getMeal(d, openMeal.key).skipped),
            )
          }
        />
      ) : (
        <DietHub
          playerName={playerName}
          dateKey={dateKey}
          draft={draft}
          slots={catalog.slots}
          foodById={foodById}
          status={status}
          currentSlot={currentSlot}
          onOpen={(slotKey) => setOpenSlot(slotKey)}
          onToggleSkip={(slotKey) =>
            mutate((d) => setSkipped(d, slotKey, !getMeal(d, slotKey).skipped))
          }
          onNarration={(narration) => mutate((d) => ({ ...d, narration }))}
          onReset={() => mutate(() => emptyDraft())}
        />
      )}
    </div>
  );
}

/* ── Hub view ────────────────────────────────────────────────────────────── */

function DietHub({
  playerName,
  dateKey,
  draft,
  slots,
  foodById,
  status,
  currentSlot,
  onOpen,
  onToggleSkip,
  onNarration,
  onReset,
}: {
  playerName: string;
  dateKey: string;
  draft: DietDraft;
  slots: MealSlotInfo[];
  foodById: Record<string, FoodItemInfo>;
  status: SyncStatus;
  currentSlot: string | null;
  onOpen: (slotKey: string) => void;
  onToggleSkip: (slotKey: string) => void;
  onNarration: (narration: string) => void;
  onReset: () => void;
}) {
  const totalItems = dayTotalUnits(draft);
  const touched = loggedMealCount(draft);

  return (
    <div className="flex flex-col gap-5 p-5 pb-32">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-orange-700 p-5 text-white shadow-lg shadow-orange-500/20">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-100/90">
                Daily Diet · {playerName}
              </p>
              <SyncBadge status={status} />
            </div>
            <p className="mt-1 text-[11px] text-amber-100/70">
              {dateLabel(dateKey)} · today
            </p>
            <div className="mt-3 flex items-end gap-4">
              <div>
                <p className="font-[family-name:var(--font-display)] text-5xl font-black tabular-nums tracking-tight">
                  {totalItems}
                </p>
                <p className="text-[11px] text-amber-100/70">items today</p>
              </div>
              <div className="border-l border-white/20 pl-4">
                <p className="font-[family-name:var(--font-display)] text-3xl font-black tabular-nums tracking-tight">
                  {touched}/{slots.length}
                </p>
                <p className="text-[11px] text-amber-100/70">meals touched</p>
              </div>
            </div>
          </div>
          {touched > 0 && (
            <button
              onClick={onReset}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur hover:bg-white/20"
            >
              Reset
            </button>
          )}
        </div>
        <p className="mt-3 text-[11px] italic text-amber-100/80">
          Tap a meal to log what you ate. Saved as you go — no submit needed.
        </p>
      </div>

      {/* Meal cards */}
      <div className="space-y-2.5">
        {slots.map((slot) => {
          const meal = draft.meals[slot.key];
          const summary = compactSummary(meal, foodById, 3);
          const isCurrent = currentSlot === slot.key;
          const itemCount = totalUnits(meal);
          const isLogged = (meal && (meal.items.length > 0 || meal.skipped)) ?? false;

          return (
            <div
              key={slot.key}
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

              <button
                onClick={() => onOpen(slot.key)}
                className="flex w-full items-start gap-3 p-4 text-left"
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
                  {meal?.skipped ? "⏭️" : (slot.emoji ?? "🍽️")}
                </div>
                <div className="min-w-0 flex-1 pr-12">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="text-[15px] font-bold text-gray-900">{slot.name}</p>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">
                      {slot.windowLabel}
                    </p>
                  </div>
                  {meal?.skipped ? (
                    <p className="mt-1 text-sm italic text-gray-500">Marked as skipped</p>
                  ) : itemCount > 0 ? (
                    <p className="mt-1 line-clamp-2 text-sm text-gray-700">{summary}</p>
                  ) : (
                    <p className="mt-1 text-sm italic text-gray-400">Not logged yet</p>
                  )}
                </div>
              </button>

              {/* Skipped toggle row */}
              <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2">
                <p className="text-[11px] text-gray-400">
                  {itemCount > 0
                    ? `${itemCount} ${itemCount === 1 ? "item" : "items"} logged`
                    : isLogged
                      ? "—"
                      : "Tap to log · or skip"}
                </p>
                <button
                  onClick={() => onToggleSkip(slot.key)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    meal?.skipped
                      ? "bg-gray-700 text-white"
                      : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  {meal?.skipped ? "Unskip" : "Skipped"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Day narration */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900">Narration (optional)</h2>
        <p className="mb-2 text-[11px] text-gray-500">
          Your reference — helps KFANDRA cross-check later
        </p>
        <textarea
          value={draft.narration}
          onChange={(e) => onNarration(e.target.value)}
          placeholder="e.g. fasting till lunch, big dinner after practice"
          rows={3}
          className="w-full rounded-2xl border border-gray-200 bg-white p-3 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
        />
      </section>

      <p className="text-center text-[11px] italic text-gray-400">
        Diet tracking is not scored — KFANDRA reviews it separately.
      </p>
    </div>
  );
}

/* ── Meal detail view ────────────────────────────────────────────────────── */

function MealDetail({
  slot,
  meal,
  sections,
  foodById,
  status,
  onBack,
  onTap,
  onAdjust,
  onRemove,
  onAddCustom,
  onToggleSkip,
}: {
  slot: MealSlotInfo;
  meal: MealLog;
  sections: DietCatalog["sections"];
  foodById: Record<string, FoodItemInfo>;
  status: SyncStatus;
  onBack: () => void;
  onTap: (foodKey: string) => void;
  onAdjust: (loggedId: string, delta: number) => void;
  onRemove: (loggedId: string) => void;
  onAddCustom: (c: { name: string; quantity: number; unit: string; notes?: string }) => void;
  onToggleSkip: () => void;
}) {
  const [showCustom, setShowCustom] = useState(false);
  const totalItems = totalUnits(meal);

  return (
    <div className="flex flex-col gap-4 p-5 pb-32">
      {/* Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          aria-label="Back to meal hub"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600">
            Logging
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold leading-tight text-gray-900">
            {slot.emoji ?? "🍽️"} {slot.name}
          </h1>
          <p className="text-[11px] text-gray-500">
            {slot.windowLabel} · informational only
          </p>
        </div>
        <SyncBadge status={status} dark />
      </div>

      {/* Skipped banner */}
      {meal.skipped && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-gray-900">Marked as skipped</p>
              <p className="mt-1 text-[11px] text-gray-500">
                KFANDRA sees this as an intentional skip, not a forgotten log.
              </p>
            </div>
            <button
              onClick={onToggleSkip}
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
                  foodById={foodById}
                  onPlus={() => onAdjust(it.id, 1)}
                  onMinus={() => onAdjust(it.id, -1)}
                  onRemove={() => onRemove(it.id)}
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
            {sections.map((section) => (
              <div key={section.label}>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-600">
                  {section.label}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {section.items.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => onTap(item.key)}
                      className="group flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white p-2.5 text-left transition-all hover:border-orange-300 hover:bg-orange-50/40 active:scale-[0.98]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-lg group-hover:bg-orange-100">
                        {item.emoji ?? "🍴"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] font-semibold leading-tight text-gray-900">
                          {item.name}
                        </p>
                        <p className="text-[10px] leading-tight text-gray-500">
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
          onClick={onToggleSkip}
          className="rounded-xl border border-gray-200 bg-white py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500 hover:bg-gray-50"
        >
          Skip this meal
        </button>
      )}

      {/* Floating Done */}
      <div className="fixed inset-x-0 bottom-20 z-40 px-5">
        <button
          onClick={onBack}
          className="mx-auto flex w-full max-w-md items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 py-3.5 text-sm font-bold text-white shadow-xl shadow-orange-500/30 active:scale-[0.99]"
        >
          {totalItems > 0
            ? `Done · ${totalItems} ${totalItems === 1 ? "item" : "items"} saved`
            : meal.skipped
              ? "Done · skipped"
              : "Back to meals"}
        </button>
      </div>

      {/* Custom-item sheet. Rendered conditionally (no AnimatePresence): in this
          React 19 / Next 16 stack framer-motion does not unmount custom-component
          children on exit, so an exit-animated overlay lingers at opacity 0 and
          keeps intercepting clicks. We animate it in and close it instantly. */}
      {showCustom && (
        <CustomItemSheet
          onCancel={() => setShowCustom(false)}
          onSave={(c) => {
            onAddCustom(c);
            setShowCustom(false);
          }}
        />
      )}
    </div>
  );
}

/* ── Subcomponents ───────────────────────────────────────────────────────── */

function SyncBadge({ status, dark }: { status: SyncStatus; dark?: boolean }) {
  if (dark) {
    // Compact dot variant for the (light) meal-detail header.
    const flash = status === "saved" || status === "saving";
    return (
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full transition-colors ${
            status === "error"
              ? "bg-amber-500"
              : flash
                ? "bg-emerald-500"
                : "bg-emerald-300"
          }`}
        />
        {status === "error" ? "Offline" : status === "saving" ? "Saving" : status === "saved" ? "Saved" : "Auto"}
      </div>
    );
  }
  const label =
    status === "saving"
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
        ? "text-amber-100"
        : "text-amber-100/60";
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide ${color}`}>
      {label}
    </span>
  );
}

function LoggedRow({
  item,
  foodById,
  onPlus,
  onMinus,
  onRemove,
}: {
  item: LoggedItem;
  foodById: Record<string, FoodItemInfo>;
  onPlus: () => void;
  onMinus: () => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { name, unit } = describeLogged(item, foodById);
  const isCustom = item.foodKey === null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        <p className="min-w-0 flex-1 text-sm font-semibold text-gray-900">
          {name}
          {isCustom && (
            <span className="ml-1.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-700">
              Custom
            </span>
          )}
        </p>
        <p className="text-xs text-gray-500">{unit}</p>
        <p className="min-w-[2.5ch] text-right font-[family-name:var(--font-display)] text-lg font-bold tabular-nums text-orange-600">
          × {item.count}
        </p>
        <svg
          className={`h-4 w-4 text-gray-300 transition-transform ${open ? "rotate-90" : ""}`}
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
            <p className="ml-2 truncate text-[11px] italic text-gray-500">
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
  const [unit, setUnit] = useState<CustomUnit>("piece");
  const [notes, setNotes] = useState("");

  const canSave = name.trim().length > 0 && quantity > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] flex items-end bg-black/40"
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
        <h3 className="mb-1 text-base font-bold text-gray-900">Add a custom item</h3>
        <p className="mb-4 text-[11px] text-gray-500">
          Anything not in the list. KFANDRA can promote frequently-used customs
          into the catalog later.
        </p>

        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
          What did you eat?
        </p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sabudana khichadi"
          className="mb-4 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
          autoFocus
        />

        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
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
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              Unit
            </p>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as CustomUnit)}
              className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm capitalize focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            >
              {CUSTOM_UNIT_OPTIONS.map((u) => (
                <option key={u} value={u} className="capitalize">
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
          Notes (optional)
        </p>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. with green chutney"
          className="mb-5 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
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
