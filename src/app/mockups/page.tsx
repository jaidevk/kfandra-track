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

const quickStats = [
  { label: "MMG Points", value: "15,700", sub: "+2,800 this week", accent: "text-blue-400" },
  { label: "Rank", value: "#4", sub: "of 13 players", accent: "text-amber-400" },
  { label: "Club Balance", value: "120 Kr", sub: "Cicada Baby's", accent: "text-emerald-400" },
];

const upcomingSessions = [
  { day: "TUE", date: "15", month: "Apr" },
  { day: "THU", date: "17", month: "Apr" },
  { day: "SAT", date: "19", month: "Apr" },
];

const recentActivity = [
  { action: "Points submitted", detail: "Thu 9/4 — 2,100 pts", icon: "+" },
  { action: "Match played", detail: "CB vs PB — Won 3-2", icon: "W" },
  { action: "Confirmed", detail: "Tue 7/4 — 1st to confirm", icon: "1" },
];

export default function MockupHome() {
  return (
    <motion.div
      className="flex flex-col gap-5 p-5"
      variants={stagger}
      initial="hidden"
      animate="show"
    >
      {/* Welcome Hero */}
      <motion.div variants={fadeUp} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 p-6">
        <div className="absolute top-0 right-0 w-40 h-40 bg-blue-400/10 rounded-full -translate-y-1/2 translate-x-1/4 blur-2xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-400/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />
        <div className="relative z-10">
          <p className="text-sm font-medium text-blue-200/70 tracking-wide">Good morning</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold text-white tracking-tight">
            Acid
          </h1>
          <p className="mt-2 text-sm text-blue-200/50 italic">
            &ldquo;Respect, Trust, Integrity, Passion & Humility&rdquo;
          </p>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <motion.div variants={fadeUp} className="grid grid-cols-3 gap-3">
        {quickStats.map((stat) => (
          <div
            key={stat.label}
            className="glass rounded-xl p-3.5 group hover:border-white/10 transition-colors"
          >
            <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
              {stat.label}
            </p>
            <p className={`mt-1.5 text-2xl font-bold tabular-nums ${stat.accent}`}>
              {stat.value}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-500">{stat.sub}</p>
          </div>
        ))}
      </motion.div>

      {/* Upcoming Sessions */}
      <motion.div variants={fadeUp}>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Upcoming Sessions
        </h2>
        <div className="flex gap-3">
          {upcomingSessions.map((session, i) => (
            <div
              key={i}
              className={`flex-1 glass rounded-xl p-4 text-center transition-all hover:border-blue-500/30 ${
                i === 0 ? "glow-blue border-blue-500/20" : ""
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
                {session.day}
              </p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold text-white">
                {session.date}
              </p>
              <p className="text-xs text-slate-500">{session.month}</p>
              {i === 0 && (
                <div className="mt-2 rounded-full bg-blue-500/10 px-2 py-0.5">
                  <span className="text-[10px] font-medium text-blue-400">Next</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 gap-3">
        <Link
          href="/mockups/mmg-session"
          className="group glass rounded-xl p-4 hover:border-blue-500/30 transition-all"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
          <p className="mt-3 text-sm font-semibold text-white">Submit MMG</p>
          <p className="text-[11px] text-slate-500">Enter session points</p>
        </Link>
        <Link
          href="/mockups/klc-balance"
          className="group glass rounded-xl p-4 hover:border-emerald-500/30 transition-all"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
            </svg>
          </div>
          <p className="mt-3 text-sm font-semibold text-white">Balance Sheet</p>
          <p className="text-[11px] text-slate-500">View club finances</p>
        </Link>
      </motion.div>

      {/* Recent Activity */}
      <motion.div variants={fadeUp}>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-500">
          Recent Activity
        </h2>
        <div className="glass rounded-xl overflow-hidden divide-y divide-white/[0.04]">
          {recentActivity.map((item, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-xs font-bold text-slate-400">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200">{item.action}</p>
                <p className="text-[11px] text-slate-500">{item.detail}</p>
              </div>
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500/50" />
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
