import { strings } from "@/content/strings";
import type { Board } from "@/lib/klcsra/leaderboards";
import { Empty } from "./league-nav";

export function LeadersTab({ boards }: { boards: Board[] }) {
  if (boards.length === 0) return <Empty text={strings.league.emptyLeaders} testId="league-leaders-empty" />;
  return (
    <div className="space-y-3">
      {boards.map((b) => (
        <div key={b.key} data-testid="leader-board" data-board={b.key} className="rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-gray-600">{b.label}</p>
          <ol className="mt-1.5 space-y-1 text-[13px]">
            {b.entries.map((e) => (
              <li key={e.playerId} data-testid="leader-entry" data-player-id={e.playerId} className="flex items-center gap-2">
                <span className="w-4 text-right text-[11px] font-bold text-gray-400">{e.rank}</span>
                <span className="font-semibold text-gray-900">{e.name}</span>
                {e.club && <span className="truncate text-[11px] text-gray-500">{e.club}</span>}
                <span data-testid="leader-value" className="ml-auto font-bold tabular-nums">{e.value}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
      <p className="text-[11px] text-gray-500">{strings.league.friendliesNote}</p>
    </div>
  );
}
