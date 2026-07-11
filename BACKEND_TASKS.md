# 🟩 Backend — งานของคุณ (HoraSard)

คู่มือเฉพาะ Backend dev อ่านคู่กับ `README.md` (สถาปัตยกรรม + วิธีรัน)
และ **`PROJECT_STRUCTURE.md`** (โครงสร้างโปรเจกต์ / ความจำกลางของทีม)
ฝั่ง Frontend อยู่ในไฟล์ `FRONTEND_TASKS.md`

**อ้างอิงสถานะจริง:** `M4_HANDOFF.md` (commit `3796e65`) · เอกสาร sync ล่าสุด ก.ค. 2026

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
- **`NatalChart`** model + engine จริง (port จาก `newhora`) หลัง save birth
- **ดวงจร:** `TRANSIT_REQUIRES_PRO` + ฟิลด์ transit บน `Conversation`

> โมเดลเดิม `HoroscopeReading`/`ai_usage_logs` ยังใช้เป็นฐานได้ — `message-service` ยัง delegate ผ่าน `reading-service` จนกว่า B1 จะปิด

---

## 1. Git workflow (อ่านก่อนเริ่ม — สำคัญที่สุด)

เราใช้ **feature branch + Pull Request** ไม่ใช่ branch ถาวรต่อคน

### กติกา 6 ข้อ
1. **ห้าม push ตรงเข้า `main`** 2. **1 งาน = 1 branch สั้นๆ** 3. **`git pull` ก่อนเริ่มเสมอ**
4. **PR เล็กๆ** 5. **PM merge** 6. **คุยกับ Frontend ก่อนแก้ไฟล์กลาง**

### ชื่อ branch: `be/<งาน>`  เช่น `be/multi-turn-chat`, `be/m3-tests`

```bash
git checkout main && git pull
git checkout -b be/multi-turn-chat
# ...แก้โค้ด...
npm run typecheck && npm run lint && npm run test
git add -A && git commit -m "feat(chat): send thread history in prompt"
git push -u origin be/multi-turn-chat
# เปิด PR → รอ PM รีวิว → merge → ลบ branch
```

### conflict
```bash
git checkout main && git pull
git checkout be/multi-turn-chat
git merge main    # ไม่แน่ใจให้ถาม PM ก่อน
```

---

## 2. Checklist ราย Milestone (อัปเดตตามโค้ดจริง ณ `3796e65`)

### 🎯 Milestone 2 — Schema chat, Auth, Birth profile, Admin API ✅ ปิดแล้ว

- [x] **ปรับ schema**: `Conversation` + `Message`, `BirthProfile` fields, `suggestedQuestions` → migration
- [x] dataset จังหวัด/อำเภอไทย (`GET /api/geo/thailand`)
- [x] แปลงปี **พ.ศ.→ค.ศ.** ก่อนบันทึก (เก็บ UTC)
- [x] Auth: Google provider + auto-create user
- [x] Sign-in อีเมล: **อีเมล+รหัสผ่าน** สมัครตรง (Credentials) — **ไม่ใช้ magic-link**
- [x] Register + forgot/reset password + email verification (Turnstile)
- [x] `GET/PUT /api/me/birth-profile` — **บังคับ editCount ≤ 1**
- [x] `GET /api/me`, `/api/me/package`, `/api/me/credits`
- [x] Admin API: users + CRUD categories, packages (+ `writeAudit`)

**Acceptance:** ✅ ผ่าน

---

### 🎯 Milestone 3 — Chat + Gemini + Credit/Quota + History 🟢 ~90%

**เสร็จแล้ว (อย่าทำซ้ำ):**

- [x] API แชท: `GET|POST /api/conversations`, `GET /api/conversations/:id`, `POST .../messages` (+ `Idempotency-Key`)
- [x] กฎ Free ห้ามแชท: `CHAT_REQUIRES_PRO` + `canChat` ใน `/api/me`
- [x] `TRANSIT_REQUIRES_PRO` ใน `message-service`
- [x] `NatalChart` + newhora engine port เต็ม + `GET /api/me/natal-chart` + `chart-engine.test.ts`
- [x] `providers/gemini.ts` — REST จริง + `AbortController(timeoutMs)` + คืน `ok:false` (ไม่ throw)
- [x] **B1** multi-turn: `buildConversationHistory` + adapter multi-turn + message idempotency
- [x] `suggestedQuestions` ใน `GET /api/horoscope/categories` (`category-service.ts`)
- [x] Admin AI CMS: prompts, ai-configs, knowledge + `POST .../test`, `GET /api/admin/ai-usage`
- [x] Admin CMS ขยาย: draft/publish, revisions, FAQ, announcements, settings, SEO (`3796e65`)

**ค้างจริง (B2):**

- [ ] **B2** Tests: หักเครดิต · refund เมื่อ AI error · Free/Pro + ดวงจร lock · model routing · admin auth · idempotency

**Acceptance (ยังไม่ครบ):** test ครอบคลุมเงิน/สิทธิ์ (B2)

---

### 🎯 Milestone 4 — Payment, Package, Dashboard, Deploy 🟢 ~80%

**เสร็จแล้ว (อย่าทำซ้ำ):**

- [x] Manual payment: `POST /api/payments/manual` + admin review + เปิดแพ็กเกจ (+ audit)
- [x] `GET /api/payments/me`
- [x] ยกเลิกสมาชิก: `POST /api/me/subscription/cancel`
- [x] `GET /api/admin/dashboard` (KPIs + ต้นทุน AI โดยประมาณ)
- [x] หน้า legal scaffold + CMS settings (`privacy`/`terms`/`disclaimer` — เนื้อหาจริงรอ FE F4)
- [x] Email: `mailer.ts` — Resend เมื่อมี `RESEND_API_KEY` / dev-console fallback

**ค้างจริง (B3–B4):**

- [ ] **B3** Rate-limit production-grade (Redis/Upstash) — **รอ PM ตัดสินใจ** (ตอนนี้ in-memory)
- [ ] **B4** Go-live config: env บน Vercel ครบ, migrate+seed prod, backup, smoke test

---

## 3. สิ่งที่เขียนไว้ให้แล้ว (ใช้ซ้ำ อย่าเขียนใหม่)
- `credit-service.ts` — หักเครดิต atomic + optimistic lock + ledger immutable → **ทุกการเปลี่ยนเครดิตผ่านที่นี่ ห้ามแตะ `balance` ตรง**
- `reading-service.ts` — flow charge-after-success + idempotency (ปรับให้ทำงานระดับ message)
- `message-service.ts` + `thread-service.ts` — API แชท (B1: ยังไม่ส่ง thread context)
- `src/server/ai/` — adapter · router (fallback) · prompt-builder · usage-logger
- `payment-service.ts` · `dashboard-admin-service.ts`
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
- **Rate-limit production** — Redis/Upstash หรือยอม in-memory ชั่วคราว (บล็อก B3)
- **ดวงจร (transit)** auto-คำนวณวัน — enum มีแล้ว gate Pro แล้ว แต่ยังไม่มี engine transit เต็ม
- ~~Sign-in อีเมล~~ → **ตัดสินใจแล้ว:** อีเมล+รหัสผ่าน สมัครตรง เก็บ DB (ไม่ใช้ magic-link)
- Free/Pro quota + ราคา + credit cost ต่อข้อความ/หมวด (ตอนนี้: Free 3, Pro 100, 199฿)
- Pro หมดอายุรายเดือน หรือ manual ไม่มีกำหนด
- ประวัติแชท: แยกตามหัวข้อ หรือรวมใน ดวงจร (ดีไซน์มี 2 ไอเดีย)
- ใครถือบัญชี/จ่าย Gemini + hosting/Postgres · แหล่งข้อมูลจังหวัด/อำเภอ

---

## 7. Critical path ปิด M4 (BN)

```
B1 multi-turn chat → B2 tests → B4 deploy config → go-live
         │
         └── FN F2 (render thread) เริ่มหลัง B1 merge

B3 rate-limit — รอ PM (ทำขนานได้ถ้าตัดสินใจแล้ว)
```
