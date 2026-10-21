import Link from "next/link";
import { fmtDate } from "@/lib/format-date";
import { leagueHref, newestFirstSeasons, type LeagueParams } from "@/lib/klcsra/league-params";
import { SEASON_STATUS_TONE } from "@/lib/klcsra/season-status";
import type { Season } from "@/lib/klcsra/types";
import { seasonLabel } from "./league-nav";

export function SeasonsTab({ seasons, params }: { seasons: Season[]; params: LeagueParams }) {
  return (
    <ul className="space-y-2">
      {newestFirstSeasons(seasons).map((s) => (
        <li key={s.id}>
          <Link
            href={leagueHref(params, { seasonId: s.id, tab: "table" })}
            data-testid="season-row"
            className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border bg-white p-3 ${s.id === params.seasonId ? "border-gray-900" : "border-gray-200"}`}
          >
            <span className="min-w-0 truncate text-sm font-semibold text-gray-900">{seasonLabel(s)}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${SEASON_STATUS_TONE[s.status]}`}>{s.status}</span>
            <span className="ml-auto text-[11px] text-gray-500">{fmtDate(s.startDate)}{s.endDate ? ` → ${fmtDate(s.endDate)}` : ""}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
