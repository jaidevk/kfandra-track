"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";

type Status = "pending" | "approved" | "edited" | "rejected";

type Submission = {
  id: string;
  type: "MMG" | "Gym";
  title: string;
  date: string;
  submittedAt: string;
  reportedTotal: number;
  approvedTotal?: number;
  status: Status;
  coachNote?: string;
  details: string[];
};

const submissions: Submission[] = [
  {
    id: "s1",
    type: "MMG",
    title: "Fooba (Big Goal)",
    date: "Tue 28/4",
    submittedAt: "11:42 am",
    reportedTotal: 4500,
    status: "pending",
    details: [
      "Pre-session unpacking +500",
      "Goal +500",
      "Goal +500",
      "Assist +200",
      "Win bonus +1000",
      "Confirmation +500",
      "Order of arrival 3rd +600",
      "Other (extra reps) +700",
    ],
  },
  {
    id: "s2",
    type: "Gym",
    title: "Shoulders + Biceps",
    date: "Mon 27/4",
    submittedAt: "9:15 am",
    reportedTotal: 11,
    approvedTotal: 11,
    status: "approved",
    details: [
      "Shoulders &mdash; 6 sets, 8 reps",
      "Biceps &mdash; 5 sets, 10 reps (z-bar)",
    ],
  },
  {
    id: "s3",
    type: "MMG",
    title: "Short Game",
    date: "Sat 25/4",
    submittedAt: "11:58 am",
    reportedTotal: 1700,
    approvedTotal: 1600,
    status: "edited",
    coachNote: "Adjusted assist 200 → 100 (pre-assist).",
    details: [
      "GWW unpacking +500",
      "Goal +500",
      "Assist +200 → +100 (Coach edit)",
      "Confirmation +500",
    ],
  },
  {
    id: "s4",
    type: "Gym",
    title: "Press Ups + Abs",
    date: "Fri 24/4",
    submittedAt: "8:50 am",
    reportedTotal: 8,
    approvedTotal: 8,
    status: "approved",
    details: [
      "Press Ups &mdash; 4 sets, 20 reps",
      "Abs &mdash; 4 sets, 25 reps",
    ],
  },
  {
    id: "s5",
    type: "MMG",
    title: "End-game Drill",
    date: "Thu 23/4",
    submittedAt: "12:14 pm",
    reportedTotal: 800,
    status: "rejected",
    coachNote: "Submitted after 12 noon cut-off. Resubmit next session.",
    details: [
      "MMG drill +100 ×6",
      "Goal bonus +500 (rejected)",
    ],
  },
];

const statusBadge: Record<Status, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  edited: "bg-blue-50 text-blue-700",
  rejected: "bg-rose-50 text-rose-700",
};

const statusLabel: Record<Status, string> = {
  pending: "Pending",
  approved: "Approved",
  edited: "Edited",
  rejected: "Rejected",
};

export default function MySubmissionsMockup() {
  const [filter, setFilter] = useState<"all" | "MMG" | "Gym">("all");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = submissions.filter((s) => filter === "all" || s.type === filter);
  const selectedSub = submissions.find((s) => s.id === selected);

  return (
    <div className="flex flex-col gap-4 p-5">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-gray-900">
          My submissions
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Your history with Coach approvals and edits.
        </p>
      </header>

      {/* Filter chips */}
      <div className="flex gap-2">
        {(["all", "MMG", "Gym"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              filter === f
                ? "bg-gray-900 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2.5">
        {filtered.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelected(s.id)}
            className="w-full text-left rounded-2xl border border-gray-100 bg-white p-4 hover:border-gray-200 hover:shadow-sm transition-all"
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${
                  s.type === "MMG" ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
                }`}
              >
                {s.type === "MMG" ? "MMG" : "GYM"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {s.date} &middot; {s.title}
                  </p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge[s.status]}`}>
                    {statusLabel[s.status]}
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Submitted {s.submittedAt}
                  {s.approvedTotal !== undefined && s.approvedTotal !== s.reportedTotal && (
                    <span className="text-blue-600">
                      {" "}&middot; reported {s.reportedTotal.toLocaleString()} → approved{" "}
                      {s.approvedTotal.toLocaleString()}
                    </span>
                  )}
                  {s.approvedTotal !== undefined && s.approvedTotal === s.reportedTotal && (
                    <> &middot; {s.reportedTotal.toLocaleString()}{s.type === "MMG" ? " pts" : ""}</>
                  )}
                </p>
                {s.coachNote && (
                  <p className="mt-1 text-[11px] italic text-gray-500 line-clamp-1">
                    Coach: {s.coachNote}
                  </p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Link
          href="/mockups/mmg-session"
          className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-center text-sm font-semibold text-blue-700 hover:bg-blue-100"
        >
          + New MMG
        </Link>
        <Link
          href="/mockups/gym-session"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          + New Gym
        </Link>
      </div>

      {/* Detail sheet */}
      {selectedSub && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end"
          onClick={() => setSelected(null)}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-white rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {selectedSub.type} &middot; {selectedSub.date}
                </p>
                <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-gray-900">
                  {selectedSub.title}
                </h2>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusBadge[selectedSub.status]}`}>
                {statusLabel[selectedSub.status]}
              </span>
            </div>

            {/* Totals */}
            {selectedSub.type === "MMG" && (
              <div className="rounded-xl bg-gray-50 p-3 mb-4 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    You reported
                  </p>
                  <p className="font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums text-gray-900">
                    {selectedSub.reportedTotal.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Coach approved
                  </p>
                  <p className="font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums text-gray-900">
                    {selectedSub.approvedTotal !== undefined ? selectedSub.approvedTotal.toLocaleString() : "—"}
                  </p>
                </div>
              </div>
            )}

            {selectedSub.coachNote && (
              <div className="mb-4 rounded-xl border-l-4 border-blue-400 bg-blue-50/50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Coach note</p>
                <p className="mt-1 text-sm text-blue-900">{selectedSub.coachNote}</p>
              </div>
            )}

            <h3 className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">
              Details
            </h3>
            <div className="rounded-xl border border-gray-100 divide-y divide-gray-100 mb-4">
              {selectedSub.details.map((d, i) => (
                <div
                  key={i}
                  className="px-3.5 py-2.5 text-sm text-gray-700"
                  dangerouslySetInnerHTML={{ __html: d }}
                />
              ))}
            </div>

            {selectedSub.status === "pending" && (
              <button className="w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100">
                Withdraw submission
              </button>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
