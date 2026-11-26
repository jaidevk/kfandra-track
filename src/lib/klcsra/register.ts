/**
 * Pure. Who is in the KLC register (spec 2026-11-22 §4): the managers of
 * active clubs. A player's club is the club they manage; if they manage more
 * than one, the lowest sort_order is used and the row is flagged.
 */
import type { RegisterPlayer } from "./player-values";

export interface RegisterClub { id: string; name: string; sortOrder: number; managerPlayerId: string }
export interface RegisterPerson { id: string; displayName: string; klcName: string | null }
export interface BaseValueRow { playerId: string; baseValue: number }

export function buildRegister(
  clubs: RegisterClub[],
  people: RegisterPerson[],
  bases: BaseValueRow[],
): RegisterPlayer[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const base = new Map(bases.map((b) => [b.playerId, b.baseValue]));
  const count = new Map<string, number>();
  for (const c of clubs) count.set(c.managerPlayerId, (count.get(c.managerPlayerId) ?? 0) + 1);

  const out: RegisterPlayer[] = [];
  const seen = new Set<string>();
  for (const c of [...clubs].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))) {
    const p = byId.get(c.managerPlayerId);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push({
      playerId: p.id,
      displayName: p.displayName,
      klcName: p.klcName,
      clubId: c.id,
      clubName: c.name,
      baseValue: base.get(p.id) ?? null,
      manyClubs: (count.get(p.id) ?? 0) > 1,
    });
  }
  return out;
}
