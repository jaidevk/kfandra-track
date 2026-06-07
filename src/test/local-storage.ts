/**
 * In-memory localStorage stand-in for unit tests. This jsdom setup does not
 * expose a real `window.localStorage`, so tests that exercise draft persistence
 * install this mock via `installLocalStorageMock()` in a beforeEach.
 */

class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

/**
 * Install a fresh in-memory localStorage on both `window` and `globalThis`.
 * Returns the store so tests can assert on it directly if needed.
 */
export function installLocalStorageMock(): Storage {
  const store = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: store,
    configurable: true,
    writable: true,
  });
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", {
      value: store,
      configurable: true,
      writable: true,
    });
  }
  return store;
}
