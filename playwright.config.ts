import { defineConfig, devices } from "@playwright/test";

/**
 * Next 16 allows only ONE `next dev` per project directory (it holds a lock in
 * `.next/dev/lock`), so a suite on a private port could never start while the
 * developer had a dev server running — it would simply refuse. The suite
 * therefore targets the ordinary dev port and reuses whatever is already
 * serving it, starting one only when nothing is. Override with E2E_PORT.
 */
const PORT = Number(process.env.E2E_PORT ?? 3000);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  // One worker, deliberately. The KLCSRA specs drive real state in the local
  // Supabase — and some of that state is a singleton: the database permits
  // exactly ONE active season, which is precisely what those specs start,
  // close and assert on. Two workers would fight over that row. The suite is
  // small enough that serialising it costs a couple of minutes.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  // Recording a match is dozens of server round-trips against a dev server
  // that compiles routes on first hit, so the defaults (30s / 5s) are too tight.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
