/**
 * Minimal structured server-side logging.
 *
 * Next.js server actions/components run on the server; `console.error` here
 * lands in the platform's runtime logs (Vercel Functions logs locally and in
 * production). Until we wire a dedicated error-tracking sink, this is how a
 * failure leaves a trace instead of being swallowed into a generic user
 * message. Keep the shape stable (event + context) so logs stay greppable.
 */

type LogContext = Record<string, unknown>;

/** Pull the safe, useful bits out of an unknown error/Supabase error shape. */
function describeError(err: unknown): LogContext {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    return {
      message: e.message ?? String(err),
      // PostgREST/Supabase errors carry these — invaluable for diagnosis.
      code: e.code,
      details: e.details,
      hint: e.hint,
      status: e.status,
    };
  }
  return { message: String(err) };
}

/**
 * Log a server-side error with a stable event name and structured context.
 * Never throws and never includes PII supplied by the caller unless they pass
 * it in `context` — callers must keep phone numbers / PINs out of `context`.
 */
export function logServerError(
  event: string,
  err: unknown,
  context: LogContext = {},
): void {
  // Single line, JSON-tagged, so it is easy to find in log explorers.
  console.error(
    `[jacaranda:error] ${event}`,
    JSON.stringify({ event, ...context, error: describeError(err) }),
  );
}
