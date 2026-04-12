import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-600 to-blue-800 p-4">
      <main className="flex flex-col items-center gap-8 text-center text-white">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20 text-3xl font-bold backdrop-blur">
          KF
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          KFandra Track
        </h1>
        <p className="max-w-md text-lg text-blue-100">
          Respect, Trust, Integrity, Passion and Humility
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="rounded-xl bg-white/10 px-6 py-4 backdrop-blur">
            <h2 className="text-xl font-semibold">MMG</h2>
            <p className="text-sm text-blue-200">Monthly Multi-Games</p>
          </div>
          <div className="rounded-xl bg-white/10 px-6 py-4 backdrop-blur">
            <h2 className="text-xl font-semibold">KLCFESGR1</h2>
            <p className="text-sm text-blue-200">League & Cup</p>
          </div>
        </div>
        <Link
          href="/mockups"
          className="rounded-full bg-white px-8 py-3 text-sm font-semibold text-blue-700 shadow-lg transition-transform hover:scale-105"
        >
          View UI Mockups
        </Link>
      </main>
    </div>
  );
}
