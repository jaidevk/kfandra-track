import { strings } from "@/content/strings";
import { SPORTS, SPORT_LABELS } from "@/lib/klcsra/sport-stats";
import { TIER_KEYS, TIER_LABELS, type StandingsRules } from "@/lib/klcsra/standings-rules";

export function ScoringTab({ rules }: { rules: StandingsRules }) {
  const t = strings.league.scoring;
  const th = "px-2 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-600";
  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table data-testid="scoring-table" className="w-full text-[12px] tabular-nums">
          <thead className="bg-gray-50">
            <tr>
              <th className={`${th} text-left`}>{t.win}</th>
              {TIER_KEYS.map((k) => <th key={k} className={`${th} text-right`}>{TIER_LABELS[k]} {t.players}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {SPORTS.map((s) => (
              <tr key={s}>
                <td className="px-2 py-2 font-semibold text-gray-900">{SPORT_LABELS[s]}</td>
                {TIER_KEYS.map((k) => <td key={k} className="px-2 text-right">{rules.win[s][k]}</td>)}
              </tr>
            ))}
            <tr className="bg-gray-50">
              <td className="px-2 py-2 font-semibold text-gray-900">{t.draw}</td>
              {TIER_KEYS.map((k) => <td key={k} className="px-2 text-right">{rules.draw[k]}</td>)}
            </tr>
            <tr>
              <td className="px-2 py-2 font-semibold text-gray-900">{t.loss}</td>
              {TIER_KEYS.map((k) => <td key={k} className="px-2 text-right">{rules.loss}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-500">{t.combinedNote}</p>
      <p className="text-[11px] text-gray-500">{strings.league.capNote}</p>
    </div>
  );
}
