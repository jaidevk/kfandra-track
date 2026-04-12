export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-600 to-blue-800 p-4">
      <main className="flex flex-col items-center gap-8 text-center text-white">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          KFANDRA Helper
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
        <p className="text-sm text-blue-300">Coming Soon</p>
      </main>
    </div>
  );
}
