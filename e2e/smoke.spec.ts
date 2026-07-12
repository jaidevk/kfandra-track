import { test, expect, expectNoErrors } from "./fixtures";

/**
 * Harness smoke test. Intentionally route-agnostic: it only proves the
 * Playwright + dev-server + console-error plumbing works. Flow-specific specs
 * should be added once the real app (not the mockups) is being built.
 */
test.describe("Harness smoke", () => {
  test("app boots without runtime errors", async ({ page, errors }) => {
    const res = await page.goto("/");
    expect(res?.ok()).toBeTruthy();
    await page.waitForLoadState("networkidle");
    expectNoErrors(errors);
  });
});
