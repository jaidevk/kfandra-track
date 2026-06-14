import Link from "next/link";
import { requireStaff } from "@/lib/auth/guard";
import { strings } from "@/content/strings";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const player = await requireStaff();
  const { admin } = strings;
  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
            {admin.subtitle}
          </p>
          <Link href="/admin" className="text-xl font-bold text-gray-900 hover:underline">
            {admin.title}
          </Link>
        </div>
        <div className="text-right text-[11px] text-gray-600">
          <p className="font-semibold text-gray-700">{player.displayName}</p>
          <Link href="/" className="hover:underline">
            {admin.backToApp}
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
