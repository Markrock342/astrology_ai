# Admin expiry validation

The save button used to be silently disabled until the trimmed reason had at least three characters. A date alone therefore looked impossible to save. Keep the reason mandatory for the audit trail, label it as required, and let Save show a visible validation message and focus the incomplete field. Date validation uses the end of the selected Bangkok day; today is allowed until that instant.

## Free-only regression

The initial coverage missed a Free user with only included questions and zero purchased questions. The old service returned `canEdit: false` for that account. Every existing user can now edit the deadline, including a zero-balance Free account. Signup expiry is separately configurable on the Free package (see `ops_free_signup_expiry.md`); changing it never rewrites existing accounts.

Free deadlines are stored in the active Free subscription and mirrored in the included wallet period. If metadata is missing, only an empty wallet/Free record is initialized, with no grant or Pro access. Expired paid subscriptions are not revived when editing a currently Free account. At the chosen deadline, only the scheduled Free included pool lapses to zero, without being refilled to the default Free allowance or extended by a newly purchased pack; purchased questions follow their own date. This is expiry of questions/entitlements, not account suspension. Clearing the date before expiry keeps the remaining questions; already consumed or expired questions are not restored.

Tests must include Free included-only, Free zero balance, expired paid to Free, missing wallet/metadata, actual deadline enforcement, default open-ended behavior, and rollback. `npm run test:e2e:free-expiry` uses an actual Next.js page/API backed by the isolated local test DB, authenticated synthetic admin fixtures, and actual clicks/select/save/reload. It does not mock the expiry endpoint. It rejects non-local/non-test database targets, pins both database URLs, disables external email/AI/Redis, and cleans up its users and server process. Chromium must be installed. GitHub admin CI runs this test after the database suite; Coolify never runs this database-backed test against production.

CI runs this E2E with an actual `next build` / `next start` bundle against its disposable database, with the internal scheduler off. This avoids development Fast Refresh replacing the document during reload assertions. Locally it defaults to webpack dev for faster iteration; set `FREE_EXPIRY_E2E_PRODUCTION=1` for the same production build test. Test failures save a page screenshot along with the server log. No assertions are retried at suite level or skipped.

Verification:

- `npm run ci`
- `npm run test:ui:user-expiry` renders the real React editor in Chromium, stubbing only its HTTP boundary. Covers empty/short/whitespace reasons, missing/past dates, cancel, dated and indefinite saves and reloads, stale revision errors, and ineligible accounts. Set `PLAYWRIGHT_EXECUTABLE_PATH` when using an installed headless Chromium; otherwise the script uses installed Brave on macOS or Playwright's browser.
- `DATABASE_URL=postgresql://USER@127.0.0.1:PORT/hora_admin_filter_test_expiry npm run test:integration:admin-users` runs against an isolated migrated PostgreSQL database. The runner pins DIRECT_URL to the same local database. Includes persisted dated/indefinite expiry for Free accounts with purchased questions and Pro accounts, unchanged balances and allowances, no extra subscriptions/grants, stale revisions, and rollback on audit failure.

The component browser harness stubs HTTP; the separate `test:e2e:free-expiry` covers the real authenticated Next.js page and API. PostgreSQL tests verify deadline enforcement and the audit transaction. None of these tests modifies customer accounts.

## Automatic gates

GitHub Actions always runs `admin-regression` after `check`, with a disposable PostgreSQL 17 service and Chromium. It needs no production credentials and does not skip for missing E2E secrets. Screenshots (including a failure screenshot) are retained as artifacts for seven days. Existing chat E2E waits for this job as well.

Coolify starts builds directly from Git pushes, independently of GitHub Actions. Therefore `nixpacks.toml` also runs local CI and the actual admin expiry browser test before `next build`. A failing command stops the image build, preserving the running version. The PostgreSQL integration suite runs in Actions only, never against a production database during image builds. Browser tests mock all expiry HTTP calls and use synthetic data.

Run screenshots locally with `ADMIN_UI_ARTIFACT_DIR=output/admin-ui-tests npm run test:ui:user-expiry`. These capture the real component and repository styles using test data, not a signed-in production page.

References: [Nixpacks phase configuration](https://nixpacks.com/docs/configuration/file), [Playwright CI browser installation](https://playwright.dev/docs/browsers).
