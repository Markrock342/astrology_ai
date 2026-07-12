# HoraSard — Master Index / Architecture Map

สารบัญกลางของโปรเจกต์ (อัปเดต: `be/wave-e-handoff`, ก.ค. 2026)

## ภาพรวมสถาปัตยกรรม

```
UI (src/app, src/components)  →  เรียก API เท่านั้น ไม่มี business logic
API (src/app/api/*)           →  validate (Zod) + authorize (rbac) + handle()
Service (src/server/*)        →  business logic ทั้งหมด
DB (prisma/)                  →  PostgreSQL + Prisma 6 (Supabase pooler บน Vercel)
```

**กฎเหล็ก:** ห้ามเรียก AI จาก browser · API key อยู่ใน env เท่านั้น · หักเครดิตหลัง AI สำเร็จ + `Idempotency-Key`

**เอกสารอ้างอิง:** `README.md` · `PROJECT_STRUCTURE.md` · `BACKEND_TASKS.md` · `FRONTEND_TASKS.md` · **`M4_HANDOFF.md`** (สถานะจริงตรวจกับโค้ด)

**M3 รอ/ค้าง:** [backend_m3_waitlist.md](./backend_m3_waitlist.md)  
**M4 deploy/waitlist:** [backend_m4_deploy.md](./backend_m4_deploy.md) · [backend_m4_waitlist.md](./backend_m4_waitlist.md)  
**Wave E (BN handoff):** [backend_wave_e.md](./backend_wave_e.md)  
**Performance:** [backend_performance.md](./backend_performance.md)

## Milestone ปัจจุบัน

| Milestone | สถานะรวม |
|-----------|----------|
| **M2** — Schema chat, Auth, Birth profile, Admin CMS พื้นฐาน | ✅ ปิดแล้ว |
| **M3** — แชท AI, Gemini, ประวัติเธรด, Admin AI CMS | ✅ **ปิด BN 100%** |
| **M4** — Payment, Dashboard, Deploy | ✅ ปิดแล้ว |
| **Wave E** — HANDOFF_BE (E0.3, E1.2–E1.6) | ✅ **BN ครบ** — รอ merge `be/wave-e-handoff` |

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
| Admin AI CMS (prompts, models, knowledge, usage) | ✅ ~M3 | [backend_ai_admin.md](./backend_ai_admin.md) | `ai-admin-service.ts`, `/api/admin/{prompts,ai-configs,knowledge,ai-usage}` |
| AI engine + readings | ✅ ~M3 | [backend_ai_engine.md](./backend_ai_engine.md) | `src/server/ai/*`, `reading-service.ts` |
| Chat conversations API | ✅ M3 ปิด | [backend_m3_chat.md](./backend_m3_chat.md) | `thread-service.ts`, `message-service.ts`, `/api/conversations/*` |
| Payment + dashboard (M4) + Wave E notify/top-up | ✅ | [backend_m4_payment.md](./backend_m4_payment.md) · [backend_wave_e.md](./backend_wave_e.md) | `payment-service.ts`, `payment-notify.ts` |
| M4 deploy / go-live | 🟡 manual smoke | [backend_m4_deploy.md](./backend_m4_deploy.md) | `scripts/smoke-public-api.mjs` |
| Quota atomic + RESERVED + `QUOTA_EXCEEDED` | ✅ Wave E hardened | [backend_wave_e.md](./backend_wave_e.md) | `quota-service.ts`, `reading-service.ts` |
| Performance (poll, light bootstrap, pool fix) | ✅ Wave 3 | [backend_performance.md](./backend_performance.md) | `db.ts`, `natal-chart-service.ts`, `bootstrap-service.ts` |

## โมดูล Frontend

| โมดูล | สถานะ | บันทึก | โค้ดหลัก |
| ----- | ----- | ------ | -------- |
| App UI (mockups, chat, birth form, admin) | ✅ | [frontend_app_ui.md](./frontend_app_ui.md) | `src/components/app/*`, `auth-card.tsx`, `admin/*` |
| จังหวัด/อำเภอ (dropdown) | ✅ API + shim | [backend_geo_api.md](./backend_geo_api.md) | `GET /api/geo/thailand`, `src/lib/th-geo.ts` |

---

## API ที่มีบน main (สรุป)

**Auth:** `POST /api/auth/{register,login,check-email,forgot-password,reset-password,verify-email,resend-verification}` · NextAuth `[...nextauth]`

**User:** `GET /api/me` · `GET /api/me/{package,credits,usage}` · `DELETE /api/me/account` · `GET|PUT /api/me/birth-profile` · `GET /api/me/natal-chart` · `PUT /api/me/{profile,password,avatar}` · `POST /api/me/subscription/cancel`

**Chat:** `GET|POST /api/conversations` · `GET /api/conversations/:id` · `POST /api/conversations/:id/messages` *(header `Idempotency-Key`)*

**Horoscope:** `GET /api/horoscope/categories` *(มี `suggestedQuestions`)* · `POST /api/horoscope/readings` *(gated `FEATURES.aiChat`)*

**Payment:** `POST /api/payments/manual` *(optional `packageCode`)* · `GET /api/payments/me` · `GET /api/payments/proof/[id]`

**Public:** `GET /api/packages` · `GET /api/geo/thailand` · `GET /api/{announcements,faq,settings/public}`

**Admin:** `/api/admin/{users,categories,packages,prompts,ai-configs,knowledge,payments,announcements,faq,settings,revisions,audit-logs,ai-usage,ai-status,dashboard}/*` · `DELETE /api/admin/users/[id]` (SUPER_ADMIN)

---

## งานค้างจริง (BN)

| ID | งาน | หมายเหตุ |
|----|-----|----------|
| **Wave E2** | packageId FK, cron, cost tracking | [BE_ASSIGN.md](../BE_ASSIGN.md) § E2 |

---

## รอ PM ยืนยัน

- ~~Rate-limit strategy~~ → **ตัดสินใจแล้ว:** Upstash Redis (code พร้อม — รอใส่ env บน Vercel)
- ดวงจร (transit) auto-คำนวณวัน — gate Pro มีแล้ว แต่ยังไม่มี engine transit เต็ม
- ~~Sign-in อีเมล~~ → **ตัดสินใจแล้ว:** อีเมล+รหัสผ่าน สมัครตรง เก็บ DB
- แหล่งข้อมูลจังหวัด/อำเภอเต็ม — อำเภอยังชุดย่อใน `thailand-geo.ts`
- Free/Pro quota, ราคา, Pro หมดอายุรายเดือนหรือไม่

## งานที่เสร็จแล้ว (อย่าทำซ้ำ)

- [x] Unit tests พื้นฐาน M2 (`date`, `birth-profile-rules`, `password-reset`, `chart-engine`)
- [x] Migrations บน Supabase (รวม `knowledge_docs`, `password_reset_token`, CMS revisions)
- [x] Conversations API + Gemini จริง + Admin AI CMS + payment + dashboard
- [x] `suggestedQuestions` ใน categories API
- [x] Wave E HANDOFF_BE (BE-E0.3–E1.6) บน `be/wave-e-handoff`
- [x] Email sender (Resend-ready) — ตั้ง `RESEND_API_KEY` + `EMAIL_FROM` เพื่อส่งจริง
