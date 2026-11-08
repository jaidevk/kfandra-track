/**
 * Pure. The duplicate-match warning (spec §4, D8): another match on the same
 * date where the two clubs lead opposite sides in any half. It warns and
 * never blocks: two clubs can genuinely play twice in a morning.
 */
import type { MatchSummary, SideKey } from "./types";

export type DuplicateCandidate = Pick<
  MatchSummary,
  "id" | "entryDate" | "status" | "isFriendly" | "homeSentAt" | "awaySentAt" | "sideClubs" | "homeLabel" | "awayLabel"
>;

type SideClub = { side: SideKey; clubId: string };

export function sideClubsOf(
  halves: { sides: { side: SideKey; clubId: string | null }[] }[],
): SideClub[] {
  return halves.flatMap((h) =>
    h.sides
      .filter((s): s is { side: SideKey; clubId: string } => s.clubId !== null)
      .map((s) => ({ side: s.side, clubId: s.clubId })),
  );
}

const clubsOn = (list: SideClub[], side: SideKey) =>
  new Set(list.filter((s) => s.side === side).map((s) => s.clubId));

export function findDuplicates<C extends DuplicateCandidate>(
  target: { id: string | null; entryDate: string; sideClubs: SideClub[] },
  candidates: C[],
): C[] {
  const home = clubsOn(target.sideClubs, "home");
  const away = clubsOn(target.sideClubs, "away");
  if (home.size === 0 || away.size === 0) return [];
  const meets = (x: Set<string>, y: Set<string>) =>
    [...home].some((c) => x.has(c)) && [...away].some((c) => y.has(c));
  return candidates.filter((c) => {
    if (c.id === target.id || c.entryDate !== target.entryDate) return false;
    const cHome = clubsOn(c.sideClubs, "home");
    const cAway = clubsOn(c.sideClubs, "away");
    return meets(cHome, cAway) || meets(cAway, cHome);
  });
}

/**
 * Just the fields a warning shows. A full summary also carries its score
 * line, and a league score must not reach a manager before it is official.
 */
export function asCandidate(m: DuplicateCandidate): DuplicateCandidate {
  return {
    id: m.id, entryDate: m.entryDate, status: m.status, isFriendly: m.isFriendly,
    homeSentAt: m.homeSentAt, awaySentAt: m.awaySentAt, sideClubs: m.sideClubs,
    homeLabel: m.homeLabel, awayLabel: m.awayLabel,
  };
}
