"use client";

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";

type EntryType = "MMG" | "Gym" | "Diet";

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

type DietRow = {
  meal: string;
  window: string;
  items: string[];      // pre-summarised lines
  skipped?: boolean;
};

type Entry = {
  id: string;
  type: EntryType;
  title: string;
  date: string;
  loggedAt: string;
  summary: string;       // one-line summary used in the list
  reportedTotal?: number; // MMG/Gym only
  mmg?: MMGDetail;
  gym?: GymRow[];
  diet?: DietRow[];
  narration?: string;
};

const entries: Entry[] = [
  {
    id: "e1",
    type: "MMG",
    title: "Fooba (Big Goal)",
    date: "Today · Sat 9 May",
    loggedAt: "11:42 am",
    reportedTotal: 4500,
    summary: "Won · 2 goals · 1 assist · 4,500 pts",
    mmg: {
      participation: [
        "Confirmation order: 3rd · pts at approval",
        "Arrival: 4th · pts at approval",
        "Unpacking: Yes · +500",
        "Packing weights: No",
        "Packing kit: Yes · +500",
        "Confirmed by 11 am: Yes · +500",
      ],
      performance: [
        { game: "Football short", result: "Won", stats: ["2 goals", "1 assist"], pts: 2200 },
        { game: "3-and-in",       result: "Drew", stats: ["1 goal"],            pts:  600 },
      ],
      other: [{ description: "1st in race", pts: 200 }],
    },
    narration: "Left at 7:30 — kid drop-off",
  },
  {
    id: "e2",
    type: "Diet",
    title: "Today",
    date: "Today · Sat 9 May",
    loggedAt: "ongoing",
    summary: "5 of 8 meals logged · Breakfast, Lunch, Snack…",
    diet: [
      { meal: "Breakfast",         window: "6 am – 9 am",   items: ["Brown bread × 3", "Coffee × 1", "Banana × 1"] },
      { meal: "Mid-Morning Snack", window: "9 am – 12 pm",  items: ["Apple × 1"] },
      { meal: "Lunch",             window: "12 pm – 2 pm",  items: ["Roti × 4", "Dal × 1", "Bhendi × 2", "Curd × 1"] },
      { meal: "Midday Snack",      window: "2 pm – 4 pm",   items: [], skipped: true },
      { meal: "Evening Tea",       window: "4 pm – 6 pm",   items: ["Tea × 1", "Biscuits × 2"] },
    ],
  },
  {
    id: "e3",
    type: "Gym",
    title: "Shoulders + Biceps",
    date: "Yesterday · Fri 8 May",
    loggedAt: "6:20 am",
    reportedTotal: 5,
    summary: "5 exercises · ~22 sets",
    gym: [
      { bodyPart: "Shoulders", equipment: "Sbb",   weightKg: 12, scheme: "6 sets, 8, 4×6, 8" },
      { bodyPart: "Biceps",    equipment: "Z-bar", weightKg: 15, scheme: "6 sets, All 6" },
      { bodyPart: "Press Ups", equipment: "None",                scheme: "4 sets, super 7's" },
      { bodyPart: "Abs",       equipment: "None",                scheme: "4 sets, 25 reps", notes: "z-shape" },
      { bodyPart: "Stamina",   equipment: "None",                scheme: "Variation!", notes: "20 min jog" },
    ],
  },
  {
    id: "e4",
    type: "Diet",
    title: "Yesterday",
    date: "Yesterday · Fri 8 May",
    loggedAt: "all 8 meals",
    summary: "All 8 meals logged · 1 custom item",
    diet: [
      { meal: "Breakfast",         window: "6 am – 9 am",   items: ["Poha × 1", "Tea × 1"] },
      { meal: "Mid-Morning Snack", window: "9 am – 12 pm",  items: ["Mixed fruit × 1"] },
      { meal: "Lunch",             window: "12 pm – 2 pm",  items: ["Pulao × 1", "Curd × 1", "Sabudana khichadi × 1 (custom)"] },
      { meal: "Midday Snack",      window: "2 pm – 4 pm",   items: [], skipped: true },
      { meal: "Evening Tea",       window: "4 pm – 6 pm",   items: ["Coffee × 1", "Chivda × 1"] },
      { meal: "Supper",            window: "6 pm – 8 pm",   items: ["Roti × 3", "Aloo bhaji × 1", "Dal × 1"] },
      { meal: "Post-Supper",       window: "8 pm – 10 pm",  items: ["Milk × 1"] },
      { meal: "Midnight",          window: "10 pm – 2 am",  items: [], skipped: true },
    ],
  },
  {
    id: "e5",
    type: "MMG",
    title: "Short Game",
    date: "Sat 2 May",
    loggedAt: "11:58 am",
    reportedTotal: 1700,
    summary: "Won · 1 goal · 1,700 pts",
    mmg: {
      participation: [
        "Confirmation order: 5th · pts at approval",
        "Arrival: 5th · pts at approval",
        "Unpacking: Yes · +500",
        "Packing weights: Yes · +500",
        "Packing kit: No",
        "Confirmed by 11 am: Yes · +500",
      ],
      performance: [
        { game: "Football short", result: "Won", stats: ["1 goal", "1 pre-assist"], pts: 1100 },
      ],
    },
  },
];

const TYPE_CHIP: Record<EntryType, { bg: string; text: string }> = {
  MMG:  { bg: "bg-blue-50",    text: "text-blue-600" },
  Gym:  { bg: "bg-emerald-50", text: "text-emerald-600" },
  Diet: { bg: "bg-amber-50",   text: "text-amber-700" },
};

export default function HistoryMockup() {
  const [filter, setFilter] = useState<"all" | EntryType>("all");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = entries.filter((e) => filter === "all" || e.type === filter);
  const selectedEntry = entries.find((e) => e.id === selected);

  return (
    <div className="flex flex-col gap-4 p-5">
      <header>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-gray-900">
          History
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Everything you&rsquo;ve logged. Saved on this device.
        </p>
      </header>

      {/* Filter chips */}
      <div className="flex gap-2 flex-wrap">
        {(["all", "MMG", "Gym", "Diet"] as const).map((f) => (
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
        {filtered.map((e) => {
          const chip = TYPE_CHIP[e.type];
          return (
            <button
              key={e.id}
              onClick={() => setSelected(e.id)}
              className="w-full text-left rounded-2xl border border-gray-100 bg-white p-4 hover:border-gray-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${chip.bg} ${chip.text}`}
                >
                  {e.type.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {e.date} · {e.title}
                    </p>
                    <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                      {e.loggedAt}
                    </span>
                  </div>
                  <p className="text-[12px] text-gray-500 mt-0.5">{e.summary}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Link
          href="/mockups/mmg-session"
          className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 text-center text-xs font-semibold text-blue-700 hover:bg-blue-100"
        >
          + MMG
        </Link>
        <Link
          href="/mockups/gym-session"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-center text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
        >
          + Gym
        </Link>
        <Link
          href="/mockups/diet"
          className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-3 text-center text-xs font-semibold text-orange-700 hover:bg-orange-100"
        >
          + Diet
        </Link>
      </div>

      {/* Detail sheet */}
      {selectedEntry && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex items-end"
          onClick={() => setSelected(null)}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-white rounded-t-3xl p-5 max-h-[88vh] overflow-y-auto"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {selectedEntry.type.toUpperCase()} · {selectedEntry.date}
                </p>
                <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-gray-900">
                  {selectedEntry.title}
                </h2>
                <p className="text-[11px] text-gray-500">Logged {selectedEntry.loggedAt}</p>
              </div>
            </div>

            {selectedEntry.type === "MMG" && selectedEntry.reportedTotal !== undefined && (
              <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-3 mb-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                  Your tally
                </p>
                <p className="font-[family-name:var(--font-display)] text-3xl font-bold tabular-nums text-blue-700">
                  {selectedEntry.reportedTotal.toLocaleString()} pts
                </p>
              </div>
            )}

            {selectedEntry.type === "MMG" && selectedEntry.mmg && (
              <MMGDetailView mmg={selectedEntry.mmg} />
            )}

            {selectedEntry.type === "Gym" && selectedEntry.gym && (
              <GymDetailView rows={selectedEntry.gym} />
            )}

            {selectedEntry.type === "Diet" && selectedEntry.diet && (
              <DietDetailView meals={selectedEntry.diet} />
            )}

            {selectedEntry.narration && (
              <>
                <h3 className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mt-4 mb-2">
                  Narration
                </h3>
                <p className="rounded-xl border border-gray-100 bg-white p-3 text-sm italic text-gray-700">
                  {selectedEntry.narration}
                </p>
              </>
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

function DietDetailView({ meals }: { meals: DietRow[] }) {
  return (
    <DetailSection label="Meals">
      {meals.map((m, i) => (
        <div key={i} className="px-3.5 py-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">{m.meal}</p>
            <p className="text-[10px] uppercase tracking-wide text-gray-400">
              {m.window}
            </p>
          </div>
          {m.skipped ? (
            <p className="text-sm italic text-gray-500">Skipped</p>
          ) : m.items.length === 0 ? (
            <p className="text-sm italic text-gray-400">Not logged</p>
          ) : (
            <p className="text-sm text-gray-700">{m.items.join(" · ")}</p>
          )}
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
