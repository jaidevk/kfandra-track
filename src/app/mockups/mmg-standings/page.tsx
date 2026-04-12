"use client";

import { useState } from "react";

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

export default function MMGStandingsMockup() {
  const [period, setPeriod] = useState<Period>("month");

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">MMG Standings</h1>
        <span className="text-sm text-gray-500">April 2026</span>
      </div>

      {/* Period Toggle */}
      <div className="flex rounded-lg bg-gray-100 p-1">
        {(["week", "month", "all"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium capitalize transition-colors ${
              period === p
                ? "bg-white text-blue-600 shadow-sm"
                : "text-gray-600"
            }`}
          >
            {p === "all" ? "All Time" : p === "month" ? "Monthly" : "Weekly"}
          </button>
        ))}
      </div>

      {/* Top 3 Podium */}
      <div className="flex items-end justify-center gap-3 py-4">
        {/* 2nd */}
        <div className="flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 text-sm font-bold">
            AJ
          </div>
          <p className="mt-1 text-xs font-medium text-gray-900">Ahjoo</p>
          <p className="text-xs text-gray-500">19,300</p>
          <div className="mt-1 h-16 w-16 rounded-t-lg bg-gray-300 flex items-center justify-center text-lg font-bold text-gray-600">
            2
          </div>
        </div>
        {/* 1st */}
        <div className="flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-yellow-400 text-sm font-bold">
            AB
          </div>
          <p className="mt-1 text-xs font-semibold text-gray-900">Abe</p>
          <p className="text-xs text-blue-600 font-semibold">20,300</p>
          <div className="mt-1 h-24 w-16 rounded-t-lg bg-yellow-400 flex items-center justify-center text-lg font-bold text-yellow-800">
            1
          </div>
        </div>
        {/* 3rd */}
        <div className="flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-200 text-sm font-bold">
            AC
          </div>
          <p className="mt-1 text-xs font-medium text-gray-900">Acid</p>
          <p className="text-xs text-gray-500">15,700</p>
          <div className="mt-1 h-12 w-16 rounded-t-lg bg-orange-300 flex items-center justify-center text-lg font-bold text-orange-700">
            3
          </div>
        </div>
      </div>

      {/* Full Rankings Table */}
      <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-[40px_1fr_80px_80px] gap-0 border-b bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500">
          <span>#</span>
          <span>Player</span>
          <span className="text-right">Att.</span>
          <span className="text-right">Total</span>
        </div>
        {standings.map((player) => (
          <div
            key={player.rank}
            className={`grid grid-cols-[40px_1fr_80px_80px] gap-0 border-b border-gray-50 px-3 py-2.5 items-center ${
              player.name === "Acid" ? "bg-blue-50" : ""
            }`}
          >
            <span className="text-sm font-medium text-gray-400">
              {player.rank}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-900">
                {player.name}
              </span>
              {player.change === "up" && (
                <span className="text-xs text-green-500">▲</span>
              )}
              {player.change === "down" && (
                <span className="text-xs text-red-500">▼</span>
              )}
              {player.change === "new" && (
                <span className="rounded bg-blue-100 px-1 text-xs text-blue-600">
                  NEW
                </span>
              )}
            </div>
            <span className="text-right text-sm text-gray-500">
              {player.attendance.toLocaleString()}
            </span>
            <span className="text-right text-sm font-semibold text-gray-900">
              {player.sumTotal.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
