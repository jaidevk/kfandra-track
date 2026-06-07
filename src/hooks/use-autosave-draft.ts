"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadDraft,
  saveDraft,
  clearDraft,
  type LoadedDraft,
} from "@/lib/drafts/storage";

/**
 * Autosave-to-localStorage hook for in-progress session entry (offline
 * Option A). Holds a draft value in state, mirrors every change to
 * localStorage on a short debounce, and exposes a save status for a "Saved ✓"
 * affordance.
 *
 * Hydration: the first render always uses `initial` so server and client
 * markup match; the persisted draft (if any) is loaded in an effect on mount
 * and `hydrated` flips to true. Read `hydrated` before trusting `value` to
 * reflect stored data.
 *
 * There is no offline sync queue — Finalize (flushing to the server) is the
 * caller's job and requires connectivity. This hook only keeps the local draft
 * alive across reloads/crashes.
 */

export type DraftStatus = "idle" | "saving" | "saved" | "error";

export interface UseAutosaveDraft<T> {
  value: T;
  setValue: (next: T | ((prev: T) => T)) => void;
  /** True once the persisted draft has been read on mount. */
  hydrated: boolean;
  status: DraftStatus;
  /** Epoch ms of the last successful save, or null if never saved. */
  savedAt: number | null;
  /** Force-flush the current value to storage immediately (e.g. on blur). */
  flush: () => void;
  /** Remove the draft from storage and reset status (e.g. after Finalize). */
  clear: () => void;
}

export function useAutosaveDraft<T>(
  id: string,
  initial: T,
  options: { debounceMs?: number } = {},
): UseAutosaveDraft<T> {
  const { debounceMs = 600 } = options;

  const [value, setValueState] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState<DraftStatus>("idle");
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Latest value, readable inside timers/callbacks without re-subscribing.
  // Synced in an effect (never written during render).
  const valueRef = useRef<T>(initial);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Suppress the autosave that the hydration state-update would otherwise
  // trigger — loading a draft shouldn't immediately re-write it.
  const skipNextSave = useRef(false);

  // ── Hydrate from storage once, on mount ──────────────────────────────────
  // Reading localStorage is only possible on the client, so this necessarily
  // syncs external state into React via setState in an effect (the rule's
  // sanctioned "subscribe to an external system" case — there is no SSR-safe
  // alternative without a hydration mismatch).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    // Flipping `hydrated` (and possibly `value`) re-runs the autosave effect
    // below; skip that first run so mounting never re-writes an untouched
    // draft. Only genuine user edits should persist.
    skipNextSave.current = true;
    const stored: LoadedDraft<T> | null = loadDraft<T>(id);
    if (stored) {
      setValueState(stored.data);
      setSavedAt(stored.savedAt);
      setStatus("saved");
    }
    setHydrated(true);
    // id is intentionally the only dep — a different id is a different draft.
  }, [id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const persist = useCallback(() => {
    setStatus("saving");
    const ts = saveDraft(id, valueRef.current);
    if (ts === null) {
      setStatus("error");
    } else {
      setSavedAt(ts);
      setStatus("saved");
    }
  }, [id]);

  // ── Debounced autosave on value change (after hydration) ─────────────────
  // No synchronous setState here — "saving" is set in setValue (the event
  // handler); the timeout callback persists and sets the terminal status.
  useEffect(() => {
    if (!hydrated) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(persist, debounceMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, hydrated, debounceMs, persist]);

  const setValue = useCallback((next: T | ((prev: T) => T)) => {
    // Mark "saving" immediately on a user edit; the debounce effect schedules
    // the actual write, which flips status to "saved"/"error".
    setStatus("saving");
    setValueState((prev) =>
      typeof next === "function" ? (next as (p: T) => T)(prev) : next,
    );
  }, []);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    persist();
  }, [persist]);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    clearDraft(id);
    setSavedAt(null);
    setStatus("idle");
  }, [id]);

  return { value, setValue, hydrated, status, savedAt, flush, clear };
}
