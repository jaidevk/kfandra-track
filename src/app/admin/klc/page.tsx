import Link from "next/link";
import { listClubsWithStatus, getClubSheetForAdmin } from "@/lib/admin/klc-repository";
import { strings } from "@/content/strings";
import { CopySheetButton } from "./copy-button";

export const dynamic = "force-dynamic";

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
                {r.loaneeCount} loanees · {r.hasData ? "has entries" : "empty"}
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
  const { club, draft, totals } = sheet;

  const lines = [
    `${club.name} — ${klc.sheetHeading}`,
    `${klc.managerLabel}: ${club.managerName || "—"}`,
    `${f.asOfDate}: ${draft.asOfDate ?? "—"}`,
    `${f.matchesPlayed}: ${draft.matchesPlayed}`,
    `${f.matchesWon}: ${draft.matchesWon}`,
    `${f.players}:`,
    ...draft.shares.map((s) => `  ${s.playerName}: ${s.amount}`),
    `${f.matchesDrawn}: ${draft.matchesDrawn}`,
    `${f.matchesLost}: ${draft.matchesLost}`,
    `${f.clubBonus}: ${draft.clubBonus} ${klc.currency}`,
    `${f.paidToKfandra}: ${totals.paidToKfandra} ${klc.currency}`,
    `${f.receivedFromKfandra}: ${totals.receivedFromKfandra} ${klc.currency}`,
    `${f.distributedToLoanees}: ${totals.distributedToLoanees} ${klc.currency}`,
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

      <dl className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white text-sm">
        <Line label={f.asOfDate} value={draft.asOfDate ?? "—"} />
        <Line label={f.matchesPlayed} value={String(draft.matchesPlayed)} />
        <Line label={f.matchesWon} value={String(draft.matchesWon)} />
        <div className="px-4 py-2.5">
          <p className="mb-1 font-semibold text-gray-900">{f.players}</p>
          {draft.shares.length === 0 ? (
            <p className="text-[12px] text-gray-600">No loanees recorded.</p>
          ) : (
            <ul className="space-y-0.5">
              {draft.shares.map((s) => (
                <li key={s.playerId} className="flex justify-between">
                  <span className="text-gray-700">{s.playerName}</span>
                  <span className="tabular-nums text-gray-900">{s.amount}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Line label={f.matchesDrawn} value={String(draft.matchesDrawn)} />
        <Line label={f.matchesLost} value={String(draft.matchesLost)} />
        <Line label={f.clubBonus} value={`${draft.clubBonus} ${klc.currency}`} />
        <Line label={f.paidToKfandra} value={`${totals.paidToKfandra} ${klc.currency}`} strong />
        <Line label={f.receivedFromKfandra} value={`${totals.receivedFromKfandra} ${klc.currency}`} strong />
        <Line label={f.distributedToLoanees} value={`${totals.distributedToLoanees} ${klc.currency}`} strong />
      </dl>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between px-4 py-2.5">
      <dt className="text-gray-700">{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-bold text-blue-900" : "text-gray-900"}`}>{value}</dd>
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
