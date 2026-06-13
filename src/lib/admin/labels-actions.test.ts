import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/guard", () => ({ requireEditor: vi.fn() }));
vi.mock("./labels-repository", () => ({
  upsertLabelOverride: vi.fn(),
  deleteLabelOverride: vi.fn(),
}));

import { requireEditor } from "@/lib/auth/guard";
import { upsertLabelOverride } from "./labels-repository";
import { setLabelOverride } from "./labels-actions";

const mockRequireEditor = vi.mocked(requireEditor);
const mockUpsert = vi.mocked(upsertLabelOverride);

beforeEach(() => vi.clearAllMocks());

describe("setLabelOverride", () => {
  it("rejects unknown paths before writing", async () => {
    mockRequireEditor.mockResolvedValue({ id: "p1" } as never);
    const res = await setLabelOverride("not.a.real.path", "x");
    expect(res.ok).toBe(false);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("writes a valid path for an editor", async () => {
    mockRequireEditor.mockResolvedValue({ id: "p1" } as never);
    const res = await setLabelOverride("home.mmg.title", "Games");
    expect(res.ok).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith("home.mmg.title", "Games", "p1");
  });

  it("propagates an authorization failure from the guard", async () => {
    mockRequireEditor.mockRejectedValue(new Error("Not authorized."));
    const res = await setLabelOverride("home.mmg.title", "Games");
    expect(res.ok).toBe(false);
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
