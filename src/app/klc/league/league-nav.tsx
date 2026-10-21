import Link from "next/link";
import { strings } from "@/content/strings";
import { LEAGUE_TABS, leagueHref, type LeagueParams } from "@/lib/klcsra/league-params";
import type { TableGroups } from "@/lib/klcsra/table-groups";
import type { Season } from "@/lib/klcsra/types";

export function TabBar({ params }: { params: LeagueParams }) {
  return (
    <nav aria-label="League sections" className="grid grid-cols-5 gap-1 rounded-xl bg-gray-100 p-1 text-[11px] font-bold">
      {LEAGUE_TABS.map((t) => {
        const on = t === params.tab;
        return (
          <Link
            key={t}
            href={leagueHref(params, { tab: t })}
            data-testid={`league-tab-${t}`}
            aria-current={on ? "page" : undefined}
            className={`rounded-lg py-1.5 text-center ${on ? "bg-white text-gray-900 shadow-sm" : "text-gray-600"}`}
          >
            {strings.league.tabs[t]}
          </Link>
        );
      })}
    </nav>
  );
}

export function GroupChips({ params, groups }: { params: LeagueParams; groups: TableGroups }) {
  return (
    <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1" role="group" aria-label="Table">
      {Object.keys(groups).map((g) => {
        const on = g === params.group;
        return (
          <Link
            key={g}
            href={leagueHref(params, { group: g })}
            data-testid="group-chip"
            data-group={g}
            aria-pressed={on}
            className={`shrink-0 rounded-xl px-3 py-2 text-[11px] font-bold ${
              on ? "bg-gray-900 text-white" : "border border-gray-200 bg-white text-gray-700"
            }`}
          >
            {strings.league.groups[g] ?? g}
          </Link>
        );
      })}
    </div>
  );
}

export function Empty({ text, testId }: { text: string; testId: string }) {
  return (
    <div data-testid={testId} className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center">
      <p className="text-[12px] text-gray-600">{text}</p>
    </div>
  );
}

/**
 * The season pill opens a season picker (design §6.2). Native `<details>`, so
 * it needs no client JS. Each option is a Link: the server re-renders with the
 * new season and the `<details>` comes back closed.
 */
export function SeasonPicker({
  seasons, current, params,
}: { seasons: Season[]; current: Season; params: LeagueParams }) {
  const newestFirst = [...seasons].sort((a, b) => b.seasonNo - a.seasonNo);
  return (
    <details data-testid="league-season-picker" className="relative">
      <summary
        data-testid="league-season-pill"
        className="cursor-pointer list-none rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800 [&::-webkit-details-marker]:hidden"
      >
        S{current.seasonNo} · {current.name} ▾
      </summary>
      <ul className="absolute right-0 z-10 mt-1 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
        {newestFirst.map((s) => (
          <li key={s.id}>
            <Link
              href={leagueHref(params, { seasonId: s.id })}
              data-testid="season-option"
              aria-current={s.id === current.id ? "true" : undefined}
              className={`flex items-center justify-between px-3 py-2 text-[12px] ${
                s.id === current.id ? "bg-gray-50 font-bold text-gray-900" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span>S{s.seasonNo} · {s.name}</span>
              <span className="text-[10px] capitalize text-gray-500">{s.status}</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
