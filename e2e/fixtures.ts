import { test as base, expect, type Page } from "@playwright/test";

/**
 * Shared fixture that records browser console errors and uncaught page
 * exceptions. Specs can assert `errors` is empty to catch runtime bugs that
 * don't throw a visible UI failure.
 */
type Fixtures = {
  errors: string[];
};

export const test = base.extend<Fixtures>({
  errors: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
    });
    page.on("pageerror", (err) => {
      errors.push(`pageerror: ${err.message}`);
    });
    await use(errors);
  },
});

export { expect };

/** Assert no runtime errors were collected, ignoring known noisy sources. */
export function expectNoErrors(errors: string[]) {
  const ignorable = [
    /favicon/i,
    /Failed to load resource.*404/i, // missing mock assets, not logic bugs
    /Download the React DevTools/i,
  ];
  const real = errors.filter((e) => !ignorable.some((re) => re.test(e)));
  expect(real, `Unexpected runtime errors:\n${real.join("\n")}`).toEqual([]);
}

export type { Page };
