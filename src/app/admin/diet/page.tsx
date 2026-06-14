import Link from "next/link";
import { listPlayers } from "@/lib/admin/submissions-repository";
import {
  listDietDates,
  getDietDay,
  getPlayerDiet,
} from "@/lib/admin/activity-repository";

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
    <Link href="/admin/diet" className="text-[12px] text-gray-500 hover:underline">
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
        <p className="text-[11px] text-gray-500">Daily logs — not scored, just a record.</p>
      </div>
      <section>
        <h3 className="mb-2 text-sm font-bold text-gray-900">By date</h3>
        {dates.length === 0 ? (
          <p className="text-sm text-gray-400">No diet logs yet.</p>
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
        <p className="text-sm text-gray-400">No diet logs on this day.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Player</th>
                <th className="px-3 py-2 text-right font-semibold">Meals logged</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.playerId}>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/diet?player=${r.playerId}`}
                      className="font-medium text-gray-900 hover:underline"
                    >
                      {r.displayName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">{r.meals}</td>
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
        <p className="text-sm text-gray-400">No diet logs.</p>
      ) : (
        <div className="space-y-2">
          {diet.map((d) => (
            <div key={d.date} className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-sm font-semibold text-gray-900">{fmtDate(d.date)}</p>
              <ul className="mt-1.5 space-y-1">
                {d.meals.map((m, i) => (
                  <li key={i} className="text-[13px] text-gray-700">
                    <span className="font-medium">{m.slot}:</span>{" "}
                    {m.skipped ? (
                      <span className="italic text-gray-400">skipped</span>
                    ) : m.items.length === 0 ? (
                      <span className="italic text-gray-400">—</span>
                    ) : (
                      m.items.map((it) => `${it.name}${it.count > 1 ? ` ×${it.count}` : ""}`).join(", ")
                    )}
                  </li>
                ))}
              </ul>
              {d.narration && (
                <p className="mt-1.5 text-[12px] italic text-gray-500">“{d.narration}”</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
