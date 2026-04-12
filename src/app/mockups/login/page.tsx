"use client";

import { motion } from "framer-motion";

export default function LoginMockup() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#f8fafc] p-6">
      {/* Animated background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.08, 0.13, 0.08],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-blue-200 blur-[120px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.06, 0.1, 0.06],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
          className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-blue-100 blur-[120px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.04, 0.08, 0.04],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 4,
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-indigo-200 blur-[100px]"
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-8">
        {/* Logo & Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <motion.div
              animate={{
                boxShadow: [
                  "0 0 20px rgba(37,99,235,0.15), 0 0 60px rgba(37,99,235,0.05)",
                  "0 0 30px rgba(37,99,235,0.25), 0 0 80px rgba(37,99,235,0.1)",
                  "0 0 20px rgba(37,99,235,0.15), 0 0 60px rgba(37,99,235,0.05)",
                ],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700"
            >
              <span className="font-[family-name:var(--font-display)] text-3xl font-black text-white">
                KF
              </span>
            </motion.div>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-gray-900 tracking-tight">
              KFandra Track
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-medium">
              Club Management Platform
            </p>
          </div>
        </motion.div>

        {/* Auth Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
          className="w-full space-y-3"
        >
          {/* Google */}
          <div className="glass rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-3">
              Continue with
            </p>
            <button className="flex w-full items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98]">
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 px-1">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-[10px] uppercase tracking-widest text-gray-400">
              or
            </span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          {/* Magic Link */}
          <div className="glass rounded-2xl p-4 space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
              Magic Link
            </p>
            <input
              type="email"
              placeholder="player@kfandra.com"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
            <button className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-blue-400 active:scale-[0.98]">
              Send Magic Link
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 px-1">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-[10px] uppercase tracking-widest text-gray-400">
              or
            </span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          {/* Password */}
          <div className="glass rounded-2xl p-4 space-y-3">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
              Email &amp; Password
            </p>
            <input
              type="email"
              placeholder="Email"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
            <button className="w-full rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-600 transition-all hover:bg-blue-100 hover:border-blue-400 active:scale-[0.98]">
              Sign In
            </button>
          </div>
        </motion.div>

        {/* Footer motto */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-center text-xs text-gray-400 italic"
        >
          &ldquo;Respect, Trust, Integrity, Passion &amp; Humility&rdquo;
          <br />
          <span className="not-italic text-[10px] text-gray-400 tracking-wide">
            KFANDRA Football Club · Est. 2000 · Pune, India
          </span>
        </motion.p>
      </div>
    </div>
  );
}
