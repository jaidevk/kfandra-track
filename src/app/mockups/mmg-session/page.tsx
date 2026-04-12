"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const confirmationOrder = [
  { rank: 1, player: "Abe", time: "5:45 AM", points: 800 },
  { rank: 2, player: "Acid", time: "5:50 AM", points: 700 },
  { rank: 3, player: "Ahjoo", time: "5:55 AM", points: 600 },
  { rank: 4, player: "Jake", time: "6:00 AM", points: 500 },
  { rank: 5, player: "Mkul", time: "6:02 AM", points: 400 },
  { rank: 6, player: "Seito", time: "6:05 AM", points: 300 },
  { rank: 7, player: "Goodman", time: "6:08 AM", points: 200 },
  { rank: 8, player: "Crank", time: "6:10 AM", points: 100 },
];

const packingItems = [
  { task: "GWW Unpacking", player: "Abe", points: 500 },
  { task: "GWW Packing", player: "Acid", points: 500 },
  { task: "Session Packing", player: "Jake", points: 200 },
];

const playerEvents = [
  { player: "Acid", event: "Goal", points: 500, icon: "⚽" },
  { player: "Acid", event: "Goal", points: 500, icon: "⚽" },
  { player: "Abe", event: "Assist", points: 200, icon: "👟" },
  { player: "Ahjoo", event: "Goal", points: 500, icon: "⚽" },
  { player: "Jake", event: "Save", points: 500, icon: "🧤" },
  { player: "Mkul", event: "Goal Line Clearance", points: 500, icon: "🛡️" },
  { player: "Seito", event: "Pre-Assist", points: 100, icon: "🔗" },
];

type Tab = "attendance" | "packing" | "game";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, delay: i * 0.06, ease: "easeOut" as const },
  }),
};

const tabContent = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2, ease: "easeIn" as const } },
};

export default function MMGSessionMockup() {
  const [activeTab, setActiveTab] = useState<Tab>("attendance");

  return (
    <div
      className="min-h-screen"
      style={{
        background: "#0a0f1c",
        fontFamily: "var(--font-body, 'DM Sans', sans-serif)",
      }}
    >
      <div className="flex flex-col gap-4 p-4 pb-8">

        {/* Session Header */}
        <motion.div
          initial="hidden"
          animate="visible"
          custom={0}
          variants={fadeUp}
          className="glass rounded-2xl p-5"
        >
          <div className="flex items-start justify-between">
            <div>
              <p
                className="uppercase tracking-widest text-slate-500 mb-1"
                style={{ fontSize: "10px" }}
              >
                MMG Session
              </p>
              <h1
                className="text-2xl font-bold text-white leading-tight"
                style={{ fontFamily: "var(--font-display, 'Playfair Display', serif)" }}
              >
                Thursday, 9 Apr 2026
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">6:10 – 7:30 AM</p>
            </div>
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold mt-1"
              style={{
                background: "rgba(52,211,153,0.12)",
                color: "#34d399",
                border: "1px solid rgba(52,211,153,0.25)",
              }}
            >
              Completed
            </span>
          </div>

          <div className="mt-4 flex gap-0 divide-x"
            style={{ borderColor: "rgba(255,255,255,0.06)" }}
          >
            <div className="flex-1 pr-4">
              <p
                className="text-3xl font-bold text-white tabular-nums"
                style={{ fontFamily: "var(--font-display, 'Playfair Display', serif)" }}
              >
                8
              </p>
              <p className="uppercase tracking-widest text-slate-500 mt-0.5" style={{ fontSize: "10px" }}>
                Players
              </p>
            </div>
            <div className="flex-1 pl-4">
              <p
                className="text-3xl font-bold tabular-nums"
                style={{
                  fontFamily: "var(--font-display, 'Playfair Display', serif)",
                  color: "#60a5fa",
                }}
              >
                24,800
              </p>
              <p className="uppercase tracking-widest text-slate-500 mt-0.5" style={{ fontSize: "10px" }}>
                Total Points
              </p>
            </div>
          </div>
        </motion.div>

        {/* Tab Selector */}
        <motion.div
          initial="hidden"
          animate="visible"
          custom={1}
          variants={fadeUp}
          className="flex rounded-xl p-1 gap-1"
          style={{
            background: "rgba(17,24,39,0.8)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {(["attendance", "packing", "game"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="relative flex-1 rounded-lg px-3 py-2.5 text-sm font-medium capitalize transition-colors"
              style={{
                color: activeTab === tab ? "#fff" : "#64748b",
              }}
            >
              {activeTab === tab && (
                <motion.span
                  layoutId="tab-pill"
                  className="absolute inset-0 rounded-lg"
                  style={{
                    background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                    boxShadow: "0 0 16px rgba(37,99,235,0.4)",
                  }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{tab}</span>
            </button>
          ))}
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === "attendance" && (
            <motion.div
              key="attendance"
              variants={tabContent}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex flex-col gap-3"
            >
              {/* Confirmation Order */}
              <div className="glass rounded-2xl p-4">
                <p
                  className="uppercase tracking-widest text-slate-500 mb-3"
                  style={{ fontSize: "10px" }}
                >
                  Confirmation Order
                </p>
                <div className="flex flex-col gap-2">
                  {confirmationOrder.map((entry, i) => (
                    <motion.div
                      key={entry.rank}
                      custom={i}
                      variants={fadeUp}
                      initial="hidden"
                      animate="visible"
                      className="flex items-center justify-between rounded-xl px-3 py-2.5"
                      style={{ background: "rgba(255,255,255,0.03)" }}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white tabular-nums flex-shrink-0"
                          style={{
                            background:
                              entry.rank <= 3
                                ? "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"
                                : "rgba(100,116,139,0.25)",
                            boxShadow:
                              entry.rank <= 3
                                ? "0 0 10px rgba(59,130,246,0.4)"
                                : "none",
                            color: entry.rank <= 3 ? "#fff" : "#94a3b8",
                          }}
                        >
                          {entry.rank}
                        </span>
                        <span className="text-sm font-medium text-slate-200">
                          {entry.player}
                        </span>
                      </div>
                      <div className="text-right">
                        <p
                          className="text-sm font-semibold tabular-nums"
                          style={{ color: "#60a5fa" }}
                        >
                          +{entry.points}
                        </p>
                        <p className="text-xs text-slate-500 tabular-nums">
                          {entry.time}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Early Bonus Banner */}
              <div
                className="rounded-2xl p-4"
                style={{
                  background: "rgba(37,99,235,0.1)",
                  border: "1px solid rgba(59,130,246,0.2)",
                }}
              >
                <p
                  className="uppercase tracking-widest text-blue-400 mb-1"
                  style={{ fontSize: "10px" }}
                >
                  Early Bonus
                </p>
                <p className="text-sm font-medium text-blue-300">
                  Early Confirmation Bonus (before 7:30 AM)
                </p>
                <p className="text-xs text-blue-400/70 mt-0.5">
                  6 players confirmed before 7:30 AM — +500 pts each
                </p>
              </div>
            </motion.div>
          )}

          {activeTab === "packing" && (
            <motion.div
              key="packing"
              variants={tabContent}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="glass rounded-2xl p-4"
            >
              <p
                className="uppercase tracking-widest text-slate-500 mb-3"
                style={{ fontSize: "10px" }}
              >
                Packing Points
              </p>
              <div className="flex flex-col gap-2">
                {packingItems.map((item, i) => (
                  <motion.div
                    key={i}
                    custom={i}
                    variants={fadeUp}
                    initial="hidden"
                    animate="visible"
                    className="flex items-center justify-between rounded-xl px-3 py-3"
                    style={{ background: "rgba(255,255,255,0.03)" }}
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-200">
                        {item.task}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.player}</p>
                    </div>
                    <span
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: "#34d399" }}
                    >
                      +{item.points}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "game" && (
            <motion.div
              key="game"
              variants={tabContent}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="flex flex-col gap-3"
            >
              {/* Match Result */}
              <div className="glass rounded-2xl p-4">
                <p
                  className="uppercase tracking-widest text-slate-500 mb-3"
                  style={{ fontSize: "10px" }}
                >
                  Fooba / Full Game
                </p>
                <div className="flex items-center justify-center gap-6 py-2">
                  <div className="text-center flex-1">
                    <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Team A</p>
                    <p
                      className="tabular-nums font-bold"
                      style={{
                        fontFamily: "var(--font-display, 'Playfair Display', serif)",
                        fontSize: "52px",
                        lineHeight: 1,
                        color: "#60a5fa",
                      }}
                    >
                      3
                    </p>
                  </div>
                  <div className="text-center">
                    <span className="text-slate-500 font-medium text-sm">vs</span>
                  </div>
                  <div className="text-center flex-1">
                    <p className="text-xs text-slate-400 uppercase tracking-widest mb-1">Team B</p>
                    <p
                      className="tabular-nums font-bold"
                      style={{
                        fontFamily: "var(--font-display, 'Playfair Display', serif)",
                        fontSize: "52px",
                        lineHeight: 1,
                        color: "#94a3b8",
                      }}
                    >
                      2
                    </p>
                  </div>
                </div>
                <div
                  className="mt-3 rounded-xl p-2.5 text-center"
                  style={{
                    background: "rgba(52,211,153,0.08)",
                    border: "1px solid rgba(52,211,153,0.15)",
                  }}
                >
                  <span className="text-sm font-medium" style={{ color: "#34d399" }}>
                    Team A wins — +1,000 pts each
                  </span>
                </div>
              </div>

              {/* Player Events */}
              <div className="glass rounded-2xl p-4">
                <p
                  className="uppercase tracking-widest text-slate-500 mb-3"
                  style={{ fontSize: "10px" }}
                >
                  Player Events — Big Goal
                </p>
                <div className="flex flex-col gap-2">
                  {playerEvents.map((stat, i) => (
                    <motion.div
                      key={i}
                      custom={i}
                      variants={fadeUp}
                      initial="hidden"
                      animate="visible"
                      className="flex items-center justify-between rounded-xl px-3 py-2.5"
                      style={{ background: "rgba(255,255,255,0.03)" }}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base leading-none">{stat.icon}</span>
                        <span className="text-sm font-medium text-slate-200">
                          {stat.player}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            background: "rgba(96,165,250,0.12)",
                            color: "#93c5fd",
                            border: "1px solid rgba(96,165,250,0.2)",
                          }}
                        >
                          {stat.event}
                        </span>
                      </div>
                      <span
                        className="text-sm font-semibold tabular-nums"
                        style={{ color: "#60a5fa" }}
                      >
                        +{stat.points}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Goals Conceded */}
              <div
                className="rounded-2xl p-4"
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.18)",
                }}
              >
                <p
                  className="uppercase tracking-widest mb-2"
                  style={{ fontSize: "10px", color: "#f87171" }}
                >
                  Goals Conceded
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🥅</span>
                    <span className="text-sm text-red-300">
                      Crank (GK) — 2 conceded
                    </span>
                  </div>
                  <span
                    className="text-sm font-semibold tabular-nums"
                    style={{ color: "#f87171" }}
                  >
                    −400
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Session Total — glow card */}
        <motion.div
          initial="hidden"
          animate="visible"
          custom={3}
          variants={fadeUp}
          className="rounded-2xl p-5 relative overflow-hidden"
          style={{
            background: "rgba(17,24,39,0.7)",
            border: "1px solid rgba(96,165,250,0.2)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            boxShadow: "0 0 32px rgba(37,99,235,0.18), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {/* Glow blob */}
          <div
            className="absolute -top-8 -right-8 w-32 h-32 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(59,130,246,0.2) 0%, transparent 70%)",
            }}
          />

          <p
            className="uppercase tracking-widest text-slate-500 mb-3 relative z-10"
            style={{ fontSize: "10px" }}
          >
            Your Session Total
          </p>

          <div className="flex items-end justify-between relative z-10">
            <div className="flex flex-col gap-1.5">
              {[
                { label: "Attendance", value: "1,200" },
                { label: "Packing", value: "0" },
                { label: "Game", value: "1,600" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center gap-2">
                  <span
                    className="uppercase tracking-widest text-slate-500"
                    style={{ fontSize: "10px", minWidth: "72px" }}
                  >
                    {label}
                  </span>
                  <span className="text-xs font-medium text-slate-400 tabular-nums">
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <div className="text-right">
              <p
                className="tabular-nums font-bold leading-none"
                style={{
                  fontFamily: "var(--font-display, 'Playfair Display', serif)",
                  fontSize: "44px",
                  color: "#60a5fa",
                  textShadow: "0 0 24px rgba(96,165,250,0.5)",
                }}
              >
                2,800
              </p>
              <p
                className="uppercase tracking-widest text-blue-400/60 mt-1"
                style={{ fontSize: "10px" }}
              >
                Points
              </p>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
