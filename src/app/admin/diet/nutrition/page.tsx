import Link from "next/link";
import { getTeamNutritionGrid } from "@/lib/admin/activity-repository";
import { isValidDateKey, shiftDateKey, todayKey } from "@/lib/diet/dates";
import { formatKcal } from "@/lib/diet/nutrition";

export const dynamic = "force-dynamic";

function dayHead(key: string): string {
  return new Date(`${key}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
}

export default async function TeamNutritionPage({ searchParams }: { searchParams: Promise<{ end?: string }> }) {
  const { end } = await searchParams;
  const today = todayKey();
  const endDate = end && isValidDateKey(end) && end <= today ? end : today;
  const grid = await getTeamNutritionGrid(endDate);
  const next = shiftDateKey(endDate, 7);

  return (
    <div className="space-y-4">
      <Link href="/admin/diet" className="text-[12px] text-gray-600 hover:underline">← All diet logs</Link>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Team nutrition</h2>
        <div className="flex gap-2 text-sm">
          <Link href={`/admin/diet/nutrition?end=${shiftDateKey(endDate, -7)}`} className="rounded-full border border-gray-200 bg-white px-3 py-1 hover:bg-gray-50">← Week</Link>
          {next <= today && (
            <Link href={`/admin/diet/nutrition?end=${next}`} className="rounded-full border border-gray-200 bg-white px-3 py-1 hover:bg-gray-50">Week →</Link>
          )}
        </div>
      </div>
      {grid.rows.length === 0 ? (
        <p className="text-sm text-gray-600">No diet logs this week.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-300 bg-white">
          <table className="w-full text-[12px]">
            <thead className="bg-amber-100 text-[11px] uppercase tracking-wide text-amber-900">
              <tr>
                <th className="sticky left-0 bg-amber-100 px-2 py-2 text-left font-semibold">Player</th>
                {grid.days.map((d) => <th key={d} className="px-2 py-2 text-center font-semibold">{dayHead(d)}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {grid.rows.map((row) => (
                <tr key={row.playerId}>
                  <td className="sticky left-0 bg-white px-2 py-2 font-semibold text-gray-900">{row.displayName}</td>
                  {row.cells.map((cell, i) => (
                    <td key={grid.days[i]} className="px-1 py-1 text-center">
                      {cell && (
                        <Link href={`/admin/diet?player=${row.playerId}#${grid.days[i]}`} className="block rounded-lg px-1 py-1 hover:bg-amber-50">
                          <span className="block font-semibold tabular-nums text-gray-900">{cell.nutrition ? formatKcal(cell.nutrition) : "logged"}</span>
                          {cell.nutrition && cell.nutrition.counted > 0 && (
                            <span className="block tabular-nums text-gray-600">P {Math.round(cell.nutrition.totals.protein)} g</span>
                          )}
                          {cell.nutrition && cell.nutrition.flagged.length > 0 && (
                            <span className="mt-0.5 inline-block rounded-full bg-red-100 px-1.5 text-[10px] font-bold text-red-700">{cell.nutrition.flagged.length}</span>
                          )}
                        </Link>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {grid.silentPlayers > 0 && (
        <p className="text-[11px] text-gray-600">{grid.silentPlayers} players logged nothing this week.</p>
      )}
    </div>
  );
}
