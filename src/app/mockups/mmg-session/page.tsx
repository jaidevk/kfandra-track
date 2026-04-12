"use client";

import { useState } from "react";

const players = [
  "Abe", "Acid", "Ahchin", "Ahjoo", "Baz", "BB", "Caveman",
  "Crank", "Goodman", "Jake", "Mkul", "Napalm", "Seito",
];

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

type Tab = "attendance" | "packing" | "game";

export default function MMGSessionMockup() {
  const [activeTab, setActiveTab] = useState<Tab>("attendance");

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Session Header */}
      <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              Thursday, 9 Apr 2026
            </h1>
            <p className="text-sm text-gray-500">Session — 6:10 to 7:30 AM</p>
          </div>
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            Completed
          </span>
        </div>
        <div className="mt-3 flex gap-4 text-center">
          <div className="flex-1">
            <p className="text-2xl font-bold text-gray-900">8</p>
            <p className="text-xs text-gray-500">Players</p>
          </div>
          <div className="flex-1">
            <p className="text-2xl font-bold text-blue-600">24,800</p>
            <p className="text-xs text-gray-500">Total Points</p>
          </div>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex rounded-lg bg-gray-100 p-1">
        {(["attendance", "packing", "game"] as Tab[]).map((tab) => (
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

      {/* Tab Content */}
      {activeTab === "attendance" && (
        <div className="flex flex-col gap-3">
          {/* Confirmation Order */}
          <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Confirmation Order
            </h3>
            <div className="flex flex-col gap-2">
              {confirmationOrder.map((entry) => (
                <div
                  key={entry.rank}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${
                      entry.rank <= 3 ? "bg-blue-600" : "bg-gray-400"
                    }`}>
                      {entry.rank}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {entry.player}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-blue-600">
                      +{entry.points}
                    </span>
                    <p className="text-xs text-gray-400">{entry.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Early Bonus */}
          <div className="rounded-xl bg-blue-50 p-4 border border-blue-100">
            <h3 className="text-sm font-semibold text-blue-900">
              Early Confirmation Bonus (before 7:30 AM)
            </h3>
            <p className="mt-1 text-xs text-blue-700">
              6 players confirmed before 7:30 AM — +500 pts each
            </p>
          </div>
        </div>
      )}

      {activeTab === "packing" && (
        <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
          <h3 className="mb-3 text-sm font-semibold text-gray-900">
            Packing Points
          </h3>
          <div className="flex flex-col gap-3">
            {[
              { task: "GWW Unpacking", player: "Abe", points: 500 },
              { task: "GWW Packing", player: "Acid", points: 500 },
              { task: "Session Packing", player: "Jake", points: 200 },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.task}</p>
                  <p className="text-xs text-gray-500">{item.player}</p>
                </div>
                <span className="text-sm font-semibold text-green-600">
                  +{item.points}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "game" && (
        <div className="flex flex-col gap-3">
          {/* Match Result */}
          <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
            <h3 className="mb-2 text-sm font-semibold text-gray-900">
              Fooba / Full Game
            </h3>
            <div className="flex items-center justify-center gap-4 py-3">
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Team A</p>
                <p className="text-3xl font-bold text-gray-900">3</p>
              </div>
              <span className="text-sm text-gray-400">vs</span>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">Team B</p>
                <p className="text-3xl font-bold text-gray-900">2</p>
              </div>
            </div>
            <div className="mt-2 rounded-lg bg-green-50 p-2 text-center">
              <span className="text-sm font-medium text-green-700">
                Team A wins — +1,000 pts each
              </span>
            </div>
          </div>

          {/* Player Stats */}
          <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">
              Player Events (Big Goal)
            </h3>
            <div className="flex flex-col gap-2">
              {[
                { player: "Acid", event: "Goal", points: 500, icon: "⚽" },
                { player: "Acid", event: "Goal", points: 500, icon: "⚽" },
                { player: "Abe", event: "Assist", points: 200, icon: "👟" },
                { player: "Ahjoo", event: "Goal", points: 500, icon: "⚽" },
                { player: "Jake", event: "Save", points: 500, icon: "🧤" },
                { player: "Mkul", event: "Goal Line Clearance", points: 500, icon: "🛡️" },
                { player: "Seito", event: "Pre-Assist", points: 100, icon: "🔗" },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span>{stat.icon}</span>
                    <span className="text-sm text-gray-900">{stat.player}</span>
                    <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">
                      {stat.event}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-blue-600">
                    +{stat.points}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Goal Conceded */}
          <div className="rounded-xl bg-red-50 p-4 border border-red-100">
            <h3 className="text-sm font-semibold text-red-900">
              Goals Conceded
            </h3>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-red-700">Crank (GK) — 2 conceded</span>
              <span className="text-sm font-semibold text-red-600">-400</span>
            </div>
          </div>
        </div>
      )}

      {/* Session Total */}
      <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
        <h3 className="mb-2 text-sm font-semibold text-gray-900">
          Your Session Total
        </h3>
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-1 text-xs text-gray-500">
            <p>Attendance: 1,200</p>
            <p>Packing: 0</p>
            <p>Game: 1,600</p>
          </div>
          <p className="text-3xl font-bold text-blue-600">2,800</p>
        </div>
      </div>
    </div>
  );
}
