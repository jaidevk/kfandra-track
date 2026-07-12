import Link from "next/link";
import {
  listSessions,
  listPlayers,
  getSessionSubmissions,
  getPlayerSubmissions,
} from "@/lib/admin/submissions-repository";
import SyncButton from "./sync-button";
import { PointsTable, type PointsRow } from "./points-table";

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
      <SyncButton />
      <section>
        <h2 className="mb-2 text-sm font-bold text-gray-900">By date</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-gray-600">No sessions yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/admin/submissions?date=${s.id}`}
                  className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50"
                >
                  <span className="font-medium text-gray-900">{fmtDate(s.date)}</span>
                  {s.label && <span className="text-[11px] text-gray-600">{s.label}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold text-gray-900">By player</h2>
        {players.length === 0 ? (
          <p className="text-sm text-gray-600">No players yet.</p>
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

  const tableRows: PointsRow[] = rows.map((r) => ({
    key: r.playerId,
    label: r.displayName,
    note: r.submitted ? undefined : "not submitted",
    muted: !r.submitted,
    confirmationPoints: r.confirmationPoints,
    arrivalPoints: r.arrivalPoints,
    gamesPoints: r.gamesPoints,
    packingPoints: r.packingPoints,
    otherPoints: r.otherPoints,
    repPoints: r.repPoints,
    repReps: r.repReps,
    total: r.total,
    detail: r.detail,
  }));

  return (
    <div className="space-y-4">
      <BackLink />
      <div>
        <h2 className="text-lg font-bold text-gray-900">
          {session ? fmtDate(session.date) : "Session"}
        </h2>
        <p className="text-[11px] text-gray-600">
          {submittedCount} of {rows.length} players submitted · tap a player to
          see the games, packing, other &amp; reps breakdown
        </p>
      </div>
      <PointsTable firstColHeader="Player" rows={tableRows} />
    </div>
  );
}

async function ByPlayer({ playerId }: { playerId: string }) {
  const [players, data] = await Promise.all([
    listPlayers(),
    getPlayerSubmissions(playerId),
  ]);
  const player = players.find((p) => p.id === playerId);

  const tableRows: PointsRow[] = data.mmg.map((e) => ({
    key: e.sessionId,
    label: fmtDate(e.date),
    confirmationPoints: e.confirmationPoints,
    arrivalPoints: e.arrivalPoints,
    gamesPoints: e.gamesPoints,
    packingPoints: e.packingPoints,
    otherPoints: e.otherPoints,
    repPoints: e.repPoints,
    repReps: e.repReps,
    total: e.total,
    detail: e.detail,
  }));
  const season = data.mmg.reduce(
    (a, e) => ({
      confirmationPoints: a.confirmationPoints + e.confirmationPoints,
      arrivalPoints: a.arrivalPoints + e.arrivalPoints,
      gamesPoints: a.gamesPoints + e.gamesPoints,
      packingPoints: a.packingPoints + e.packingPoints,
      otherPoints: a.otherPoints + e.otherPoints,
      repPoints: a.repPoints + e.repPoints,
      repReps: a.repReps + e.repReps,
      total: a.total + e.total,
    }),
    {
      confirmationPoints: 0,
      arrivalPoints: 0,
      gamesPoints: 0,
      packingPoints: 0,
      otherPoints: 0,
      repPoints: 0,
      repReps: 0,
      total: 0,
    },
  );

  return (
    <div className="space-y-4">
      <BackLink />
      <div>
        <h2 className="text-lg font-bold text-gray-900">{player?.displayName ?? "Player"}</h2>
        <p className="text-[11px] text-gray-600">
          {data.mmg.length} MMG sessions · {data.gymDays} S&amp;C days · {data.dietDays} diet days
        </p>
      </div>

      <h3 className="text-sm font-bold text-gray-900">MMG sessions</h3>
      {data.mmg.length === 0 ? (
        <p className="text-sm text-gray-600">No MMG submissions.</p>
      ) : (
        <PointsTable firstColHeader="Date" rows={tableRows} footer={season} />
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/admin/submissions" className="text-[12px] text-gray-600 hover:underline">
      ← All submissions
    </Link>
  );
}
