"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { initAnalytics, capturePageview } from "@/lib/observability/analytics";

/**
 * Initializes PostHog once on mount and emits a manual pageview on every App
 * Router navigation (there are no full page reloads to trigger autocapture's
 * pageview). All of this is a no-op when NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is unset.
 *
 * Init is purely client-side (no cookie/session read), so wrapping the root
 * layout does NOT force pages to render dynamically — the static marketing
 * pages stay static.
 */
function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    initAnalytics();
  }, []);

  useEffect(() => {
    if (!pathname) return;
    const qs = searchParams?.toString();
    capturePageview(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, searchParams]);

  return null;
}

export default function AnalyticsProvider() {
  // useSearchParams requires a Suspense boundary during static generation.
  return (
    <Suspense fallback={null}>
      <PageviewTracker />
    </Suspense>
  );
}
