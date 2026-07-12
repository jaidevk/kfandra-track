"use client";
import Link from "next/link";
import { useState } from "react";
import { updatePointRulePoints, updateGameTypeName } from "@/lib/admin/config-actions";
import type { PointRuleRow, GameTypeRow } from "@/lib/admin/config-repository";

const SCOPE_TITLES: Record<string, string> = {
  result: "Game results",
  stat: "Highlights",
  participation: "Participation bonuses",
  order: "Order of arrival",
  fitness: "Fitness (gym reps)",
  other: "Other",
};
const SCOPE_ORDER = ["result", "stat", "participation", "order", "fitness", "other"];

export default function ConfigEditor({
  rules,
  gameTypes,
}: {
  rules: PointRuleRow[];
  gameTypes: GameTypeRow[];
}) {
  const defaults = rules.filter((r) => r.gameTypeId === null);
  const overrides = rules.filter((r) => r.gameTypeId !== null);

  const defaultsByScope = SCOPE_ORDER.map((scope) => ({
    scope,
    title: SCOPE_TITLES[scope] ?? scope,
    rules: defaults.filter((r) => r.scope === scope),
  })).filter((g) => g.rules.length > 0);

  const overridesByGame = groupBy(overrides, (r) => r.gameTypeName ?? "Other");

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-[12px] text-gray-600 hover:underline">
        ← Admin
      </Link>

      {/* Game type names */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-gray-900">Game type names</h2>
        <div className="space-y-2">
          {gameTypes.map((g) => (
            <NameRow key={g.id} gameType={g} />
          ))}
        </div>
      </section>

      {/* Point values — defaults grouped by scope */}
      <section>
        <h2 className="mb-1 text-sm font-bold text-gray-900">Point values</h2>
        <p className="mb-2 text-[11px] text-gray-600">
          Editing a value takes effect immediately the next time a score is computed.
        </p>
        {defaultsByScope.map((group) => (
          <div key={group.scope} className="mb-4">
            <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-600">
              {group.title}
            </h3>
            <div className="space-y-2">
              {group.rules.map((r) => (
                <PointsRow key={r.id} rule={r} />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Per-game-type overrides */}
      {Object.keys(overridesByGame).length > 0 && (
        <section>
          <h2 className="mb-1 text-sm font-bold text-gray-900">Per-game overrides</h2>
          <p className="mb-2 text-[11px] text-gray-600">
            These values apply only to the named game type, replacing the default.
          </p>
          {Object.entries(overridesByGame).map(([game, rs]) => (
            <div key={game} className="mb-4">
              <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-600">
                {game}
              </h3>
              <div className="space-y-2">
                {rs.map((r) => (
                  <PointsRow key={r.id} rule={r} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function PointsRow({ rule }: { rule: PointRuleRow }) {
  const [value, setValue] = useState(String(rule.points));
  const [saved, setSaved] = useState(rule.points);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const num = Number(value);
  const dirty = value.trim() !== "" && num !== saved;

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const res = await updatePointRulePoints(rule.id, num);
    if (res.ok) {
      setSaved(num);
      setMsg("Saved");
    } else {
      setMsg(res.error);
    }
    setBusy(false);
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
      <span className="flex-1 text-sm text-gray-800">{rule.label}</span>
      {msg && <span className="text-[11px] text-gray-600">{msg}</span>}
      <input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={busy}
        className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-right text-sm tabular-nums focus:border-gray-400 focus:outline-none"
      />
      <button
        onClick={save}
        disabled={busy || !dirty}
        className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
      >
        Save
      </button>
    </div>
  );
}

function NameRow({ gameType }: { gameType: GameTypeRow }) {
  const [value, setValue] = useState(gameType.name);
  const [saved, setSaved] = useState(gameType.name);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const dirty = value.trim() !== "" && value !== saved;

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const res = await updateGameTypeName(gameType.id, value);
    if (res.ok) {
      setSaved(value.trim());
      setValue(value.trim());
      setMsg("Saved");
    } else {
      setMsg(res.error);
    }
    setBusy(false);
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
      <span className="w-6 text-center text-lg">{gameType.emoji ?? "⚽"}</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={busy}
        className="min-w-0 flex-1 rounded-lg border border-gray-200 px-2 py-1 text-sm focus:border-gray-400 focus:outline-none"
      />
      {msg && <span className="text-[11px] text-gray-600">{msg}</span>}
      <button
        onClick={save}
        disabled={busy || !dirty}
        className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
      >
        Save
      </button>
    </div>
  );
}

function groupBy<T>(items: T[], key: (t: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of items) {
    const k = key(item);
    (out[k] ??= []).push(item);
  }
  return out;
}
