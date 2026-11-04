# Payment review history

Admin → ตรวจการโอนเงิน shows an independent history beneath the payment queue. It remains visible with an empty pending queue. Filters use member name/email/payment ID, decision, reviewer and inclusive Bangkok review dates. Page size is 20; the private API validates a maximum of 100 and uses `private, no-store`.

New approvals and rejections append a versioned `receipt` to the existing payment audit row in the same database transaction as the payment state and grants. No migration/backfill is required. The receipt freezes member/reviewer identity, selected package name/code, paid amount, granted questions/legacy credits, actual grant start/end, resolved expiry rule and note. It is read-only through the admin interface. Duplicate/concurrent decisions cannot grant twice or produce a second successful receipt. If audit persistence fails, the transaction rolls back the payment and grants.

For question packs, the resolved rule and actual purchased-pool expiry come from `applyQuestionPack`. A 30-day pack can preserve an existing later date or unlimited pool: the UI displays the package rule separately from the actual end date. Monthly renewals record the added 30 days and resulting membership expiry. Usage-only top-ups retain the existing purchased-pool expiry.

The history service does not read current catalog rules or wallet balances. Old rows without a complete, consistent versioned receipt show the known payment/reviewer fields and an explicit missing-grant-details message. It does not infer old quotas or dates from today's package settings. A missing review timestamp is marked unknown instead of substituting the submission date; those rows are excluded when filtering by review dates. Existing payments/audits are not rewritten to manufacture snapshots. Current account names may be used for these legacy rows and the reviewer filter; new receipt identities remain frozen.

`GET /api/admin/payments/history` requires the existing admin + 2FA authorization. It returns selected display fields only, without slip paths, IP addresses or raw audit JSON. Totals and rows are read in one repeatable-read transaction. UTC timestamp bounds are explicitly converted independently of PostgreSQL session timezone.

Validation:

- `npm run test:ui:payment-history`: real React/Chromium, synthetic HTTP fixtures; checks layout, dates, filters, pagination, legacy gaps, approval/rejection refresh, stale-response protection, empty queues and desktop/mobile screenshots.
- `npm run test:integration:admin-users`: isolated local PostgreSQL; checks frozen receipts after catalog/profile/wallet edits, day boundaries, concurrency and full rollback on audit failure.
- `npm run ci`: route authorization, input validation, payment regressions, typecheck/lint/unit checks.

The payment browser test is included in `test:ui:admin`, so both GitHub Actions and the actual Coolify build must pass it before deployment. Screenshots are stored under `output/admin-ui-tests/payment-history-*.png` and uploaded with the existing admin artifact.
