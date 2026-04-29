"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
};

const upcomingSessions = [
  { day: "TUE", date: "28", month: "Apr", label: "Next" },
  { day: "THU", date: "30", month: "Apr" },
  { day: "SAT", date: "02", month: "May" },
];

export default function MockupHome() {
  return (
    <motion.div
      className="flex flex-col gap-5 p-5"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* Welcome */}
      <motion.div variants={fadeUp} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 p-6">
        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-400/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-2xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-400/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
        <div className="relative z-10">
          <p className="text-sm font-medium text-blue-200/70 tracking-wide">Good morning</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold text-white tracking-tight">
            Acid
          </h1>
          <p className="mt-2 text-sm text-blue-200/50 italic">
            Tap a tile below to log today&rsquo;s session.
          </p>
        </div>
      </motion.div>

      {/* Two-tile launchpad */}
      <motion.div variants={fadeUp} className="grid grid-cols-1 gap-3">
        <Link
          href="/mockups/mmg-session"
          className="group relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm hover:border-blue-200 hover:shadow-md transition-all p-5"
        >
          <div className="absolute right-0 top-0 h-24 w-24 -translate-y-6 translate-x-6 rounded-full bg-blue-50 group-hover:bg-blue-100 transition-colors" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-500/20">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Tap to enter</p>
              <h2 className="mt-0.5 font-[family-name:var(--font-display)] text-2xl font-bold text-gray-900">
                MMG Score
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Calculator-style — tap buttons, submit to Coach
              </p>
            </div>
            <svg className="w-5 h-5 shrink-0 text-gray-300 group-hover:text-blue-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </Link>

        <Link
          href="/mockups/gym-session"
          className="group relative overflow-hidden rounded-2xl bg-white border border-gray-100 shadow-sm hover:border-emerald-200 hover:shadow-md transition-all p-5"
        >
          <div className="absolute right-0 top-0 h-24 w-24 -translate-y-6 translate-x-6 rounded-full bg-emerald-50 group-hover:bg-emerald-100 transition-colors" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-500/20">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3.75h-1.5a1.5 1.5 0 00-1.5 1.5v13.5a1.5 1.5 0 001.5 1.5h1.5m10.5-16.5h1.5a1.5 1.5 0 011.5 1.5v13.5a1.5 1.5 0 01-1.5 1.5h-1.5M6.75 12h10.5M9 7.5v9m6-9v9" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">Tap to enter</p>
              <h2 className="mt-0.5 font-[family-name:var(--font-display)] text-2xl font-bold text-gray-900">
                Gym Performance
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Pick body part &rarr; log sets &amp; reps &rarr; submit
              </p>
            </div>
            <svg className="w-5 h-5 shrink-0 text-gray-300 group-hover:text-emerald-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </Link>
      </motion.div>

      {/* Upcoming sessions (informational only — sourced from sheet in V1) */}
      <motion.div variants={fadeUp}>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
          Upcoming sessions
        </h2>
        <div className="flex gap-3">
          {upcomingSessions.map((session, i) => (
            <div
              key={i}
              className={`flex-1 bg-white rounded-xl p-4 text-center border transition-all ${
                i === 0 ? "glow-blue border-blue-200 shadow-sm shadow-blue-500/10" : "border-gray-100 shadow-sm"
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">
                {session.day}
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold text-gray-900">
                {session.date}
              </p>
              <p className="text-xs text-gray-400">{session.month}</p>
              {session.label && (
                <div className="mt-2 rounded-full bg-blue-50 px-2 py-0.5">
                  <span className="text-[10px] font-medium text-blue-600">{session.label}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* My recent submissions — read-only summary */}
      <motion.div variants={fadeUp}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            My recent submissions
          </h2>
          <Link href="/mockups/my-submissions" className="text-[10px] font-semibold uppercase tracking-wide text-blue-600 hover:text-blue-700">
            View all
          </Link>
        </div>
        <div className="bg-white rounded-xl overflow-hidden divide-y divide-gray-100 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 text-xs font-bold">
              MMG
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700">Tue 28/4 &mdash; Fooba (Big Goal)</p>
              <p className="text-[11px] text-gray-400">Submitted 11:42 am &middot; awaiting Coach</p>
            </div>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Pending</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 text-xs font-bold">
              GYM
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700">Mon 27/4 &mdash; Shoulders + Biceps</p>
              <p className="text-[11px] text-gray-400">Approved by Coach &middot; 4:08 pm</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Approved</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 text-xs font-bold">
              MMG
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700">Sat 25/4 &mdash; Short Game</p>
              <p className="text-[11px] text-gray-400">Coach edited 200 &rarr; 100 &middot; Approved</p>
            </div>
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Edited</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
