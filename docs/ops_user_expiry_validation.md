# Admin expiry validation

The save button used to be silently disabled until the trimmed reason had at least three characters. A date alone therefore looked impossible to save. Keep the reason mandatory for the audit trail, label it as required, and let Save show a visible validation message and focus the incomplete field. Accounts without editable entitlement remain disabled. Date validation uses the end of the selected Bangkok day; today is allowed until that instant.

Verification:

- `npm run ci`
- `npm run test:ui:user-expiry` renders the real React editor in Chromium, stubbing only its HTTP boundary. Covers empty/short/whitespace reasons, missing/past dates, cancel, dated and indefinite saves and reloads, stale revision errors, and ineligible accounts. Set `PLAYWRIGHT_EXECUTABLE_PATH` when using an installed headless Chromium; otherwise the script uses installed Brave on macOS or Playwright's browser.
- `DATABASE_URL=postgresql://USER@127.0.0.1:PORT/hora_admin_filter_test_expiry npm run test:integration:admin-users` runs against an isolated migrated PostgreSQL database. The runner pins DIRECT_URL to the same local database. Includes persisted dated/indefinite expiry for Free accounts with purchased questions and Pro accounts, unchanged balances and allowances, no extra subscriptions/grants, stale revisions, and rollback on audit failure.

The browser harness is not a full authenticated Next.js end-to-end test. The separate PostgreSQL test verifies the actual expiry service and audit transaction. Neither test modifies customer accounts.
