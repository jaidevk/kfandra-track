"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { loginAction, registerAction, type AuthResult } from "@/lib/auth/actions";
import {
  AnalyticsEvent,
  capture,
  identifyPlayer,
} from "@/lib/observability/analytics";

type Mode = "login" | "register";

export default function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");

  const [loginState, login, loginPending] = useActionState<AuthResult | null, FormData>(
    loginAction,
    null,
  );
  const [registerState, register, registerPending] = useActionState<
    AuthResult | null,
    FormData
  >(registerAction, null);

  // On success the session cookie is set server-side; navigate to `next`.
  useEffect(() => {
    const success = loginState?.ok ? loginState : registerState?.ok ? registerState : null;
    if (!success) return;
    // Tie this anonymous session to the player (opaque UUID, no PII) and
    // record the auth event for funnel analysis.
    identifyPlayer(success.playerId, success.role);
    capture(
      success.isNew ? AnalyticsEvent.Registered : AnalyticsEvent.LoggedIn,
    );
    router.replace(next);
    router.refresh();
  }, [loginState, registerState, next, router]);

  const loginError = loginState && !loginState.ok ? loginState.error : null;
  const registerError = registerState && !registerState.ok ? registerState.error : null;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#f8fafc] p-6">
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
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white ring-1 ring-gray-200 shadow-lg shadow-blue-500/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/kfandra-logo.png"
              alt="KFANDRA"
              className="h-14 w-14 object-contain"
            />
          </div>
          <div className="flex flex-col items-center gap-1">
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-black text-gray-900 tracking-tight">
              KMMGAFDRA
            </h1>
            <p className="mt-1 text-center text-[10px] uppercase tracking-widest text-gray-400 font-medium">
              KFANDRA&rsquo;s Monthly Multi-Game, Fitness &amp; Diet Recording App
            </p>
          </div>
        </motion.div>

        <AnimatePresence initial={false} mode="wait">
          {mode === "login" ? (
            <motion.form
              key="login"
              action={login}
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
                <h2 className="mt-1 text-base font-bold text-gray-900">
                  Phone &amp; 4-digit PIN
                </h2>
              </div>
              <Field label="Phone number">
                <input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  placeholder="98xxxxxxxx"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm tabular-nums focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </Field>
              <Field label="4-digit PIN">
                <PinInput />
              </Field>
              {loginError && <ErrorNote>{loginError}</ErrorNote>}
              <SubmitButton pending={loginPending}>Sign in</SubmitButton>
              <div className="flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className="text-blue-600 font-semibold hover:text-blue-700"
                >
                  Create an account
                </button>
                <span className="text-gray-400">SMS OTP coming in V2</span>
              </div>
            </motion.form>
          ) : (
            <motion.form
              key="register"
              action={register}
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
                  Create your account
                </h2>
                <p className="mt-1 text-[11px] text-gray-500">
                  No approval needed — you&rsquo;re in as soon as you register.
                </p>
              </div>
              <Field label="Name (player nickname)">
                <input
                  name="name"
                  type="text"
                  autoComplete="nickname"
                  required
                  maxLength={40}
                  placeholder="Your nickname"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </Field>
              <Field label="Phone number">
                <input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  placeholder="98xxxxxxxx"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm tabular-nums focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </Field>
              <Field label="Choose a 4-digit PIN">
                <PinInput />
              </Field>
              {registerError && <ErrorNote>{registerError}</ErrorNote>}
              <SubmitButton pending={registerPending}>Create account</SubmitButton>
              <button
                type="button"
                onClick={() => setMode("login")}
                className="block w-full text-[11px] text-gray-500 hover:text-gray-700 font-semibold"
              >
                ← Back to sign-in
              </button>
            </motion.form>
          )}
        </AnimatePresence>

        <p className="text-center text-[10px] text-gray-400 italic">
          &ldquo;Respect, Trust, Integrity, Passion &amp; Humility&rdquo;
          <br />
          <span className="not-italic tracking-wide">
            KFANDRA &middot; Est. 2000 &middot; Pune, India
          </span>
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

function PinInput() {
  const [pin, setPin] = useState("");
  return (
    <input
      name="pin"
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={4}
      required
      value={pin}
      onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
      placeholder="••••"
      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm tabular-nums tracking-[0.5em] text-center focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
    />
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700"
    >
      {children}
    </p>
  );
}

function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="block w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-blue-400 active:scale-[0.98] disabled:opacity-60"
    >
      {pending ? "Please wait…" : children}
    </button>
  );
}
