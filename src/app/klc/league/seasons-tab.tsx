import Link from "next/link";
import { leagueHref, type LeagueParams } from "@/lib/klcsra/league-params";
import type { Season } from "@/lib/klcsra/types";

const TONE: Record<Season["status"], string> = {
  active: "bg-green-100 text-green-800",
  upcoming: "bg-amber-100 text-amber-900",
  closed: "bg-gray-100 text-gray-700",
};

export function SeasonsTab({ seasons, params }: { seasons: Season[]; params: LeagueParams }) {
  const newestFirst = [...seasons].sort((a, b) => b.seasonNo - a.seasonNo);
  return (
    <ul className="space-y-2">
      {newestFirst.map((s) => (
        <li key={s.id}>
          <Link
            href={leagueHref(params, { seasonId: s.id, tab: "table" })}
            data-testid="season-row"
            className={`flex items-center gap-2 rounded-xl border bg-white p-3 ${s.id === params.seasonId ? "border-gray-900" : "border-gray-200"}`}
          >
            <span className="text-sm font-semibold text-gray-900">S{s.seasonNo} · {s.name}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${TONE[s.status]}`}>{s.status}</span>
            <span className="ml-auto text-[11px] text-gray-500">{s.startDate}{s.endDate ? ` → ${s.endDate}` : ""}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
