/**
 * Pure KLC player values (spec 2026-11-22 §5). No DB/server imports.
 *
 * Values are never stored: they are worked out on every read from the base
 * value, the counted matches and KFANDRA's non-voided changes, so reopening a
 * match, fixing a score, flipping a friendly's mark or voiding a change needs
 * no clean-up.
 */
import { sideClubLabel, toLeagueMatch } from "./league-data";
import { sideOutcome, type SideOutcome } from "./league-table";
import { round4 } from "./round";
import { STAT_KEYS, type StatKey } from "./stat-rates";
import type { MatchDraft } from "./types";
import type { ValueRules } from "./value-rules";

export interface RegisterPlayer {
  playerId: string;
  displayName: string;
  klcName: string | null;
  clubId: string;
  clubName: string;
  baseValue: number | null;
  /** Manages more than one active club (the lowest sort_order club is used). */
  manyClubs: boolean;
}

export interface ValueChange {
  id: string;
  playerId: string;
  effectiveDate: string;
  amount: number;
  note: string;
  createdAt: string;
  voidedAt: string | null;
  voidNote: string | null;
}

export interface MatchValueLine {
  matchId: string;
  date: string;
  /** "Club A v Club B" */
  label: string;
  kind: "league" | "official_friendly";
  /** Null for a match the league table can't score (incomplete, or 1 player). */
  result: SideOutcome | null;
  resultChange: number;
  stats: { statKey: StatKey; count: number; change: number }[];
  /** 1..freeMatches when this was one of the player's free small-sided matches. */
  smallSidedFree: number | null;
  /** 0 when smallSidedFree is set. */
  total: number;
}

export interface SessionValue {
  date: string;
  matches: MatchValueLine[];
  changes: { id: string; amount: number; note: string }[];
  /** Sum before the floor. */
  total: number;
  valueBefore: number;
  valueAfter: number;
  hitFloor: boolean;
}

export interface PlayerValue {
  playerId: string;
  /** Official KLC name, else the app name. */
  name: string;
  clubId: string;
  clubName: string;
  baseValue: number | null;
  /** Null when there is no base value. */
  current: number | null;
  lastSession: { date: string; change: number } | null;
  /** Oldest first. */
  sessions: SessionValue[];
  playedWithoutBase: boolean;
}

/** Submitted league matches, and submitted friendlies marked Official. */
export function isCountedForValues(m: MatchDraft): boolean {
  return m.status === "submitted" && (!m.isFriendly || m.isOfficialFriendly);
}

/** Oldest first: entry date, then submitted_at (nulls last), then id. */
function oldestFirst(a: MatchDraft, b: MatchDraft): number {
  const byDate = a.entryDate.localeCompare(b.entryDate);
  if (byDate !== 0) return byDate;
  if (a.submittedAt !== b.submittedAt) {
    if (a.submittedAt === null) return 1;
    if (b.submittedAt === null) return -1;
    return a.submittedAt.localeCompare(b.submittedAt);
  }
  return a.id.localeCompare(b.id);
}

const sum = (xs: number[]) => round4(xs.reduce((s, x) => s + x, 0));

function matchLines(playerId: string, matches: MatchDraft[], rules: ValueRules): MatchValueLine[] {
  const lines: MatchValueLine[] = [];
  let smallCount = 0;
  for (const m of matches) {
    const a = m.appearances.find((x) => x.playerId === playerId);
    if (!a) continue;
    const lm = toLeagueMatch(m);

    let free: number | null = null;
    if (rules.smallSided.enabled && lm.totalPlayers < rules.smallSided.belowPlayers) {
      smallCount += 1;
      if (smallCount <= rules.smallSided.freeMatches) free = smallCount;
    }

    const result = sideOutcome(lm, a.side);
    const resultChange = result ? rules.result[result] : 0;

    const counts = new Map<StatKey, number>();
    for (const half of Object.values(a.stats)) {
      for (const [k, n] of Object.entries(half) as [StatKey, number | undefined][]) {
        if (n) counts.set(k, (counts.get(k) ?? 0) + n);
      }
    }
    const stats = STAT_KEYS
      .filter((k) => counts.has(k) && (rules.stats[k] ?? 0) !== 0)
      .map((k) => {
        const count = counts.get(k)!;
        return { statKey: k, count, change: round4(count * rules.stats[k]!) };
      });

    const raw = round4(resultChange + sum(stats.map((s) => s.change)));
    lines.push({
      matchId: m.id,
      date: m.entryDate,
      label: `${sideClubLabel(m, "home", { counted: true })} v ${sideClubLabel(m, "away", { counted: true })}`,
      kind: m.isFriendly ? "official_friendly" : "league",
      result,
      resultChange,
      stats,
      smallSidedFree: free,
      total: free === null ? raw : 0,
    });
  }
  return lines;
}

function valueFor(
  p: RegisterPlayer,
  matches: MatchDraft[],
  changes: ValueChange[],
  rules: ValueRules,
): PlayerValue {
  const ident = {
    playerId: p.playerId,
    name: p.klcName ?? p.displayName,
    clubId: p.clubId,
    clubName: p.clubName,
    baseValue: p.baseValue,
  };
  const lines = matchLines(p.playerId, matches, rules);
  if (p.baseValue === null) {
    return { ...ident, current: null, lastSession: null, sessions: [], playedWithoutBase: lines.length > 0 };
  }

  const mine = changes
    .filter((c) => c.playerId === p.playerId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const dates = [...new Set([...lines.map((l) => l.date), ...mine.map((c) => c.effectiveDate)])].sort();

  let value = p.baseValue;
  const sessions: SessionValue[] = [];
  for (const date of dates) {
    const ms = lines.filter((l) => l.date === date);
    const cs = mine.filter((c) => c.effectiveDate === date);
    const total = sum([...ms.map((l) => l.total), ...cs.map((c) => c.amount)]);
    const raw = round4(value + total);
    const valueAfter = Math.max(rules.floor, raw);
    sessions.push({
      date,
      matches: ms,
      changes: cs.map((c) => ({ id: c.id, amount: c.amount, note: c.note })),
      total,
      valueBefore: value,
      valueAfter,
      hitFloor: raw < rules.floor,
    });
    value = valueAfter;
  }

  const last = sessions.at(-1);
  return {
    ...ident,
    current: value,
    lastSession: last ? { date: last.date, change: round4(last.valueAfter - last.valueBefore) } : null,
    sessions,
    playedWithoutBase: false,
  };
}

export function computePlayerValues(input: {
  players: RegisterPlayer[];
  matches: MatchDraft[];
  changes: ValueChange[];
  rules: ValueRules;
}): PlayerValue[] {
  const counted = input.matches.filter(isCountedForValues).sort(oldestFirst);
  const live = input.changes.filter((c) => c.voidedAt === null);
  return input.players.map((p) => valueFor(p, counted, live, input.rules));
}

/** Valued players only, highest value first, then by name. */
export function rankValues(values: PlayerValue[]): PlayerValue[] {
  return values
    .filter((v) => v.current !== null)
    .sort((a, b) => b.current! - a.current! || a.name.localeCompare(b.name, "en"));
}

export function formatKr(n: number): string {
  return `${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })} KR`;
}

/** "+20 KR", "−10 KR" (a true minus sign), "0 KR". */
export function formatChange(n: number): string {
  if (n > 0) return `+${formatKr(n)}`;
  if (n < 0) return `−${formatKr(-n)}`;
  return formatKr(0);
}
