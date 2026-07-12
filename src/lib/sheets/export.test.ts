import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SheetsClient } from "./client";
import type { SessionRow } from "@/lib/admin/submissions-repository";

vi.mock("server-only", () => ({}));
vi.mock("./config", () => ({ getSheetsConfig: vi.fn() }));
vi.mock("@/lib/admin/submissions-repository", () => ({
  listPlayers: vi.fn(),
  getSessionSubmissions: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () =>
              Promise.resolve({
                data: [
                  { id: "s1", session_date: "2026-06-02" },
                  { id: "s2", session_date: "2026-06-04" },
                ],
              }),
          }),
        }),
      }),
    }),
  }),
}));

import { getSheetsConfig } from "./config";
import { listPlayers, getSessionSubmissions } from "@/lib/admin/submissions-repository";
import { exportMonth } from "./export";

const mockConfig = vi.mocked(getSheetsConfig);
const mockPlayers = vi.mocked(listPlayers);
const mockSubs = vi.mocked(getSessionSubmissions);

const row = (playerId: string, displayName: string, total: number): SessionRow => ({
  playerId,
  displayName,
  submitted: total > 0,
  arrivalPoints: 0,
  confirmationPoints: 0,
  gamesPoints: 0,
  packingPoints: 0,
  otherPoints: 0,
  repPoints: 0,
  repReps: 0,
  total,
  detail: null,
});

function fakeClient(): SheetsClient & {
  ensureTab: ReturnType<typeof vi.fn>;
  writeMatrix: ReturnType<typeof vi.fn>;
} {
  return {
    ensureTab: vi.fn(async () => {}),
    writeMatrix: vi.fn(async () => {}),
  };
}

beforeEach(() => vi.clearAllMocks());

describe("exportMonth", () => {
  it("skips (error) when export is disabled", async () => {
    mockConfig.mockResolvedValue({ enabled: false, spreadsheetId: "ss" });
    const client = fakeClient();
    const res = await exportMonth(2026, 6, client);
    expect(res.ok).toBe(false);
    expect(client.writeMatrix).not.toHaveBeenCalled();
  });

  it("writes a player×session matrix of totals to the month tab", async () => {
    mockConfig.mockResolvedValue({ enabled: true, spreadsheetId: "ss-1" });
    mockPlayers.mockResolvedValue([
      { id: "a", displayName: "Abe" },
      { id: "b", displayName: "Baz" },
    ]);
    mockSubs.mockImplementation(async (sessionId: string) =>
      sessionId === "s1"
        ? [row("a", "Abe", 1500), row("b", "Baz", 300)]
        : [row("a", "Abe", 1000), row("b", "Baz", 0)],
    );

    const client = fakeClient();
    const res = await exportMonth(2026, 6, client);

    expect(res).toMatchObject({ ok: true, sessions: 2, players: 2, tab: "Jun 2026" });
    expect(client.ensureTab).toHaveBeenCalledWith("ss-1", "Jun 2026");
    const matrix = client.writeMatrix.mock.calls[0][2];
    expect(matrix[0]).toEqual(["", "PLAYERS", "Tue 2/6", "Thu 4/6", "TOTAL"]);
    expect(matrix[1]).toEqual([1, "Abe", 1500, 1000, 2500]);
    expect(matrix[2]).toEqual([2, "Baz", 300, 0, 300]);
  });
});
