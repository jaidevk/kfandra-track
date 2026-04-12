"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const clubs = [
  {
    name: "Cicada Baby's",
    code: "CB",
    gradient: "from-emerald-600 to-emerald-800",
    openingBalance: 1000,
    currentBalance: 120,
    matches: [
      { date: "12/02/26", income: 60, expenditure: 0, total: 60 },
      { date: "14/02/26", income: 130, expenditure: 160, total: -30 },
      { date: "17/02/26", income: 170, expenditure: 40, total: 130 },
      { date: "19/02/26", income: 160, expenditure: 40, total: 120 },
      { date: "19/03/26", income: 165, expenditure: 100, total: 65 },
      { date: "21/03/26", income: 110, expenditure: 70, total: 40 },
    ],
  },
  {
    name: "Simba's Golden Tigers",
    code: "SGT",
    gradient: "from-amber-600 to-orange-700",
    openingBalance: 1000,
    currentBalance: 160,
    matches: [
      { date: "12/02/26", income: 105, expenditure: 100, total: 5 },
      { date: "14/02/26", income: 100, expenditure: 40, total: 60 },
      { date: "17/02/26", income: 80, expenditure: 0, total: 80 },
      { date: "17/02/26", income: 130, expenditure: 30, total: 100 },
      { date: "19/03/26", income: 180, expenditure: 120, total: 60 },
      { date: "21/03/26", income: 200, expenditure: 40, total: 160 },
    ],
  },
];

const loans = [
  { player: "Acid", from: "CB", to: "PB", amount: 30, status: "active" },
  { player: "Jake", from: "NW", to: "CB", amount: 20, status: "completed" },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
};

export default function KLCBalanceMockup() {
  const [selectedClub, setSelectedClub] = useState(0);
  const club = clubs[selectedClub];
  const isPositive = club.currentBalance >= 0;

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-medium mb-1">
          Financial Records
        </p>
        <div className="flex items-end justify-between">
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-white leading-tight">
            Balance Sheets
          </h1>
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
            KLCFESGR1
          </span>
        </div>
      </motion.div>

      {/* Kroopy Rate Bar */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3"
      >
        <p className="text-[10px] uppercase tracking-widest text-amber-500/70 mb-1 font-semibold">
          Kroopy Exchange Rate
        </p>
        <p className="text-xs text-amber-300/80 font-medium">
          300 Kr = 1 Rupee &nbsp;·&nbsp; 1 Kr = 2 MMG pts &nbsp;·&nbsp; 1 Rupee = 600 MMG pts
        </p>
      </motion.div>

      {/* Club Selector */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="flex gap-2 overflow-x-auto pb-1 scrollbar-none"
      >
        {clubs.map((c, i) => (
          <button
            key={c.code}
            onClick={() => setSelectedClub(i)}
            className={`relative flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-xs font-semibold transition-all duration-200 ${
              selectedClub === i
                ? "text-white shadow-lg"
                : "glass text-slate-400 hover:text-slate-200"
            }`}
          >
            {selectedClub === i && (
              <motion.div
                layoutId="clubBg"
                className={`absolute inset-0 rounded-full bg-gradient-to-r ${c.gradient} opacity-90`}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${
                  selectedClub === i
                    ? "bg-white/20 text-white"
                    : "bg-white/10 text-slate-300"
                }`}
              >
                {c.code.charAt(0)}
              </span>
              {c.name}
            </span>
          </button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={selectedClub}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-4"
        >
          {/* Balance Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="glass rounded-2xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-medium mb-2">
                Opening Balance
              </p>
              <p className="font-[family-name:var(--font-display)] text-3xl font-bold text-white tabular-nums">
                {club.openingBalance}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Kroopies</p>
            </div>

            <div
              className={`rounded-2xl p-4 border ${
                isPositive
                  ? "bg-emerald-500/[0.08] border-emerald-500/20"
                  : "bg-red-500/[0.08] border-red-500/20"
              }`}
              style={{
                boxShadow: isPositive
                  ? "0 0 24px rgba(16,185,129,0.08)"
                  : "0 0 24px rgba(239,68,68,0.08)",
              }}
            >
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-medium mb-2">
                Current Balance
              </p>
              <p
                className={`font-[family-name:var(--font-display)] text-3xl font-bold tabular-nums ${
                  isPositive ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {isPositive ? "+" : ""}
                {club.currentBalance}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Kroopies</p>
            </div>
          </div>

          {/* Match Breakdown */}
          <div className="glass rounded-2xl overflow-hidden">
            <div className="border-b border-white/[0.06] px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                Match Day Breakdown
              </p>
              <p className="text-sm font-semibold text-white mt-0.5">{club.name}</p>
            </div>

            {/* Column Headers */}
            <div className="grid grid-cols-[1fr_64px_64px_64px] border-b border-white/[0.04] px-4 py-2 text-[10px] font-semibold uppercase tracking-widest">
              <span className="text-slate-600">Date</span>
              <span className="text-right text-emerald-600">Income</span>
              <span className="text-right text-red-600">Expense</span>
              <span className="text-right text-slate-600">Net</span>
            </div>

            <motion.div variants={container} initial="hidden" animate="show">
              {club.matches.map((match, i) => (
                <motion.div
                  key={i}
                  variants={item}
                  className="grid grid-cols-[1fr_64px_64px_64px] border-b border-white/[0.04] px-4 py-3 items-center last:border-0 hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-xs text-slate-400 tabular-nums font-medium">
                    {match.date}
                  </span>
                  <span className="text-right text-xs text-emerald-400 tabular-nums font-medium">
                    +{match.income}
                  </span>
                  <span className="text-right text-xs text-red-400 tabular-nums font-medium">
                    {match.expenditure > 0 ? `-${match.expenditure}` : "—"}
                  </span>
                  <span
                    className={`text-right text-sm font-bold tabular-nums ${
                      match.total >= 0 ? "text-white" : "text-red-400"
                    }`}
                  >
                    {match.total >= 0 ? "+" : ""}
                    {match.total}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Player Loans */}
          <div className="glass rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                  Player Loans
                </p>
              </div>
              <button className="rounded-full border border-blue-500/40 bg-blue-500/10 px-3 py-1 text-[10px] font-semibold text-blue-400 uppercase tracking-wide hover:bg-blue-500/20 transition-colors">
                Request
              </button>
            </div>

            {loans.map((loan, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.08 }}
                className="flex items-center justify-between border-b border-white/[0.04] px-4 py-3.5 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 border border-white/10 text-xs font-bold text-slate-300">
                    {loan.player.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      {loan.player}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {loan.from} <span className="text-slate-600">→</span> {loan.to}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <p className="text-sm font-bold text-white tabular-nums">
                    {loan.amount} Kr
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                      loan.status === "active"
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        : "bg-slate-500/20 text-slate-400 border border-slate-500/30"
                    }`}
                  >
                    {loan.status}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
