"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const tabs = [
  {
    href: "/mockups",
    label: "Home",
    match: (p: string) => p === "/mockups",
    icon: (active: boolean) => (
      <svg className="w-5 h-5" fill={active ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
      </svg>
    ),
  },
  {
    href: "/mockups/mmg-session",
    label: "MMG",
    match: (p: string) => p.startsWith("/mockups/mmg-session"),
    icon: (active: boolean) => (
      <svg className="w-5 h-5" fill={active ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.773 4.773zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    href: "/mockups/gym-session",
    label: "Gym",
    match: (p: string) => p.startsWith("/mockups/gym-session"),
    icon: (active: boolean) => (
      <svg className="w-5 h-5" fill={active ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3.75h-1.5a1.5 1.5 0 00-1.5 1.5v13.5a1.5 1.5 0 001.5 1.5h1.5m10.5-16.5h1.5a1.5 1.5 0 011.5 1.5v13.5a1.5 1.5 0 01-1.5 1.5h-1.5M6.75 12h10.5M9 7.5v9m6-9v9" />
      </svg>
    ),
  },
];

export default function MockupsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-[#f8fafc] relative grain">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 text-xs font-bold text-white shadow-lg shadow-blue-500/20">
                KF
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-white" />
            </div>
            <div>
              <span className="text-base font-semibold tracking-tight text-gray-900">
                KFandra Track
              </span>
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 align-middle">
                Mockup
              </span>
            </div>
          </div>
          <Link
            href="/mockups/my-submissions"
            className="flex items-center gap-2 rounded-full border border-gray-200 px-2.5 py-1 hover:border-gray-300 hover:bg-gray-50 transition-colors"
            aria-label="My submissions"
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
              History
            </span>
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-[10px] font-semibold text-gray-600 ring-1 ring-gray-200">
              JK
            </div>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 pb-24 relative z-0">{children}</main>

      {/* Bottom Navigation — 3 tabs */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around py-1">
          {tabs.map((tab) => {
            const isActive = tab.match(pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className="relative flex flex-col items-center gap-1 px-6 py-2"
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute -top-px left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-blue-500"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className={isActive ? "text-blue-600" : "text-gray-400"}>
                  {tab.icon(isActive)}
                </span>
                <span className={`text-[10px] font-medium tracking-wide ${
                  isActive ? "text-blue-600" : "text-gray-400"
                }`}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
