import Link from "next/link";
import {
  listSessions,
  listPlayers,
  getSessionSubmissions,
  getPlayerSubmissions,
} from "@/lib/admin/submissions-repository";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; player?: string }>;
}) {
  const { date, player } = await searchParams;
  if (date) return <ByDate sessionId={date} />;
  if (player) return <ByPlayer playerId={player} />;
  return <Index />;
}

async function Index() {
  const [sessions, players] = await Promise.all([listSessions(), listPlayers()]);
  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-sm font-bold text-gray-900">By date</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-gray-400">No sessions yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/admin/submissions?date=${s.id}`}
                  className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-900">{fmtDate(s.date)}</span>
                  {s.label && <span className="text-[11px] text-gray-400">{s.label}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-gray-900">By player</h2>
        {players.length === 0 ? (
          <p className="text-sm text-gray-400">No players yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {players.map((p) => (
              <Link
                key={p.id}
                href={`/admin/submissions?player=${p.id}`}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              >
                {p.displayName}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

async function ByDate({ sessionId }: { sessionId: string }) {
  const [sessions, rows] = await Promise.all([
    listSessions(),
    getSessionSubmissions(sessionId),
  ]);
  const session = sessions.find((s) => s.id === sessionId);
  const submittedCount = rows.filter((r) => r.submitted).length;

  return (
    <div className="space-y-4">
      <BackLink />
      <div>
        <h2 className="text-lg font-bold text-gray-900">
          {session ? fmtDate(session.date) : "Session"}
        </h2>
        <p className="text-[11px] text-gray-500">
          {submittedCount} of {rows.length} players submitted · Total = arrival +
          confirmation + games (games, stats, packing &amp; other points)
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Player</th>
              <th className="px-3 py-2 text-right font-semibold">Arrival</th>
              <th className="px-3 py-2 text-right font-semibold">Confirm</th>
              <th className="px-3 py-2 text-right font-semibold">Games</th>
              <th className="px-3 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => (
              <tr key={r.playerId} className={r.submitted ? "" : "text-gray-300"}>
                <td className="px-3 py-2">
                  {r.displayName}
                  {!r.submitted && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide">
                      not submitted
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.arrivalPoints}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.confirmationPoints}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.gamesPoints}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function ByPlayer({ playerId }: { playerId: string }) {
  const [players, data] = await Promise.all([
    listPlayers(),
    getPlayerSubmissions(playerId),
  ]);
  const player = players.find((p) => p.id === playerId);

  return (
    <div className="space-y-4">
      <BackLink />
      <div>
        <h2 className="text-lg font-bold text-gray-900">{player?.displayName ?? "Player"}</h2>
        <p className="text-[11px] text-gray-500">
          {data.mmg.length} MMG sessions · {data.gymDays} gym days · {data.dietDays} diet days
        </p>
      </div>

      <h3 className="text-sm font-bold text-gray-900">MMG sessions</h3>
      {data.mmg.length === 0 ? (
        <p className="text-sm text-gray-400">No MMG submissions.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Date</th>
                <th className="px-3 py-2 text-right font-semibold">Confirm #</th>
                <th className="px-3 py-2 text-right font-semibold">Arrival #</th>
                <th className="px-3 py-2 text-right font-semibold">Games</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.mmg.map((e) => (
                <tr key={e.sessionId}>
                  <td className="px-3 py-2">{fmtDate(e.date)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {e.confirmationOrder ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{e.arrivalOrder ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{e.gameCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/admin/submissions" className="text-[12px] text-gray-500 hover:underline">
      ← All submissions
    </Link>
  );
}
