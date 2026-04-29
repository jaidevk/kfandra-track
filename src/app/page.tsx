"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function Home() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-blue-600 via-blue-700 to-indigo-900 px-6 py-16">
      {/* Background gradient layers */}
      <div className="pointer-events-none absolute inset-0">
        {/* Blue glow top-left */}
        <motion.div
          animate={{ scale: [1, 1.12, 1], opacity: [0.2, 0.35, 0.2] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-300 blur-[140px]"
        />
        {/* Blue glow bottom-right */}
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.28, 0.15] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 3 }}
          className="absolute -bottom-40 -right-40 h-[400px] w-[400px] rounded-full bg-blue-400 blur-[130px]"
        />
        {/* Center subtle indigo */}
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.18, 0.1] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut", delay: 5 }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[300px] w-[300px] rounded-full bg-indigo-300 blur-[100px]"
        />
      </div>

      {/* Grain overlay */}
      <div className="grain pointer-events-none absolute inset-0" />

      {/* Floating background elements */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            animate={{ y: [0, -20, 0], opacity: [0.05, 0.1, 0.05] }}
            transition={{
              duration: 6 + i * 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 2,
            }}
            className="absolute rounded-full border border-white/20"
            style={{
              width: 120 + i * 80,
              height: 120 + i * 80,
              left: `${15 + i * 30}%`,
              top: `${20 + i * 20}%`,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <main className="relative z-10 flex w-full max-w-md flex-col items-center gap-10 text-center">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col items-center gap-5"
        >
          <motion.div
            animate={{
              boxShadow: [
                "0 0 24px rgba(255,255,255,0.2), 0 0 60px rgba(255,255,255,0.08)",
                "0 0 40px rgba(255,255,255,0.35), 0 0 90px rgba(255,255,255,0.15)",
                "0 0 24px rgba(255,255,255,0.2), 0 0 60px rgba(255,255,255,0.08)",
              ],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white/20 backdrop-blur-sm border border-white/30"
          >
            <span className="font-[family-name:var(--font-display)] text-4xl font-black text-white">
              KF
            </span>
          </motion.div>

          <div className="flex flex-col items-center gap-2">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-[10px] uppercase tracking-widest text-blue-100/70 font-semibold"
            >
              KFANDRA
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="font-[family-name:var(--font-display)] text-5xl font-black text-white leading-none tracking-tight"
            >
              KFandra
              <br />
              <span className="text-blue-200">Track</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="text-sm text-blue-100/60 italic"
            >
              Respect, Trust, Integrity, Passion &amp; Humility
            </motion.p>
          </div>
        </motion.div>

        {/* Floating Feature Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="grid grid-cols-2 gap-3 w-full"
        >
          <motion.div
            whileHover={{ y: -3, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="bg-white/20 backdrop-blur rounded-2xl p-4 text-left border border-white/30"
          >
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 border border-white/30">
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.773 4.773zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-sm font-bold text-white mb-0.5">MMG</h2>
            <p className="text-[11px] text-blue-100/70 leading-relaxed">
              Tap-to-add points &middot; submit to KFANDRA
            </p>
          </motion.div>

          <motion.div
            whileHover={{ y: -3, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="bg-white/20 backdrop-blur rounded-2xl p-4 text-left border border-white/30"
          >
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400/30 border border-emerald-300/40">
              <svg className="h-4 w-4 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3.75h-1.5a1.5 1.5 0 00-1.5 1.5v13.5a1.5 1.5 0 001.5 1.5h1.5m10.5-16.5h1.5a1.5 1.5 0 011.5 1.5v13.5a1.5 1.5 0 01-1.5 1.5h-1.5M6.75 12h10.5M9 7.5v9m6-9v9" />
              </svg>
            </div>
            <h2 className="text-sm font-bold text-white mb-0.5">Gym</h2>
            <p className="text-[11px] text-blue-100/70 leading-relaxed">
              Body part &rarr; sets &amp; reps &middot; submit to KFANDRA
            </p>
          </motion.div>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.5 }}
          className="flex flex-col gap-3 w-full"
        >
          <Link href="/mockups" className="group block w-full">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              animate={{
                boxShadow: [
                  "0 0 16px rgba(255,255,255,0.2), 0 4px 24px rgba(255,255,255,0.1)",
                  "0 0 28px rgba(255,255,255,0.35), 0 4px 32px rgba(255,255,255,0.2)",
                  "0 0 16px rgba(255,255,255,0.2), 0 4px 24px rgba(255,255,255,0.1)",
                ],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="w-full rounded-2xl bg-white px-6 py-4 text-sm font-bold text-blue-700"
            >
              <span className="flex items-center justify-center gap-2">
                View UI Mockups
                <motion.svg
                  animate={{ x: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </motion.svg>
              </span>
            </motion.div>
          </Link>

          <Link href="/mockups/login" className="block w-full">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full rounded-2xl border border-white/[0.25] bg-white/[0.1] px-6 py-3.5 text-sm font-semibold text-white/80 text-center transition-all hover:bg-white/[0.18] hover:text-white hover:border-white/[0.4]"
            >
              Login Preview
            </motion.div>
          </Link>
        </motion.div>

        {/* Footer label */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.6 }}
          className="text-[10px] uppercase tracking-widest text-blue-100/50 font-medium"
        >
          KFANDRA · Est. 2000 · Pune, India
        </motion.p>
      </main>
    </div>
  );
}
