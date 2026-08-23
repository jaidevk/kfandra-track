import Link from "next/link";
import { listMatches } from "@/lib/klcsra/repository";
import { SPORT_LABELS } from "@/lib/klcsra/sport-stats";
import { NewMatchForm } from "./new-match-form";
import { PhaseNotice } from "./notice";

export const dynamic = "force-dynamic";

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Today in the local timezone, as `YYYY-MM-DD` (never UTC — the club plays in IST). */
function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export default async function MatchesPage() {
  const matches = await listMatches();

  return (
    <div className="space-y-4">
      <Link href="/admin" className="text-[12px] text-gray-600 hover:underline">
        ← Admin
      </Link>
      <PhaseNotice />

      <h2 className="text-sm font-bold text-gray-900">KLCSRA matches</h2>

      <NewMatchForm today={todayIso()} />

      {matches.length === 0 ? (
        <p data-testid="match-empty" className="text-sm text-gray-600">
          No matches yet. Create one above.
        </p>
      ) : (
        <ul
          data-testid="match-list"
          className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white"
        >
          {matches.map((m) => (
            <li key={m.id} data-testid="match-row" data-match-id={m.id}>
              <Link
                href={`/admin/klc/matches/${m.id}`}
                data-testid="match-link"
                className="block px-4 py-2.5 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {fmtDate(m.entryDate)}
                  </span>
                  <span
                    data-testid="match-status"
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      m.status === "submitted"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {m.status}
                  </span>
                </div>
                <p data-testid="match-score" className="text-[13px] text-gray-800">
                  {m.homeLabel} <span className="font-bold tabular-nums">{m.scoreLine}</span>{" "}
                  {m.awayLabel}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-600">
                  <span>{SPORT_LABELS[m.sport] ?? m.sport}</span>
                  {m.isCombined && <Tag testId="tag-combined">Combined</Tag>}
                  {m.isFriendly && <Tag testId="tag-friendly">Friendly</Tag>}
                  {m.seasonName && <Tag testId="tag-season">{m.seasonName}</Tag>}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tag({ children, testId }: { children: React.ReactNode; testId: string }) {
  return (
    <span
      data-testid={testId}
      className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800"
    >
      {children}
    </span>
  );
}
