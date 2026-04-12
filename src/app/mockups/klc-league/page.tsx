"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const leagueTable = [
  { pos: 1, club: "PB", name: "Piranha Bling", played: 5, won: 3, drawn: 0, lost: 2, gf: 12, ga: 4, gd: 8, pts: 12, division: "1st" },
  { pos: 2, club: "CB", name: "Cicada Baby's", played: 5, won: 2, drawn: 3, lost: 0, gf: 3, ga: 3, gd: 0, pts: 11, division: "1st" },
  { pos: 3, club: "SGT", name: "Simba's Golden Tigers", played: 5, won: 1, drawn: 2, lost: 2, gf: 14, ga: 12, gd: 2, pts: 6, division: "2nd" },
  { pos: 4, club: "NW", name: "Ninja Waters", played: 2, won: 2, drawn: 0, lost: 0, gf: 5, ga: 1, gd: 4, pts: 8, division: "2nd" },
  { pos: 5, club: "RK", name: "Rusty Krakens", played: 3, won: 1, drawn: 1, lost: 1, gf: 9, ga: 3, gd: 6, pts: 5, division: "3rd" },
  { pos: 6, club: "DR", name: "Dancing Rhinos", played: 3, won: 2, drawn: 0, lost: 1, gf: 3, ga: 9, gd: -6, pts: 8, division: "3rd" },
];

const recentMatches = [
  { home: "SGT", away: "CB", scoreH: 0, scoreA: 0, date: "12/02/26", type: "League" },
  { home: "SGT", away: "RK", scoreH: 2, scoreA: 0, date: "14/02/26", type: "League" },
  { home: "CB", away: "PB", scoreH: 3, scoreA: 2, date: "17/02/26", type: "League" },
  { home: "RK", away: "NW", scoreH: 0, scoreA: 2, date: "19/02/26", type: "League" },
  { home: "PB", away: "DR", scoreH: 4, scoreA: 0, date: "19/02/26", type: "Cup" },
];

type Tab = "table" | "fixtures" | "stats";

const divisionBadge = (div: string) => {
  if (div === "1st") return "bg-blue-500/20 text-blue-400 border border-blue-500/30";
  if (div === "2nd") return "bg-amber-500/20 text-amber-400 border border-amber-500/30";
  return "bg-slate-500/20 text-slate-400 border border-slate-500/30";
};

const clubGradient = (club: string) => {
  const map: Record<string, string> = {
    PB: "from-blue-600 to-blue-800",
    CB: "from-emerald-600 to-emerald-800",
    SGT: "from-amber-600 to-orange-700",
    NW: "from-cyan-600 to-cyan-800",
    RK: "from-red-600 to-red-800",
    DR: "from-purple-600 to-purple-800",
  };
  return map[club] ?? "from-slate-600 to-slate-800";
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

export default function KLCLeagueMockup() {
  const [activeTab, setActiveTab] = useState<Tab>("table");

  return (
    <div className="flex flex-col gap-5 p-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-1"
      >
        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">
          KFANDRA League &amp; Cup
        </p>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-white leading-tight">
          KLCFESGR1
        </h1>
        <p className="text-xs text-slate-500">
          Fooba Evolution Short Game Rehashed — Season 1
        </p>
      </motion.div>

      {/* Tab Switcher */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="glass flex rounded-xl p-1 gap-1"
      >
        {(["table", "fixtures", "stats"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative flex-1 rounded-lg px-3 py-2 text-xs font-semibold capitalize transition-all duration-200 ${
              activeTab === tab ? "text-white" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {activeTab === tab && (
              <motion.div
                layoutId="tabBg"
                className="absolute inset-0 rounded-lg bg-blue-600/30 border border-blue-500/40"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10 tracking-wide">{tab}</span>
          </button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        {activeTab === "table" && (
          <motion.div
            key="table"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="glass rounded-2xl overflow-hidden"
          >
            {/* Table Header */}
            <div className="grid grid-cols-[28px_1fr_28px_28px_28px_28px_38px_42px] border-b border-white/[0.06] px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              <span>#</span>
              <span>Club</span>
              <span className="text-center">P</span>
              <span className="text-center">W</span>
              <span className="text-center">D</span>
              <span className="text-center">L</span>
              <span className="text-center">GD</span>
              <span className="text-right">Pts</span>
            </div>

            <motion.div variants={container} initial="hidden" animate="show">
              {leagueTable.map((team) => (
                <motion.div
                  key={team.club}
                  variants={item}
                  className="grid grid-cols-[28px_1fr_28px_28px_28px_28px_38px_42px] border-b border-white/[0.04] px-3 py-3 items-center last:border-0 hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-xs font-medium text-slate-500 tabular-nums">
                    {team.pos}
                  </span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ${clubGradient(team.club)} text-[9px] font-bold text-white shadow-sm`}
                    >
                      {team.club.slice(0, 2)}
                    </span>
                    <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-medium text-slate-200 truncate">
                        {team.name}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${divisionBadge(team.division)}`}
                      >
                        {team.division}
                      </span>
                    </div>
                  </div>
                  <span className="text-center text-xs text-slate-400 tabular-nums">
                    {team.played}
                  </span>
                  <span className="text-center text-xs text-slate-400 tabular-nums">
                    {team.won}
                  </span>
                  <span className="text-center text-xs text-slate-400 tabular-nums">
                    {team.drawn}
                  </span>
                  <span className="text-center text-xs text-slate-400 tabular-nums">
                    {team.lost}
                  </span>
                  <span
                    className={`text-center text-xs font-semibold tabular-nums ${
                      team.gd > 0
                        ? "text-emerald-400"
                        : team.gd < 0
                        ? "text-red-400"
                        : "text-slate-400"
                    }`}
                  >
                    {team.gd > 0 ? `+${team.gd}` : team.gd}
                  </span>
                  <span className="text-right text-sm font-bold text-white tabular-nums">
                    {team.pts}
                  </span>
                </motion.div>
              ))}
            </motion.div>

            {/* Division Key */}
            <div className="flex gap-4 px-3 py-3 border-t border-white/[0.04] bg-white/[0.01]">
              <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400 inline-block" />
                1st Division
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" />
                2nd Division
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-500 inline-block" />
                3rd Division
              </span>
            </div>
          </motion.div>
        )}

        {activeTab === "fixtures" && (
          <motion.div
            key="fixtures"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-3"
          >
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold px-1">
              Recent Matches
            </p>
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="flex flex-col gap-2"
            >
              {recentMatches.map((match, i) => (
                <motion.div
                  key={i}
                  variants={item}
                  className="glass rounded-2xl px-4 py-4 flex items-center justify-between gap-3"
                >
                  {/* Home */}
                  <div className="flex flex-col items-center gap-1.5 w-12">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${clubGradient(match.home)} text-[10px] font-bold text-white shadow-md`}
                    >
                      {match.home}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {match.home}
                    </span>
                  </div>

                  {/* Score */}
                  <div className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-[family-name:var(--font-display)] text-3xl font-bold text-white tabular-nums">
                        {match.scoreH}
                      </span>
                      <span className="text-slate-600 font-light text-xl">–</span>
                      <span className="font-[family-name:var(--font-display)] text-3xl font-bold text-white tabular-nums">
                        {match.scoreA}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500">{match.date}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                        match.type === "Cup"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                          : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      }`}
                    >
                      {match.type}
                    </span>
                  </div>

                  {/* Away */}
                  <div className="flex flex-col items-center gap-1.5 w-12">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${clubGradient(match.away)} text-[10px] font-bold text-white shadow-md`}
                    >
                      {match.away}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {match.away}
                    </span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}

        {activeTab === "stats" && (
          <motion.div
            key="stats"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-3"
          >
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-semibold px-1">
              Top Scorers
            </p>
            <div className="glass rounded-2xl overflow-hidden">
              {[
                { player: "Acid", club: "CB", goals: 5 },
                { player: "Abe", club: "PB", goals: 4 },
                { player: "Ahjoo", club: "SGT", goals: 3 },
                { player: "Jake", club: "NW", goals: 2 },
              ].map((scorer, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07, duration: 0.35 }}
                  className="flex items-center justify-between border-b border-white/[0.04] px-4 py-3.5 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-600 tabular-nums w-4">
                      {i + 1}
                    </span>
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${clubGradient(scorer.club)} text-[9px] font-bold text-white`}
                    >
                      {scorer.club}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">
                        {scorer.player}
                      </p>
                      <p className="text-[10px] text-slate-500">{scorer.club}</p>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-[family-name:var(--font-display)] text-2xl font-bold text-blue-400 tabular-nums">
                      {scorer.goals}
                    </span>
                    <span className="text-[10px] text-slate-600 uppercase tracking-wide">
                      gls
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
