/**
 * The list route's inline error note.
 *
 * `PhaseNotice` — the Phase 2 "mechanics only" banner — lived here too and is
 * gone: Phase 3 removed it from both recorder routes. The recorder route has
 * its own copy of `ErrorNote` in `[id]/recorder-shared.tsx`, following this
 * repo's per-feature convention rather than a shared component.
 */

/** An inline `ActionResult.error`. The messages are written for humans; show them verbatim. */
export function ErrorNote({ message, testId }: { message: string | null; testId?: string }) {
  if (!message) return null;
  return (
    <p
      data-testid={testId}
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[12px] font-medium text-red-800"
    >
      {message}
    </p>
  );
}
