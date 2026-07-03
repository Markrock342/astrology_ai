# HoraSard — โครงสร้างโปรเจกต์ (Canonical Reference)

เอกสารนี้คือ **ความจำกลางของทีม** — อ่านก่อนเริ่มงานทุกครั้ง
Repo: [github.com/Markrock342/astrology_ai](https://github.com/Markrock342/astrology_ai)

| เอกสาร | ใครอ่าน |
|--------|---------|
| `README.md` | ทุกคน — สถาปัตยกรรม, วิธีรัน, guardrails |
| **ไฟล์นี้** | ทุกคน — โครงสร้างโฟลเดอร์, DB, API, AI, Phase |
| `FRONTEND_TASKS.md` | Frontend dev — checklist + git workflow |
| `BACKEND_TASKS.md` | Backend dev — checklist + git workflow |
| `design/mockups/` | Frontend — ดีไซน์จริง 5 หน้า |

---

## 1. ภาพรวมผลิตภัณฑ์

- **ชื่อ:** โหราศาสตร์ / HORASARD (`horasard.com`)
- **ประเภท:** แอปดูดวง AI แบบ **แชท** (สนทนาหลายข้อความ) ไม่ใช่ Q&A ยิงครั้งเดียว
- **ผู้ใช้:** สมัคร/เข้าสู่ระบบ → กรอกวันเกิด (บังคับครั้งแรก) → เลือกหมวด → แชทถาม AI
- **สิทธิ์:** Free / Pro + เครดิต (ไม่แสดง token ดิบ)
- **แอดมิน:** CMS จัดการ user, หมวด, prompt/persona, AI model, แพ็กเกจ, เครดิต, การชำระเงิน manual, usage logs

---

## 2. Tech stack

| Layer | เทคโนโลยี |
|-------|-----------|
| Frontend | Next.js 16 App Router, React 19, TypeScript, Tailwind v4 |
| Backend | Next.js Route Handlers + `src/server/*` service layer |
| DB | PostgreSQL + Prisma 6 |
| Auth | Auth.js v5 — Google + อีเมล (auto-create user ครั้งแรก) |
| AI | Gemini (adapter/router) — ขยาย provider อื่นได้ภายหลัง |
| Validation | Zod |

---

## 3. โครงสร้างโฟลเดอร์

```
hora_ai/
├── design/
│   └── mockups/              # ดีไซน์จริง (01_Sign-in … 05_Chat)
├── prisma/
│   ├── schema.prisma         # โมเดล DB ทั้งหมด
│   ├── migrations/           # versioned migrations
│   └── seed.ts               # ข้อมูลเริ่มต้น (หมวด, แพ็กเกจ, prompt, admin)
├── src/
│   ├── app/                  # Next.js routes (บาง — เรียก service เท่านั้น)
│   │   ├── (public)/         # landing, login, register, forgot-password
│   │   ├── (app)/            # โซนผู้ใช้ (guard ใน layout)
│   │   ├── (admin)/admin/    # Admin CMS (guard ADMIN)
│   │   └── api/              # Route Handlers → src/server/*
│   ├── server/               # ★ BUSINESS LAYER (ห้ามมี React)
│   │   ├── db.ts
│   │   ├── auth/             # config, rbac (requireUser, requireAdmin)
│   │   ├── credit/           # หัก/เพิ่มเครดิต atomic
│   │   ├── horoscope/        # reading-service (→ จะเป็น message-service)
│   │   ├── ai/               # adapter, router, prompt-builder, gemini, usage-logger
│   │   └── audit/            # admin audit logs
│   ├── lib/                  # errors, http, schemas, rate-limit, date
│   ├── config/               # env validation, constants
│   ├── components/           # UI components
│   ├── types/                # shared types (HoroscopeResponse, AI I/O)
│   └── auth.ts               # NextAuth root instance
├── tests/                    # (M3) credits, refund, permissions, routing
├── .env.example
├── README.md
├── PROJECT_STRUCTURE.md      # ← ไฟล์นี้
├── FRONTEND_TASKS.md
└── BACKEND_TASKS.md
```

### กฎเหล็ก (ห้ามละเมิด)

1. **UI ไม่มี business logic** — `src/app/*` เรียก `src/server/*` เท่านั้น
2. **ห้ามเรียก Gemini จาก browser** — ผ่าน adapter/router ฝั่ง server
3. **API key อยู่ใน env** — DB เก็บแค่ `secretReference` (ชื่อ env var)
4. **หักเครดิตหลัง AI สำเร็จเท่านั้น** — ใช้ `Idempotency-Key` กันกดซ้ำ
5. **ทุกการเปลี่ยนเครดิตผ่าน `credit-service`** — ห้ามแก้ `balance` ตรง
6. **ทุก admin mutation เรียก `requireAdmin()` + `writeAudit()`**
7. **เก็บวันเวลา UTC** — แสดงผลเวลาไทย (`Asia/Bangkok`)

---

## 4. UX / ดีไซน์ (ยืนยันแล้ว)

อ้างอิง `design/mockups/`

| หน้า | ไฟล์ | หมายเหตุ |
|------|------|----------|
| Sign-in | `01_Sign-in.jpg` | Google + อีเมล, ไม่มี Register แยก |
| Birth form | `02_Birthdate.jpg` | วัน/เดือน/ปี(พ.ศ.·ค.ศ.)/เวลา + ประเทศ/จังหวัด/อำเภอ, แก้ได้อีก 1 ครั้ง |
| Settings | `03_Settings.jpg` | popover: ชื่อ, รหัสผ่าน, วันเกิด(1/2), แพ็กเกจ, logout |
| Home/Chat | `04_New_Chat.jpg` | sidebar หมวด Free/🔒Pro + ประวัติแชท |
| Chat | `05_Chat.jpg` | แชท + คำถามแนะนำ |

**ธีม:** พื้นดำ `#0d0d0f` + ทอง `#c9a24b` + เขียวเทอร์ควอยซ์ `#1f8f7a` · ฟอนต์ Noto Sans Thai

**Free vs Pro (พื้นดวงเดิม):**
- Free: ตัวตน, การงาน
- Pro (🔒): การเงิน, ความรัก, สุขภาพ, โชคลาภ

**ดวงจร (transit):** Pro ทั้งโหมด — **รอ PM ยืนยันว่าอยู่ Phase 1 หรือเลื่อน**

**Phase 2 (ยังไม่ทำ):** Voice/STT/TTS, ไอคอนโทรศัพท์ในช่องแชท, RAG, payment gateway อัตโนมัติ

---

## 5. AI — Persona + Static Knowledge (Phase 1)

### ทำได้ใน Phase 1

| วิธี | รายละเอียด |
|------|-------------|
| **System prompt** | กฎความปลอดภัย, ขอบเขต, รูปแบบ output |
| **Persona** | โทนแม่หมอ อบอุ่น น่าเชื่อถือ ไม่ฟันธง |
| **Category prompt** | คำแนะนำเฉพาะหมวด |
| **Plan prompt** | Free สั้น / Pro ละเอียด |
| **Static knowledge** | ข้อความสั้นใน DB (`prompt_templates` type KNOWLEDGE) |

### ยังไม่ทำ (Phase 2)

- อัปโหลดไฟล์ (PDF, Word, Excel)
- Vector DB / RAG / retrieval อัตโนมัติ
- Fine-tuning โมเดล

### ลำดับประกอบ prompt (`prompt-builder.ts`)

```
1. Safety → 2. Persona → 3. Plan → 4. Category → 5. Knowledge
→ 6. Birth profile → 7. User question → 8. Output format
```

### AI pipeline (server-only)

```
Request → Config resolver → Prompt builder → Provider adapter (Gemini)
→ Usage logger → (success) Credit deduct + save message
```

ไฟล์หลัก: `src/server/ai/adapter.ts`, `router.ts`, `providers/gemini.ts`, `prompt-builder.ts`

---

## 6. Database (Prisma)

### ตารางปัจจุบัน (ใน `schema.prisma`)

| กลุ่ม | ตาราง |
|-------|--------|
| Auth | `users`, `accounts`, `sessions` |
| Profile | `birth_profiles` |
| Catalog | `horoscope_categories`, `packages`, `user_subscriptions` |
| Credit | `credit_wallets`, `credit_transactions` |
| AI config | `prompt_templates`, `ai_provider_configs` |
| Readings | `horoscope_readings`, `ai_usage_logs` |
| Admin | `payments`, `admin_audit_logs`, `app_settings` |

### ต้องเพิ่ม (Milestone 2 — ตามดีไซน์แชท)

| ตาราง/ฟิลด์ | เหตุผล |
|-------------|--------|
| `conversations` | เธรดแชทต่อหมวด/โหมด |
| `messages` | ข้อความ USER/ASSISTANT, หักเครดิตต่อข้อความตอบ AI |
| `birth_profiles.editCount` | แก้วันเกิดได้อีก 1 ครั้ง |
| `birth_profiles` country/province/district | ฟอร์มดีไซน์บังคับ |
| `horoscope_categories.suggestedQuestions` | คำถามแนะนำต่อหมวด |

---

## 7. API (Phase 1)

### มีแล้ว (ตัวอย่าง)

| Method | Path | หมายเหตุ |
|--------|------|----------|
| GET/POST | `/api/auth/[...nextauth]` | NextAuth |
| POST | `/api/auth/register` | สมัคร (อาจปรับเป็น auto-create ตามดีไซน์) |
| GET | `/api/me` | โปรไฟล์ + แพ็กเกจ |
| GET | `/api/me/credits` | เครดิตคงเหลือ |
| GET | `/api/horoscope/categories` | รายการหมวด |
| POST | `/api/horoscope/readings` | (จะเปลี่ยนเป็น conversations/messages) |

### ต้องทำ (M2–M4)

Auth/birth-profile · Admin users/categories/packages/prompts/ai-configs ·
Chat: `POST/GET /api/conversations`, `POST .../messages` ·
History · Manual payments · Admin dashboard/usage/audit

**รูปแบบ response ทุก endpoint:**
```json
{ "ok": true, "data": {} }
{ "ok": false, "error": { "code": "NO_QUOTA", "message": "..." } }
```

---

## 8. Credit flow (ห้ามหักซ้ำ)

```
1. ตรวจ idempotencyKey → มีแล้วคืนผลเดิม
2. ตรวจ user active + สิทธิ์หมวด + quota
3. เรียก AI (ยังไม่หักเครดิต)
4. AI error/timeout → log usage, ไม่หัก, คืน error
5. AI สำเร็จ → DB transaction เดียว:
   - บันทึก message
   - deductCredits (optimistic lock)
   - credit_transaction (AI_USAGE)
   - ai_usage_log
```

ไฟล์: `src/server/credit/credit-service.ts`, `src/server/horoscope/reading-service.ts`

---

## 9. Git workflow

- `main` = โค้ดที่รันได้ — **ห้าม push ตรง**
- Branch: `fe/<งาน>` (Frontend), `be/<งาน>` (Backend)
- 1 งาน = 1 branch สั้นๆ → PR → PM รีวิว → merge

```bash
git checkout main && git pull
git checkout -b be/chat-model   # หรือ fe/signin-page
# ...ทำงาน...
npm run typecheck && npm run lint
git push -u origin be/chat-model
# เปิด PR
```

---

## 10. Milestones

| # | งานหลัก | สถานะ |
|---|---------|--------|
| M1 | โครงสร้าง, schema, service layer, หน้า skeleton, seed | ✅ เสร็จ |
| M2 | Auth, birth form, schema แชท, Admin API พื้นฐาน, UI ตาม mockup | กำลังทำ |
| M3 | Gemini จริง, แชท + เครดิต + ประวัติ, admin prompt/model | รอ |
| M4 | Polish, deploy, handover | รอ |

---

## 11. รอ PM / ลูกค้ายืนยัน

- ดวงจร (transit) อยู่ Phase 1 ไหม
- Sign-in อีเมล: magic-link หรือ อีเมล+รหัสผ่าน
- Free/Pro quota, ราคา, credit ต่อข้อความ
- Pro หมดอายุรายเดือน หรือ manual
- ประวัติแชท: แยกตามหมวด หรือรวมดวงจร
- ใครถือบัญชี Gemini + hosting/Postgres
- แหล่งข้อมูลจังหวัด/อำเภอไทย

---

## 12. อัปเดตเอกสารนี้เมื่อไหร่

แก้ไฟล์นี้ทุกครั้งที่:
- เพิ่ม/เปลี่ยนโครงสร้างโฟลเดอร์หรือตาราง DB สำคัญ
- ตัดสินใจสโคป Phase 1 vs 2 ใหม่
- เปลี่ยนสัญญา API ที่ FE/BE ใช้ร่วมกัน

*อัปเดตล่าสุด: Milestone 1 foundation + ดีไซน์ Horasard UI + ยืนยัน AI = Persona/static (ไม่รวม RAG Phase 1)*