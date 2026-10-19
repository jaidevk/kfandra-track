"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * False in the server render (and the hydration pass that matches it), true
 * from the first client render after that.
 *
 * Forms expose it as `data-hydrated` so the e2e suite can wait for React to
 * own the inputs before filling them: a value typed into server HTML is reset
 * to the initial state when a controlled input hydrates.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
