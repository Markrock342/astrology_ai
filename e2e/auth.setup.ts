import { test as setup, expect } from "@playwright/test";
import { stubChartStatus } from "./helpers/sse";

const AUTH_FILE = "e2e/.auth/user.json";

/**
 * Sign in once and reuse the session for every spec.
 *
 * The app shell is guarded on the server (requireSessionShell), so there is no
 * way to reach the chat without a real session — stubbing /api/app/bootstrap is
 * not enough, the route would redirect to /login before React ever runs.
 */
setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  expect(
    email && password,
    "Set E2E_EMAIL and E2E_PASSWORD to a test account on the target database",
  ).toBeTruthy();

  // page.request — NOT the standalone `request` fixture. They have separate
  // cookie jars, and only this one writes the session cookie into the browser
  // context we are about to save.
  const res = await page.request.post("/api/auth/login", {
    data: { email, password },
  });
  expect(
    res.ok(),
    `Login failed (${res.status()}): ${await res.text()}`,
  ).toBeTruthy();

  // Prove the cookie is accepted by Auth.js and the protected API, not just
  // that the custom login route returned 200.
  const session = await page.request.get("/api/auth/session");
  expect(session.ok()).toBeTruthy();
  expect((await session.json()).user?.email).toBe(email);
  const me = await page.request.get("/api/me");
  expect(me.ok(), "The session must authorize the real protected API").toBeTruthy();

  // Prove the session actually lands on the guarded shell before we bank it.
  await stubChartStatus(page);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);

  await page.context().storageState({ path: AUTH_FILE });
});
