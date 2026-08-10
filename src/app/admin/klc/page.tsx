import Link from "next/link";
import { listClubsWithStatus, getClubSheetForAdmin, type AdminDatedEntry } from "@/lib/admin/klc-repository";
import { strings } from "@/content/strings";
import { CopySheetButton } from "./copy-button";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function AdminKlcPage({
  searchParams,
}: {
  searchParams: Promise<{ club?: string }>;
}) {
  const { club } = await searchParams;
  if (club) return <OneClub clubId={club} />;
  return <Index />;
}

async function Index() {
  const rows = await listClubsWithStatus();
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-bold text-gray-900">Clubs</h2>
      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
        {rows.map((r) => (
          <li key={r.club.id}>
            <Link
              href={`/admin/klc?club=${r.club.id}`}
              className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50"
            >
              <span className="font-medium text-gray-900">{r.club.name}</span>
              <span className="text-[11px] text-gray-600">
                {r.entryCount} {r.entryCount === 1 ? "match-day" : "match-days"} ·{" "}
                {r.hasData ? "has entries" : "empty"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

async function OneClub({ clubId }: { clubId: string }) {
  const sheet = await getClubSheetForAdmin(clubId);
  const { klc } = strings;
  const f = klc.fields;
  if (!sheet) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-gray-600">Club not found.</p>
      </div>
    );
  }
  const { club, overview, entries } = sheet;

  const cur = (n: number) => `${n} ${klc.currency}`;
  const lines = [
    `${club.name} — ${klc.sheetHeading}`,
    `${klc.managerLabel}: ${club.managerName || "—"}`,
    "",
    `${klc.overviewHeading} (${overview.entryCount} match-days)`,
    `  ${f.matchesPlayed}: ${overview.matchesPlayed}`,
    `  ${f.matchesWon}: ${overview.matchesWon}`,
    `  ${f.matchesDrawn}: ${overview.matchesDrawn}`,
    `  ${f.matchesLost}: ${overview.matchesLost}`,
    `  ${f.paidToKfandra}: ${cur(overview.totals.paidToKfandra)}`,
    `  ${f.receivedFromKfandra}: ${cur(overview.totals.receivedFromKfandra)}`,
    `  ${f.distributedToLoanees}: ${cur(overview.totals.distributedToLoanees)}`,
    "",
    ...entries.flatMap((e) => [
      `${fmtDate(e.draft.asOfDate)} — played ${e.draft.matchesPlayed}, won ${e.draft.matchesWon}, drawn ${e.draft.matchesDrawn}, lost ${e.draft.matchesLost}, bonus ${cur(e.draft.clubBonus)}`,
      ...e.draft.shares.map((s) => `    ${s.playerName}: ${s.amount}`),
      `    → ${f.paidToKfandra} ${cur(e.totals.paidToKfandra)} · ${f.receivedFromKfandra} ${cur(e.totals.receivedFromKfandra)} · ${f.distributedToLoanees} ${cur(e.totals.distributedToLoanees)}`,
    ]),
  ];
  const copyText = lines.join("\n");

  return (
    <div className="space-y-4">
      <BackLink />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{club.name}</h2>
          <p className="text-[11px] text-gray-600">
            {klc.managerLabel} — {club.managerName || "—"}
          </p>
        </div>
        <CopySheetButton text={copyText} />
      </div>

      {/* Running overview */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-blue-800">
          {klc.overviewHeading} · {overview.entryCount} match-days
        </p>
        <dl className="space-y-1 text-sm">
          <OLine label={f.matchesPlayed} value={String(overview.matchesPlayed)} />
          <OLine label={f.matchesWon} value={String(overview.matchesWon)} />
          <OLine label={f.matchesDrawn} value={String(overview.matchesDrawn)} />
          <OLine label={f.matchesLost} value={String(overview.matchesLost)} />
          <OLine label={f.paidToKfandra} value={cur(overview.totals.paidToKfandra)} strong />
          <OLine label={f.receivedFromKfandra} value={cur(overview.totals.receivedFromKfandra)} strong />
          <OLine label={f.distributedToLoanees} value={cur(overview.totals.distributedToLoanees)} strong />
        </dl>
      </div>

      {/* Per-date breakdown */}
      <h3 className="text-sm font-bold text-gray-900">By date</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-600">No entries yet.</p>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => (
            <DateCard key={e.draft.asOfDate} entry={e} />
          ))}
        </div>
      )}
    </div>
  );
}

function DateCard({ entry }: { entry: AdminDatedEntry }) {
  const { klc } = strings;
  const f = klc.fields;
  const { draft, totals } = entry;
  const cur = (n: number) => `${n} ${klc.currency}`;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
      <p className="mb-1 font-bold text-gray-900">{fmtDate(draft.asOfDate)}</p>
      <p className="text-[12px] text-gray-600">
        {f.matchesPlayed} {draft.matchesPlayed} · {f.matchesWon} {draft.matchesWon} ·{" "}
        {f.matchesDrawn} {draft.matchesDrawn} · {f.matchesLost} {draft.matchesLost} ·{" "}
        {f.clubBonus} {cur(draft.clubBonus)}
      </p>
      {draft.shares.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {draft.shares.map((s) => (
            <li key={s.playerId} className="flex justify-between text-[12px]">
              <span className="text-gray-700">{s.playerName}</span>
              <span className="tabular-nums text-gray-900">{s.amount}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-gray-100 pt-2 text-[11px] font-semibold text-blue-900">
        <span>8 · {cur(totals.paidToKfandra)}</span>
        <span>9 · {cur(totals.receivedFromKfandra)}</span>
        <span>10 · {cur(totals.distributedToLoanees)}</span>
      </div>
    </div>
  );
}

function OLine({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className="text-blue-900">{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-bold text-blue-900" : "text-blue-800"}`}>{value}</dd>
    </div>
  );
}
function BackLink() {
  return (
    <Link href="/admin/klc" className="text-[12px] text-gray-600 hover:underline">
      ← All clubs
    </Link>
  );
}
