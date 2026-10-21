"use client";

import type { ClubOption, SideKey } from "@/lib/klcsra/types";

/**
 * Small pieces shared by the five recorder screens. Deliberately local to the
 * recorder route: this repo duplicates the sync-badge / error-note pattern
 * per feature (`club-balance-entry.tsx`, `diet-entry.tsx`, `mmg-entry.tsx`)
 * rather than extracting a shared one, and Phase 3 follows that convention.
 */

/** Structural shape of every `ActionResult`; `data` is not needed in the UI. */
export type Result = { ok: true } | { ok: false; error: string };

/** Autosave status, mirroring `club-balance-entry.tsx:12`. */
export type SyncStatus = "idle" | "saving" | "saved" | "error";

/**
 * A club plus the player who manages it.
 *
 * `klcsra`'s own `ClubOption` carries only the manager's NAME, which is free
 * text and cannot address a player row — so the id is joined on in
 * `page.tsx` (via `@/lib/klc/repository`, which already selects it) purely so
 * the recorder can auto-place a manager into slot 1. It is nullable because a
 * real club ("Deep Waters") has no manager account.
 */
export interface RecorderClub extends ClubOption {
  managerPlayerId: string | null;
}

export const SIDES: readonly SideKey[] = ["home", "away"];
export const SIDE_LABELS: Record<SideKey, string> = { home: "Home", away: "Away" };

/** Six fixed slots per team; a 7th+ player appends below the grid. */
export const SQUAD_SLOTS = 6;

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

/** Autosave affordance. Copy of the per-feature `SyncBadge` convention. */
export function SyncBadge({ status }: { status: SyncStatus }) {
  const label =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "Autosaved ✓"
        : status === "error"
          ? "Not saved — check below"
          : "Autosaves";
  const color =
    status === "error"
      ? "text-red-600"
      : status === "saved"
        ? "text-green-600"
        : "text-gray-500";
  return (
    <span
      data-testid="sync-badge"
      data-sync-status={status}
      className={`shrink-0 text-[11px] font-semibold ${color}`}
    >
      {label}
    </span>
  );
}

/** A small rounded label. */
export function Tag({
  children,
  testId,
  tone = "blue",
}: {
  children: React.ReactNode;
  testId?: string;
  tone?: "blue" | "gray" | "amber" | "green";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-800",
    gray: "bg-gray-100 text-gray-700",
    amber: "bg-amber-100 text-amber-900",
    green: "bg-green-100 text-green-800",
  } as const;
  return (
    <span
      data-testid={testId}
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** `+45` / `−20` / `0`, using a real minus sign. */
export function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return "0";
}

/**
 * UTC, formatted identically on the server and in the browser. A locale-aware
 * format would hydrate differently whenever the two disagree on timezone.
 */
export function fmtStamp(iso: string): string {
  return `${new Date(iso).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
