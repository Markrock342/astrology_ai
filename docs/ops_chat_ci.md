# Isolated chat CI

The former chat job used a stale external database secret. PostgreSQL reported a missing tenant/user during login, producing HTTP 500. Auth.js also rejected the local host because AUTH_TRUST_HOST was missing.

The job now owns a PostgreSQL 17 service (`hora_chat_test_ci`), applies all migrations, and creates a synthetic verified member with a birth profile, Free subscription, question balance and assistant message. Credentials and the Auth.js signing secret are generated per run. The runner pins DATABASE_URL and DIRECT_URL, sets the exact local Auth.js URL and trusted-host flag, disables the scheduler and external email/AI/storage credentials, builds the production app, then exercises the actual login API, session endpoint, protected profile API, and chat UI. Chat responses and chart status are stubbed for deterministic, cost-free answers without external AI or chart scraping. Feedback uses the actual API and its saved DOWN verdict is verified directly in PostgreSQL; 404 is a failure.

Run locally with a local disposable database named `hora_chat_test` or `hora_chat_test_<suffix>`:

```sh
DATABASE_URL=postgresql://USER@127.0.0.1:5432/hora_chat_test_local npm run test:e2e:chat
```

Other database names and remote hosts are rejected before migration or fixture creation. The runner removes its member and session storage file and stops its server after success/failure. The isolated database belongs to the test environment; never populate it with production data. CI always builds fresh. Local `CHAT_E2E_REUSE_BUILD=1` is allowed only when the running bundle's source fingerprint matches the current checkout. Local macOS builds use webpack because the external SSD cannot reliably host the Turbopack persistence database; Linux CI uses the standard production build.

No production database, E2E account, or GitHub secret is needed. Reports, traces and the test server log are uploaded as `chat-playwright-report` for seven days. Authentication storage is excluded from artifacts. Treat traces as internal test artifacts because they can contain the temporary test session.

For changes to this gate, validate locally and on a pull request before merging to main (which triggers Coolify production deployment).
