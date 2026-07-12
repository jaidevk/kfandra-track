import Link from "next/link";

/**
 * Breadcrumb: "‹ KFANDRA › <label>", where KFANDRA links home.
 *
 * Exists primarily so iPhone standalone-PWA users — who have no browser back
 * button or address bar — can always get back to the home screen. Rendered
 * inside each mode's entry form, left-aligned in the gap between the header
 * card and the main section. No positioning of its own — the parent's
 * container controls width/padding so it lines up flush-left with the cards.
 */
export function Breadcrumb({ label }: { label: string }) {
  return (
    <nav aria-label="Breadcrumb">
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
