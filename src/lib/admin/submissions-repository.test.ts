import { describe, it, expect } from "vitest";
import { toSessionRows } from "./submissions-rows";

const players = [
  { id: "a", displayName: "Abe" },
  { id: "b", displayName: "Baz" },
  { id: "c", displayName: "Crank" },
];

describe("toSessionRows", () => {
  it("sums order points + self-scored games into the grand total", () => {
    const order = [{ playerId: "a", arrivalPoints: 300, confirmationPoints: 200 }];
    const rows = toSessionRows(players, order, ["a"], { a: 1500 });
    const abe = rows.find((r) => r.playerId === "a")!;
    expect(abe).toMatchObject({
      submitted: true,
      arrivalPoints: 300,
      confirmationPoints: 200,
      gamesPoints: 1500,
      total: 2000,
    });
  });

  it("defaults missing players to zero across all columns", () => {
    const rows = toSessionRows(players, [], [], {});
    const baz = rows.find((r) => r.playerId === "b")!;
    expect(baz).toMatchObject({
      submitted: false,
      arrivalPoints: 0,
      confirmationPoints: 0,
      gamesPoints: 0,
      total: 0,
    });
  });

  it("counts games-only submitters (no order points) toward their total", () => {
    // 'c' submitted, earned no order points, but logged games worth 1000.
    const rows = toSessionRows(players, [], ["c"], { c: 1000 });
    const crank = rows.find((r) => r.playerId === "c")!;
    expect(crank.submitted).toBe(true);
    expect(crank.total).toBe(1000);
  });
});
