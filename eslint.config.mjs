import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Not part of the app source: agent worktrees/skills and build caches
    // (vendored JS with its own conventions), and the Playwright E2E suite
    // (separate tooling/config, linted on its own). Keeping these out of the
    // app lint gate keeps `npm run lint` focused on src/.
    ".claude/**",
    "e2e/**",
    "playwright.config.ts",
  ]),
]);

export default eslintConfig;
