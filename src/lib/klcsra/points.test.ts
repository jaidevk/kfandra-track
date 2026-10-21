import { describe, it, expect } from "vitest";
import { computeMatchPoints } from "./points";
import { DEFAULT_STANDINGS_RULES as R } from "./standings-rules";
import { SPORTS, type Sport } from "./sport-stats";

const MAIN: Sport[] = ["football", "fooba", "rugby"];
const pts = (sport: Sport, totalPlayers: number, homeScore: number, awayScore: number) =>
  computeMatchPoints({ sport, totalPlayers, homeScore, awayScore }, R);

describe("computeMatchPoints", () => {
  it.each([...SPORTS])("%s: 7+ win/draw/loss", (sport: Sport) => {
    const win = MAIN.includes(sport) ? 5 : 3;
    expect(pts(sport, 12, 3, 1)).toEqual({ tier: "7plus", outcome: "home", home: win, away: 0 });
    expect(pts(sport, 7, 0, 2)).toEqual({ tier: "7plus", outcome: "away", home: 0, away: win });
    expect(pts(sport, 8, 2, 2)).toEqual({ tier: "7plus", outcome: "draw", home: 1, away: 1 });
  });

  it.each([...SPORTS])("%s: 4–6 win 1 / draw 0.2", (sport: Sport) => {
    expect(pts(sport, 6, 1, 0)).toMatchObject({ tier: "4to6", home: 1, away: 0 });
    expect(pts(sport, 4, 1, 1)).toMatchObject({ tier: "4to6", home: 0.2, away: 0.2 });
  });

  it.each([...SPORTS])("%s: 2–3 win 0.5 / draw 0.1", (sport: Sport) => {
    expect(pts(sport, 3, 0, 1)).toMatchObject({ tier: "2to3", home: 0, away: 0.5 });
    expect(pts(sport, 2, 0, 0)).toMatchObject({ tier: "2to3", home: 0.1, away: 0.1 });
  });

  it("fewer than 2 players: no tier, 0 points, result still decided", () => {
    expect(pts("football", 1, 2, 0)).toEqual({ tier: null, outcome: "home", home: 0, away: 0 });
  });

  it("an unknown sport scores as a multi-game variation", () => {
    expect(pts("variation" as Sport, 12, 1, 0)).toMatchObject({ home: 3, away: 0 });
  });

  it("reads points and tiers from the rules, not hardcoded", () => {
    const loss = { ...structuredClone(R), loss: -1 };
    expect(computeMatchPoints({ sport: "football", totalPlayers: 12, homeScore: 1, awayScore: 0 }, loss))
      .toMatchObject({ home: 5, away: -1 });
    const tiers = {
      ...structuredClone(R),
      tiers: [
        { key: "7plus" as const, min: 9, max: null },
        { key: "4to6" as const, min: 4, max: 8 },
        { key: "2to3" as const, min: 2, max: 3 },
      ],
    };
    expect(computeMatchPoints({ sport: "football", totalPlayers: 8, homeScore: 1, awayScore: 0 }, tiers))
      .toMatchObject({ tier: "4to6", home: 1 });
  });

  it("a winning margin earns no bonus (v1 margin rule is gone)", () => {
    expect(pts("football", 12, 30, 0)).toMatchObject({ home: 5, away: 0 });
  });
});
