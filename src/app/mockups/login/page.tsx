"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Mode = "login" | "register" | "pending";

export default function LoginMockup() {
  const [mode, setMode] = useState<Mode>("login");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#f8fafc] p-6">
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.08, 0.13, 0.08] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-blue-200 blur-[120px]"
        />
        <motion.div
          animate={{ scale: [1, 1.1, 1], opacity: [0.06, 0.1, 0.06] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-blue-100 blur-[120px]"
        />
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-8">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-500/20">
            <span className="font-[family-name:var(--font-display)] text-3xl font-black text-white">
              KF
            </span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-gray-900 tracking-tight">
              KFandra Track
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-medium">
              Working name &middot; KFANDRA to confirm
            </p>
          </div>
        </motion.div>

        <AnimatePresence initial={false}>
          {mode === "login" && (
            <motion.div
              key="login"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="w-full glass rounded-2xl p-5 space-y-4"
            >
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
                  Sign in
                </p>
                <h2 className="mt-1 text-base font-bold text-gray-900">Phone &amp; 4-digit PIN</h2>
              </div>
              <Field label="Phone number">
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="98xxxxxxxx"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm tabular-nums focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </Field>
              <Field label="4-digit PIN">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm tabular-nums tracking-[0.5em] text-center focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </Field>
              <Link
                href="/mockups"
                className="block w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-blue-400 active:scale-[0.98]"
              >
                Sign in
              </Link>
              <div className="flex items-center justify-between text-[11px]">
                <button
                  onClick={() => setMode("register")}
                  className="text-blue-600 font-semibold hover:text-blue-700"
                >
                  Create an account
                </button>
                <span className="text-gray-400">SMS OTP coming in V2</span>
              </div>
            </motion.div>
          )}

          {mode === "register" && (
            <motion.div
              key="register"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="w-full glass rounded-2xl p-5 space-y-4"
            >
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
                  Register
                </p>
                <h2 className="mt-1 text-base font-bold text-gray-900">
                  Self-register, KFANDRA approves
                </h2>
                <p className="mt-1 text-[11px] text-gray-500">
                  KFANDRA gets a notification and approves you before you can submit.
                </p>
              </div>
              <Field label="Name (player nickname)">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acid"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </Field>
              <Field label="Phone number">
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="98xxxxxxxx"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm tabular-nums focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </Field>
              <Field label="Choose a 4-digit PIN">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm tabular-nums tracking-[0.5em] text-center focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </Field>
              <button
                onClick={() => setMode("pending")}
                className="block w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-blue-400 active:scale-[0.98]"
              >
                Send to KFANDRA for approval
              </button>
              <button
                onClick={() => setMode("login")}
                className="block w-full text-[11px] text-gray-500 hover:text-gray-700 font-semibold"
              >
                ← Back to sign-in
              </button>
            </motion.div>
          )}

          {mode === "pending" && (
            <motion.div
              key="pending"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="w-full glass rounded-2xl p-6 text-center space-y-4"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 250, damping: 18 }}
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 border border-amber-200"
              >
                <svg className="h-8 w-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </motion.div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-amber-700 font-semibold">
                  Pending KFANDRA approval
                </p>
                <h2 className="mt-1 text-lg font-bold text-gray-900">
                  Sit tight, {name || "player"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  KFANDRA gets a notification and usually approves within a day. You&rsquo;ll be able to log in once approved.
                </p>
              </div>
              <button
                onClick={() => setMode("login")}
                className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Back to sign-in
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-[10px] text-gray-400 italic">
          &ldquo;Respect, Trust, Integrity, Passion &amp; Humility&rdquo;
          <br />
          <span className="not-italic tracking-wide">KFANDRA &middot; Est. 2000 &middot; Pune, India</span>
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
