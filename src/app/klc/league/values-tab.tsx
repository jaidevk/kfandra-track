import Link from "next/link";
import { strings } from "@/content/strings";
import { formatChange, formatKr, rankValues, type PlayerValue } from "@/lib/klcsra/player-values";
import { Empty } from "./league-nav";

/** KLC League › Values (spec 2026-11-22 §6): everyone, ranked by current value. */
export function ValuesTab({ values, seasonId }: { values: PlayerValue[]; seasonId: string }) {
  const ranked = rankValues(values);
  const v = strings.league.values;
  if (ranked.length === 0) return <Empty text={v.empty} testId="values-empty" />;
  return (
    <ol aria-label={v.caption} className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
      {ranked.map((p, i) => (
        <li key={p.playerId}>
          <Link
            href={`/klc/league/values/${p.playerId}?season=${seasonId}`}
            data-testid="values-row"
            data-player-id={p.playerId}
            className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50"
          >
            <span className="w-5 shrink-0 text-right text-[12px] font-bold text-gray-500">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-gray-900">{p.name}</span>
              <span className="block truncate text-[11px] text-gray-600">{p.clubName}</span>
            </span>
            <span className="shrink-0 text-right">
              <span data-testid="values-current" className="block text-[13px] font-bold text-gray-900">
                {formatKr(p.current!)}
              </span>
              {p.lastSession && (
                <span
                  className={`block text-[11px] ${p.lastSession.change < 0 ? "text-red-700" : "text-green-700"}`}
                >
                  {p.lastSession.change < 0 ? "▼" : p.lastSession.change > 0 ? "▲" : "•"}{" "}
                  {formatChange(p.lastSession.change)} · {p.lastSession.date.slice(8)}/{p.lastSession.date.slice(5, 7)}
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
