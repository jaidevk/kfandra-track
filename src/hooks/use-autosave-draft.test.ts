import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutosaveDraft } from "./use-autosave-draft";
import { loadDraft, saveDraft } from "@/lib/drafts/storage";
import { installLocalStorageMock } from "@/test/local-storage";

interface Draft {
  narration: string;
  count: number;
}

const initial: Draft = { narration: "", count: 0 };

beforeEach(() => {
  installLocalStorageMock();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useAutosaveDraft", () => {
  it("starts from `initial` and hydrates to true with no stored draft", async () => {
    const { result } = renderHook(() => useAutosaveDraft("s1", initial));
    expect(result.current.value).toEqual(initial);

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(result.current.hydrated).toBe(true);
    expect(result.current.status).toBe("idle");
    expect(result.current.savedAt).toBeNull();
  });

  it("hydrates an existing stored draft on mount without re-saving it", async () => {
    saveDraft("s2", { narration: "kept", count: 5 }, 12345);

    const { result } = renderHook(() => useAutosaveDraft<Draft>("s2", initial));
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    expect(result.current.value).toEqual({ narration: "kept", count: 5 });
    expect(result.current.savedAt).toBe(12345);
    expect(result.current.status).toBe("saved");
  });

  it("debounce-saves a change to localStorage", async () => {
    const { result } = renderHook(() => useAutosaveDraft<Draft>("s3", initial));
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    act(() => {
      result.current.setValue({ narration: "hi", count: 1 });
    });
    // Mid-debounce: status is "saving" and nothing persisted yet.
    expect(result.current.status).toBe("saving");
    expect(loadDraft("s3")).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(result.current.status).toBe("saved");
    expect(loadDraft<Draft>("s3")).toMatchObject({
      data: { narration: "hi", count: 1 },
    });
  });

  it("flush() persists immediately, bypassing the debounce", async () => {
    const { result } = renderHook(() => useAutosaveDraft<Draft>("s4", initial));
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    act(() => {
      result.current.setValue({ narration: "now", count: 9 });
    });
    act(() => {
      result.current.flush();
    });

    expect(result.current.status).toBe("saved");
    expect(loadDraft<Draft>("s4")).toMatchObject({
      data: { narration: "now", count: 9 },
    });
  });

  it("clear() removes the draft and resets status", async () => {
    saveDraft("s5", { narration: "x", count: 1 }, 1);
    const { result } = renderHook(() => useAutosaveDraft<Draft>("s5", initial));
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    act(() => {
      result.current.clear();
    });

    expect(loadDraft("s5")).toBeNull();
    expect(result.current.status).toBe("idle");
    expect(result.current.savedAt).toBeNull();
  });

  it("supports a functional updater", async () => {
    const { result } = renderHook(() => useAutosaveDraft<Draft>("s6", initial));
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    act(() => {
      result.current.setValue((prev) => ({ ...prev, count: prev.count + 1 }));
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(result.current.value.count).toBe(1);
    expect(loadDraft<Draft>("s6")).toMatchObject({ data: { count: 1 } });
  });
});
