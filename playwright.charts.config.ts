import { defineConfig } from "@playwright/test";

if ((process.env.CI || process.env.CHART_VISUAL_MUTATION === "1") && process.argv.some(arg => arg.startsWith("--update-snapshots"))) {
  throw new Error("Review and update chart baselines locally; CI must never approve its own screenshots.");
}

export default defineConfig({
  testDir: "./visual-tests",
  testMatch: "charts.spec.ts",
  testIgnore: ["**/._*"],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  outputDir: "output/chart-visual-tests/results",
  snapshotPathTemplate: "{testDir}/snapshots/{platform}/{projectName}/{arg}{ext}",
  updateSnapshots: "none",
  reporter: [["list"], ["html", { outputFolder: "output/chart-visual-tests/report", open: "never" }]],
  expect: { toHaveScreenshot: { animations: "disabled", caret: "hide", scale: "css", threshold: 0.1, maxDiffPixels: 100 } },
  projects: [
    { name: "desktop-dark", use: { viewport: { width: 1280, height: 1000 }, colorScheme: "dark" } },
    { name: "desktop-light", use: { viewport: { width: 1280, height: 1000 }, colorScheme: "light" } },
    { name: "mobile-dark", use: { viewport: { width: 390, height: 844 }, colorScheme: "dark" } },
    { name: "mobile-light", use: { viewport: { width: 390, height: 844 }, colorScheme: "light" } },
    { name: "narrow-dark", use: { viewport: { width: 320, height: 800 }, colorScheme: "dark" } },
    { name: "narrow-light", use: { viewport: { width: 320, height: 800 }, colorScheme: "light" } },
  ],
});
