import { describe, it, expect } from "vitest";
import { toSessionRows } from "./submissions-rows";

const players = [
  { id: "a", displayName: "Abe" },
  { id: "b", displayName: "Baz" },
  { id: "c", displayName: "Crank" },
];

describe("toSessionRows", () => {
  it("joins players to order points, defaulting missing to zero and summing the total", () => {
    const order = [{ playerId: "a", arrivalPoints: 300, confirmationPoints: 200 }];
    const rows = toSessionRows(players, order, ["a"]);
    const abe = rows.find((r) => r.playerId === "a")!;
    const baz = rows.find((r) => r.playerId === "b")!;
    expect(abe).toMatchObject({
      submitted: true,
      arrivalPoints: 300,
      confirmationPoints: 200,
      total: 500,
    });
    expect(baz).toMatchObject({
      submitted: false,
      arrivalPoints: 0,
      confirmationPoints: 0,
      total: 0,
    });
  });

  it("flags submitted players who earned no order points (submitted but no arrival rank)", () => {
    // 'c' submitted an entry but recorded no arrival rank, so earns 0 order points.
    const rows = toSessionRows(players, [], ["c"]);
    const crank = rows.find((r) => r.playerId === "c")!;
    expect(crank.submitted).toBe(true);
    expect(crank.total).toBe(0);
  });
});
