import "server-only";
import { PostHog } from "posthog-node";
import { logServerError } from "@/lib/observability/log";

/**
 * Server-side PostHog (posthog-node). Mirrors the client wrapper's contract:
 * everything is a SAFE NO-OP when NEXT_PUBLIC_POSTHOG_KEY is unset, and a
 * failure to send analytics must NEVER break the request that triggered it
 * (auth, in particular). So the getter returns null instead of throwing, and
 * `captureServerEvent` swallows errors.
 */

let posthogClient: PostHog | null = null;

export function getPostHogClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return null;
  if (!posthogClient) {
    posthogClient = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      // Serverless: send each event eagerly. We still `await flush()` at the
      // call site so the request doesn't freeze before the event leaves.
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthogClient;
}

type Props = Record<string, string | number | boolean | null | undefined>;

/**
 * Identify (optional) + capture a single server-side event, then flush so the
 * event is actually sent before the serverless function can freeze. No-ops
 * without a key; never throws.
 */
export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Props,
  identifyProps?: Props,
): Promise<void> {
  const client = getPostHogClient();
  if (!client) return;
  try {
    if (identifyProps) {
      client.identify({ distinctId, properties: identifyProps });
    }
    client.capture({ distinctId, event, properties });
    await client.flush();
  } catch (err) {
    // Analytics is best-effort — log and move on, never surface to the caller.
    logServerError("analytics.server_capture_failed", err);
  }
}
