import { strings } from "@/content/strings";
import type { TableRow } from "@/lib/klcsra/league-table";
import { Empty } from "./league-nav";

const fmt = (n: number) => String(n);
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

type StatCol = "P" | "W" | "D" | "L" | "GF" | "GA" | "TF" | "TA";

/**
 * One table in a sideways-scrolling wrapper: # + Club are pinned left and Pts
 * pinned right (sticky, with a background so scrolled cells don't show
 * through); only the stat columns between them move.
 */
export function TableTab({
  rows, kinds, caption,
}: { rows: TableRow[]; kinds: { goals: boolean; tries: boolean }; caption: string }) {
  if (rows.length === 0) return <Empty text={strings.league.emptyTable} testId="league-table-empty" />;
  const h = strings.league.table;
  const cols: StatCol[] = [
    "P", "W", "D", "L",
    ...(kinds.goals ? (["GF", "GA"] as const) : []),
    ...(kinds.tries ? (["TF", "TA"] as const) : []),
  ];
  const th = "py-2 text-[10px] font-bold uppercase tracking-wide text-gray-600";
  const pinLeft = "sticky left-0 z-10 shadow-[inset_-1px_0_0_#f3f4f6]";
  const pinRight = "sticky right-0 z-10 shadow-[inset_1px_0_0_#f3f4f6]";
  return (
    <>
      <div data-testid="league-table" className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-right text-[12px] tabular-nums text-gray-700">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-gray-50">
              <th scope="col" className={`${th} ${pinLeft} bg-gray-50 pl-3 pr-2 text-left`}>
                <span className="inline-block w-5">{h.rank}</span>{h.club}
              </th>
              {cols.map((c) => <th key={c} scope="col" className={`${th} px-1.5`}>{h[c]}</th>)}
              <th scope="col" className={`${th} px-1.5`}>{h.Diff}</th>
              <th scope="col" className={`${th} ${pinRight} bg-gray-50 pl-2 pr-3`}>{h.Pts}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r, i) => (
              <tr key={r.clubId} data-testid="table-row" data-club-id={r.clubId}>
                <th scope="row" className={`${pinLeft} bg-white py-2 pl-3 pr-2 text-left font-normal`}>
                  <div className="flex items-center">
                    <span className="w-5 shrink-0 text-gray-500">{i + 1}</span>
                    <span className="max-w-[110px] truncate font-semibold text-gray-900" title={r.clubName}>{r.clubName}</span>
                  </div>
                </th>
                {cols.map((c) => (
                  <td key={c} data-col={c} className="px-1.5 py-2">{fmt(r[c])}</td>
                ))}
                <td data-col="Diff" className={`px-1.5 py-2 ${r.Diff > 0 ? "text-green-700" : r.Diff < 0 ? "text-red-600" : ""}`}>{signed(r.Diff)}</td>
                <td data-col="Pts" className={`${pinRight} bg-white py-2 pl-2 pr-3 font-bold text-gray-900`}>{fmt(r.Pts)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-500">{strings.league.tableNote}</p>
    </>
  );
}
