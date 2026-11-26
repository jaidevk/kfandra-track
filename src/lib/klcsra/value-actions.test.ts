import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ getCurrentPlayer: vi.fn() }));
vi.mock("./repository", () => ({ listSeasons: vi.fn(), writeAudit: vi.fn() }));
vi.mock("./value-repository", () => ({
  getBaseValue: vi.fn(), upsertBaseValue: vi.fn(), getKlcName: vi.fn(), setKlcName: vi.fn(),
  insertValueChange: vi.fn(), getValueChange: vi.fn(), voidValueChange: vi.fn(),
}));

import { getCurrentPlayer, type CurrentPlayer } from "@/lib/auth/current-user";
import * as repo from "./repository";
import * as vrepo from "./value-repository";
import {
  addValueChangeAction, setBaseValueAction, setKlcNameAction, voidValueChangeAction,
} from "./value-actions";

const as = (role: string) =>
  vi.mocked(getCurrentPlayer).mockResolvedValue({ id: "me", role } as unknown as CurrentPlayer);
const SEASON = { id: "s2", seasonNo: 2, name: "S2", startDate: "2026-12-01", endDate: "2027-03-31", status: "active" as const };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(repo.listSeasons).mockResolvedValue([SEASON]);
  as("kfandra");
});

describe("value actions", () => {
  it("refuses anyone but KFANDRA or super_admin", async () => {
    as("admin");
    const r = await setBaseValueAction("s2", "p1", "200");
    expect(r).toEqual({ ok: false, error: "Only KFANDRA can change the register." });
    expect(vrepo.upsertBaseValue).not.toHaveBeenCalled();
  });

  it("saves a base value and logs from → to", async () => {
    vi.mocked(vrepo.getBaseValue).mockResolvedValue(150);
    expect(await setBaseValueAction("s2", "p1", "200")).toEqual({ ok: true, data: undefined });
    expect(vrepo.upsertBaseValue).toHaveBeenCalledWith("s2", "p1", 200, "me");
    expect(repo.writeAudit).toHaveBeenCalledWith({
      actorPlayerId: "me", action: "klc.base_value", entityType: "player", entityId: "p1",
      diff: { seasonId: "s2", from: 150, to: 200 },
    });
  });

  it("refuses a negative or invalid base value, and an unknown season", async () => {
    expect((await setBaseValueAction("s2", "p1", "-5")).ok).toBe(false);
    expect((await setBaseValueAction("s2", "p1", "abc")).ok).toBe(false);
    expect((await setBaseValueAction("nope", "p1", "5")).ok).toBe(false);
  });

  it("sets and clears the official name", async () => {
    vi.mocked(vrepo.getKlcName).mockResolvedValue(null);
    expect((await setKlcNameAction("p1", " Patrick ")).ok).toBe(true);
    expect(vrepo.setKlcName).toHaveBeenCalledWith("p1", "Patrick");
    expect((await setKlcNameAction("p1", "x".repeat(61))).ok).toBe(false);
  });

  it("adds a change only with a non-zero amount, a note and a date inside the season", async () => {
    vi.mocked(vrepo.insertValueChange).mockResolvedValue("c1");
    expect((await addValueChangeAction("s2", "p1", "2026-12-05", "0", "x")).ok).toBe(false);
    expect((await addValueChangeAction("s2", "p1", "2026-12-05", "-30", "  ")).ok).toBe(false);
    expect((await addValueChangeAction("s2", "p1", "2026-11-30", "-30", "Ill")).ok).toBe(false);
    expect(await addValueChangeAction("s2", "p1", "2026-12-05", "-30", "Ill")).toEqual({ ok: true, data: undefined });
    expect(vrepo.insertValueChange).toHaveBeenCalledWith({
      seasonId: "s2", playerId: "p1", effectiveDate: "2026-12-05", amount: -30, note: "Ill", by: "me",
    });
    expect(repo.writeAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: "klc.value_change", entityType: "klc_player_value_change", entityId: "c1",
    }));
  });

  it("voids a change with a note, once", async () => {
    vi.mocked(vrepo.getValueChange).mockResolvedValue({ id: "c1", voidedAt: null });
    expect((await voidValueChangeAction("c1", "")).ok).toBe(false);
    expect((await voidValueChangeAction("c1", "typo")).ok).toBe(true);
    expect(vrepo.voidValueChange).toHaveBeenCalledWith("c1", "me", "typo");
    vi.mocked(vrepo.getValueChange).mockResolvedValue({ id: "c1", voidedAt: "2026-12-06T00:00:00Z" });
    expect(await voidValueChangeAction("c1", "again")).toEqual({ ok: false, error: "That change is already voided." });
  });
});
