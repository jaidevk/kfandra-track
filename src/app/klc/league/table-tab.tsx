import { strings } from "@/content/strings";
import type { TableRow } from "@/lib/klcsra/league-table";
import { Empty } from "./league-nav";

const fmt = (n: number) => String(n);
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

/**
 * Three side-by-side tables: # + Club stay put on the left, Pts on the right,
 * and only the middle stat columns scroll sideways at phone width.
 */
export function TableTab({ rows, kinds }: { rows: TableRow[]; kinds: { goals: boolean; tries: boolean } }) {
  if (rows.length === 0) return <Empty text={strings.league.emptyTable} testId="league-table-empty" />;
  const cols: { key: keyof TableRow; label: string }[] = [
    { key: "P", label: "P" }, { key: "W", label: "W" }, { key: "D", label: "D" }, { key: "L", label: "L" },
    ...(kinds.goals ? [{ key: "GF" as const, label: "GF" }, { key: "GA" as const, label: "GA" }] : []),
    ...(kinds.tries ? [{ key: "TF" as const, label: "TF" }, { key: "TA" as const, label: "TA" }] : []),
  ];
  const th = "py-2 text-[10px] font-bold uppercase tracking-wide text-gray-600";
  return (
    <>
      <div data-testid="league-table" className="flex overflow-hidden rounded-xl border border-gray-200 bg-white text-[12px] tabular-nums">
        <table>
          <thead><tr className="bg-gray-50"><th className={`${th} pl-3 pr-1 text-left`}>#</th><th className={`${th} pr-2 text-left`}>Club</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r, i) => (
              <tr key={r.clubId} data-testid="table-row" data-club-id={r.clubId}>
                <td className="py-2 pl-3 pr-1 text-gray-500">{i + 1}</td>
                <td className="py-2 pr-2 font-semibold text-gray-900">
                  {/* max-width is ignored on a <td>; a block inside truncates. */}
                  <div className="max-w-[110px] truncate" title={r.clubName}>{r.clubName}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="min-w-0 flex-1 overflow-x-auto">
          <table className="w-full text-right text-gray-700">
            <thead><tr className="bg-gray-50">
              {cols.map((c) => <th key={c.key} className={`${th} px-1.5`}>{c.label}</th>)}
              <th className={`${th} px-1.5`}>Diff</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.clubId}>
                  {cols.map((c) => (
                    <td key={c.key} data-col={c.key} className="px-1.5 py-2">{fmt(r[c.key] as number)}</td>
                  ))}
                  <td data-col="Diff" className={`px-1.5 ${r.Diff > 0 ? "text-green-700" : r.Diff < 0 ? "text-red-600" : ""}`}>{signed(r.Diff)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <table className="border-l border-gray-100 text-right">
          <thead><tr className="bg-gray-50"><th className={`${th} pl-2 pr-3`}>Pts</th></tr></thead>
          <tbody className="divide-y divide-gray-100 font-bold text-gray-900">
            {rows.map((r) => <tr key={r.clubId}><td data-col="Pts" className="py-2 pl-2 pr-3">{fmt(r.Pts)}</td></tr>)}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-500">{strings.league.tableNote}</p>
    </>
  );
}
