"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateFoodNutrition } from "@/lib/admin/food-actions";
import { NUMBER_FIELDS, perUnitView, type FoodEditInput, type NumberField, type RawNumbers } from "@/lib/diet/nutrition-edit";
import type { FoodEditRow } from "@/lib/admin/food-repository";
import type { Verdict } from "@/lib/diet/types";

const DOT: Record<Verdict, string> = { good: "bg-emerald-500", watch: "bg-amber-500", avoid: "bg-red-500" };

export default function FoodEditor({ foods, canEdit }: { foods: FoodEditRow[]; canEdit: boolean }) {
  const sections: Array<[string, FoodEditRow[]]> = [];
  for (const f of foods) {
    const last = sections.at(-1);
    if (last && last[0] === f.section) last[1].push(f);
    else sections.push([f.section, [f]]);
  }
  return (
    <div className="space-y-5">
      {sections.map(([section, rows]) => (
        <section key={section}>
          <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-600">{section}</h3>
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {rows.map((f) => <FoodRow key={f.id} food={f} canEdit={canEdit} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function FoodRow({ food, canEdit }: { food: FoodEditRow; canEdit: boolean }) {
  const view = perUnitView(food);
  const [open, setOpen] = useState(false);
  return (
    <div data-testid={`food-row-${food.key}`} className="p-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">{food.emoji ?? "🍴"}</span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            {food.name}
            {food.verdict && <span className={`inline-block h-2 w-2 rounded-full ${DOT[food.verdict]}`} />}
            {!food.isActive && <span className="text-[10px] font-normal text-gray-600">(hidden)</span>}
          </p>
          <p className="text-[11px] text-gray-600">
            {food.unit}
            {view.kcal === null ? " · not counted" : ` · ${view.kcal} kcal · P ${view.protein} · C ${view.carbs} · F ${view.fat}`}
          </p>
        </div>
        {canEdit && (
          <button onClick={() => setOpen((o) => !o)} className="rounded-lg border border-gray-200 px-2.5 py-1 text-[12px] font-semibold text-gray-700 hover:bg-gray-50">
            {open ? "Close" : "Edit"}
          </button>
        )}
      </div>
      {open && <EditForm food={food} onDone={() => setOpen(false)} />}
    </div>
  );
}

const toStr = (n: number | null): string => (n === null ? "" : String(n));

function EditForm({ food, onDone }: { food: FoodEditRow; onDone: () => void }) {
  const router = useRouter();
  const view = perUnitView(food);
  // Initial strings, kept to detect whether any number was actually edited.
  const initial = Object.fromEntries(NUMBER_FIELDS.map((k) => [k, toStr(view[k])])) as RawNumbers;
  const [vals, setVals] = useState<RawNumbers>(initial);
  const [verdict, setVerdict] = useState<Verdict | "">(food.verdict ?? "");
  const [note, setNote] = useState(food.note ?? "");
  const [isActive, setIsActive] = useState(food.isActive);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fields: Array<[NumberField, string]> = [
    ["gramsPerUnit", `Grams per ${food.unit}`], ["kcal", "kcal per unit"], ["protein", "Protein g per unit"],
    ["carbs", "Carbs g per unit"], ["fat", "Fat g per unit"], ["sodiumMg", "Sodium mg per unit"],
  ];

  async function save() {
    setSaving(true);
    setError(null);
    // Send numbers only if one changed, so a verdict/note save can't drift them (Task 12).
    const numbersChanged = NUMBER_FIELDS.some((k) => vals[k] !== initial[k]);
    const input: FoodEditInput = { numbers: numbersChanged ? vals : null, verdict: verdict || null, note, isActive };
    const res = await updateFoodNutrition(food.id, input);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    onDone();
    router.refresh();
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {fields.map(([k, label]) => (
          <label key={k} className="text-[11px] text-gray-600">
            {label}
            <input
              aria-label={label}
              inputMode="decimal"
              value={vals[k]}
              onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))}
              className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-900"
            />
          </label>
        ))}
      </div>
      <label className="block text-[11px] text-gray-600">
        Verdict
        <select aria-label="Verdict" value={verdict} onChange={(e) => setVerdict(e.target.value as Verdict | "")} className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-900">
          <option value="">None</option>
          <option value="good">Good</option>
          <option value="watch">Watch</option>
          <option value="avoid">Avoid</option>
        </select>
      </label>
      <label className="block text-[11px] text-gray-600">
        KFANDRA’s note
        <textarea aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-gray-900" />
      </label>
      <label className="flex items-center gap-2 text-[12px] text-gray-700">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Show to players
      </label>
      {error && <p className="text-[12px] text-red-700">{error}</p>}
      <button onClick={save} disabled={saving} className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
