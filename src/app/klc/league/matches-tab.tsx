import Link from "next/link";
import { strings } from "@/content/strings";
import { SPORT_LABELS } from "@/lib/klcsra/sport-stats";
import { TIER_LABELS, type StandingsRules } from "@/lib/klcsra/standings-rules";
import { matchResult } from "@/lib/klcsra/league-table";
import { sideClubLabel, toLeagueMatch } from "@/lib/klcsra/league-data";
import type { MatchDraft } from "@/lib/klcsra/types";
import { Empty } from "./league-nav";

function fmtDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export function MatchesTab({ drafts, rules }: { drafts: MatchDraft[]; rules: StandingsRules }) {
  const league = drafts.filter((d) => !d.isFriendly);
  if (league.length === 0) return <Empty text={strings.league.emptyMatches} testId="league-matches-empty" />;
  const groups: { date: string; items: MatchDraft[] }[] = [];
  for (const d of league) {
    const last = groups[groups.length - 1];
    if (last && last.date === d.entryDate) last.items.push(d);
    else groups.push({ date: d.entryDate, items: [d] });
  }
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.date}>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-600">{fmtDate(g.date)}</p>
          <ul className="space-y-2">
            {g.items.map((d) => {
              // One call, so the shown score and the points use the same halves.
              const { agg, pts } = matchResult(toLeagueMatch(d), rules);
              const each = d.isCombined ? " each" : "";
              return (
                <li key={d.id} data-testid="league-match" data-match-id={d.id}>
                  <Link href={`/klc/matches/${d.id}`} className="block rounded-xl border border-gray-200 bg-white p-3 hover:border-gray-300">
                    <p className="text-sm font-semibold text-gray-900">
                      {sideClubLabel(d, "home")}{" "}
                      <span className="mx-0.5 whitespace-nowrap rounded-md bg-gray-100 px-1.5 py-0.5 font-bold tabular-nums">
                        {agg.home} – {agg.away}
                      </span>{" "}
                      {sideClubLabel(d, "away")}
                    </p>
                    <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-600">
                      <span className="font-medium text-gray-700">{SPORT_LABELS[d.sport] ?? d.sport}</span>
                      {d.isCombined && <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">Combined</span>}
                      {pts.tier && <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700">{TIER_LABELS[pts.tier]}</span>}
                      <span data-testid="league-match-points" className="ml-auto font-semibold tabular-nums text-gray-900">
                        {pts.home}{each} · {pts.away}{each} pts
                      </span>
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
