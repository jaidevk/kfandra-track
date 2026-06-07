import { describe, it, expect, beforeEach } from "vitest";
import { loadDraft, saveDraft, clearDraft, listDraftIds } from "./storage";
import { installLocalStorageMock } from "@/test/local-storage";

interface SampleDraft {
  narration: string;
  games: number;
}

beforeEach(() => {
  installLocalStorageMock();
});

describe("draft storage", () => {
  it("round-trips a draft through save → load", () => {
    const data: SampleDraft = { narration: "great game", games: 3 };
    const savedAt = saveDraft("session-2026-06-07", data, 1_700_000_000_000);

    expect(savedAt).toBe(1_700_000_000_000);

    const loaded = loadDraft<SampleDraft>("session-2026-06-07");
    expect(loaded).toEqual({ data, savedAt: 1_700_000_000_000 });
  });

  it("returns null for an absent draft", () => {
    expect(loadDraft("nope")).toBeNull();
  });

  it("namespaces keys so app data and other localStorage don't collide", () => {
    localStorage.setItem("unrelated", "x");
    saveDraft("mmg", { narration: "", games: 0 });

    expect(localStorage.getItem("jacaranda:draft:mmg")).not.toBeNull();
    expect(listDraftIds()).toEqual(["mmg"]);
  });

  it("clearDraft removes a draft and is a no-op when absent", () => {
    saveDraft("mmg", { narration: "x", games: 1 });
    clearDraft("mmg");
    expect(loadDraft("mmg")).toBeNull();
    expect(() => clearDraft("mmg")).not.toThrow();
  });

  it("discards and removes a corrupt payload", () => {
    localStorage.setItem("jacaranda:draft:bad", "{not json");
    expect(loadDraft("bad")).toBeNull();
    // stale entry is cleaned up
    expect(localStorage.getItem("jacaranda:draft:bad")).toBeNull();
  });

  it("discards a draft written by an incompatible version", () => {
    localStorage.setItem(
      "jacaranda:draft:old",
      JSON.stringify({ v: 0, savedAt: 1, data: { narration: "old", games: 0 } }),
    );
    expect(loadDraft("old")).toBeNull();
    expect(localStorage.getItem("jacaranda:draft:old")).toBeNull();
  });

  it("listDraftIds returns only namespaced ids", () => {
    localStorage.setItem("foo", "1");
    saveDraft("a", {});
    saveDraft("b", {});
    expect(listDraftIds().sort()).toEqual(["a", "b"]);
  });

  it("overwrites an existing draft on re-save", () => {
    saveDraft("mmg", { narration: "first", games: 1 }, 1);
    saveDraft("mmg", { narration: "second", games: 2 }, 2);
    expect(loadDraft<SampleDraft>("mmg")).toEqual({
      data: { narration: "second", games: 2 },
      savedAt: 2,
    });
  });
});
