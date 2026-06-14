import Link from "next/link";
import { strings } from "@/content/strings";

export default function AdminDashboard() {
  const { admin } = strings;
  const cards = [
    { href: "/admin/submissions", ...admin.mmgCard },
    { href: "/admin/gym", ...admin.gymCard },
    { href: "/admin/diet", ...admin.dietCard },
    { href: "/admin/config", ...admin.configCard },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((c) => (
        <Link
          key={c.href}
          href={c.href}
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-gray-300"
        >
          <h2 className="text-base font-bold text-gray-900">{c.title}</h2>
          <p className="mt-1 text-sm text-gray-600">{c.subtitle}</p>
        </Link>
      ))}
    </div>
  );
}
