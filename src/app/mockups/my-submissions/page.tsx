"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";

type Status = "pending" | "approved" | "edited" | "rejected";

type MMGDetail = {
  participation?: string[];
  performance?: { game: string; result: string; stats: string[]; pts: number }[];
  other?: { description: string; pts: number }[];
};

type GymRow = {
  bodyPart: string;
  equipment: string;
  weightKg?: number;
  scheme: string;
  notes?: string;
};

type Submission = {
  id: string;
  type: "MMG" | "Gym";
  title: string;
  date: string;
  submittedAt: string;
  reportedTotal: number;
  approvedTotal?: number;
  status: Status;
  kfandraNote?: string;
  mmg?: MMGDetail;
  gym?: GymRow[];
  narration?: string;
};

const submissions: Submission[] = [
  {
    id: "s1",
    type: "MMG",
    title: "Tuesday session",
    date: "Tue 28/4",
    submittedAt: "11:42 am",
    reportedTotal: 4500,
    status: "pending",
    mmg: {
      participation: [
        "Confirmation order: 3rd · pts at approval",
        "Arrival: 4th · pts at approval",
        "Unpacking: Yes · +500",
        "Packing weights: No",
        "Packing kit: Yes · +500",
        "Confirmed by 8 am: Yes · +500",
      ],
      performance: [
        {
          game: "Football short",
          result: "Won",
          stats: ["2 goals", "1 assist"],
          pts: 2200,
        },
        {
          game: "3-and-in",
          result: "Drew",
          stats: ["1 goal"],
          pts: 600,
        },
      ],
      other: [{ description: "1st in race", pts: 200 }],
    },
    narration: "Left at 7:30 — kid drop-off",
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
    gym: [
      { bodyPart: "Shoulders", equipment: "Sbb", weightKg: 12, scheme: "6 sets, 8, 4×6, 8" },
      { bodyPart: "Biceps", equipment: "Z-bar", weightKg: 15, scheme: "6 sets, All 6" },
    ],
  },
  {
    id: "s3",
    type: "MMG",
    title: "Saturday session",
    date: "Sat 25/4",
    submittedAt: "11:58 am",
    reportedTotal: 1700,
    approvedTotal: 1600,
    status: "edited",
    kfandraNote: "Adjusted assist 200 → 100 (counted as pre-assist).",
    mmg: {
      participation: [
        "Confirmation order: 5th · pts at approval",
        "Arrival: 5th · pts at approval",
        "Unpacking: Yes · +500",
        "Packing weights: Yes · +500",
        "Packing kit: No",
        "Confirmed by 8 am: Yes · +500",
      ],
      performance: [
        {
          game: "Football short",
          result: "Won",
          stats: ["1 goal", "1 assist → pre-assist (KFANDRA edit)"],
          pts: 1100,
        },
      ],
    },
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
    gym: [
      { bodyPart: "Press Ups", equipment: "None", scheme: "4 sets, super 7's" },
      { bodyPart: "Abs", equipment: "None", scheme: "4 sets, 25 reps", notes: "z-shape" },
    ],
  },
  {
    id: "s5",
    type: "MMG",
    title: "Thursday session",
    date: "Thu 23/4",
    submittedAt: "12:14 pm",
    reportedTotal: 800,
    status: "rejected",
    kfandraNote: "Submitted after 12 noon cut-off. Resubmit next session.",
    mmg: {
      performance: [
        { game: "Other", result: "Lost", stats: [], pts: 0 },
      ],
      other: [{ description: "Drill reps", pts: 800 }],
    },
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
          Your history with KFANDRA approvals and edits.
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
                {s.kfandraNote && (
                  <p className="mt-1 text-[11px] italic text-gray-500 line-clamp-1">
                    KFANDRA: {s.kfandraNote}
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
            className="w-full bg-white rounded-t-3xl p-5 max-h-[88vh] overflow-y-auto"
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
                    KFANDRA approved
                  </p>
                  <p className="font-[family-name:var(--font-display)] text-2xl font-bold tabular-nums text-gray-900">
                    {selectedSub.approvedTotal !== undefined
                      ? selectedSub.approvedTotal.toLocaleString()
                      : "—"}
                  </p>
                </div>
              </div>
            )}

            {selectedSub.kfandraNote && (
              <div className="mb-4 rounded-xl border-l-4 border-blue-400 bg-blue-50/50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">
                  KFANDRA note
                </p>
                <p className="mt-1 text-sm text-blue-900">{selectedSub.kfandraNote}</p>
              </div>
            )}

            {selectedSub.type === "MMG" && selectedSub.mmg && (
              <MMGDetailView mmg={selectedSub.mmg} />
            )}

            {selectedSub.type === "Gym" && selectedSub.gym && (
              <GymDetailView rows={selectedSub.gym} />
            )}

            {selectedSub.narration && (
              <>
                <h3 className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mt-4 mb-2">
                  Narration
                </h3>
                <p className="rounded-xl border border-gray-100 bg-white p-3 text-sm italic text-gray-700">
                  {selectedSub.narration}
                </p>
              </>
            )}

            {selectedSub.status === "pending" && (
              <button className="mt-4 w-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 hover:bg-rose-100">
                Withdraw submission
              </button>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}

function MMGDetailView({ mmg }: { mmg: MMGDetail }) {
  return (
    <div className="space-y-4">
      {mmg.participation && mmg.participation.length > 0 && (
        <DetailSection label="Participation">
          {mmg.participation.map((line, i) => (
            <p key={i} className="px-3.5 py-2 text-sm text-gray-700">
              {line}
            </p>
          ))}
        </DetailSection>
      )}
      {mmg.performance && mmg.performance.length > 0 && (
        <DetailSection label="Performance">
          {mmg.performance.map((g, i) => (
            <div key={i} className="px-3.5 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">
                {g.game}
              </p>
              <div className="flex items-baseline justify-between">
                <p className="text-sm text-gray-700">
                  {g.result}
                  {g.stats.length > 0 ? ` · ${g.stats.join(", ")}` : ""}
                </p>
                <p className="text-sm font-bold tabular-nums text-blue-600">
                  +{g.pts.toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </DetailSection>
      )}
      {mmg.other && mmg.other.length > 0 && (
        <DetailSection label="Other">
          {mmg.other.map((o, i) => (
            <div key={i} className="flex items-baseline justify-between px-3.5 py-2">
              <p className="text-sm text-gray-700">{o.description}</p>
              <p className="text-sm font-bold tabular-nums text-violet-600">
                +{o.pts.toLocaleString()}
              </p>
            </div>
          ))}
        </DetailSection>
      )}
    </div>
  );
}

function GymDetailView({ rows }: { rows: GymRow[] }) {
  return (
    <DetailSection label="Exercises">
      {rows.map((r, i) => (
        <div key={i} className="px-3.5 py-2.5">
          <p className="text-sm font-semibold text-gray-900">
            {r.bodyPart}
            <span className="text-gray-400 font-normal"> · {r.equipment}</span>
            {r.weightKg !== undefined && r.weightKg > 0 && (
              <span className="text-emerald-700"> · {r.weightKg} kg</span>
            )}
          </p>
          <p className="text-sm text-gray-700">{r.scheme}</p>
          {r.notes && <p className="text-[11px] italic text-gray-500">{r.notes}</p>}
        </div>
      ))}
    </DetailSection>
  );
}

function DetailSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-2">
        {label}
      </h3>
      <div className="rounded-xl border border-gray-100 divide-y divide-gray-100 bg-white">
        {children}
      </div>
    </div>
  );
}
