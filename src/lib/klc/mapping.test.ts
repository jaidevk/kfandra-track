import { describe, it, expect } from "vitest";
import { buildBalanceDraft } from "./mapping";

describe("buildBalanceDraft", () => {
  it("maps a stored sheet + loanee rows into a draft", () => {
    const sheet = {
      as_of_date: "2026-07-20",
      matches_played: 6, matches_won: 4, matches_drawn: 1, matches_lost: 1,
      club_bonus: 50,
    };
    const shares = [
      { player_id: "p1", amount: 5, display_name: "Asha" },
      { player_id: "p2", amount: 4, display_name: "Ben" },
    ];
    expect(buildBalanceDraft(sheet, shares)).toEqual({
      asOfDate: "2026-07-20",
      matchesPlayed: 6, matchesWon: 4, matchesDrawn: 1, matchesLost: 1,
      clubBonus: 50,
      shares: [
        { playerId: "p1", playerName: "Asha", amount: 5 },
        { playerId: "p2", playerName: "Ben", amount: 4 },
      ],
    });
  });

  it("returns a zeroed draft with no loanees when no sheet exists", () => {
    expect(buildBalanceDraft(null, [])).toEqual({
      asOfDate: null,
      matchesPlayed: 0, matchesWon: 0, matchesDrawn: 0, matchesLost: 0,
      clubBonus: 0, shares: [],
    });
  });
});
