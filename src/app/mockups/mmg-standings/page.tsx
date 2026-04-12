"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const standings = [
  { rank: 1, name: "Abe", attendance: 2000, total: 18300, sumTotal: 20300, change: "up" },
  { rank: 2, name: "Ahjoo", attendance: 2000, total: 17300, sumTotal: 19300, change: "up" },
  { rank: 3, name: "Acid", attendance: 2000, total: 13700, sumTotal: 15700, change: "same" },
  { rank: 4, name: "Jake", attendance: 1500, total: 10900, sumTotal: 12400, change: "down" },
  { rank: 5, name: "Goodman", attendance: 500, total: 11200, sumTotal: 11700, change: "up" },
  { rank: 6, name: "Mkul", attendance: 1500, total: 6500, sumTotal: 8000, change: "same" },
  { rank: 7, name: "Seito", attendance: 2000, total: 2900, sumTotal: 4900, change: "up" },
  { rank: 8, name: "Ahchin", attendance: 500, total: 4200, sumTotal: 4700, change: "down" },
  { rank: 9, name: "Crank", attendance: 1000, total: 2800, sumTotal: 3800, change: "new" },
  { rank: 10, name: "BB", attendance: 500, total: 0, sumTotal: 500, change: "same" },
  { rank: 11, name: "Baz", attendance: 0, total: 0, sumTotal: 0, change: "same" },
  { rank: 12, name: "Caveman", attendance: 0, total: 0, sumTotal: 0, change: "same" },
  { rank: 13, name: "Napalm", attendance: 0, total: 0, sumTotal: 0, change: "same" },
];

type Period = "month" | "week" | "all";

const podiumOrder = [standings[1], standings[0], standings[2]]; // 2nd, 1st, 3rd

const podiumConfig = [
  {
    position: 2,
    gradient: "from-slate-400/30 via-slate-300/20 to-slate-500/10",
    borderColor: "border-slate-400/40",
    numberColor: "text-slate-300",
    avatarRing: "ring-slate-400/60",
    avatarBg: "bg-slate-700",
    barHeight: "h-20",
    avatarSize: "w-12 h-12 text-sm",
    label: "SILVER",
  },
  {
    position: 1,
    gradient: "from-amber-500/40 via-amber-400/25 to-amber-600/10",
    borderColor: "border-amber-400/50",
    numberColor: "text-amber-400",
    avatarRing: "ring-amber-400/70",
    avatarBg: "bg-amber-900/60",
    barHeight: "h-28",
    avatarSize: "w-16 h-16 text-base",
    label: "GOLD",
  },
  {
    position: 3,
    gradient: "from-orange-700/30 via-orange-600/20 to-orange-800/10",
    borderColor: "border-orange-600/40",
    numberColor: "text-orange-400",
    avatarRing: "ring-orange-600/50",
    avatarBg: "bg-orange-950/60",
    barHeight: "h-14",
    avatarSize: "w-12 h-12 text-sm",
    label: "BRONZE",
  },
];

function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export default function MMGStandingsMockup() {
  const [period, setPeriod] = useState<Period>("month");

  return (
    <div
      className="min-h-screen p-4 pb-10"
      style={{ background: "#0a0f1c" }}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6 flex items-start justify-between"
      >
        <div>
          <p
            className="text-[10px] uppercase tracking-widest text-slate-500 mb-1"
          >
            KFandra Track
          </p>
          <h1
            className="font-[family-name:var(--font-display)] text-3xl font-bold text-white leading-none"
          >
            MMG Standings
          </h1>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Season</p>
          <p className="text-sm font-semibold text-blue-400 tabular-nums">Apr 2026</p>
        </div>
      </motion.div>

      {/* Period Toggle */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.08 }}
        className="mb-6 flex gap-1 rounded-xl p-1 glass"
        style={{ background: "rgba(17,24,39,0.6)" }}
      >
        {(["week", "month", "all"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`relative flex-1 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-widest transition-all duration-200 ${
              period === p
                ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {p === "all" ? "All Time" : p === "month" ? "Monthly" : "Weekly"}
          </button>
        ))}
      </motion.div>

      {/* Podium */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="mb-6"
      >
        <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-4 text-center">
          Top Performers
        </p>
        <div className="flex items-end justify-center gap-3">
          {podiumOrder.map((player, i) => {
            const cfg = podiumConfig[i];
            return (
              <motion.div
                key={player.rank}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.08 }}
                className="flex flex-col items-center gap-2"
              >
                {/* Avatar */}
                <div
                  className={`${cfg.avatarSize} flex items-center justify-center rounded-full font-bold text-white ring-2 ${cfg.avatarRing} ${cfg.avatarBg}`}
                >
                  {getInitials(player.name)}
                </div>
                {/* Name */}
                <div className="text-center">
                  <p
                    className={`text-xs font-semibold ${cfg.position === 1 ? "text-white" : "text-slate-300"}`}
                  >
                    {player.name}
                  </p>
                  <p
                    className={`text-[11px] font-bold tabular-nums ${cfg.position === 1 ? "text-amber-400" : "text-slate-400"}`}
                  >
                    {player.sumTotal.toLocaleString()}
                  </p>
                </div>
                {/* Podium block */}
                <div
                  className={`w-20 ${cfg.barHeight} rounded-t-lg border ${cfg.borderColor} bg-gradient-to-b ${cfg.gradient} flex flex-col items-center justify-start pt-2`}
                  style={{ backdropFilter: "blur(8px)" }}
                >
                  <span
                    className={`font-[family-name:var(--font-display)] text-4xl font-bold leading-none ${cfg.numberColor}`}
                    style={{ opacity: 0.9 }}
                  >
                    {cfg.position}
                  </span>
                  <span className="text-[8px] uppercase tracking-widest text-slate-500 mt-0.5">
                    {cfg.label}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Full Rankings Table */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35 }}
        className="rounded-2xl overflow-hidden glass"
        style={{
          background: "rgba(17,24,39,0.6)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Table Header */}
        <div className="grid grid-cols-[36px_1fr_72px_80px] gap-0 px-4 py-3 border-b border-white/[0.06]">
          <span className="text-[10px] uppercase tracking-widest text-slate-500">#</span>
          <span className="text-[10px] uppercase tracking-widest text-slate-500">Player</span>
          <span className="text-right text-[10px] uppercase tracking-widest text-slate-500">Att.</span>
          <span className="text-right text-[10px] uppercase tracking-widest text-slate-500">Total</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/[0.04]">
          {standings.map((player, idx) => {
            const isCurrentUser = player.name === "Acid";
            return (
              <motion.div
                key={player.rank}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.4 + idx * 0.04 }}
                className={`grid grid-cols-[36px_1fr_72px_80px] gap-0 px-4 py-3 items-center relative ${
                  isCurrentUser
                    ? "bg-blue-500/[0.08]"
                    : "hover:bg-white/[0.02] transition-colors duration-150"
                }`}
              >
                {/* Blue glow stripe for current user */}
                {isCurrentUser && (
                  <span
                    className="absolute left-0 top-0 bottom-0 w-0.5 rounded-full bg-blue-400"
                    style={{ boxShadow: "0 0 8px 1px rgba(96,165,250,0.6)" }}
                  />
                )}

                {/* Rank */}
                <span
                  className={`font-[family-name:var(--font-display)] text-sm font-bold tabular-nums ${
                    player.rank <= 3
                      ? player.rank === 1
                        ? "text-amber-400"
                        : player.rank === 2
                        ? "text-slate-300"
                        : "text-orange-400"
                      : "text-slate-600"
                  }`}
                >
                  {player.rank}
                </span>

                {/* Name + Trend */}
                <div className="flex items-center gap-2">
                  <span
                    className={`text-sm font-semibold ${isCurrentUser ? "text-blue-300" : "text-slate-200"}`}
                  >
                    {player.name}
                  </span>
                  {player.change === "up" && (
                    <span className="text-[10px] text-emerald-400">▲</span>
                  )}
                  {player.change === "down" && (
                    <span className="text-[10px] text-red-400">▼</span>
                  )}
                  {player.change === "new" && (
                    <span
                      className="rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-400"
                      style={{
                        background: "rgba(96,165,250,0.12)",
                        border: "1px solid rgba(96,165,250,0.3)",
                      }}
                    >
                      NEW
                    </span>
                  )}
                  {isCurrentUser && (
                    <span
                      className="rounded px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-400"
                      style={{
                        background: "rgba(96,165,250,0.12)",
                        border: "1px solid rgba(96,165,250,0.25)",
                      }}
                    >
                      YOU
                    </span>
                  )}
                </div>

                {/* Attendance */}
                <span
                  className={`text-right text-sm tabular-nums ${
                    player.attendance > 0 ? "text-slate-400" : "text-slate-600"
                  }`}
                >
                  {player.attendance > 0 ? player.attendance.toLocaleString() : "—"}
                </span>

                {/* Total */}
                <span
                  className={`text-right text-sm font-bold tabular-nums ${
                    player.sumTotal > 0
                      ? isCurrentUser
                        ? "text-blue-300"
                        : "text-white"
                      : "text-slate-600"
                  }`}
                >
                  {player.sumTotal > 0 ? player.sumTotal.toLocaleString() : "—"}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/[0.04] flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-widest text-slate-600">
            {standings.length} players
          </p>
          <p className="text-[10px] uppercase tracking-widest text-slate-600">
            Matchday pts + attendance
          </p>
        </div>
      </motion.div>
    </div>
  );
}
