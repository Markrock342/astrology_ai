import { defineConfig, devices } from "@playwright/test";

/**
 * E2E for the chat flow.
 *
 * Every regression that reached production this cycle — streaming stalls, the
 * sidebar not following the URL, "ไม่พบข้อความผู้ใช้นี้" on edit, a quota that
 * silently halved — lived in the client and was invisible to the 159 unit
 * tests, which only ever exercise services. These specs drive the real UI.
 *
 * The AI itself is stubbed at the network boundary (see e2e/helpers/sse.ts), so
 * a run is deterministic, costs nothing, and takes seconds. What we are testing
 * is OUR code, not Gemini's.
 *
 * Requires a real signed-in session (the app shell is server-guarded), so set:
 *   E2E_EMAIL=... E2E_PASSWORD=...   (a test account on the target DB)
 * Specs skip with a clear message when it is missing.
 */
export default defineConfig({
  testDir: "./e2e",
  // Kept out of tests/ on purpose: vitest owns tests/**/*.test.ts.
  // macOS writes AppleDouble sidecars (._foo.spec.ts) on non-native volumes;
  // Playwright would try to parse them as specs and die on the binary header.
  testIgnore: ["**/._*"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 45_000,

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],

  // Point E2E_BASE_URL at a deployed URL to skip booting a local server.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
