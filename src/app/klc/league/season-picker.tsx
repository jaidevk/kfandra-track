"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A native `<details>` that also closes on Escape, on a tap outside it, and
 * when one of its links is followed (a client-side navigation keeps the DOM
 * node, so `open` would otherwise survive the season change).
 */
export function DismissibleDetails({
  children, className, testId,
}: { children: ReactNode; className?: string; testId?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const close = () => {
      if (ref.current?.open) ref.current.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !ref.current?.open) return;
      close();
      ref.current.querySelector("summary")?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  return (
    <details
      ref={ref}
      data-testid={testId}
      className={className}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) ref.current!.open = false;
      }}
    >
      {children}
    </details>
  );
}
