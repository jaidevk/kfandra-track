/**
 * The Phase 2 banner. Deliberately loud: this UI is scaffolding for the
 * mechanics, and Phase 3 throws the visuals away. Shared by both recorder
 * routes so the wording cannot drift between them.
 */
export function PhaseNotice() {
  return (
    <p
      data-testid="phase2-notice"
      className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-900"
    >
      Phase 2 placeholder — mechanics only. The real recorder UI lands in Phase 3.
    </p>
  );
}

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
