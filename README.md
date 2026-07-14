# HoraSard — AI Horoscope Web App (โหราศาสตร์)

Production-ready **Phase 1** of a Thai AI horoscope service by Limit Code Studio.
Users register, enter birth info, pick a category, and ask an AI (Gemini) for a
reading, gated by Free/Pro permissions and a Credit/Quota system. Includes an
Admin CMS for users, categories, prompts, AI models, packages, credits, manual
payments and usage logs.

> **Scope guardrails (do not violate):**
> - Phase 2 features are **out of scope** (voice/STT/TTS, payment gateway, file
>   upload/RAG, native apps, etc.). Do not build them.
> - **Never** call Gemini directly from the browser — all AI goes through the
>   server adapter/router.
> - **Never** store API keys in the DB as plain text — the DB stores only a
>   `secretReference` (env var name).
> - **Never** double-charge credit on AI error or duplicate click — deduct only
>   after a validated success, guarded by an `Idempotency-Key`.

> **Canonical project reference:** [`PROJECT_STRUCTURE.md`](./PROJECT_STRUCTURE.md) — folder layout, DB, API, AI strategy, Phase boundaries, milestones.

---

## Tech stack

| Area     | Choice                                             |
| -------- | -------------------------------------------------- |
| Framework| Next.js 16 (App Router) + React 19 + TypeScript    |
| Styling  | Tailwind CSS v4 (dark astrology theme)             |
| DB / ORM | PostgreSQL + Prisma **6** (pinned for stability)   |
| Auth     | Auth.js (NextAuth v5) — Credentials + optional Google |
| AI       | Gemini via provider adapter/router                 |
| Validation | Zod                                              |

---

## Getting started

```bash
# 1. Install deps
npm install

# 2. Configure env
cp .env.example .env
#   - set DATABASE_URL to your local/managed Postgres
#   - run `npx auth secret` to fill AUTH_SECRET
#   - GEMINI_API_KEY can stay empty until Milestone 3

# 3. Create the schema + seed baseline data
npm run db:migrate      # creates tables (dev migration)
npm run db:seed         # categories, Free/Pro packages, prompts, Gemini config, admin

# 4. Run
npm run dev             # http://localhost:3000
```

Default admin email (from seed): `admin@horasard.local` — set `SEED_ADMIN_PASSWORD` in `.env` (required, never commit the real value).

### Useful scripts

| Script              | Purpose                          |
| ------------------- | -------------------------------- |
| `npm run dev`       | Dev server                       |
| `npm run build`     | Production build                 |
| `npm run typecheck` | `tsc --noEmit`                   |
| `npm run lint`      | ESLint                           |
| `npm run ci`        | Local CI gate (typecheck+lint+unit) — same as GH Actions check job |
| `npm run ci:e2e`    | Playwright E2E (needs `.env` E2E/DB secrets) |
| `npm run hooks:install` | Enable pre-push hook to run `npm run ci` |
| `npm run db:migrate`| Prisma migrate dev               |
| `npm run db:seed`   | Seed baseline data               |
| `npm run db:studio` | Prisma Studio (browse DB)        |

### CI while GitHub Actions is unavailable

If GitHub Actions is locked (billing), use the local gate instead of waiting on Actions:

```bash
npm run hooks:install   # once per clone — block push when checks fail
npm run ci              # typecheck · lint · unit (fast)
npm run ci:e2e          # browser E2E when you have DATABASE_URL + E2E_* in .env
```

**Vercel is the remote gate.** It runs `vercel-build` (`npm run ci && next build`) on every
push, so a failing typecheck, lint or unit test now fails the build — and a broken commit never
reaches production. Unlike the pre-push hook this covers *everyone*: teammates who never ran
`hooks:install`, and anyone who pushes with `--no-verify`.

Not covered there: the browser E2E (`npm run ci:e2e`) — it needs a real session and a browser.
Run it locally before shipping anything that touches the chat, or clear the GitHub billing lock
and `.github/workflows/ci.yml` will run it on every push and PR, exactly as written.

---

## Architecture: the golden rule

**UI never contains business logic.** Pages/components call the **service
layer** in `src/server/*`. This keeps the backend portable (extractable to
NestJS later) and keeps secrets/AI off the client.

```
src/
├─ app/                     # Next.js routes (thin — call services only)
│  ├─ (public)/             # landing, login, register, forgot-password
│  ├─ (app)/                # authenticated user area (guarded in layout)
│  ├─ (admin)/admin/        # Admin CMS (role-guarded in layout)
│  └─ api/                  # Route Handlers → call src/server/*
├─ server/                  # ★ business/service layer (no React here)
│  ├─ db.ts                 # Prisma singleton
│  ├─ auth/                 # NextAuth config + rbac guards
│  ├─ credit/               # atomic deduct/refund/grant (no double charge)
│  ├─ horoscope/            # reading orchestrator (the full flow)
│  ├─ ai/                   # adapter + gemini + router + prompt-builder + usage
│  └─ audit/                # admin audit logging
├─ lib/                     # errors, http helpers, zod schemas, rate-limit, dates
├─ config/                  # env validation + constants/defaults
├─ components/              # UI components
└─ types/                   # shared types (HoroscopeResponse, AI I/O)
prisma/
├─ schema.prisma            # all tables + relations (M1 deliverable)
└─ seed.ts                  # baseline data
```

---

## 👥 Work division (PM: assign these)

The scaffold compiles, builds, and every page/route exists as a stub. Pick up
your lane and replace the `ScaffoldNote` placeholders with real work.

> **Per-role guides with git workflow + milestone checklists:**
> Frontend → [`FRONTEND_TASKS.md`](./FRONTEND_TASKS.md) · งานรอบนี้ [`FE_ASSIGN.md`](./FE_ASSIGN.md)
> Backend → [`BACKEND_TASKS.md`](./BACKEND_TASKS.md) · งานรอบนี้ [`BE_ASSIGN.md`](./BE_ASSIGN.md)

### 🟦 Frontend developer

Owns everything visual + client state. Talk to the backend only via the JSON API.

- **UI system**: dark astrology theme (already in `globals.css`), shared
  components in `src/components/` (buttons, cards, inputs, category tiles,
  loading/skeleton states). Consider adding shadcn/ui.
- **Public**: `src/app/(public)/*` — landing (hero, categories, Free vs Pro,
  how-it-works, FAQ, footer), login, register, forgot-password forms.
- **User area**: `src/app/(app)/*` — sidebar + mobile bottom nav, dashboard,
  onboarding (birth form + validation), **reading page** (all states: loading /
  AI processing / success / no-quota / locked / timeout / error / retry),
  history list + detail, account/package page.
- **Admin UI**: `src/app/(admin)/admin/*` — tables, forms, filters for each
  section (data comes from admin APIs).
- **Auth on client**: use NextAuth `signIn`/`signOut`; call `POST /api/auth/register`.
- **Reading requests**: always send an `Idempotency-Key` header (e.g. a UUID
  generated when the user opens the reading form) so retries don't double-charge.

### 🟩 Backend developer

Owns the service layer, API routes, DB, and AI integration.

- **DB**: extend/finalize `prisma/schema.prisma`; write migrations; keep `seed.ts` current.
- **Auth**: complete `src/server/auth/config.ts` (Credentials done; add Google if
  confirmed), password reset flow, session/role plumbing.
- **APIs**: implement remaining route handlers under `src/app/api/*` following
  the working examples (`register`, `me`, `me/credits`, `horoscope/categories`,
  `horoscope/readings`). Each must: validate with Zod, authorize, use `handle()`.
- **Credit service** (`src/server/credit`): already implements atomic deduct with
  optimistic locking + immutable ledger — reuse it everywhere; don't bypass it.
- **Reading flow** (`src/server/horoscope/reading-service.ts`): the full
  charge-after-success + idempotency orchestration is written — wire the real AI.
- **AI** (`src/server/ai`): implement the real Gemini call in
  `providers/gemini.ts` (Milestone 3) using `resolveSecret(secretReference)` +
  `AbortController(timeoutMs)`; return normalized results (never throw on
  provider errors — return `ok:false` so no credit is charged).
- **Admin services**: user management, category/package/prompt/ai-config CRUD,
  manual payments, usage aggregation. Every sensitive change → `writeAudit(...)`.

### 🟨 Shared conventions

- All money/credit changes go through `credit-service`. Never update
  `credit_wallets.balance` directly.
- Every admin mutation calls `requireAdmin()` **and** `writeAudit()`.
- Store dates in UTC; display with `formatThai()`.
- Throw `AppError(code, msg)`; let `handle()` shape the HTTP response.
- Never log passwords or API keys.

---

## API surface (Phase 1)

Auth · User (`/api/me/*`) · Horoscope (`categories`, `readings`) · Payments
(manual) · Admin (`users`, `categories`, `packages`, `prompts`, `ai-configs`,
`ai-configs/:id/test`, `ai-usage`, `payments`, `audit-logs`, `dashboard`).
See `src/app/api/*` for implemented examples and the project spec section 10 for
the full list.

---

## Milestones

1. **M1 (this scaffold)** — repo, DB schema, page/route list, service-layer
   skeleton, auth foundation, UI shell. ✅
2. **M2** — register/login, birth profile, Free/Pro structure, categories, basic Admin CMS.
3. **M3** — real Gemini integration, reading flow, credit/quota, history, admin prompt/model config.
4. **M4** — UX polish, responsive QA, deploy, admin training, handover.

---

## ⚠️ Open questions blocking full implementation

Confirm with the client before locking these (kept configurable meanwhile):

1. Auth.js vs Supabase Auth? Is **Google login** required in Phase 1?
2. Exact birth fields; is **birth location** needed in Phase 1?
3. Final **category list** and which are **Free vs Pro**.
4. **Free quota**, **Pro quota + price**, and **credit cost per category**.
5. Pro expiry: **monthly** or **manual indefinite**?
6. Who owns/pays the **Gemini API** account? Hosting + managed Postgres accounts?

Secondary (defaults chosen, easily changed via Admin/seed): brand name/logo/
colors, free-form vs suggested questions, slip upload vs admin-record, admin can
read full readings, privacy/terms/disclaimer copy, persona wording, Free vs Pro
response length, behavior when Gemini is down, bug-warranty period.

---

## Notes

- **Prisma pinned to v6** on purpose: Prisma 7 requires driver adapters + a new
  config format that adds friction for a small team. Revisit post-handover.
- **Route protection** is done in the `(app)` and `(admin)` layouts (server
  components). Admin APIs must *also* call `requireAdmin()` (defense in depth).
- The SSD volume is exFAT, so macOS creates `._*` sidecar files — they're
  git-ignored and lint-ignored; ignore them.
