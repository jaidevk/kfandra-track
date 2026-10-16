import Link from "next/link";
import { listPlayers } from "@/lib/admin/submissions-repository";
import {
  listDietDates,
  getDietDay,
  getPlayerDiet,
} from "@/lib/admin/activity-repository";
import { formatKcal } from "@/lib/diet/nutrition";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function DietPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; player?: string }>;
}) {
  const { date, player } = await searchParams;
  if (date) return <ByDate date={date} />;
  if (player) return <ByPlayer playerId={player} />;
  return <Index />;
}

function BackLink() {
  return (
    <Link href="/admin/diet" className="text-[12px] text-gray-600 hover:underline">
      ← All diet logs
    </Link>
  );
}

async function Index() {
  const [dates, players] = await Promise.all([listDietDates(), listPlayers()]);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Diet</h2>
        <p className="text-[11px] text-gray-600">Daily logs — not scored, just a record.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/diet/nutrition"
          className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Team nutrition grid
        </Link>
        <Link
          href="/admin/diet/foods"
          className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
        >
          Food values
        </Link>
      </div>
      <section>
        <h3 className="mb-2 text-sm font-bold text-gray-900">By date</h3>
        {dates.length === 0 ? (
          <p className="text-sm text-gray-600">No diet logs yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {dates.map((d) => (
              <Link
                key={d}
                href={`/admin/diet?date=${d}`}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              >
                {fmtDate(d)}
              </Link>
            ))}
          </div>
        )}
      </section>
      <section>
        <h3 className="mb-2 text-sm font-bold text-gray-900">By player</h3>
        <div className="flex flex-wrap gap-2">
          {players.map((p) => (
            <Link
              key={p.id}
              href={`/admin/diet?player=${p.id}`}
              className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:border-gray-300 hover:bg-gray-50"
            >
              {p.displayName}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

async function ByDate({ date }: { date: string }) {
  const rows = await getDietDay(date);
  return (
    <div className="space-y-4">
      <BackLink />
      <h2 className="text-lg font-bold text-gray-900">{fmtDate(date)}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-600">No diet logs on this day.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-300 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-amber-100 text-[11px] uppercase tracking-wide text-amber-900">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Player</th>
                <th className="px-3 py-2 text-right font-semibold">Meals</th>
                <th className="px-3 py-2 text-right font-semibold">kcal</th>
                <th className="px-3 py-2 text-right font-semibold">P / C / F</th>
                <th className="px-3 py-2 text-right font-semibold">Counted</th>
                <th className="px-3 py-2 text-right font-semibold">⚑</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rows.map((r) => (
                <tr key={r.playerId} className="text-gray-800 odd:bg-white even:bg-slate-100">
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/diet?player=${r.playerId}`}
                      className="font-semibold text-gray-900 hover:underline"
                    >
                      {r.displayName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.meals}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.nutrition ? formatKcal(r.nutrition) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.nutrition && r.nutrition.counted > 0
                      ? `${Math.round(r.nutrition.totals.protein)} / ${Math.round(r.nutrition.totals.carbs)} / ${Math.round(r.nutrition.totals.fat)}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.nutrition ? `${r.nutrition.counted}/${r.nutrition.total}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.nutrition && r.nutrition.flagged.length > 0 ? (
                      <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[11px] font-bold text-red-700">
                        {r.nutrition.flagged.length}
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

async function ByPlayer({ playerId }: { playerId: string }) {
  const [players, diet] = await Promise.all([listPlayers(), getPlayerDiet(playerId)]);
  const name = players.find((p) => p.id === playerId)?.displayName ?? "Player";
  return (
    <div className="space-y-4">
      <BackLink />
      <h2 className="text-lg font-bold text-gray-900">{name} · Diet ({diet.length})</h2>
      {diet.length === 0 ? (
        <p className="text-sm text-gray-600">No diet logs.</p>
      ) : (
        <div className="space-y-2">
          {diet.map((d) => (
            <div key={d.date} id={d.date} className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-sm font-semibold text-gray-900">{fmtDate(d.date)}</p>
              {d.nutrition && (
                <p className="text-[12px] text-gray-700">
                  {formatKcal(d.nutrition)}
                  {d.nutrition.counted > 0 &&
                    ` · P ${Math.round(d.nutrition.totals.protein)} g · C ${Math.round(d.nutrition.totals.carbs)} g · F ${Math.round(d.nutrition.totals.fat)} g`}
                  {` · ${d.nutrition.counted}/${d.nutrition.total} counted`}
                </p>
              )}
              <ul className="mt-1.5 space-y-1">
                {d.meals.map((m, i) => (
                  <li key={i} className="text-[13px] text-gray-700">
                    <span className="font-medium">{m.slot}:</span>{" "}
                    {m.skipped ? (
                      <span className="italic text-gray-600">skipped</span>
                    ) : m.items.length === 0 ? (
                      <span className="italic text-gray-600">—</span>
                    ) : (
                      m.items.map((it) => `${it.name}${it.count > 1 ? ` ×${it.count}` : ""}`).join(", ")
                    )}
                    {m.nutrition && m.nutrition.counted > 0 ? (
                      <span className="text-gray-600"> · {formatKcal(m.nutrition)}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
              {d.nutrition && d.nutrition.flagged.length > 0 && (
                <details className="mt-1.5 text-[12px]">
                  <summary className="cursor-pointer font-semibold text-red-700">
                    {d.nutrition.flagged.length} flagged
                  </summary>
                  <ul className="mt-1 space-y-0.5">
                    {d.nutrition.flagged.map((f) => (
                      <li key={f.foodKey}>
                        <span className="font-medium">{f.name}</span> ({f.verdict})
                        {f.note ? ` — ${f.note}` : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {d.narration && (
                <p className="mt-1.5 text-[12px] italic text-gray-600">“{d.narration}”</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
