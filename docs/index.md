# HoraSard — Master Index / Architecture Map

สารบัญกลางของโปรเจกต์ (อัปเดต: 17 ก.ค. 2026)

**ฐาน:** `origin/main` — hotfix deploy (lint · ALLOW_DESTRUCTIVE · Node `ci-local.mjs`)  
**หมายเหตุ:** `.cursorrules` เป็น local only — ห้าม commit · GitHub Actions billing-locked (ดู README) — gate จริงคือ Vercel `vercel-build`

## ภาพรวมสถาปัตยกรรม

```
UI (src/app, src/components)  →  เรียก API เท่านั้น ไม่มี business logic
API (src/app/api/*)           →  validate (Zod) + authorize (rbac) + handle()
Service (src/server/*)        →  business logic ทั้งหมด
DB (prisma/)                  →  PostgreSQL + Prisma 6 (Supabase pooler)
```

**กฎเหล็ก:** ห้ามเรียก AI จาก browser · API key เข้ารหัสใน DB (legacy env whitelist เป็น fallback) · หักเครดิตหลัง AI สำเร็จ + `Idempotency-Key` · โลโก้ CMS เก็บใน DB เสิร์ฟ `/api/media/:id` (ไม่ผูก Vercel Blob)

**เอกสารอ้างอิง:** `README.md` · `PROJECT_STRUCTURE.md` · `BACKEND_TASKS.md` · `FRONTEND_TASKS.md` · **`M4_HANDOFF.md`**

**M3 รอ/ค้าง:** [backend_m3_waitlist.md](./backend_m3_waitlist.md)  
**M4 deploy/waitlist:** [backend_m4_deploy.md](./backend_m4_deploy.md) · [backend_m4_waitlist.md](./backend_m4_waitlist.md)  
**Wave E:** [backend_wave_e.md](./backend_wave_e.md) *(merge แล้ว)*  
**Performance:** [backend_performance.md](./backend_performance.md)  
**Chart memory / token:** [backend_chart_memory.md](./backend_chart_memory.md) · [TOKEN_COST_OPTIMIZATION_CLIENT_SUMMARY.md](./TOKEN_COST_OPTIMIZATION_CLIENT_SUMMARY.md)  
**UX Wave F:** [UX_WAVE_F_ASSIGN.md](../UX_WAVE_F_ASSIGN.md) · [UX_WAVE_F_BE.md](../UX_WAVE_F_BE.md) · [UX_WAVE_F_FE.md](../UX_WAVE_F_FE.md)  
**Gemini billing ops:** [ops_gemini_billing_alerts.md](./ops_gemini_billing_alerts.md)  
**App UI / mobile:** [frontend_app_ui.md](./frontend_app_ui.md)  
**Admin CMS UX (preview / health / models):** [admin_cms_ux.md](./admin_cms_ux.md)  
**Admin AI + keys:** [backend_ai_admin.md](./backend_ai_admin.md)  
**คู่มือหน้าโมเดล AI (ละเอียด / สำหรับเพื่อนโยน AI):** [`SETTINGS_MODEL_AI.md`](../SETTINGS_MODEL_AI.md)

## Milestone ปัจจุบัน

| Milestone | สถานะรวม |
|-----------|----------|
| **M2–M4**, **Wave E**, **Perf Wave 3** | ✅ |
| **UX Wave F BE/FE** | ✅ |
| **Message feedback** + `assertFeedbackClient` | ✅ |
| **Mobile settings nav + admin กลับแอป** | ✅ |
| **Admin encrypted API keys** | ✅ `/admin/ai-configs` + `AI_SECRET_ENC_KEY` |
| **Logo & Theme (host-agnostic upload)** | ✅ DB `media_assets` + `/api/media/:id` |
| **Admin CMS UX reliability** | ✅ preview · health รายโมเดล · Base URL · follow-up ใช้ AI config routing |
| **Dev runtime (landing overlays)** | ✅ soft-fail CMS · `next/script` theme · Prisma host log · JWT cookie note |
| **AI model config repair** | ✅ create ต้องมี key · planScope · primary-only health · migrate seed encrypted · drop dead category aiConfigId |
| **คู่มือโมเดล AI** | ✅ [`SETTINGS_MODEL_AI.md`](../SETTINGS_MODEL_AI.md) ที่รากโปรเจกต์ |

**Feature gating:** `src/config/features.ts` — `NEXT_PUBLIC_APP_PHASE=2` ปิด AI chat + Admin AI CMS; ไม่ตั้ง = เปิดทั้งหมด

---

## โมดูล Backend

| โมดูล | สถานะ | บันทึก | โค้ดหลัก |
| ----- | ----- | ------ | -------- |
| Chat / Birth / Geo / Auth / Me / Admin CRUD | ✅ | docs ในโฟลเดอร์นี้ | `prisma/`, `src/server/*` |
| Admin AI CMS + encrypted keys + feedback | ✅ | [backend_ai_admin.md](./backend_ai_admin.md) | `ai-admin-service.ts`, `secret-box.ts`, `secret-resolver.ts` |
| Chat API (SSE, answerMode, followUps, feedback) | ✅ | [backend_m3_chat.md](./backend_m3_chat.md) | `follow-up-suggestions.ts`, `feedback-service.ts` |
| CMS media upload (logo/landing/OG) | ✅ | [frontend_app_ui.md](./frontend_app_ui.md) | `cms-upload.ts`, `GET /api/media/:id` |

## โมดูล Frontend

| โมดูล | สถานะ | บันทึก | โค้ดหลัก |
| ----- | ----- | ------ | -------- |
| App UI (chat, account, theme, credit) | ✅ | [frontend_app_ui.md](./frontend_app_ui.md) | `app-shell.tsx`, `chat-view.tsx` |
| Logo & Theme + mobile settings | ✅ | [frontend_app_ui.md](./frontend_app_ui.md) | `site-theme-manager.tsx`, `brand-logo.tsx`, `settings-popover*.ts(x)` |
| Admin CMS UX (preview / AI health / models) | ✅ | [admin_cms_ux.md](./admin_cms_ux.md) | `page.tsx` (landing), `ai-configs-manager.tsx`, `OpenAIAdapter`, `adminFetch` |
| Dashboard soft-nav | 🟡 branch แยก | `fix/dashboard-soft-nav` | ยังไม่รวม |

---

## API ที่เพิ่มรอบนี้

- `POST /api/admin/ai-configs/test-key` — ทดสอบ API key ก่อนบันทึก (รองรับ OpenAI-compatible `baseUrl`)
- `GET /api/media/:id` — เสิร์ฟรูป CMS จาก DB
- `POST /api/admin/upload` — บันทึกรูปลง `media_assets` (ไม่ใช้ Vercel Blob)

---

## งานค้างจริง (BN)

| ID | งาน | หมายเหตุ |
|----|-----|----------|
| **Soft-nav** | merge `fix/dashboard-soft-nav` | ยังแยก |
| **Smoke** | ลอง UI โลโก้ + วาง AI key บน prod/staging | manual |
| **Wave E2** | packageId FK, cron, cost tracking | [BE_ASSIGN.md](../BE_ASSIGN.md) § E2 |
| **Ops** | Resend, Upstash, smoke prod | PM |

## รอ PM ยืนยัน

- Rate-limit: Upstash Redis (code พร้อม — รอ env)
- ดวงจร auto-คำนวณรายวัน
- Free/Pro quota, ราคา, Pro หมดอายุรายเดือนหรือไม่

## งานที่เสร็จแล้วรอบนี้ (อย่าทำซ้ำ)

- [x] Encrypted admin AI API keys + cache + test-key
- [x] Logo & Theme upload host-agnostic (DB media)
- [x] Mobile settings dual-mount fix + admin «กลับแอป»
- [x] `assertFeedbackClient` + migration guard TS
- [x] Migrations: `ai_config_encrypted_key`, `media_assets`, `ai_config_base_url`
- [x] Admin AI Models revamp (Base URL / health per model / provider defaults)
- [x] Follow-up + thread title ใช้ AI config router (ไม่ hardcode Gemini env)
- [x] AI model config repair: encrypted-only create, planScope, primary health, seed migrate, drop category.aiConfigId
- [x] คู่มือหน้าโมเดล AI: `SETTINGS_MODEL_AI.md`
