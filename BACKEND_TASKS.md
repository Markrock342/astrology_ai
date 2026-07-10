# 🟩 Backend — งานของคุณ (HoraSard)

คู่มือเฉพาะ Backend dev อ่านคู่กับ `README.md` (สถาปัตยกรรม + วิธีรัน)
และ **`PROJECT_STRUCTURE.md`** (โครงสร้างโปรเจกต์ / ความจำกลางของทีม)
ฝั่ง Frontend อยู่ในไฟล์ `FRONTEND_TASKS.md`

**ขอบเขตของคุณ:** service layer + API + ฐานข้อมูล + AI integration
**โฟลเดอร์ที่ดูแล:** `src/server/`, `src/app/api/`, `prisma/`
**กฎเหล็ก:** business logic อยู่ใน `src/server/*` เท่านั้น — route handler แค่ validate + authorize + เรียก service

> อัปเดตตามดีไซน์จริง `Horasard UI` (ดู `design/mockups/`) — มี schema ต้องปรับ ดูข้อ 0

---

## 0. ⚠️ สิ่งที่เปลี่ยนจากแผนเดิม (มีผลกับ schema)

ดีไซน์จริงทำให้ backend ต้องปรับหลายจุด:

1. **แอปเป็นแบบ Chat (สนทนาหลายข้อความต่อเธรด)** ไม่ใช่ reading ยิงครั้งเดียว
   → schema เดิม `HoroscopeReading` (Q&A เดี่ยว) **ต้องปรับเป็นโมเดลแชท**:
   - `Conversation` (เธรด): userId, categoryId (หัวข้อ), mode (`NATAL` พื้นดวงเดิม / `TRANSIT` ดวงจร), title, createdAt
   - `Message`: conversationId, role (`USER`/`ASSISTANT`), content, + (ฝั่ง assistant) provider/modelId/promptVersion/creditCost/usage
   - **หักเครดิตต่อ 1 ข้อความตอบของ AI** (ไม่ใช่ต่อ reading) — ยังคงหลัก charge-after-success + idempotency เดิม
2. **แก้วันเกิดได้อีกแค่ 1 ครั้ง** → เพิ่ม `birthProfile.editCount` (เริ่ม 0, แก้ได้จนถึง 1) + บังคับที่ service
3. **ฟิลด์วันเกิดเพิ่ม**: `birthCountry` (default ไทย), `birthProvince`, `birthDistrict` (บังคับ), เวลาเป็น ชม./นาที
   - รับปีเป็น **พ.ศ. หรือ ค.ศ.** จาก client แต่ **เก็บเป็น ค.ศ. (UTC) เสมอ** (แปลงก่อนบันทึก)
4. **2 โหมด**: `NATAL` (หมวด Free/Pro) และ `TRANSIT`/ดวงจร (**Pro เท่านั้นทั้งโหมด**)
5. **Google login อยู่ Phase 1** + ผู้ใช้ใหม่ **auto-create บัญชีตอน sign-in ครั้งแรก**
6. **คำถามแนะนำต่อหมวด** → เพิ่ม `HoroscopeCategory.suggestedQuestions` (Json อาเรย์)
7. **Voice/STT/TTS = Phase 2 อย่าทำ** (ในดีไซน์เป็นไอคอนโทรศัพท์ไว้เฉยๆ)
8. ต้องมีเนื้อหา **นโยบายความเป็นส่วนตัว/เงื่อนไข** (เก็บใน `app_settings` หรือหน้า static)

**กฎ Flowchart (ยืนยัน PM แล้ว)**
- **Free ห้ามแชท AI** — `reading-service` + `message-service` คืน `CHAT_REQUIRES_PRO`; `GET /api/me` มี `canChat: plan === "PRO"`
- **Free หมวด:** ตัวตน + การงานเท่านั้น (หมวด Pro ยัง lock ด้วย `CATEGORY_LOCKED`)
- **`NatalChart`** model + stub service หลัง save birth — engine จริง port จาก `newhora` ภายหลัง
- **ดวงจร:** `TRANSIT_REQUIRES_PRO` + ฟิลด์ transit บน `Conversation`

> โมเดลเดิม `HoroscopeReading`/`ai_usage_logs` ยังใช้เป็นฐานได้ — ปรับ `reading-service.ts` ให้ทำงานระดับ "ข้อความ" แทน "reading" แล้ว migrate ชื่อ/ความสัมพันธ์ให้ตรงโมเดลแชท

---

## 1. Git workflow (อ่านก่อนเริ่ม — สำคัญที่สุด)

เราใช้ **feature branch + Pull Request** ไม่ใช่ branch ถาวรต่อคน

### กติกา 6 ข้อ
1. **ห้าม push ตรงเข้า `main`** 2. **1 งาน = 1 branch สั้นๆ** 3. **`git pull` ก่อนเริ่มเสมอ**
4. **PR เล็กๆ** 5. **PM merge** 6. **คุยกับ Frontend ก่อนแก้ไฟล์กลาง**

### ชื่อ branch: `be/<งาน>`  เช่น `be/chat-model`, `be/gemini-adapter`

```bash
git checkout main && git pull
git checkout -b be/chat-model
# ...แก้ schema...
npm run db:migrate          # สร้าง migration (commit ไปด้วย)
npm run typecheck && npm run lint
git add -A && git commit -m "feat(chat): add Conversation + Message models"
git push -u origin be/chat-model
# เปิด PR → รอ PM รีวิว → merge → ลบ branch
```

### conflict
```bash
git checkout main && git pull
git checkout be/chat-model
git merge main    # ไม่แน่ใจให้ถาม PM ก่อน
```

---

## 2. Checklist ราย Milestone (สถานะจริง — ตรวจกับโค้ด ณ commit `3796e65`)

> **อ่านก่อน:** checklist นี้ผ่านการตรวจกับโค้ดจริง + git history แล้ว ไม่ใช่แผนเดิม (แผนเดิมล้าสมัยหนัก)
> `[x]` = มีในโค้ดและใช้งานได้ · `[ ]` = ยังค้างจริง (งานที่เหลือเพื่อ production)
> รายละเอียดเชิงลึก + ผังลำดับงาน + env checklist ดู [`M4_HANDOFF.md`](./M4_HANDOFF.md)

### 🎯 Milestone 2 — Schema chat, Auth, Birth profile, Admin API ✅ ปิดแล้ว

- [x] **ปรับ schema**: เพิ่ม `Conversation` + `Message`, ปรับ `BirthProfile` (country/province/district + `editCount`), เพิ่ม `suggestedQuestions` ที่ category → เขียน migration
- [x] เตรียม dataset **จังหวัด/อำเภอไทย** (เสิร์ฟผ่าน `GET /api/geo/thailand` + `src/data/thailand-geo.ts`; อำเภอยังชุดย่อ)
- [x] แปลงปี **พ.ศ.→ค.ศ.** ก่อนบันทึก (เก็บ UTC)
- [x] Auth: เปิด **Google provider** ใน `src/auth.ts` + **auto-create user ตอน sign-in ครั้งแรก**
- [x] Sign-in อีเมล: **อีเมล+รหัสผ่าน** สมัครตรง เก็บ `passwordHash` ใน DB เรา (Credentials) — **ไม่ใช้ magic-link**
- [x] `GET/PUT /api/me/birth-profile` — **บังคับ editCount ≤ 1** (แก้ได้อีกครั้งเดียว)
- [x] `GET /api/me`, `/api/me/package`, `/api/me/credits`
- [x] Admin API: users (list/detail/status/credits/subscription) + CRUD categories, packages (+ `writeAudit` ทุก mutation)

**Acceptance:** sign-in (Google+email) ได้ · กรอก/แก้วันเกิด (จำกัด 1 ครั้ง) ได้ · admin จัดการผู้ใช้/หมวด/แพ็กเกจได้

> **M2 ปิดแล้ว** (`be/m2-close` + `fe/milestone2-3-ui` + flowchart rules). DB migrate+seed บน Supabase แล้ว.

### 🎯 Milestone 3 — Chat + Gemini + Credit/Quota + History 🟢 ~85%

**เสร็จแล้ว:**
- [x] API แชท: `GET|POST /api/conversations`, `GET /api/conversations/:id`, `POST /api/conversations/:id/messages` (รับ header `Idempotency-Key`) — `e06f129`
- [x] กฎ Free ห้ามแชท: `CHAT_REQUIRES_PRO` + `canChat` ใน `/api/me`
- [x] `NatalChart` + **newhora engine เต็ม** (`engine/newhora/*` + `compute-chart.ts`) + `GET /api/me/natal-chart` — `6944412`
- [x] **`providers/gemini.ts` เรียก Gemini จริง** — REST + `AbortController(timeoutMs)` + `resolveSecret()` + **ไม่ throw** (คืน `ok:false` เพื่อ fallback/ไม่หักเครดิต) — `45f37d9`
- [x] Prompt builder: persona แม่หมอ + โหมด natal/transit + knowledge docs (`prompt-builder.ts`, `prompt-resolver.ts`)
- [x] คำถามแนะนำต่อหมวด (`suggestedQuestions` ตอบใน `GET /api/horoscope/categories`)
- [x] Admin AI: CRUD `prompts`, `ai-configs` + `POST /api/admin/ai-configs/:id/test`, `GET /api/admin/ai-usage`, knowledge — `3796e65`
- [x] `reading-service.ts` บังคับ 4 กฎครบ (permission/quota ก่อนยิง · AI fail = ไม่หักเครดิต · idempotency · charge+persist ใน transaction เดียว)

**ค้างจริง (→ production):**
- [ ] **B1 — Multi-turn context จริง**: `message-service.ts` ยัง `delegate → createReading()` ยิงทีละคำถาม ไม่ส่งประวัติเธรดเข้า prompt (ดู `message-service.ts:19` คอมเมนต์ "Phase 1: delegates ... Wave C+") → โหลด `Message[]` ก่อนหน้าของเธรด ส่งเป็น conversation history เข้า adapter (Gemini รองรับ `contents[]` หลาย turn อยู่แล้ว), เลิกพึ่ง single-shot · **ต้องคงกฎ 4 ข้อเดิม** · จำกัด context (turn ล่าสุด/token budget)
- [ ] **B2 — Tests** (acceptance M3 ที่ยังไม่มี): หักเครดิต · **refund/ไม่หักเมื่อ AI error/timeout** · `CHAT_REQUIRES_PRO`/`CATEGORY_LOCKED`/`TRANSIT_REQUIRES_PRO` · `NO_QUOTA`/`RATE_LIMITED` · idempotency (retry key เดิมไม่สร้างซ้ำ) · model routing/fallback · admin auth block

**Acceptance:** สนทนาต่อเนื่องหลาย turn AI อ้างอิงบทก่อนหน้าได้ · หักเครดิตต่อ **ข้อความตอบ** ถูก · error ไม่หักซ้ำ · retry ไม่สร้างข้อความซ้ำ · `npm run test` ครอบเคสข้างบนครบ

### 🎯 Milestone 4 — Payment, Package, Dashboard, Deploy 🟢 ~80%

**เสร็จแล้ว:**
- [x] Manual payment: `POST /api/payments/manual` + `GET /api/payments/me` + admin review (`/api/admin/payments/:id/review`) + เปิดแพ็กเกจ + audit — `56cb57d`
- [x] จัดการแพ็กเกจ + **ยกเลิกการเป็นสมาชิก** (`POST /api/me/subscription/cancel`)
- [x] `GET /api/admin/dashboard` — KPIs + ต้นทุน AI โดยประมาณ (`dashboard-admin-service.ts`) — `31412b9`
- [x] เก็บ/เสิร์ฟ นโยบาย/เงื่อนไข (CMS settings + หน้า `(public)/{privacy,terms,disclaimer}` + `GET /api/settings/public`)
- [x] **อีเมลจริง** (password reset ฯลฯ) — Resend wired ใน `mailer.ts` (ตั้ง `RESEND_API_KEY` = ส่งจริง / ไม่ตั้ง = log console)

**ค้างจริง (→ production):**
- [ ] **B3 — Rate-limit production-grade**: `src/lib/rate-limit.ts` ยัง in-memory `Map` (คอมเมนต์เขียนเองว่าต้อง Redis/Upstash สำหรับ multi-instance) → Upstash Redis sliding-window, **คง interface `rateLimit(key, limit, windowMs)` เดิม** + env `UPSTASH_REDIS_REST_URL`/`_TOKEN` · **⏸️ รอ PM เคาะก่อน** (Redis vs คง in-memory — ถ้าคง in-memory = แค่เขียน note ปิด)
- [ ] **B4 — Go-live config** (ตั้งค่า ไม่ใช่เขียนโค้ด): ตั้ง env จริงบน Vercel (ดู §7) · `db:migrate` + `db:seed` บน Supabase production (ต้องมี `DIRECT_URL`) · ตั้ง `NEXT_PUBLIC_APP_PHASE` ตามที่ลูกค้าจ่าย · ยืนยัน backup policy · smoke test flow เต็มบน production URL

---

## 2b. 🚀 Production go-live checklist (B4)

**Env ที่ต้องตั้งจริง** (จาก `src/config/env.ts`):

| ตัวแปร | จำเป็น | หมายเหตุ |
|--------|--------|----------|
| `DATABASE_URL` | ✅ | Supabase pooler |
| `DIRECT_URL` | ✅ | สำหรับ `db:migrate` (Prisma direct connection) |
| `AUTH_SECRET` | ✅ | `npx auth secret` |
| `AUTH_URL` / `APP_BASE_URL` | ✅ | domain จริง (ใช้สร้างลิงก์ในอีเมล) |
| `AUTH_GOOGLE_ID` / `_SECRET` | ✅ | Google login |
| `GEMINI_API_KEY` | ✅ | **AI chat ใช้ไม่ได้ถ้าไม่ตั้ง** (คืน `MISSING_API_KEY`) |
| `RESEND_API_KEY` / `EMAIL_FROM` | ✅ | อีเมลจริง (ไม่ตั้ง = log console เท่านั้น) |
| `TURNSTILE_SECRET_KEY` | ⬜ | bot protection บนฟอร์ม auth |
| `OPENAI_API_KEY` | ⬜ | fallback provider |
| `SEED_ADMIN_EMAIL` / `_PASSWORD` | ✅ | สร้าง admin คนแรกตอน seed |
| `NEXT_PUBLIC_APP_PHASE` | ⬜ | feature gating (unset=เปิดหมด · `2`=ซ่อน AI · `3`=เปิด AI) |

**ขั้นตอน deploy:** ตั้ง env → `npm run db:migrate` → `npm run db:seed` → verify admin login → smoke test: sign-in → กรอกวันเกิด → อัปเกรด Pro (manual) → แชท → ได้คำตอบจาก Gemini จริง

---

## 3. สิ่งที่เขียนไว้ให้แล้ว (ใช้ซ้ำ อย่าเขียนใหม่)
- `credit-service.ts` — หักเครดิต atomic + optimistic lock + ledger immutable → **ทุกการเปลี่ยนเครดิตผ่านที่นี่ ห้ามแตะ `balance` ตรง**
- `reading-service.ts` — flow charge-after-success + idempotency (ปรับให้ทำงานระดับ message)
- `src/server/ai/` — adapter · router (fallback) · prompt-builder · usage-logger
- `rbac.ts` — `requireUser()`, `requireAdmin()`, `requireSuperAdmin()`
- `audit-service.ts` — `writeAudit()` (เรียกทุก admin mutation)
- `http.ts` — `handle()`, `ok()`, `fail()` · `errors.ts` — `AppError(code, msg)`

**Pattern route handler:**
```ts
export async function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const data = someSchema.parse(await req.json());
    return ok(await someService(user.id, data));
  });
}
```

---

## 4. สัญญากับ Frontend (contract)
ทุก API ตอบ `{ ok:true, data }` หรือ `{ ok:false, error:{ code, message } }` — อย่าเปลี่ยนโดยไม่บอก FE

**ไฟล์กลางที่ต้องคุยกับ FE ก่อนแก้:**
`prisma/schema.prisma` · `src/types/index.ts` · `src/lib/schemas.ts` · `src/config/constants.ts` · `package.json`

---

## 5. ความปลอดภัย (ห้ามพลาด)
- API key อยู่ใน env เท่านั้น — DB เก็บแค่ `secretReference` ห้ามเก็บ key จริง
- ห้าม log password / API key · ทุก admin route เรียก `requireAdmin()` ฝั่ง server
- เครดิต + สร้างข้อความ อยู่ใน DB transaction เดียวกัน · เก็บวันเวลาเป็น UTC

---

## 6. รอ PM ยืนยัน (มีผลกับ backend)
- **ดวงจร (transit)** อยู่ Phase 1 ไหม (เพิ่มงานเยอะ: คำนวณ/หาวันอัตโนมัติ) หรือเลื่อน
- ~~Sign-in อีเมล~~ → **ตัดสินใจแล้ว:** อีเมล+รหัสผ่าน สมัครตรง เก็บ DB (ไม่ใช้ magic-link)
- Free/Pro quota + ราคา + credit cost ต่อข้อความ/หมวด (ตอนนี้: Free 3, Pro 100, 199฿)
- Pro หมดอายุรายเดือน หรือ manual ไม่มีกำหนด
- ประวัติแชท: แยกตามหัวข้อ หรือรวมใน ดวงจร (ดีไซน์มี 2 ไอเดีย)
- ใครถือบัญชี/จ่าย Gemini + hosting/Postgres · แหล่งข้อมูลจังหวัด/อำเภอ
