import Link from "next/link";

const quickStats = [
  { label: "Your MMG Points", value: "15,700", change: "+2,800", positive: true },
  { label: "MMG Rank", value: "#4", change: "of 13", positive: true },
  { label: "Club Balance", value: "120 Kr", change: "Cicada Baby's", positive: true },
];

const upcomingSessions = [
  { day: "Tue", date: "15 Apr", time: "6:10 AM", status: "upcoming" },
  { day: "Thu", date: "17 Apr", time: "6:10 AM", status: "upcoming" },
  { day: "Sat", date: "19 Apr", time: "6:10 AM", status: "upcoming" },
];

const recentActivity = [
  { action: "Points submitted", detail: "Thu 9/4/26 — 2,100 pts", time: "2d ago" },
  { action: "Match played", detail: "CB vs PB — Won 3-2", time: "3d ago" },
  { action: "Attendance confirmed", detail: "Tue 7/4/26 — 1st to confirm", time: "5d ago" },
];

export default function MockupHome() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Welcome */}
      <div className="rounded-xl bg-blue-600 p-5 text-white">
        <p className="text-sm text-blue-200">Good morning</p>
        <h1 className="text-2xl font-bold">Acid</h1>
        <p className="mt-1 text-sm text-blue-100">
          Respect, Trust, Integrity, Passion & Humility
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        {quickStats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl bg-white p-3 shadow-sm border border-gray-100"
          >
            <p className="text-xs text-gray-500">{stat.label}</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{stat.value}</p>
            <p className={`text-xs ${stat.positive ? "text-green-600" : "text-red-600"}`}>
              {stat.change}
            </p>
          </div>
        ))}
      </div>

      {/* Upcoming Sessions */}
      <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          Upcoming Sessions
        </h2>
        <div className="flex gap-3">
          {upcomingSessions.map((session) => (
            <div
              key={session.date}
              className="flex-1 rounded-lg border border-gray-200 p-3 text-center"
            >
              <p className="text-xs font-medium text-blue-600">{session.day}</p>
              <p className="text-sm font-semibold text-gray-900">{session.date}</p>
              <p className="text-xs text-gray-500">{session.time}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/mockups/mmg-session"
          className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm border border-gray-100"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-xl">
            ⚽
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Submit MMG</p>
            <p className="text-xs text-gray-500">Enter session points</p>
          </div>
        </Link>
        <Link
          href="/mockups/klc-balance"
          className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm border border-gray-100"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-xl">
            💰
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Balance Sheet</p>
            <p className="text-xs text-gray-500">View club finances</p>
          </div>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          Recent Activity
        </h2>
        <div className="flex flex-col gap-3">
          {recentActivity.map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{item.action}</p>
                <p className="text-xs text-gray-500">{item.detail}</p>
              </div>
              <span className="text-xs text-gray-400">{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
