import { redirect } from "next/navigation";
import { Breadcrumb } from "@/components/breadcrumb";
import { strings } from "@/content/strings";
import { getCurrentPlayer } from "@/lib/auth/current-user";
import {
  loadSportStats, loadStandingsRules, loadStatRates, loadTableGroups,
} from "@/lib/klcsra/config";
import { buildLeaderboards } from "@/lib/klcsra/leaderboards";
import { clubNamesFromDrafts, toLeagueMatch, toStatRows } from "@/lib/klcsra/league-data";
import { parseLeagueParams } from "@/lib/klcsra/league-params";
import { listSubmittedMatchDrafts } from "@/lib/klcsra/league-repository";
import { buildLeagueTable } from "@/lib/klcsra/league-table";
import { listSeasons } from "@/lib/klcsra/repository";
import { groupScoreKinds } from "@/lib/klcsra/table-groups";
import { Empty, GroupChips, SeasonPicker, TabBar, seasonLabel } from "./league-nav";
import { LeadersTab } from "./leaders-tab";
import { MatchesTab } from "./matches-tab";
import { ScoringTab } from "./scoring-tab";
import { SeasonsTab } from "./seasons-tab";
import { TableTab } from "./table-tab";

export const dynamic = "force-dynamic";

/**
 * KLC League: tables, results, leaders, seasons and the points scale, for
 * every signed-in player. Everything is derived on read from SUBMITTED
 * matches (`listSubmittedMatchDrafts`), so drafts never appear here.
 */
export default async function LeaguePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const player = await getCurrentPlayer();
  if (!player) redirect("/login?next=/klc/league");

  const [seasons, groups, rules] = await Promise.all([
    listSeasons(), loadTableGroups(), loadStandingsRules(),
  ]);
  const params = parseLeagueParams(await searchParams, seasons, groups);
  const season = seasons.find((s) => s.id === params.seasonId) ?? null;
  const { league } = strings;

  let body: React.ReactNode;
  if (params.tab === "seasons") {
    body = <SeasonsTab seasons={seasons} params={params} />;
  } else if (params.tab === "scoring") {
    body = <ScoringTab rules={rules} />;
  } else if (!season) {
    body = <Empty text={league.noSeason} testId="league-no-season" />;
  } else {
    const drafts = await listSubmittedMatchDrafts(season);
    if (params.tab === "matches") {
      body = <MatchesTab drafts={drafts} rules={rules} />;
    } else if (params.tab === "leaders") {
      const [rates, sportStats] = await Promise.all([loadStatRates(), loadSportStats()]);
      const boards = buildLeaderboards(drafts.flatMap(toStatRows), params.group, groups, rates, sportStats);
      body = (<><GroupChips params={params} groups={groups} /><LeadersTab boards={boards} /></>);
    } else {
      // Names come from the matches themselves, so a club deactivated since
      // still shows by name in a past season (listClubs is active-only).
      const clubs = clubNamesFromDrafts(drafts);
      const rows = buildLeagueTable(drafts.map(toLeagueMatch), params.group, clubs, rules, groups);
      const caption = `${league.table.caption}: ${league.groups[params.group] ?? params.group}, ${seasonLabel(season)}`;
      body = (
        <>
          <GroupChips params={params} groups={groups} />
          <TableTab rows={rows} kinds={groupScoreKinds(params.group, groups)} caption={caption} />
        </>
      );
    }
  }

  return (
    // w-full: body is a flex column and mx-auto disables stretch, so without it
    // this column shrink-wraps to the table's min-content and overflows 375px.
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-5 pb-24">
      <Breadcrumb label={league.breadcrumb} />
      <div className="flex items-end justify-between gap-2">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-black tracking-tight text-gray-900">
          {league.title}
        </h1>
        {season && <SeasonPicker seasons={seasons} current={season} params={params} />}
      </div>
      <TabBar params={params} />
      {body}
    </div>
  );
}
