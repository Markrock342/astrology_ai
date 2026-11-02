# Admin user package filtering

`GET /api/admin/users?packageCode=FREE` filters current entitlement, not payment history.
Free includes users with no subscription, a Free subscription, or only expired/cancelled paid subscriptions. Any ACTIVE PRO-type subscription with a null or future expiry excludes the user from Free. At the exact expiry timestamp, access has expired.

Other package codes match current, unexpired PRO subscriptions, including manual grants without payments. The historical latest-purchase column and its sort remain unchanged. The dropdown is labelled current package and excludes credit-only top-ups.

The count, pagination query and hydrated subscription rows share one captured timestamp. EXISTS avoids duplicate users with multiple matching subscription rows.

## Regression checks

`npm run ci` runs type checking, lint and the database-free suite. The PostgreSQL integration suite requires a separate migrated test database:

```sh
DATABASE_URL=postgresql://LOCAL_USER@127.0.0.1:LOCAL_PORT/hora_admin_filter_test npm run test:integration:admin-users
```

The integration runner pins both DATABASE_URL and DIRECT_URL to this target before migrating. It refuses remote hosts, other database names and query parameters that could override the host. Never use production credentials or a production database for fixtures.

Seven real-database checks cover the original payment-history regression, sign-up, expiry boundary, cancellation, manual/lifetime grants, changed current packages, duplicate rows, account status, pagination and preservation of historical purchases.
