"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/mockups", label: "Home", icon: "🏠" },
  { href: "/mockups/mmg-session", label: "MMG", icon: "⚽" },
  { href: "/mockups/mmg-standings", label: "Standings", icon: "🏆" },
  { href: "/mockups/klc-league", label: "League", icon: "📊" },
  { href: "/mockups/klc-balance", label: "Balance", icon: "💰" },
];

export default function MockupsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Top Header */}
      <header className="sticky top-0 z-50 border-b bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              KF
            </div>
            <span className="text-lg font-semibold text-gray-900">
              KFandra Track
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Apr 2026</span>
            <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
              JK
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 pb-20">{children}</main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around">
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-2 text-xs ${
                  isActive
                    ? "text-blue-600 font-medium"
                    : "text-gray-500"
                }`}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
