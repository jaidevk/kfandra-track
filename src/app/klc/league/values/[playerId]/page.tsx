import Link from "next/link";
import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { strings } from "@/content/strings";
import { getCurrentPlayer } from "@/lib/auth/current-user";
import { loadValueRules } from "@/lib/klcsra/config";
import { defaultSeasonId } from "@/lib/klcsra/league-params";
import { formatChange, formatKr } from "@/lib/klcsra/player-values";
import { listSeasons } from "@/lib/klcsra/repository";
import { STAT_LABELS } from "@/lib/klcsra/stat-rates";
import { loadSeasonValues } from "@/lib/klcsra/value-repository";

export const dynamic = "force-dynamic";

/** One player's value, session by session, newest first (spec 2026-11-22 §6). */
export default async function PlayerValuePage({
  params, searchParams,
}: {
  params: Promise<{ playerId: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { playerId } = await params;
  const { season: seasonParam } = await searchParams;
  const player = await getCurrentPlayer();
  if (!player) redirect(`/login?next=/klc/league/values/${playerId}`);

  const [seasons, rules] = await Promise.all([listSeasons(), loadValueRules()]);
  const seasonId = seasons.some((s) => s.id === seasonParam) ? seasonParam! : defaultSeasonId(seasons);
  const season = seasons.find((s) => s.id === seasonId) ?? null;
  const v = strings.league.values;
  const back = `/klc/league?tab=values${season ? `&season=${season.id}` : ""}`;

  const value = season ? (await loadSeasonValues(season)).values.find((x) => x.playerId === playerId) : undefined;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-5 pb-24">
      <Breadcrumb label={strings.league.breadcrumb} />
      <Link href={back} className="text-[12px] text-gray-600 hover:underline">{v.back}</Link>
      {!value || value.current === null ? (
        <p data-testid="value-not-found" className="text-sm text-gray-600">{v.notFound}</p>
      ) : (
        <>
          <header className="rounded-xl border border-gray-200 bg-white p-4">
            <h1 className="text-xl font-black text-gray-900">{value.name}</h1>
            <p className="text-[12px] text-gray-600">{value.clubName}</p>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
              <div><dt className="text-gray-500">{v.base}</dt><dd className="font-bold">{formatKr(value.baseValue!)}</dd></div>
              <div><dt className="text-gray-500">{v.current}</dt><dd data-testid="value-current" className="font-bold">{formatKr(value.current)}</dd></div>
            </dl>
          </header>
          {value.sessions.length === 0 && <p className="text-[12px] text-gray-600">{v.noChange}</p>}
          {[...value.sessions].reverse().map((s) => (
            <section key={s.date} data-testid="value-session" data-date={s.date} className="rounded-xl border border-gray-200 bg-white p-3 text-[12px]">
              <h2 className="font-bold text-gray-900">{s.date}</h2>
              <ul className="mt-1 space-y-1">
                {s.matches.map((m) => (
                  <li key={m.matchId}>
                    <p className="font-semibold">
                      {m.label} · {m.kind === "league" ? v.league : v.officialFriendly}
                    </p>
                    {m.smallSidedFree !== null ? (
                      <p className="text-gray-600">{v.free(m.smallSidedFree, rules.smallSided.freeMatches)}</p>
                    ) : (
                      <p className="text-gray-700">
                        {m.result ? `${v.result[m.result]} ${formatChange(m.resultChange)}` : v.noResult}
                        {m.stats.map((st) => ` · ${STAT_LABELS[st.statKey]} ×${st.count} ${formatChange(st.change)}`).join("")}
                      </p>
                    )}
                  </li>
                ))}
                {s.changes.map((c) => (
                  <li key={c.id} data-testid="value-change-line">
                    {v.kfandraChange}: {formatChange(c.amount)} · {c.note}
                  </li>
                ))}
              </ul>
              <p className="mt-2 flex justify-between border-t border-gray-100 pt-1">
                <span>{v.sessionTotal} {formatChange(s.total)}</span>
                <span className="font-bold">{v.valueAfter} {formatKr(s.valueAfter)}</span>
              </p>
              {s.hitFloor && <p className="text-red-700">{v.stoppedAtZero}</p>}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
