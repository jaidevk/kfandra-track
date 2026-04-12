"use client";

import { useState } from "react";

const clubs = [
  {
    name: "Cicada Baby's",
    code: "CB",
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

export default function KLCBalanceMockup() {
  const [selectedClub, setSelectedClub] = useState(0);
  const club = clubs[selectedClub];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Club Balance Sheets</h1>
        <span className="text-xs text-gray-500">KLCFESGR1</span>
      </div>

      {/* Kroopy Rate Info */}
      <div className="rounded-lg bg-yellow-50 px-4 py-2 border border-yellow-100">
        <p className="text-xs text-yellow-800">
          300 Kroopies = 1 Rupee | 1 Kr = 2 MMG pts | 1 Rupee = 600 MMG pts
        </p>
      </div>

      {/* Club Selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {clubs.map((c, i) => (
          <button
            key={c.code}
            onClick={() => setSelectedClub(i)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              selectedClub === i
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 border border-gray-200"
            }`}
          >
            <span className={`flex h-5 w-5 items-center justify-center rounded text-xs font-bold ${
              selectedClub === i ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
            }`}>
              {c.code.charAt(0)}
            </span>
            {c.name}
          </button>
        ))}
      </div>

      {/* Balance Overview */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500">Opening Balance</p>
          <p className="text-2xl font-bold text-gray-900">{club.openingBalance} Kr</p>
        </div>
        <div className={`rounded-xl p-4 shadow-sm border ${
          club.currentBalance >= 0 ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"
        }`}>
          <p className="text-xs text-gray-500">Current Balance</p>
          <p className={`text-2xl font-bold ${
            club.currentBalance >= 0 ? "text-green-700" : "text-red-700"
          }`}>
            {club.currentBalance} Kr
          </p>
        </div>
      </div>

      {/* Match-by-Match Breakdown */}
      <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b bg-gray-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">
            {club.name} — Match Day Breakdown
          </h3>
        </div>

        <div className="grid grid-cols-[1fr_70px_70px_70px] gap-0 border-b bg-gray-50 px-4 py-2 text-xs font-medium text-gray-500">
          <span>Date</span>
          <span className="text-right text-green-600">Income</span>
          <span className="text-right text-red-500">Expense</span>
          <span className="text-right">Net</span>
        </div>

        {club.matches.map((match, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_70px_70px_70px] gap-0 border-b border-gray-50 px-4 py-2.5 items-center"
          >
            <span className="text-sm text-gray-700">{match.date}</span>
            <span className="text-right text-sm text-green-600">
              +{match.income}
            </span>
            <span className="text-right text-sm text-red-500">
              -{match.expenditure}
            </span>
            <span className={`text-right text-sm font-semibold ${
              match.total >= 0 ? "text-gray-900" : "text-red-600"
            }`}>
              {match.total >= 0 ? "+" : ""}{match.total}
            </span>
          </div>
        ))}
      </div>

      {/* Player Loans */}
      <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Player Loans</h3>
          <button className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
            Request Loan
          </button>
        </div>
        {[
          { player: "Acid", from: "CB", to: "PB", amount: 30, status: "active" },
          { player: "Jake", from: "NW", to: "CB", amount: 20, status: "completed" },
        ].map((loan, i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b border-gray-50 py-2.5 last:border-0"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">{loan.player}</p>
              <p className="text-xs text-gray-500">
                {loan.from} → {loan.to}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">{loan.amount} Kr</p>
              <span className={`text-xs ${
                loan.status === "active" ? "text-blue-600" : "text-gray-400"
              }`}>
                {loan.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
