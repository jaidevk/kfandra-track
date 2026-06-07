import { describe, it, expect } from "vitest";
import { computeOrderPoints, type OrderEntry } from "./order-points";

/** Helper: look up a player's result by id. */
function find(results: ReturnType<typeof computeOrderPoints>, id: string) {
  return results.find((r) => r.playerId === id);
}

describe("computeOrderPoints", () => {
  // ── Scenario 1 (user's worked happy path) ─────────────────────────────────
  // 5 confirm in order A, B, C, D, E. Arrive in order B, A, E, D, C.
  // Expected: A 500+400, B 400+500, C 300+100, D 200+200, E 100+300.
  it("scenario 1: 5 players, all arrive, confirmation order differs from arrival", () => {
    const entries: OrderEntry[] = [
      { playerId: "A", confirmationRank: 1, arrivalRank: 2 },
      { playerId: "B", confirmationRank: 2, arrivalRank: 1 },
      { playerId: "C", confirmationRank: 3, arrivalRank: 5 },
      { playerId: "D", confirmationRank: 4, arrivalRank: 4 },
      { playerId: "E", confirmationRank: 5, arrivalRank: 3 },
    ];
    const r = computeOrderPoints(entries);

    expect(find(r, "A")).toEqual({ playerId: "A", confirmationPoints: 500, arrivalPoints: 400 });
    expect(find(r, "B")).toEqual({ playerId: "B", confirmationPoints: 400, arrivalPoints: 500 });
    expect(find(r, "C")).toEqual({ playerId: "C", confirmationPoints: 300, arrivalPoints: 100 });
    expect(find(r, "D")).toEqual({ playerId: "D", confirmationPoints: 200, arrivalPoints: 200 });
    expect(find(r, "E")).toEqual({ playerId: "E", confirmationPoints: 100, arrivalPoints: 300 });
  });

  // ── Scenario 2 (user's worked no-show path) ───────────────────────────────
  // 5 confirm in order A, B, C, D, E. Only 4 arrive: D, C, A, E (B no-show).
  // Expected: A 400+200, B none, C 300+300, D 200+400, E 100+100.
  it("scenario 2: a no-show drops out and shifts everyone below up", () => {
    const entries: OrderEntry[] = [
      { playerId: "A", confirmationRank: 1, arrivalRank: 3 },
      { playerId: "B", confirmationRank: 2, arrivalRank: null }, // no-show
      { playerId: "C", confirmationRank: 3, arrivalRank: 2 },
      { playerId: "D", confirmationRank: 4, arrivalRank: 1 },
      { playerId: "E", confirmationRank: 5, arrivalRank: 4 },
    ];
    const r = computeOrderPoints(entries);

    expect(find(r, "B")).toBeUndefined(); // no-shows earn nothing, omitted
    expect(r).toHaveLength(4);

    expect(find(r, "A")).toEqual({ playerId: "A", confirmationPoints: 400, arrivalPoints: 200 });
    expect(find(r, "C")).toEqual({ playerId: "C", confirmationPoints: 300, arrivalPoints: 300 });
    expect(find(r, "D")).toEqual({ playerId: "D", confirmationPoints: 200, arrivalPoints: 400 });
    expect(find(r, "E")).toEqual({ playerId: "E", confirmationPoints: 100, arrivalPoints: 100 });
  });

  // ── Ranks are order-only, not literal multipliers ─────────────────────────
  it("uses ranks only to order — gaps/typos don't change the result", () => {
    const entries: OrderEntry[] = [
      { playerId: "A", confirmationRank: 10, arrivalRank: 99 },
      { playerId: "B", confirmationRank: 20, arrivalRank: 250 },
      { playerId: "C", confirmationRank: 30, arrivalRank: 1000 },
    ];
    const r = computeOrderPoints(entries);
    // N = 3 → 300, 200, 100 down each ladder.
    expect(find(r, "A")).toEqual({ playerId: "A", confirmationPoints: 300, arrivalPoints: 300 });
    expect(find(r, "B")).toEqual({ playerId: "B", confirmationPoints: 200, arrivalPoints: 200 });
    expect(find(r, "C")).toEqual({ playerId: "C", confirmationPoints: 100, arrivalPoints: 100 });
  });

  // ── Ties: standard SKIP ranking (500, 500, 300) ───────────────────────────
  it("ties use skip ranking: 500, 500, 300 for a shared top spot of 5", () => {
    const entries: OrderEntry[] = [
      { playerId: "A", confirmationRank: 1, arrivalRank: 1 },
      { playerId: "B", confirmationRank: 1, arrivalRank: 2 }, // tied conf with A
      { playerId: "C", confirmationRank: 3, arrivalRank: 3 },
      { playerId: "D", confirmationRank: 4, arrivalRank: 4 },
      { playerId: "E", confirmationRank: 5, arrivalRank: 5 },
    ];
    const r = computeOrderPoints(entries);
    // Confirmation: A & B tied at position 1 → both 500; C at position 3 → 300.
    expect(find(r, "A")!.confirmationPoints).toBe(500);
    expect(find(r, "B")!.confirmationPoints).toBe(500);
    expect(find(r, "C")!.confirmationPoints).toBe(300);
    expect(find(r, "D")!.confirmationPoints).toBe(200);
    expect(find(r, "E")!.confirmationPoints).toBe(100);
  });

  // ── Arrived but never confirmed: 0 conf pts, excluded from conf denominator ─
  it("arrived-but-never-confirmed earns 0 confirmation pts and shrinks Nc", () => {
    const entries: OrderEntry[] = [
      { playerId: "A", confirmationRank: 1, arrivalRank: 1 },
      { playerId: "B", confirmationRank: null, arrivalRank: 2 }, // never confirmed
      { playerId: "C", confirmationRank: 2, arrivalRank: 3 },
    ];
    const r = computeOrderPoints(entries);

    // Arrival ladder: N = 3 → A 300, B 200, C 100.
    expect(find(r, "A")!.arrivalPoints).toBe(300);
    expect(find(r, "B")!.arrivalPoints).toBe(200);
    expect(find(r, "C")!.arrivalPoints).toBe(100);

    // Confirmation ladder: Nc = 2 (only A, C) → A 200, C 100; B earns 0.
    expect(find(r, "A")!.confirmationPoints).toBe(200);
    expect(find(r, "C")!.confirmationPoints).toBe(100);
    expect(find(r, "B")!.confirmationPoints).toBe(0);
  });

  // ── Edge cases ────────────────────────────────────────────────────────────
  it("returns an empty array when nobody arrives", () => {
    const entries: OrderEntry[] = [
      { playerId: "A", confirmationRank: 1, arrivalRank: null },
      { playerId: "B", confirmationRank: 2, arrivalRank: null },
    ];
    expect(computeOrderPoints(entries)).toEqual([]);
  });

  it("handles a single arriver (gets the full N×100 = 100)", () => {
    const entries: OrderEntry[] = [
      { playerId: "A", confirmationRank: 1, arrivalRank: 1 },
    ];
    expect(computeOrderPoints(entries)).toEqual([
      { playerId: "A", confirmationPoints: 100, arrivalPoints: 100 },
    ]);
  });
});
