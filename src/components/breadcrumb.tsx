import Link from "next/link";

/**
 * Top-of-page breadcrumb: "‹ KFANDRA › <label>", where KFANDRA links home.
 *
 * Exists primarily so iPhone standalone-PWA users — who have no browser back
 * button or address bar — can always get back to the home screen. Rendered
 * above each mode's entry form (gym / diet / mmg). Server-compatible (just
 * Link + text), so it needs no "use client".
 */
export function Breadcrumb({ label }: { label: string }) {
  return (
    <nav aria-label="Breadcrumb" className="mx-auto max-w-md px-5 pt-4">
      <ol className="flex items-center gap-1.5 text-[12px]">
        <li>
          <Link
            href="/"
            className="font-semibold text-gray-500 hover:text-gray-800"
          >
            ‹ KFANDRA
          </Link>
        </li>
        <li aria-hidden className="text-gray-300">
          ›
        </li>
        <li className="font-medium text-gray-700">{label}</li>
      </ol>
    </nav>
  );
}
