# 🟩 Backend — งานของคุณ (HoraSard)

คู่มือเฉพาะ Backend dev อ่านคู่กับ `README.md` (สถาปัตยกรรม + วิธีรัน)
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
4. **2 โหมด**: `NATAL` (หมวด Free/Pro) และ `TRANSIT`/ดวงจร (**Pro เท่านั้นทั้งโหมด**) — *รอ PM ยืนยันว่าดวงจรอยู่ Phase 1 ไหม*
5. **Google login อยู่ Phase 1** + ผู้ใช้ใหม่ **auto-create บัญชีตอน sign-in ครั้งแรก**
6. **คำถามแนะนำต่อหมวด** → เพิ่ม `HoroscopeCategory.suggestedQuestions` (Json อาเรย์)
7. **Voice/STT/TTS = Phase 2 อย่าทำ** (ในดีไซน์เป็นไอคอนโทรศัพท์ไว้เฉยๆ)
8. ต้องมีเนื้อหา **นโยบายความเป็นส่วนตัว/เงื่อนไข** (เก็บใน `app_settings` หรือหน้า static)

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

## 2. Checklist ราย Milestone (อัปเดตตามดีไซน์จริง)

### 🎯 Milestone 2 — Schema chat, Auth, Birth profile, Admin API

- [ ] **ปรับ schema**: เพิ่ม `Conversation` + `Message`, ปรับ `BirthProfile` (country/province/district + `editCount`), เพิ่ม `suggestedQuestions` ที่ category → เขียน migration
- [ ] เตรียม dataset **จังหวัด/อำเภอไทย** (เสิร์ฟผ่าน API หรือฝัง JSON) + ตกลงรูปแบบกับ Frontend
- [ ] แปลงปี **พ.ศ.→ค.ศ.** ก่อนบันทึก (เก็บ UTC)
- [ ] Auth: เปิด **Google provider** ใน `src/auth.ts` + **auto-create user ตอน sign-in ครั้งแรก**
- [ ] Sign-in อีเมล: ยืนยันกับ PM (magic-link vs อีเมล+รหัสผ่าน) แล้ว implement ให้ตรง
- [ ] `GET/PUT /api/me/birth-profile` — **บังคับ editCount ≤ 1** (แก้ได้อีกครั้งเดียว)
- [ ] `GET /api/me`, `/api/me/package`, `/api/me/credits`
- [ ] Admin API: users (list/detail/status/credits/subscription) + CRUD categories, packages (+ `writeAudit` ทุก mutation)

**Acceptance:** sign-in (Google+email) ได้ · กรอก/แก้วันเกิด (จำกัด 1 ครั้ง) ได้ · admin จัดการผู้ใช้/หมวด/แพ็กเกจได้

### 🎯 Milestone 3 — Chat + Gemini + Credit/Quota + History

- [ ] API แชท: `POST /api/conversations` (เริ่มเธรดตามหัวข้อ/โหมด), `POST /api/conversations/:id/messages` (ส่งข้อความ → AI ตอบ), `GET /api/conversations`, `GET /api/conversations/:id`
- [ ] ปรับ `reading-service.ts` → **message-service**: เช็คสิทธิ์ (Free/Pro, ดวงจร=Pro) → เช็ค quota → เรียก AI → **หักเครดิตหลังสำเร็จ** → บันทึก message + usage ใน transaction เดียว → idempotency กันกดซ้ำ
- [ ] `providers/gemini.ts` — เรียก Gemini จริง + `AbortController(timeoutMs)`, ใช้ `resolveSecret()`; **ห้าม throw** เมื่อ error (คืน `ok:false` เพื่อ fallback และไม่หักเครดิต)
- [ ] Prompt builder: รองรับประวัติสนทนา (ส่ง context ของเธรด) + persona แม่หมอ + โหมด natal/transit
- [ ] คำถามแนะนำต่อหมวด (ตอบใน `GET /api/horoscope/categories`)
- [ ] Admin: CRUD prompts, ai-configs + `POST /api/admin/ai-configs/:id/test`, `GET /api/admin/ai-usage`
- [ ] Tests: หักเครดิต · refund เมื่อ AI error · Free/Pro + ดวงจร lock · model routing · admin auth · idempotency

**Acceptance:** แชทได้ · AI ตอบ+บันทึก · หักเครดิตถูก · error ไม่หักซ้ำ · retry ไม่สร้างข้อความซ้ำ · ประวัติเธรดครบ

### 🎯 Milestone 4 — Payment, Package, Dashboard, Deploy
- [ ] Manual payment: `POST /api/payments/manual` + admin review + เปิดแพ็กเกจ (+ audit)
- [ ] จัดการแพ็กเกจ + **ยกเลิกการเป็นสมาชิก** (endpoint + ปรับ subscription)
- [ ] `GET /api/admin/dashboard` (ตัวเลข + ต้นทุน AI โดยประมาณ)
- [ ] Rate-limit production-grade (Redis/Upstash), production DB + secrets + backup
- [ ] เก็บ/เสิร์ฟ นโยบายความเป็นส่วนตัว/เงื่อนไข

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
- Sign-in อีเมล: magic-link หรือ อีเมล+รหัสผ่าน
- Free/Pro quota + ราคา + credit cost ต่อข้อความ/หมวด (ตอนนี้: Free 3, Pro 100, 199฿)
- Pro หมดอายุรายเดือน หรือ manual ไม่มีกำหนด
- ประวัติแชท: แยกตามหัวข้อ หรือรวมใน ดวงจร (ดีไซน์มี 2 ไอเดีย)
- ใครถือบัญชี/จ่าย Gemini + hosting/Postgres · แหล่งข้อมูลจังหวัด/อำเภอ
