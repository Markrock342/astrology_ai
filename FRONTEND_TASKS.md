# 🟦 Frontend — งานของคุณ (HoraSard)

คู่มือเฉพาะ Frontend dev อ่านคู่กับ `README.md` (สถาปัตยกรรม + วิธีรัน)
และ **`PROJECT_STRUCTURE.md`** (โครงสร้างโปรเจกต์ / ความจำกลางของทีม)
ฝั่ง Backend อยู่ในไฟล์ `BACKEND_TASKS.md`

> **งานรอบนี้ (อ่านก่อน):** [`FE_ASSIGN.md`](./FE_ASSIGN.md) — F2 multi-turn / ประวัติเธรด

**ขอบเขตของคุณ:** หน้าเว็บ + UI + client state
**โฟลเดอร์ที่ดูแล:** `src/app/(public|app|admin)/`, `src/components/`
**คุยกับ Backend ผ่าน JSON API เท่านั้น** — ห้ามเรียก AI/DB ตรงจากหน้าเว็บ

> อัปเดตตามดีไซน์จริง `Horasard UI` (ดูรูปใน `design/mockups/`) — มีของเปลี่ยนจากแผนเดิม ดูข้อ 0

---

## 0. ⚠️ สรุปดีไซน์จริง + สิ่งที่เปลี่ยนจากแผนเดิม

ดูรูปประกอบใน `design/mockups/` (01_Sign-in … 05_Chat)

**แบรนด์/ธีม (ยืนยันแล้ว)**
- ชื่อ **โหราศาสตร์ / HORASARD** · โดเมน `horasard.com` · โลโก้สีทอง
- ธีม **ดำเกือบสนิท + ทอง (primary) + เขียวเทอร์ควอยซ์ (secondary/active)** — ไม่มีสีม่วงแล้ว
  (ค่าที่จะใช้: bg `#0d0d0f`, สีทอง `#c9a24b`, เขียว `#1f8f7a`/active `#12b886`)
- ฟอนต์ Noto Sans Thai (มีให้ใน `design/.../Font/`)

**สิ่งที่ต่างจากแผนเดิม (สำคัญ)**
1. **ตัวแอปเป็นแบบ Chat** (สนทนา) ไม่ใช่หน้า "ดูดวง" ยิงครั้งเดียว — มี sidebar + ห้องแชท + ประวัติเป็นเธรด
2. **ไม่มีหน้า Register แยก** — Sign-in หน้าเดียว (Google + อีเมล) ผู้ใช้ใหม่ระบบสร้างบัญชีให้อัตโนมัติ
3. **Google login มีในดีไซน์** (อยู่ใน Phase 1)
4. เข้าครั้งแรก **บังคับกรอกวันเกิดก่อน** ถึงใช้แอปได้
5. **แก้วันเกิดได้อีกแค่ 1 ครั้ง** (แสดงตัวนับ "ครั้งที่ 1/2") — กันเอาวันเกิดคนอื่นมาใช้
6. ฟอร์มวันเกิดใช้ **ปี พ.ศ./ค.ศ.** + เวลาเป็น ชม./นาที + **ประเทศ/จังหวัด/อำเภอ (บังคับ)**
7. มี 2 โหมด: **พื้นดวงเดิม** (natal, มีหมวด Free/Pro) และ **ดวงจร** (transit, Pro เท่านั้น)
8. **Voice/โทร (ไอคอนโทรศัพท์ในช่องแชท) = Phase 2 อย่าทำ** ทำแค่แชทข้อความ
9. มี **คำถามแนะนำ** (suggested questions) ต่อหมวด

**กฎ Flowchart (ยืนยัน PM แล้ว)**
- **Free:** ดูหมวดพื้นดวงเดิมได้เฉพาะ **ตัวตน + การงาน** — **ห้ามสนทนา AI** (ต้องอัปเกรด Pro)
- **Pro:** สนทนา AI ได้ทุกหมวด + โหมดดวงจร
- FE ใช้ `canChat` จาก `GET /api/me` — แสดง `UpgradeProState` และปิด composer เมื่อ Free

---

## 1. Git workflow (อ่านก่อนเริ่ม — สำคัญที่สุด)

เราใช้ **feature branch + Pull Request** ไม่ใช่ branch ถาวรต่อคน

### กติกา 6 ข้อ
1. **ห้าม push ตรงเข้า `main`** — `main` ต้องรันได้เสมอ
2. **1 งาน = 1 branch สั้นๆ** อายุ 1-3 วัน แล้ว merge กลับ
3. **ก่อนเริ่มงานทุกครั้ง** ดึงล่าสุด: `git checkout main && git pull`
4. **PR เล็กๆ** ดีกว่า PR ใหญ่ก้อนเดียว
5. **PM รีวิวแล้วค่อย merge**
6. **คุยกับ Backend ก่อนแก้ไฟล์กลาง** (ดูข้อ 4)

### ชื่อ branch: `fe/<งาน>`  เช่น `fe/signin-page`, `fe/chat-ui`

```bash
git checkout main && git pull
git checkout -b fe/signin-page
# ...เขียนโค้ด...
npm run typecheck && npm run lint
git add -A && git commit -m "feat(signin): add sign-in page"
git push -u origin fe/signin-page
# เปิด PR → รอ PM รีวิว → merge → ลบ branch
```

### conflict
```bash
git checkout main && git pull
git checkout fe/signin-page
git merge main    # ไม่แน่ใจให้ถาม PM ก่อน
```

---

## 2. Checklist ราย Milestone (สถานะจริง — ตรวจกับโค้ด ณ `main` หลัง merge PR #6/#7)

> **อ่านก่อน:** checklist นี้ตรวจกับโค้ดจริงแล้ว ไม่ใช่แผนเดิม
> `[x]` = มีในโค้ดและใช้งานได้ · `[ ]` = ยังค้างจริง (งานที่เหลือเพื่อ production)
> งานมอบรอบนี้: [`FE_ASSIGN.md`](./FE_ASSIGN.md)

### 🎯 Milestone 2 — Sign-in, Birth form, Layout, Settings ✅ ปิดแล้ว

- [x] **ตั้งธีมจริง** ใน `globals.css`: พื้นดำ + ทอง + เขียวเทอร์ควอยซ์ (แทนค่า placeholder เดิม) + วางโลโก้ HORASARD
- [x] **หน้า Sign-in** (`01`): ปุ่ม Continue with Google + ตัวคั่น "หรือ" + ช่องอีเมล + ปุ่ม "ลงชื่อเข้าใช้ด้วยอีเมล" + ข้อความนโยบายความเป็นส่วนตัว — **อีเมล+รหัสผ่าน** (ไม่ใช่ magic-link)
- [x] **App shell** (`04`): sidebar ซ้าย (ปุ่มเริ่มสนทนาใหม่ · ค้นหา · หัวข้อพื้นดวงเดิมพร้อม badge Free/🔒Pro · ส่วนดวงจร · รายการประวัติแชท) + แถบล่าง (Username · Pro/Free · เกียร์ตั้งค่า) + ปุ่มพับ sidebar
- [x] **หน้า Birth form** (`02`): dropdown วัน/เดือน/ปี(พ.ศ.·ค.ศ.)/เวลา(ชม.·นาที) + ประเทศ(default ไทย)/จังหวัด/อำเภอ + 2 checkbox (ยอมรับนโยบาย, รับทราบว่าแก้วันเกิดได้อีก 1 ครั้ง) + ปุ่ม "ทำนาย" + validation
- [x] บังคับ flow: เข้าครั้งแรก → ยังไม่มี birth profile → เด้งไปหน้า Birth form ก่อน
- [x] **Settings popover** (`03`): เปลี่ยนชื่อผู้ใช้ · เปลี่ยนรหัสผ่าน · เปลี่ยนวันเกิด (แสดงตัวนับครั้งที่ x/2, disable เมื่อครบ) · จัดการแพ็กเกจ · ออกจากระบบ · ยกเลิกการเป็นสมาชิก
- [x] responsive: sidebar ยุบได้ + มือถือใช้ bottom/drawer nav

**Acceptance M2 (ปิดแล้ว):** sign-in ได้ · กรอก/แก้วันเกิด (จำกัด 1 ครั้ง) ได้ · shell + settings ครบ · `/register` redirect ไป `/login`

### 🎯 Milestone 3 — Chat, History, Package, Admin UI 🟢 UI เสร็จ

**เสร็จแล้ว:**
- [x] **หน้าแชท** (`chat-view.tsx`): ห้องแชท user (ขวา) / AI (ซ้าย) + composer "สอบถามเราได้เลย" + ปุ่มส่ง + header `Idempotency-Key` + ปุ่มลองใหม่
- [x] **คำถามแนะนำ** ต่อหมวด (chip) — ดึงจาก API หมวด
- [x] **ประวัติแชท** ใน sidebar + หน้า `(app)/history` + `history/[id]` (เปิดอ่านย้อนหลัง)
- [x] **จัดการแพ็กเกจ / อัปเกรด Pro** (`account-view.tsx` + `payment-submit-card.tsx` — ส่งสลิป manual)
- [x] **ล็อกหมวด Pro / โหมดดวงจร** — โชว์ CTA อัปเกรด (`UpgradeProState`) ไม่ยิง AI
- [x] Admin UI ครบ: prompts/persona, ai-configs (+ ปุ่ม Test), usage logs, users, categories, packages, payments, knowledge, faq, announcements, settings, audit-logs
- [x] **F1 — QA error-state บนแชท** (`chat-view.tsx`): map ครบทุก error code · retry ใช้ `Idempotency-Key` เดิม (เฉพาะ AI timeout/provider/rate-limit/network) · `UpgradeProState` สำหรับ Free · CTA อัปเกรดใน error banner

**ค้างจริง (→ production):**
- [x] **F2 — render ประวัติเธรดเต็ม + multi-turn** — merged ใน [PR #9](https://github.com/Markrock342/astrology_ai/pull/9)
- [x] **Wave D — UI ฟอร์มดวงจร** (`TransitFormModal` + Pro gate + empty-thread load)

### 🎯 Milestone 4 — Polish

- [x] **F3 — polish**: skeleton หน้าหลัก (chat thread, history, admin loading, dashboard, payments) · admin tables responsive
- [x] **F4 — legal content**: privacy/terms/disclaimer จาก CMS · disclaimer ครบ 7 หัวข้อ + "เพื่อความบันเทิง" (รอ PM รีวิวกฎหมายก่อน go-live)

---

## 3. เทคนิค & จุดที่ต้องรู้
- แทนที่ placeholder `ScaffoldNote` ในแต่ละหน้า (ลบ component เมื่อไม่มีใครใช้)
- **Auth:** ใช้ `signIn("google")` / `signIn("credentials")` / `signOut` จาก NextAuth
- **แชท:** สร้าง `Idempotency-Key` (UUID) ต่อ 1 ข้อความ แล้วส่งเป็น header เดิมทุกครั้งที่ retry
- ต้องมีชุดข้อมูล **จังหวัด/อำเภอไทย** สำหรับ dropdown (คุยกับ Backend ว่าจะยิง API หรือฝัง JSON ที่ฝั่ง client)
- ปี **พ.ศ.**: ให้ผู้ใช้เลือก พ.ศ./ค.ศ. ได้ แต่ backend เก็บเป็น ค.ศ. (UTC) — ส่งค่าที่ตกลงกันไว้ให้ตรง
- แนะนำเพิ่ม shadcn/ui สำหรับ component พื้นฐาน

---

## 4. สัญญากับ Backend (contract)
ทุก API ตอบรูปแบบเดียวกัน:
```jsonc
{ "ok": true, "data": { /* ... */ } }
{ "ok": false, "error": { "code": "NO_QUOTA", "message": "..." } }
```
โค้ด error ที่ต้องแมปเป็น state บนแชท (backend คืนจริงครบชุดนี้):
`NO_QUOTA` · `CHAT_REQUIRES_PRO` · `CATEGORY_LOCKED` · `TRANSIT_REQUIRES_PRO` · `AI_TIMEOUT` · `AI_PROVIDER_ERROR` · `USER_DISABLED` · `RATE_LIMITED` · `VALIDATION`

**ไฟล์กลางที่ต้องคุยกับ Backend ก่อนแก้:**
`src/types/index.ts` · `src/lib/schemas.ts` · `src/config/constants.ts` · `package.json`

---

## 5. รอ PM ยืนยัน (มีผลกับ UI)
- ~~**ดวงจร (transit)**~~ → **ยืนยันแล้ว:** อยู่ Phase 1 แต่ UI ฟอร์มดวงจรยังไม่ครบ (Wave D FE)
- ~~Sign-in อีเมล~~ → **อีเมล+รหัสผ่าน** (ไม่ใช่ magic-link)
- ~~Free แชทได้ไหม~~ → **Free ห้ามแชท AI** ดูหมวดตัวตน+การงานได้อย่างเดียว
- ประวัติแชท: เก็บแยกตามหัวข้อ หรือรวมใน "ดวงจร" (ดีไซน์มี 2 ไอเดีย)
- แหล่งข้อมูลจังหวัด/อำเภอ (ชุดข้อมูลไทยเต็ม?)
- คำถามแนะนำ: ใครเป็นคนกำหนดเนื้อหา (ลูกค้า/แอดมิน)