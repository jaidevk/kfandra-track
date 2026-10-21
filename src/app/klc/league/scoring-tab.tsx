import { strings } from "@/content/strings";
import { SPORTS, SPORT_LABELS } from "@/lib/klcsra/sport-stats";
import { TIER_KEYS, TIER_LABELS, type StandingsRules } from "@/lib/klcsra/standings-rules";

export function ScoringTab({ rules }: { rules: StandingsRules }) {
  const th = "px-2 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-600";
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table data-testid="scoring-table" className="w-full text-[12px] tabular-nums">
          <thead className="bg-gray-50">
            <tr>
              <th className={`${th} text-left`}>Win</th>
              {TIER_KEYS.map((t) => <th key={t} className={`${th} text-right`}>{TIER_LABELS[t]} players</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {SPORTS.map((s) => (
              <tr key={s}>
                <td className="px-2 py-2 font-semibold text-gray-900">{SPORT_LABELS[s]}</td>
                {TIER_KEYS.map((t) => <td key={t} className="px-2 text-right">{rules.win[s][t]}</td>)}
              </tr>
            ))}
            <tr className="bg-gray-50">
              <td className="px-2 py-2 font-semibold text-gray-900">Draw (all types)</td>
              {TIER_KEYS.map((t) => <td key={t} className="px-2 text-right">{rules.draw[t]}</td>)}
            </tr>
            <tr>
              <td className="px-2 py-2 font-semibold text-gray-900">Loss</td>
              {TIER_KEYS.map((t) => <td key={t} className="px-2 text-right">{rules.loss}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-500">
        Players are counted across both teams. A combined (joint-manager) match is one result on the aggregate score, with full points to each club.
      </p>
      <p className="text-[11px] text-gray-500">{strings.league.capNote}</p>
    </div>
  );
}
