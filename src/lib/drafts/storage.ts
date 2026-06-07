/**
 * Local draft storage — the persistence core for "offline Option A".
 *
 * Drafts (an in-progress MMG or Gym session entry) are mirrored to
 * localStorage on every change so nothing is lost if signal or phone drops
 * mid-session. There is NO offline sync queue: the final "Finalize" action
 * still requires connectivity (that's the feature layer's concern). This
 * module only guarantees the in-progress draft survives a reload/crash.
 *
 * Everything here is pure and SSR-safe — calls degrade to a no-op / null when
 * there is no `window.localStorage` (server render, private-mode quota=0, etc.)
 * rather than throwing, so callers never have to guard the environment.
 */

const PREFIX = "jacaranda:draft:";

// Bump when the on-disk envelope shape changes incompatibly. Envelopes written
// by an older version are discarded on read rather than mis-parsed.
const VERSION = 1;

interface Envelope<T> {
  v: number;
  /** Epoch ms when the draft was last written. */
  savedAt: number;
  data: T;
}

export interface LoadedDraft<T> {
  data: T;
  savedAt: number;
}

function getStore(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage ?? null;
  } catch {
    // Accessing localStorage can throw in sandboxed iframes / blocked cookies.
    return null;
  }
}

function keyFor(id: string): string {
  return `${PREFIX}${id}`;
}

/**
 * Read a draft. Returns null when absent, when storage is unavailable, or when
 * the stored payload is corrupt or written by an incompatible version (in
 * which case the stale entry is also removed).
 */
export function loadDraft<T>(id: string): LoadedDraft<T> | null {
  const store = getStore();
  if (!store) return null;

  const raw = store.getItem(keyFor(id));
  if (raw === null) return null;

  try {
    const env = JSON.parse(raw) as Envelope<T>;
    if (
      typeof env !== "object" ||
      env === null ||
      env.v !== VERSION ||
      typeof env.savedAt !== "number"
    ) {
      store.removeItem(keyFor(id));
      return null;
    }
    return { data: env.data, savedAt: env.savedAt };
  } catch {
    store.removeItem(keyFor(id));
    return null;
  }
}

/**
 * Write a draft. Returns the savedAt timestamp on success, or null when
 * storage is unavailable or the write failed (e.g. quota exceeded) — callers
 * can surface an "unsaved" status without the app crashing.
 */
export function saveDraft<T>(id: string, data: T, now: number = Date.now()): number | null {
  const store = getStore();
  if (!store) return null;

  const env: Envelope<T> = { v: VERSION, savedAt: now, data };
  try {
    store.setItem(keyFor(id), JSON.stringify(env));
    return now;
  } catch {
    return null;
  }
}

/** Remove a draft (e.g. after a successful Finalize). No-op if absent. */
export function clearDraft(id: string): void {
  const store = getStore();
  if (!store) return;
  try {
    store.removeItem(keyFor(id));
  } catch {
    // ignore — best-effort cleanup
  }
}

/** List the ids of all drafts currently held in local storage. */
export function listDraftIds(): string[] {
  const store = getStore();
  if (!store) return [];

  const ids: string[] = [];
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key && key.startsWith(PREFIX)) {
      ids.push(key.slice(PREFIX.length));
    }
  }
  return ids;
}
