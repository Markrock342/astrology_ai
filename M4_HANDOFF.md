# 🏁 HoraSard — แผนปิด Milestone 4 (Handoff รวม BN + FN)

> **เอกสารนี้คืออะไร:** สรุปสถานะโปรเจกต์ ณ commit `3796e65` แบบ "ตรวจกับโค้ดจริง + git history"
> ไม่ใช่คัดจาก checklist เดิม (ซึ่งล้าสมัยหนัก) เขียนสำหรับ **PM แจกให้ BN (backend) และ FN (frontend)**
> อ่านจบแล้วจะรู้ว่า *อะไรเสร็จจริง · อะไรค้างจริง · ใครทำอะไร · ใครบล็อกใคร · เหลืออีกกี่ก้าวถึง production*
>
> จัดทำ: 2026-07-10 · อ้างอิง branch `main`

---

## 0. TL;DR (อ่าน 30 วินาที)

- โครงสร้าง **M2 / M3 / M4 สร้างเสร็จไปแล้ว ~90%** ทั้ง backend และ frontend — ทั้ง chat API, Gemini จริง, Admin AI CMS, manual payment, dashboard, legal pages **มีครบในโค้ดแล้ว**
- **checklist ในไฟล์เดิม (`BACKEND_TASKS.md` / `FRONTEND_TASKS.md` / `docs/index.md`) ผิด** — หลายข้อขึ้น `[ ]` ทั้งที่ commit ล่าสุดทำเสร็จแล้ว **ห้ามใช้ประเมินงาน**
- งานที่ **ค้างจริง** เพื่อปิด M4 มี **4 ก้อนฝั่ง BN + 4 ก้อนฝั่ง FN + 1 การตัดสินใจของ PM**
- ก้อนเดียวที่เป็น **ฟีเจอร์จริง** คือ **แชทหลาย turn (multi-turn context)** ที่เหลือคือ **test + hardening + polish + config**

| ฝั่ง | งานหลัก (🔴) | งานรอง (🟡🟢) |
|------|-------------|--------------|
| **BN** | B1 multi-turn chat · B2 tests M3 | B3 rate-limit (รอ PM) · B4 deploy config |
| **FN** | F1 QA error-state chat | F2 render thread (หลัง B1) · F3 polish · F4 legal content |
| **PM** | ตัดสินใจ rate-limit (บล็อก B3) | ยืนยัน quota/ราคา/Pro expiry |

---

## 1. ⚠️ สำคัญที่สุด: เอกสารเดิมไม่ตรงกับโค้ด

ก่อนแจกงาน ต้องเข้าใจก่อนว่า **checklist เดิมล้าสมัย** เพราะเขียนไว้ช่วง M2 แล้วโค้ดวิ่งไปไกลกว่านั้นมากใน commit หลังๆ (`e06f129` conversation APIs, `45f37d9` Gemini 3.x, `56cb57d` payment, `31412b9` dashboard, `3796e65` CMS draft/publish)

| checklist เดิมบอก | ความจริงในโค้ด (หลักฐาน) |
|-------------------|--------------------------|
| `/api/conversations/*` "ยังไม่มี" | ✅ มีครบ 3 route — `e06f129` |
| Gemini จริง `[ ]` | ✅ REST call เต็ม + AbortController + ไม่ throw — `45f37d9` |
| Admin AI CMS 🚧 | ✅ ครบ + draft/publish/revisions/FAQ/banner/SEO — `3796e65` |
| Manual payment `[ ]` | ✅ `/api/payments/manual` + admin review — `56cb57d` |
| Admin dashboard `[ ]` | ✅ route + service + UI + KPIs — `31412b9` |
| ยกเลิกสมาชิก `[ ]` | ✅ `/api/me/subscription/cancel` |
| ส่งอีเมลจริง "dev fallback เท่านั้น" | ✅ Resend wired แล้ว — แค่ตั้ง `RESEND_API_KEY` |
| newhora engine "stub" | ✅ port เต็ม + `chart-engine.test.ts` — `6944412` |
| suggestedQuestions `[ ]` | ✅ อยู่ใน category-service + chat-view |

👉 **Action:** ก่อนเริ่ม sprint ให้ sync 3 ไฟล์นี้ให้ตรงความจริง (ดู §9) ไม่งั้น dev อ่านแล้วประเมินงานผิดซ้ำ

---

## 2. สถานะ Milestone (ตรวจกับโค้ดแล้ว)

| # | ขอบเขต | สถานะจริง |
|---|--------|-----------|
| **M1** | โครงสร้าง, schema, service layer, seed | ✅ เสร็จ |
| **M2** | Auth (Google + email/password), birth profile, Free/Pro, admin CMS พื้นฐาน, UI ตาม mockup | ✅ เสร็จ + ปิดแล้ว |
| **M3** | แชท AI จริง (Gemini), credit/quota, ประวัติเธรด, Admin AI CMS | 🟢 **~85%** — โครงครบ, ขาด multi-turn context จริง + test |
| **M4** | Payment, dashboard, deploy, polish, legal | 🟢 **~80%** — code ครบ, ขาด hardening + polish + go-live config |

---

## 3. สิ่งที่ "เสร็จแล้วจริง" (อย่าทำซ้ำ)

### 3.1 Backend — service layer (`src/server/`)
- **Auth ครบ:** Google provider + auto-provision (`provisioning.ts`), email+password (`server-sign-in.ts`), email verification (`email-verification-service.ts`), password reset (`password-reset-service.ts`), Turnstile (`turnstile.ts`), RBAC (`rbac.ts`)
- **Credit/Quota:** `credit-service.ts` (atomic + optimistic lock + ledger immutable), `quota-service.ts` (daily/monthly limits → `RATE_LIMITED`)
- **AI engine:** `providers/gemini.ts` (จริง), `providers/openai.ts`, `router.ts` (fallback), `prompt-builder.ts`, `usage-logger.ts`, `adapter.ts`
- **Reading flow:** `reading-service.ts` — บังคับ 4 กฎครบ (permission+quota ก่อนยิง AI · AI fail = ไม่หักเครดิต · idempotency · charge+persist ใน transaction เดียว) ดู [reading-service.ts:13](src/server/horoscope/reading-service.ts#L13)
- **Chart engine:** newhora port เต็มใน `engine/newhora/*` + `compute-chart.ts` + `natal-chart-service.ts`
- **Chat threads:** `message-service.ts` + `thread-service.ts` + `chart-context.ts`
- **Payment:** `payment-service.ts` (manual submit + admin review)
- **Admin CMS:** `ai-admin-service.ts`, `catalog-admin-service.ts`, `user-admin-service.ts`, `dashboard-admin-service.ts`, `settings-admin-service.ts`, `cms-content-admin-service.ts`, `content-revision-service.ts`, `ai-status-service.ts`, `log-admin-service.ts`
- **Email:** `mailer.ts` — Resend จริง (มี key) / dev-console fallback (ไม่มี key)

### 3.2 Frontend — UI (`src/components/`, `src/app/`)
- **Auth UI:** `auth-card.tsx`, `auth-panels.tsx`, `turnstile-field.tsx`, `verify-email-client.tsx` + หน้า login/register/forgot/reset/verify
- **App shell:** `app-shell.tsx` (sidebar + collapse + mobile drawer), `app-data-provider.tsx`
- **Chat:** `chat-view.tsx` (ห้องแชท + suggested questions)
- **Birth:** `birth-form.tsx` + `birth-profile-gate.tsx` (บังคับกรอกก่อนใช้)
- **Settings:** `settings-popover.tsx` + `settings-modals.tsx` (ชื่อ/รหัส/วันเกิด + ตัวนับ/แพ็กเกจ/ออกจากระบบ/ยกเลิกสมาชิก)
- **Account/Payment:** `account-view.tsx`, `payment-submit-card.tsx` (ส่งสลิป), `profile-avatar-card.tsx`
- **Admin (ครบทุกหน้า):** dashboard, users, categories, packages, payments, prompts, ai-configs, knowledge, usage, faq, announcements, settings, audit-logs, preview
- **CMS render:** `cms-document-view.tsx`, `cms-text-view.tsx`, `faq-view.tsx`, `site-announcement-banner.tsx`
- **Legal:** หน้า `(public)/privacy`, `(public)/terms`, `(public)/disclaimer` (ตรวจเนื้อหา → F4)

### 3.3 API inventory (มีบน main แล้ว)
```
Auth      POST /api/auth/{register,login,check-email,forgot-password,
                reset-password,verify-email,resend-verification} · [...nextauth]
User      GET /api/me · GET /api/me/{package,credits} · GET|PUT /api/me/birth-profile
          GET /api/me/natal-chart · PUT /api/me/{profile,password,avatar}
          POST /api/me/subscription/cancel
Chat      GET|POST /api/conversations · GET /api/conversations/:id
          POST /api/conversations/:id/messages   ← header Idempotency-Key
Horoscope GET /api/horoscope/categories · POST /api/horoscope/readings
Payment   POST /api/payments/manual · GET /api/payments/me
Public    GET /api/packages · GET /api/geo/thailand · GET /api/announcements
          GET /api/faq · GET /api/settings/public
Admin     /api/admin/{users,categories,packages,prompts,ai-configs,knowledge,
                payments,announcements,faq,settings,revisions,audit-logs,
                ai-usage,ai-status,dashboard}/*
```

---

## 4. 🔴 งานค้างจริง (หัวใจของเอกสาร)

มีแค่ **5 ช่องว่างจริง** เท่านั้น:

1. **Multi-turn chat context ยังไม่จริง** — `message-service` ยิงทีละคำถามแบบไม่มีประวัติ → *ฟีเจอร์*
2. **Test M3 ยังบาง** — ไม่มี test เรื่องเงิน/สิทธิ์/idempotency → *คุณภาพ*
3. **Rate-limit ยัง in-memory** — ไม่รอด multi-instance → *hardening (รอ PM)*
4. **Go-live config** — env จริง + migrate/seed + backup ยังไม่ตั้ง → *deploy*
5. **UX polish + legal content** — responsive/skeleton/เนื้อห กฎหมายจริง → *frontend*

รายละเอียดแยกฝั่งอยู่ §5 (BN) และ §6 (FN)

---

## 5. 🟩 งานของ BN (Backend)

### B1 — แชทหลาย turn จริง 🔴 (ฟีเจอร์หลัก)
**ปัญหา:** [message-service.ts:19](src/server/horoscope/message-service.ts#L19) `sendMessage()` เพียง `delegate → createReading()` ซึ่งรับแค่ `question` เดี่ยว ([reading-service.ts:116](src/server/horoscope/reading-service.ts#L116) `buildUserPrompt(snapshot, question, chartJson)`) — **ไม่ส่งประวัติข้อความก่อนหน้าในเธรดเข้า prompt เลย** คอมเมนต์ในไฟล์ก็เขียนเองว่า *"Phase 1: delegates to the reading pipeline ... wired for full multi-turn chat in Wave C+"*

**ผลกระทบ:** ผู้ใช้ถามต่อเนื่อง ("แล้วเรื่องงานล่ะ?") AI ตอบเหมือนเริ่มใหม่ทุกครั้ง — ไม่ใช่การสนทนาจริง

**ต้องทำ:**
- โหลด `Message[]` ก่อนหน้าของ `conversationId` (เรียงเวลา) แล้วส่งเป็น conversation history
- ขยาย `prompt-builder.ts` / provider adapter ให้รับ `contents[]` แบบหลาย turn (Gemini รองรับ `contents: [{role, parts}]` อยู่แล้ว — ดู [gemini.ts:81](src/server/ai/providers/gemini.ts#L81) ที่ตอนนี้ส่ง user turn เดียว)
- ทางเลือก: ให้ `message-service` ทำ orchestration ของตัวเอง (โหลด history → build → generate → charge) แทนการ delegate `createReading` เดี่ยว **แต่ต้องคง 4 กฎเดิม** (permission/quota ก่อนยิง · fail ไม่หักเครดิต · idempotency · transaction เดียว) — copy pattern จาก reading-service
- ตัด/ลด context ยาวเกิน (จำกัดจำนวน turn ล่าสุด หรือ token budget)

**Acceptance:** ถามต่อเนื่อง 3–4 ข้อความในเธรดเดียว AI อ้างอิงบทก่อนหน้าได้ · หักเครดิตต่อ **ข้อความตอบ** · idempotency-key เดิม = ไม่สร้าง/ไม่หักซ้ำ · error ไม่หักเครดิต

**ไฟล์:** `message-service.ts`, `prompt-builder.ts`, `providers/gemini.ts`, `providers/openai.ts`, `conversations/[id]/messages/route.ts`

---

### B2 — Test coverage M3 🔴
**ปัญหา:** ตอนนี้มีแค่ `date.test.ts`, `birth-profile-rules.test.ts`, `chart-engine.test.ts`, `password-reset.test.ts` — **ยังไม่มี** test ครอบ flow เงิน/สิทธิ์ ทั้งที่เป็น acceptance ของ M3

**ต้องเขียน test:**
- หักเครดิตถูกต้องเมื่อ AI สำเร็จ
- **refund/ไม่หัก** เมื่อ AI error/timeout ([reading-service.ts:120](src/server/horoscope/reading-service.ts#L120))
- Free ห้ามแชท → `CHAT_REQUIRES_PRO` · หมวด Pro lock → `CATEGORY_LOCKED` · ดวงจร → `TRANSIT_REQUIRES_PRO`
- `NO_QUOTA` เมื่อเครดิตไม่พอ · `RATE_LIMITED` เมื่อชน quota
- idempotency: ยิงซ้ำ key เดิม → คืนอันเดิม ไม่สร้างซ้ำ ([reading-service.ts:34](src/server/horoscope/reading-service.ts#L34))
- model routing + fallback (`router.ts`)
- admin auth: non-admin โดน block ทุก `/api/admin/*`

**Acceptance:** `npm run test` เขียว + ครอบเคสข้างบนครบ

**ไฟล์:** `tests/*.test.ts` (เพิ่มใหม่)

---

### B3 — Rate-limit production 🟡 **(บล็อก — รอ PM §7)**
**ปัญหา:** [rate-limit.ts:6](src/lib/rate-limit.ts#L6) เป็น in-memory `Map` — คอมเมนต์เขียนเองว่าต้องใช้ Redis/Upstash สำหรับ multi-instance บน Vercel (แต่ละ instance นับแยกกัน → limit รั่ว)

**ต้องทำ (ถ้า PM เลือก Redis):** เปลี่ยน `rateLimit()` เป็น Upstash Redis (sliding window) + env `UPSTASH_REDIS_REST_URL` / `_TOKEN` · คง interface `rateLimit(key, limit, windowMs)` เดิมเพื่อไม่ต้องแก้ที่เรียก

**⚠️ อย่าเพิ่งเริ่ม** จนกว่า PM ตัดสินใจ (ดู §7) — ถ้าคง in-memory = แค่เขียน note ปิด ไม่มีงานโค้ด

---

### B4 — Go-live config / deploy 🟢
Code พร้อมหมดแล้ว เหลือ **ตั้งค่า** (ไม่ใช่เขียนโค้ด):
- ตั้ง env จริงบน Vercel (ดูตาราง §8)
- รัน `npm run db:migrate` + `npm run db:seed` บน Supabase production (ต้องมี `DIRECT_URL`)
- ตั้ง `NEXT_PUBLIC_APP_PHASE` ให้ตรงสิ่งที่ลูกค้าจ่าย (unset = เปิดหมด, `=2` = ซ่อน AI, `=3` = เปิด AI)
- ยืนยัน backup policy ของ Supabase
- smoke test บน production: sign-in → กรอกวันเกิด → อัปเกรด Pro (manual) → แชท → ได้คำตอบจาก Gemini จริง

**Acceptance:** flow เต็มทำงานบน production URL จริง

---

## 6. 🟦 งานของ FN (Frontend)

### F1 — QA error-state บนแชท 🔴
**ต้องทำ:** ตรวจ `chat-view.tsx` map error code จาก API ครบทุกตัวเป็น UI state ที่ถูก:

| code | UI ที่ควรเห็น |
|------|---------------|
| `NO_QUOTA` | เครดิตหมด → CTA เติม/อัปเกรด |
| `CHAT_REQUIRES_PRO` | Free ห้ามแชท → UpgradeProState + ปิด composer |
| `CATEGORY_LOCKED` | หมวด Pro → CTA อัปเกรด |
| `TRANSIT_REQUIRES_PRO` | ดวงจร Pro-only → CTA อัปเกรด |
| `AI_TIMEOUT` / `AI_PROVIDER_ERROR` | error + ปุ่มลองใหม่ (**ใช้ Idempotency-Key เดิม**) |
| `USER_DISABLED` | บัญชีถูกระงับ |
| `RATE_LIMITED` | ช้าลงหน่อย |
| `VALIDATION` | ข้อมูลไม่ครบ |

> ⚠️ contract เดิมใน `FRONTEND_TASKS.md` **ลืม** `CHAT_REQUIRES_PRO` และ `TRANSIT_REQUIRES_PRO` — ต้อง map เพิ่มด้วย (backend คืน 2 โค้ดนี้จริง)

**Acceptance:** ทุกโค้ดข้างบนมี UI รองรับ · retry ใช้ key เดิม · ไม่มี state ค้าง/จอขาว

---

### F2 — แสดงประวัติเธรดเต็มในห้องแชท 🟡 **(ขึ้นกับ B1)**
เมื่อ B1 ทำ multi-turn เสร็จ → เช็คว่า `chat-view` โหลดและ render ข้อความทั้งเธรดจาก `GET /api/conversations/:id` (user ขวา / AI ซ้าย, ข้อความยาวอ่านง่าย) และ scroll/anchor ถูกต้อง · เริ่มได้เมื่อ B1 merge

---

### F3 — M4 polish pass 🟢
- responsive ทุกหน้า (มือถือ/แท็บเล็ต/เดสก์ท็อป) — โดยเฉพาะ admin tables
- empty / error / skeleton เนียนทั่วทุกหน้า (มี `content-skeleton.tsx` อยู่แล้ว ใช้ให้ทั่ว)
- ตรวจ loading state ตอนสลับหน้า/โหลดเธรด

**Acceptance:** ไม่มีหน้าไหน layout แตกบนมือถือ · ไม่มี flash of empty content

---

### F4 — เนื้อหา legal จริง 🟢
หน้า `privacy` / `terms` / `disclaimer` **มีโครงแล้ว** — ตรวจว่าเป็นข้อความจริง (ขอจากลูกค้า/ที่ปรึกษากฎหมาย) ไม่ใช่ placeholder · ต้องมี disclaimer "เพื่อความบันเทิง" ตามกฎหมายดูดวง

---

## 7. ⏸️ รอ PM ตัดสินใจ

| เรื่อง | ตัวเลือก | บล็อกอะไร |
|--------|----------|-----------|
| **Rate-limit production** | (ก) Upstash Redis — รอด multi-instance, ต้องเปิดบัญชี + env (~half day) · (ข) คง in-memory — พอสำหรับ single-instance/demo, 0 งาน · (ค) พักไว้ ปิด M4 ด้วยงานอื่นก่อน | **B3** |
| **Quota/ราคา/Pro expiry** | ยืนยัน: Free 3 / Pro 100 / 199฿ ยังใช้ไหม · Pro หมดอายุรายเดือน หรือ manual | ค่า seed + payment logic |
| **NEXT_PUBLIC_APP_PHASE ตอน deploy** | เปิดหมด / ซ่อน AI (=2) / เปิด AI (=3) | B4 |

---

## 8. 🔧 Environment variables (สำหรับ B4)

จาก [env.ts](src/config/env.ts) — ตัวที่ต้องตั้งจริงตอน production:

| ตัวแปร | จำเป็น | หมายเหตุ |
|--------|--------|----------|
| `DATABASE_URL` | ✅ | Supabase pooler |
| `DIRECT_URL` | ✅ | สำหรับ `db:migrate` (Prisma direct) |
| `AUTH_SECRET` | ✅ | `npx auth secret` |
| `AUTH_URL` / `APP_BASE_URL` | ✅ | domain จริง (ลิงก์ในอีเมล) |
| `AUTH_GOOGLE_ID` / `_SECRET` | ✅ | Google login |
| `GEMINI_API_KEY` | ✅ | **AI chat ใช้ไม่ได้ถ้าไม่ตั้ง** (คืน `MISSING_API_KEY`) |
| `RESEND_API_KEY` / `EMAIL_FROM` | ✅ | อีเมลจริง (ไม่ตั้ง = log console) |
| `TURNSTILE_SECRET_KEY` | ⬜ | bot protection |
| `OPENAI_API_KEY` | ⬜ | fallback provider |
| `SEED_ADMIN_EMAIL` / `_PASSWORD` | ✅ | สร้าง admin คนแรกตอน seed |
| `NEXT_PUBLIC_APP_PHASE` | ⬜ | feature gating (unset=เปิดหมด) |

> 🔐 API key อยู่ใน env เท่านั้น — DB เก็บแค่ `secretReference` (ชื่อ env) ไม่เก็บ key จริง ([resolveSecret](src/config/env.ts#L55))

---

## 9. 📌 งานเสริม: sync เอกสารให้ตรงโค้ด

ต้องแก้ให้ตรงความจริง (ดู §1):
- `BACKEND_TASKS.md` — mark M3/M4 ที่เสร็จเป็น `[x]`, เหลือแค่ B1–B4
- `FRONTEND_TASKS.md` — mark M3 UI ที่เสร็จเป็น `[x]`, เหลือแค่ F1–F4
- `docs/index.md` — ลบ "ยังไม่มี: /api/conversations" (มีแล้ว), อัปสถานะ M3/M4
- `PROJECT_STRUCTURE.md` — footer ยังเขียน "อัปเดตล่าสุด: Milestone 1" → อัปเป็นสถานะปัจจุบัน

---

## 10. 🔗 ลำดับงาน & ใครบล็อกใคร

```
PM ตัดสินใจ rate-limit ──► B3 (ถ้าเลือก Redis)
        │
        ▼
BN:  B1 multi-turn ──► B2 tests ──► B4 deploy config ──► 🚀 go-live
        │
        └──────────► FN: F2 render thread (เริ่มได้หลัง B1 merge)

FN:  F1 error-state ─┐
     F3 polish ──────┼─► ทำขนานได้เลย ไม่รอใคร
     F4 legal ───────┘
```

- **ทำขนานได้ทันที (ไม่รอใคร):** B1, B2, F1, F3, F4
- **ต้องรอ:** F2 รอ B1 · B3 รอ PM · B4 (go-live) รอ B1+B2 เสร็จ + PM ยืนยัน env/phase
- **เส้นทางวิกฤต (critical path):** `B1 → B2 → B4 → go-live`

---

## 11. ✅ Definition of Done — M4 ปิดเมื่อ

- [ ] แชทต่อเนื่องหลาย turn ได้จริง หักเครดิตถูก (B1)
- [ ] `npm run test` ครอบ credit/refund/lock/idempotency/routing/admin-auth (B2)
- [ ] rate-limit ตัดสินใจแล้ว + implement/ปิด note (B3 + PM)
- [ ] deploy production: env ครบ, migrate+seed, smoke test ผ่าน (B4)
- [ ] chat error-state ครบทุกโค้ด + retry ใช้ key เดิม (F1)
- [ ] render ประวัติเธรดเต็ม (F2)
- [ ] responsive + skeleton เนียนทุกหน้า (F3)
- [ ] legal content จริง (F4)
- [ ] เอกสาร 4 ไฟล์ sync ตรงโค้ด (§9)

---

*อ้างอิงโค้ด ณ commit `3796e65` · หากมี commit ใหม่หลังจากนี้ ตรวจซ้ำก่อนใช้*
