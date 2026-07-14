# HoraSard — Master Index / Architecture Map

สารบัญกลางของโปรเจกต์ (อัปเดต: `main` @ `83d74af` + branch `fix/dashboard-soft-nav`, 14 ก.ค. 2026)

## ภาพรวมสถาปัตยกรรม

```
UI (src/app, src/components)  →  เรียก API เท่านั้น ไม่มี business logic
API (src/app/api/*)           →  validate (Zod) + authorize (rbac) + handle()
Service (src/server/*)        →  business logic ทั้งหมด
DB (prisma/)                  →  PostgreSQL + Prisma 6 (Supabase pooler บน Vercel)
```

**กฎเหล็ก:** ห้ามเรียก AI จาก browser · API key อยู่ใน env เท่านั้น · หักเครดิตหลัง AI สำเร็จ + `Idempotency-Key`

**เอกสารอ้างอิง:** `README.md` · `PROJECT_STRUCTURE.md` · `BACKEND_TASKS.md` · `FRONTEND_TASKS.md` · **`M4_HANDOFF.md`**

**M3 รอ/ค้าง:** [backend_m3_waitlist.md](./backend_m3_waitlist.md)  
**M4 deploy/waitlist:** [backend_m4_deploy.md](./backend_m4_deploy.md) · [backend_m4_waitlist.md](./backend_m4_waitlist.md)  
**Wave E:** [backend_wave_e.md](./backend_wave_e.md) *(merge แล้ว)*  
**Performance:** [backend_performance.md](./backend_performance.md)  
**Chart memory / token:** [backend_chart_memory.md](./backend_chart_memory.md) · [TOKEN_COST_OPTIMIZATION_CLIENT_SUMMARY.md](./TOKEN_COST_OPTIMIZATION_CLIENT_SUMMARY.md)  
**UX Wave F (งานปัจจุบัน):** [UX_WAVE_F_ASSIGN.md](../UX_WAVE_F_ASSIGN.md) · [UX_WAVE_F_BE.md](../UX_WAVE_F_BE.md) · [UX_WAVE_F_FE.md](../UX_WAVE_F_FE.md)  
**Gemini billing ops:** [ops_gemini_billing_alerts.md](./ops_gemini_billing_alerts.md)

## Milestone ปัจจุบัน

| Milestone | สถานะรวม |
|-----------|----------|
| **M2** — Schema chat, Auth, Birth profile, Admin CMS พื้นฐาน | ✅ ปิดแล้ว |
| **M3** — แชท AI, Gemini, ประวัติเธรด, Admin AI CMS | ✅ ปิดแล้ว |
| **M4** — Payment, Dashboard, Deploy | ✅ ปิดแล้ว |
| **Wave E** — HANDOFF_BE (E0.3, E1.2–E1.6) + quota RESERVED | ✅ **merge บน `main`** |
| **Perf Wave 3** — pool fix, bootstrap cache, indexes | ✅ บน `main` |
| **UX Wave F BE** — phased SSE, answerMode, followUps | ✅ **merge บน `main`** (#15) | [UX_WAVE_F_BE.md](../UX_WAVE_F_BE.md) · `follow-up-suggestions.ts` |
| **UX Wave F FE** — thinking UI, chips, answerMode | ✅ **merge บน `main`** (#16) | [UX_WAVE_F_FE.md](../UX_WAVE_F_FE.md) |
| **Dashboard soft-nav** — `useChatRouteSearchParams` + hard return จากตั้งค่า | 🟡 `fix/dashboard-soft-nav` | [frontend_app_ui.md](./frontend_app_ui.md) |

**Feature gating:** `src/config/features.ts` — ตั้ง `NEXT_PUBLIC_APP_PHASE=2` บน Vercel จะปิด AI chat + Admin AI CMS; dev ไม่ตั้ง = เปิดทั้งหมด

---

## โมดูล Backend

| โมดูล | สถานะ | บันทึก | โค้ดหลัก |
| ----- | ----- | ------ | -------- |
| Chat schema (Conversation/Message, BirthProfile fields) | ✅ M2 | [backend_chat_schema.md](./backend_chat_schema.md) | `prisma/schema.prisma`, `prisma/migrations/*` |
| Birth profile API (พ.ศ.→ค.ศ., editCount≤1) | ✅ M2 | [backend_birth_profile.md](./backend_birth_profile.md) | `birth-profile-service.ts`, `/api/me/birth-profile` |
| Thailand geo API | ✅ M2 | [backend_geo_api.md](./backend_geo_api.md) | `thailand-geo.ts`, `/api/geo/thailand` |
| Google auth + auto-create user | ✅ M2 | [backend_google_auth.md](./backend_google_auth.md) | `provisioning.ts`, `src/auth.ts` |
| Register + password reset + email verify | ✅ | [backend_auth_register_reset.md](./backend_auth_register_reset.md) | `auth-card.tsx`, `/api/auth/*` |
| User API (`/api/me`, package, credits, usage, account delete) | ✅ | [backend_me_api.md](./backend_me_api.md) | `account-service.ts`, `usage-service.ts`, `/api/me/*` |
| Admin API (users, categories, packages) | ✅ M2 | [backend_admin_api.md](./backend_admin_api.md) | `user-admin-service.ts`, `catalog-admin-service.ts` |
| Admin AI CMS (prompts, models, knowledge, usage) | ✅ M3 | [backend_ai_admin.md](./backend_ai_admin.md) | `ai-admin-service.ts`, `provider-alerts.ts` |
| AI engine + readings | ✅ M3+ | [backend_ai_engine.md](./backend_ai_engine.md) | `src/server/ai/*`, `reading-service.ts` |
| Chat conversations API (SSE phases, answerMode, followUps) | ✅ Wave F BE | [backend_m3_chat.md](./backend_m3_chat.md) | `follow-up-suggestions.ts`, `reading-service.ts` |
| Chart memory + token optimization | ✅ | [backend_chart_memory.md](./backend_chart_memory.md) | `chart-memory-service.ts`, `derive-chart-memory.ts` |
| Payment + dashboard (M4) + Wave E | ✅ | [backend_m4_payment.md](./backend_m4_payment.md) | `payment-service.ts`, `payment-notify.ts` |
| M4 deploy / go-live | 🟡 manual smoke | [backend_m4_deploy.md](./backend_m4_deploy.md) | `scripts/smoke-public-api.mjs` |
| Quota atomic + RESERVED | ✅ Wave E | [backend_wave_e.md](./backend_wave_e.md) | `quota-service.ts`, `reading-service.ts` |
| Performance (pool, bootstrap cache) | ✅ Wave 3 | [backend_performance.md](./backend_performance.md) | `db.ts`, `bootstrap-service.ts` |
| myhora scrape-first | ✅ | [newhora-integration.md](./newhora-integration.md) | `compute-chart.ts`, `natal-chart-service.ts` |
| HoraSard Standard v1 | ✅ | [HORASARD_STANDARD_V1.md](./HORASARD_STANDARD_V1.md) | `tests/horasard-standard-v1.test.ts` |

## โมดูล Frontend

| โมดูล | สถานะ | บันทึก | โค้ดหลัก |
| ----- | ----- | ------ | -------- |
| App UI (chat ChatGPT-style, account, admin) | ✅ | [frontend_app_ui.md](./frontend_app_ui.md) | `src/components/app/*`, `admin/*` |
| UX Wave F (chips, phased thinking) | ✅ PR #16 | [UX_WAVE_F_FE.md](../UX_WAVE_F_FE.md) | `chat-view.tsx` |
| Soft-nav cat/thread sync | 🟡 fix branch | [frontend_app_ui.md](./frontend_app_ui.md) | `chat-nav.ts` |
| จังหวัด/อำเภอ (dropdown) | ✅ API + shim | [backend_geo_api.md](./backend_geo_api.md) | `GET /api/geo/thailand` |

---

## API ที่มีบน main (สรุป)

**Auth:** `POST /api/auth/{register,login,...}` · NextAuth `[...nextauth]`

**User:** `GET /api/me` · `GET /api/me/usage?view=summary` · `DELETE /api/me/account` · `GET|PUT /api/me/birth-profile` · `GET /api/me/natal-chart`

**Chat:** `GET|POST /api/conversations` · `GET /api/conversations/:id` · `GET /api/conversations/:id/poll` · `POST /api/conversations/:id/messages` *(SSE หรือ 202)* · `POST /api/conversations/:id/stop`

**Horoscope:** `GET /api/horoscope/categories` · `POST /api/horoscope/readings`

**Payment:** `POST /api/payments/manual` *(packageCode)* · `GET /api/payments/me` · `GET /api/payments/proof/[id]`

**Public:** `GET /api/packages` · `GET /api/geo/thailand` · `GET /api/{announcements,faq,settings/public}`

**Admin:** `/api/admin/{users,...,provider-alert,dashboard}/*` · `GET /api/admin/revisions/:id`

---

## งานค้างจริง (BN)

| ID | งาน | หมายเหตุ |
|----|-----|----------|
| **UX Wave F P0** | SSE phase + chips + answerMode | ✅ merge บน `main` (#15/#16) |
| **Dashboard soft-nav** | cat/thread sync + router.push จาก account/onboarding | 🟡 `fix/dashboard-soft-nav` |
| **Wave E2** | packageId FK, cron, cost tracking | [BE_ASSIGN.md](../BE_ASSIGN.md) § E2 |
| **Ops** | Resend verify, Upstash env, smoke prod | PM |

---

## รอ PM ยืนยัน

- Rate-limit: Upstash Redis (code พร้อม — รอ env)
- ดวงจร auto-คำนวณรายวัน — gate Pro มี, engine บางส่วนใน `daily-transit-service`
- แหล่งข้อมูลจังหวัด/อำเภอเต็ม
- Free/Pro quota, ราคา, Pro หมดอายุรายเดือนหรือไม่

## งานที่เสร็จแล้ว (อย่าทำซ้ำ)

- [x] Wave E HANDOFF_BE — **merge บน `main`**
- [x] Perf Wave 1–3 (poll, light bootstrap, pool fix, indexes)
- [x] Chat UX: edit, regenerate, SSE stream, stop, markdown
- [x] Chart memory + token optimization Phase 1–3
- [x] Payment slip: ยอด + รูปเท่านั้น (ไม่มีเลขอ้างอิง)
- [x] HoraSard Standard v1 + 20 golden cases
- [x] Gemini billing alert banner ใน admin
