import Link from "next/link";
import { strings } from "@/content/strings";
import {
  LEAGUE_TABS, leagueHref, newestFirstSeasons, type LeagueParams,
} from "@/lib/klcsra/league-params";
import type { TableGroups } from "@/lib/klcsra/table-groups";
import type { Season } from "@/lib/klcsra/types";
import { DismissibleDetails } from "./season-picker";

export function TabBar({ params }: { params: LeagueParams }) {
  return (
    <nav aria-label={strings.league.sectionsLabel} className="grid grid-cols-5 gap-1 rounded-xl bg-gray-100 p-1 text-[11px] font-bold">
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
    <nav className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1" aria-label={strings.league.groupsLabel}>
      {Object.keys(groups).map((g) => {
        const on = g === params.group;
        return (
          <Link
            key={g}
            href={leagueHref(params, { group: g })}
            data-testid="group-chip"
            data-group={g}
            aria-current={on ? "true" : undefined}
            className={`shrink-0 rounded-xl px-3 py-2 text-[11px] font-bold ${
              on ? "bg-gray-900 text-white" : "border border-gray-200 bg-white text-gray-700"
            }`}
          >
            {strings.league.groups[g] ?? g}
          </Link>
        );
      })}
    </nav>
  );
}

export function Empty({ text, testId }: { text: string; testId: string }) {
  return (
    <div data-testid={testId} className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center">
      <p className="text-[12px] text-gray-600">{text}</p>
    </div>
  );
}

export const seasonLabel = (s: Season) => `S${s.seasonNo} · ${s.name}`;

/**
 * The season pill opens a season picker (design §6.2). Native `<details>`;
 * the small client wrapper only adds Escape / outside-tap / follow-link close.
 */
export function SeasonPicker({
  seasons, current, params,
}: { seasons: Season[]; current: Season; params: LeagueParams }) {
  return (
    <DismissibleDetails testId="league-season-picker" className="relative min-w-0 max-w-[55%]">
      <summary
        data-testid="league-season-pill"
        aria-label={`${strings.league.seasonLabel}: ${seasonLabel(current)}`}
        className="block cursor-pointer list-none truncate rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800 [&::-webkit-details-marker]:hidden"
      >
        {seasonLabel(current)} <span aria-hidden>▾</span>
      </summary>
      <ul className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
        {newestFirstSeasons(seasons).map((s) => (
          <li key={s.id}>
            <Link
              href={leagueHref(params, { seasonId: s.id })}
              data-testid="season-option"
              aria-current={s.id === current.id ? "true" : undefined}
              className={`flex items-center justify-between gap-2 px-3 py-2 text-[12px] ${
                s.id === current.id ? "bg-gray-50 font-bold text-gray-900" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="min-w-0 truncate">{seasonLabel(s)}</span>
              <span className="shrink-0 text-[10px] capitalize text-gray-500">{s.status}</span>
            </Link>
          </li>
        ))}
      </ul>
    </DismissibleDetails>
  );
}
