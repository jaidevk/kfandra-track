"use client";

import { useState } from "react";

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

export default function KLCLeagueMockup() {
  const [activeTab, setActiveTab] = useState<Tab>("table");

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-bold text-gray-900">KLCFESGR1</h1>
      <p className="text-xs text-gray-500">
        KFANDRA League and Cup Fooba Evolution Short Game Rehashed 1
      </p>

      {/* Tab Selector */}
      <div className="flex rounded-lg bg-gray-100 p-1">
        {(["table", "fixtures", "stats"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "table" && (
        <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[30px_1fr_30px_30px_30px_30px_40px_45px] gap-0 border-b bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500">
            <span>#</span>
            <span>Club</span>
            <span className="text-center">P</span>
            <span className="text-center">W</span>
            <span className="text-center">D</span>
            <span className="text-center">L</span>
            <span className="text-center">GD</span>
            <span className="text-right font-semibold">Pts</span>
          </div>

          {leagueTable.map((team, i) => (
            <div
              key={team.club}
              className={`grid grid-cols-[30px_1fr_30px_30px_30px_30px_40px_45px] gap-0 border-b border-gray-50 px-3 py-2.5 items-center ${
                i < 2 ? "bg-blue-50/50" : ""
              }`}
            >
              <span className="text-sm font-medium text-gray-400">{team.pos}</span>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded bg-gray-200 text-xs font-bold">
                  {team.club}
                </span>
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {team.name}
                  </span>
                  <span className={`ml-1 text-xs ${
                    team.division === "1st" ? "text-blue-600" :
                    team.division === "2nd" ? "text-orange-500" :
                    "text-gray-400"
                  }`}>
                    {team.division}
                  </span>
                </div>
              </div>
              <span className="text-center text-sm text-gray-500">{team.played}</span>
              <span className="text-center text-sm text-gray-500">{team.won}</span>
              <span className="text-center text-sm text-gray-500">{team.drawn}</span>
              <span className="text-center text-sm text-gray-500">{team.lost}</span>
              <span className={`text-center text-sm ${team.gd >= 0 ? "text-green-600" : "text-red-500"}`}>
                {team.gd > 0 ? `+${team.gd}` : team.gd}
              </span>
              <span className="text-right text-sm font-bold text-gray-900">
                {team.pts}
              </span>
            </div>
          ))}

          {/* Division Key */}
          <div className="flex gap-4 px-3 py-2 text-xs text-gray-400 bg-gray-50">
            <span><span className="text-blue-600">●</span> 1st Division</span>
            <span><span className="text-orange-500">●</span> 2nd Division</span>
            <span><span className="text-gray-400">●</span> 3rd Division</span>
          </div>
        </div>
      )}

      {activeTab === "fixtures" && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-gray-900">Recent Matches</h3>
          {recentMatches.map((match, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm border border-gray-100"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded bg-gray-200 text-xs font-bold">
                  {match.home}
                </span>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-gray-900">{match.scoreH}</span>
                  <span className="text-sm text-gray-400">-</span>
                  <span className="text-xl font-bold text-gray-900">{match.scoreA}</span>
                </div>
                <p className="text-xs text-gray-400">{match.date}</p>
                <span className={`text-xs ${match.type === "Cup" ? "text-yellow-600" : "text-blue-600"}`}>
                  {match.type}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded bg-gray-200 text-xs font-bold">
                  {match.away}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "stats" && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Top Scorers (KLCFESGR1)
            </h3>
            {[
              { player: "Acid", club: "CB", goals: 5 },
              { player: "Abe", club: "PB", goals: 4 },
              { player: "Ahjoo", club: "SGT", goals: 3 },
              { player: "Jake", club: "NW", goals: 2 },
            ].map((scorer, i) => (
              <div
                key={i}
                className="flex items-center justify-between border-b border-gray-50 py-2 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-400">{i + 1}</span>
                  <span className="text-sm font-medium text-gray-900">{scorer.player}</span>
                  <span className="text-xs text-gray-400">{scorer.club}</span>
                </div>
                <span className="text-sm font-bold text-blue-600">{scorer.goals}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
