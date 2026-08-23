import Link from "next/link";
import { getActiveSeason, listMatches, listSeasons } from "@/lib/klcsra/repository";
import { SPORT_LABELS } from "@/lib/klcsra/sport-stats";
import type { MatchSummary, Season } from "@/lib/klcsra/types";
import { NewMatchForm } from "./new-match-form";

export const dynamic = "force-dynamic";

/**
 * Screen 1 — the matches list.
 *
 * Two states matter, and the second one is the live state today: KLCSRA ships
 * with every season seeded `upcoming`, so KFANDRA's first view has NO active
 * season. That is not an error — friendlies and drafts work fine without one —
 * so the between-seasons variant is an inviting amber prompt, not a red alarm.
 * (The red "cannot be submitted" framing belongs on the Seasons screen, which
 * is where you go to fix it.)
 */

function fmtDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Today in the local timezone, as `YYYY-MM-DD` (never UTC — the club plays in IST). */
function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** `listMatches()` is already newest-first, so a single pass preserves the order. */
function groupByDate(matches: MatchSummary[]): { date: string; matches: MatchSummary[] }[] {
  const groups: { date: string; matches: MatchSummary[] }[] = [];
  for (const m of matches) {
    const last = groups[groups.length - 1];
    if (last && last.date === m.entryDate) last.matches.push(m);
    else groups.push({ date: m.entryDate, matches: [m] });
  }
  return groups;
}

export default async function MatchesPage() {
  const [matches, active, seasons] = await Promise.all([
    listMatches(),
    getActiveSeason(),
    listSeasons(),
  ]);
  const upcoming = seasons.find((s) => s.status === "upcoming") ?? null;
  const today = todayIso();
  const groups = groupByDate(matches);

  return (
    <div className="space-y-4">
      <Link href="/admin/klc" className="text-[12px] text-gray-600 hover:underline">
        ← KLC admin
      </Link>

      <div>
        <h2 className="text-lg font-bold text-gray-900">Matches</h2>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <SeasonPill season={active} />
          <span className="text-[11px] text-gray-600">
            {matches.length === 0
              ? "Nothing recorded yet"
              : `${matches.length} ${matches.length === 1 ? "match" : "matches"}`}
          </span>
        </div>
      </div>

      {!active && <BetweenSeasons upcoming={upcoming} />}

      <NewMatchForm today={today} />

      {matches.length === 0 ? (
        <div
          data-testid="match-empty"
          className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-6 text-center"
        >
          <p className="text-sm font-semibold text-gray-900">No matches yet</p>
          <p className="mt-0.5 text-[12px] text-gray-600">
            Pick a date above and tap ＋ New match to start recording.
          </p>
        </div>
      ) : (
        <div data-testid="match-list" className="space-y-4">
          {groups.map((g) => (
            <section key={g.date} data-testid="match-date-group" data-date={g.date}>
              <p className="mb-1.5 flex items-baseline gap-2 text-[11px] font-bold uppercase tracking-wide text-gray-600">
                <span>{fmtDate(g.date)}</span>
                {g.date === today && (
                  <span className="rounded-full bg-gray-900 px-1.5 py-0.5 text-[9px] tracking-widest text-white">
                    Today
                  </span>
                )}
              </p>
              <ul className="space-y-2">
                {g.matches.map((m) => (
                  <MatchCard key={m.id} match={m} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// ── header bits ─────────────────────────────────────────────────────────────

function SeasonPill({ season }: { season: Season | null }) {
  if (!season) {
    return (
      <span
        data-testid="season-pill"
        className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900"
      >
        Between seasons
      </span>
    );
  }
  return (
    <span
      data-testid="season-pill"
      className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-800"
    >
      S{season.seasonNo} · {season.name}
    </span>
  );
}

function BetweenSeasons({ upcoming }: { upcoming: Season | null }) {
  return (
    <div
      data-testid="no-season-prompt"
      className="rounded-xl border border-amber-300 bg-amber-50 p-4"
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">
        No season running
      </p>
      <p className="mt-0.5 text-sm font-bold text-amber-900">
        {upcoming ? `S${upcoming.seasonNo} · ${upcoming.name} is ready to go.` : "Set up a season."}
      </p>
      <p className="mt-1 text-[12px] text-amber-800">
        Record friendlies and drafts whenever you like. A league match needs an active season
        before it can be submitted, so start one first.
      </p>
      <Link
        href="/admin/klc/seasons"
        data-testid="start-season-link"
        className="mt-3 inline-block rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
      >
        {upcoming ? `Start Season ${upcoming.seasonNo}` : "Go to Seasons"} →
      </Link>
    </div>
  );
}

// ── one match ───────────────────────────────────────────────────────────────

function MatchCard({ match: m }: { match: MatchSummary }) {
  const submitted = m.status === "submitted";
  return (
    <li data-testid="match-row" data-match-id={m.id}>
      <Link
        href={`/admin/klc/matches/${m.id}`}
        data-testid="match-link"
        className="block rounded-xl border border-gray-200 bg-white p-3 hover:border-gray-300 hover:bg-gray-50"
      >
        <div className="flex items-start justify-between gap-2">
          {/* One line, not a three-row scoreboard: club names run long (a
              combined match shows two per side) and the score chip keeps the
              result findable however the names wrap. */}
          <p data-testid="match-score" className="min-w-0 text-sm font-semibold text-gray-900">
            {m.homeLabel}{" "}
            <span className="mx-0.5 whitespace-nowrap rounded-md bg-gray-100 px-1.5 py-0.5 font-bold tabular-nums text-gray-900">
              {m.scoreLine}
            </span>{" "}
            {m.awayLabel}
          </p>
          <span
            data-testid="match-status"
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize tracking-wide ${
              submitted ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
            }`}
          >
            {m.status}
          </span>
        </div>
        <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-600">
          <span data-testid="match-sport" className="font-medium text-gray-700">
            {SPORT_LABELS[m.sport] ?? m.sport}
          </span>
          {m.isCombined && (
            <Tag testId="tag-combined" tone="blue">
              Combined
            </Tag>
          )}
          {m.isFriendly && (
            <Tag testId="tag-friendly" tone="violet">
              Friendly
            </Tag>
          )}
          {m.seasonName && (
            <Tag testId="tag-season" tone="gray">
              {m.seasonName}
            </Tag>
          )}
        </p>
      </Link>
    </li>
  );
}

const TONES = {
  blue: "bg-blue-50 text-blue-800",
  violet: "bg-violet-50 text-violet-800",
  gray: "bg-gray-100 text-gray-700",
} as const;

function Tag({
  children,
  testId,
  tone,
}: {
  children: React.ReactNode;
  testId: string;
  tone: keyof typeof TONES;
}) {
  return (
    <span
      data-testid={testId}
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
