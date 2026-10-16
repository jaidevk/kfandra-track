import Link from "next/link";
import { requireStaff } from "@/lib/auth/guard";
import { isEditorRole } from "@/lib/auth/roles";
import { listFoodsForEdit } from "@/lib/admin/food-repository";
import FoodEditor from "./food-editor";

export const dynamic = "force-dynamic";

export default async function FoodsPage({ searchParams }: { searchParams: Promise<{ uncounted?: string }> }) {
  const [player, foods, { uncounted }] = await Promise.all([requireStaff("/admin/diet/foods"), listFoodsForEdit(), searchParams]);
  const uncountedOnly = uncounted === "1";
  const shown = uncountedOnly ? foods.filter((f) => f.kcal_per_100g === null) : foods;
  return (
    <div className="space-y-4">
      <Link href="/admin/diet" className="text-[12px] text-gray-600 hover:underline">← All diet logs</Link>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Food values</h2>
        <Link
          href={uncountedOnly ? "/admin/diet/foods" : "/admin/diet/foods?uncounted=1"}
          className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm hover:bg-gray-50"
        >
          {uncountedOnly ? "Show all" : "Uncounted only"}
        </Link>
      </div>
      <p className="text-[11px] text-gray-600">
        Values are per unit (e.g. one glass). Changes apply to every day since nutrition started.
      </p>
      <FoodEditor foods={shown} canEdit={isEditorRole(player.role)} />
    </div>
  );
}
