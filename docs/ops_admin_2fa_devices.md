# Admin 2FA remembered browser

Admins may explicitly select **จดจำอุปกรณ์นี้ 30 วัน** before entering the six-digit code. It is unchecked by default and is available during initial enrollment, TOTP verification, and backup-code verification. Login remains required. Without consent, the existing 12-hour proof applies and logout clears it.

The separate remembered-browser cookie survives logout for the same account. It is HttpOnly, Secure in production, SameSite=Lax, host-only, and expires exactly 30 days after successful verification. Reading it never renews it. It contains a purpose-separated HMAC-signed proof bound to the account ID, role, password hash, encrypted TOTP secret, and enrollment timestamp. Password changes, TOTP reset/re-enrollment, signing-key rotation, account disablement or role removal prevent reuse. Old unbound 2FA cookies are not accepted; existing admins must verify once after this release.

**ลืมอุปกรณ์ 2FA** in the admin header clears both local proofs after confirmation and returns to verification. This clears this browser only; it does not remotely revoke copied cookies or list other browsers. For a lost device, change the password or have a Super Admin reset the affected account's 2FA. Remembered browsers do not bypass the live session, account-status or role guards. Private browsing and clearing site cookies require verification again.

No database schema change is needed. TOTP time-step consumption now uses a conditional database update so only one concurrent redemption succeeds; backup codes retain their atomic single-use check.

Validation:

- `npm run ci`: token tampering, account/purpose binding, fixed expiry, credential changes, cookie flags, opt-in/out, API validation, replay guards and existing tests.
- `npm run test:ui:admin`: actual expiry and 2FA React components in Chromium, with HTTP/navigation boundaries stubbed; covers auto-submit, explicit consent, failed OTP, backup codes, forget/cancel, and initial enrollment. Screenshots under `output/admin-ui-tests`.
- `DATABASE_URL=postgresql://USER@127.0.0.1:PORT/hora_admin_filter_test_2fa npm run test:integration:admin-users`: isolated PostgreSQL only; tests persistence, fixed expiry, credential reset, logout/re-entry, concurrent TOTP and backup-code spending and original expiry/filter regressions. Both database URLs are pinned by the runner.

GitHub's admin regression job runs the UI and isolated PostgreSQL suites. Coolify's versioned Nixpacks commands run CI and both UI suites before the production build. Keep Coolify's custom build command empty so it does not override these commands.
