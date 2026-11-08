"use client";

import Link from "next/link";
import { useState } from "react";
import { useHydrated } from "@/hooks/use-hydrated";
import { fmtDayDate } from "@/lib/format-date";
import type { DuplicateCandidate } from "@/lib/klcsra/duplicates";
import { statusLabel } from "@/lib/klcsra/match-status";

/**
 * "Another match between these clubs that day" (spec §4). It warns and never
 * blocks. "This is a different match" hides it for this viewer only, in
 * localStorage. That's a convenience; nothing depends on it.
 */
export function DuplicateBanner({
  matchId,
  duplicates,
}: {
  matchId: string;
  duplicates: DuplicateCandidate[];
}) {
  const key = `klc-dup-dismissed:${matchId}`;
  const hydrated = useHydrated();
  const [dismissedNow, setDismissedNow] = useState(false);
  const stored = hydrated && readFlag(key);
  if (duplicates.length === 0 || dismissedNow || stored) return null;

  return (
    <div
      data-testid="duplicate-banner"
      className="space-y-1.5 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-900"
    >
      {duplicates.map((d) => (
        <p key={d.id}>
          {d.homeLabel} vs {d.awayLabel} already has a match on {fmtDayDate(d.entryDate)} (
          {statusLabel(d)}).{" "}
          <Link href={`/klc/matches/${d.id}`} data-testid="duplicate-open" className="font-bold underline">
            Open it
          </Link>
        </p>
      ))}
      <button
        type="button"
        data-testid="duplicate-dismiss"
        onClick={() => {
          setDismissedNow(true);
          try {
            localStorage.setItem(key, "1");
          } catch {
            /* private mode: the in-memory flag is enough */
          }
        }}
        className="font-semibold underline"
      >
        This is a different match
      </button>
    </div>
  );
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
