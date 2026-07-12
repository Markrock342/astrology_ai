# 🟦 Frontend — สถานะปิด M4 (อัปเดต 12 ก.ค. 2026)

**สถานะ:** F1–F4 + Wave D + UX ChatGPT-style ครบบน `main`

อ่านคู่กับ `M4_HANDOFF.md` · `FRONTEND_TASKS.md`

## ปิดแล้ว
- [x] F1 error-state + Idempotency-Key retry
- [x] F2 ประวัติเธรด + multi-turn
- [x] F3 polish (skeleton, nav progress, theme toggle)
- [x] F4 legal จาก CMS
- [x] Landing CTAs แยก register / login
- [x] โปรไฟล์ → ตั้งค่า · อาทิตย์/จันทร์ → ธีม
- [x] **Wave D:** ฟอร์มดวงจร (`TransitFormModal`) + Pro gate

## ค้างมือ
- [ ] Smoke มือ: Pro แชท + ดวงจร + ประวัติหลัง refresh

---

# 🚀 Wave E — Production Hardening (Frontend)

ที่มา: production-readiness audit (12 ก.ค. 2026) · UX ลูกค้าจ่ายเงิน 5/10 · จุดใหญ่: user มองไม่เห็น usage (คำอ้าง "เทียบเท่า ChatGPT" ยังไม่จริงตรงนี้) + สถานะรออนุมัติจางเกินไป
อ่านคู่กับ `BE_ASSIGN.md` Wave E — งานที่มี 🔗 ต้องรอ/คุย contract กับ BE ก่อน
**กติกา:** ยึด error จาก server เป็นหลัก (`message ?? ERROR_MESSAGES[code]`) · commit ทีละ ID · เทสมือบนจอมือถือด้วย (ลูกค้าส่วนใหญ่ iPhone)

## 🔴 E0 — ต้องเสร็จก่อนเปิดรับเงินจริง (เริ่มได้เลย ไม่รอ BE)

### FE-E0.1 · [P1] แก้ ETA เพี้ยน "รอแอดมินตรวจสอบ (ภายใน 199–2 วันทำการ)"
- [x] `replaceAll("{price}", …)` + CMS steps ใช้ `{price}`
- [x] ETA "ปกติภายใน 1–2 วันทำการ" บนการ์ด PENDING · **S** ✅

### FE-E0.2 · [P2→สำคัญ] Banner "รออนุมัติ" ให้เด่นบน app shell
`account-view.tsx:112` — pending อยู่แค่ /account ผ่าน popover → ลูกค้าจ่ายแล้วไม่เห็นอะไร = เปิด ticket
- [ ] 🔗 BE ใส่ `pendingPayment` ใน bootstrap payload (`bootstrap-service.ts`) — คุยก่อน
- [ ] banner ถาวรใน `app-shell.tsx:44`: "รอแอดมินตรวจสอบการชำระเงิน ฿199 · ปกติภายใน 1–2 วันทำการ" ลิงก์ /account
- [ ] special-case `CHAT_REQUIRES_PRO` ใน chat-view ให้พูด "สลิปอยู่ระหว่างตรวจสอบ" · **M**

### FE-E0.3 · [P2] INTERNAL retryable (ตัดเครดิตแต่ข้อความไม่ขึ้น)
- [x] เพิ่ม `"INTERNAL"` เข้า `RETRYABLE_ERRORS` + prefer server message · **S** ✅

### FE-E0.4 · [P1] 🚨 `npm run lint` แดงอยู่ — 8 errors, 4 warnings
- [x] theme-provider / nav-progress / admin lint fixed
- **เสร็จเมื่อ:** `npm run lint` exit 0 · **S** ✅

## 🟠 E1 — สัปดาห์แรก

### FE-E1.1 · [P1] ⭐ หน้า usage ให้ user (หัวใจ "เทียบเท่า ChatGPT")
ตอนนี้เห็นแค่ยอดเครดิตเปล่า ไม่มี history / "ใช้ไป x/y" / ไม่เห็น balance ตอนแชท
- [ ] 🔗 รอ `GET /api/me/usage` (BE-E1.3) — คุย field
- [ ] `account-view.tsx:18`: ขยาย `MyPackage` พก limit+used → "ใช้ไปแล้ว 18/20 ครั้งวันนี้" + progress bar
- [ ] แสดง balance บน chat header · (option) ราคาต่อคำถามก่อนกดส่ง · usage history list · **M**

### FE-E1.2 · [P2] การ์ด REJECTED + ปุ่มส่งใหม่ (ตอนนี้เห็นแค่ "ปฏิเสธ")
`payment-submit-card.tsx:219` — เหตุผล fetch มาแล้วทิ้ง
- [ ] 🔗 BE-E2.3 (`reviewNote`) — render "เหตุผลจากแอดมิน: …" + thumbnail + ปุ่ม "ส่งสลิปใหม่" + ติดต่อ
- [ ] ยืนยันหลัง REJECTED ส่งใหม่ได้ทันที · **S**

### FE-E1.3 · [P1] 🔗 ฟอร์มซื้อเครดิตเพิ่มสำหรับ Pro (ปิดทางตันซื้อซ้ำ)
- [ ] 🔗 BE-E1.4 (top-up product) — ฟอร์ม top-up ให้ Pro active เครดิตใกล้หมด, reuse payment-submit flow · **M**

### FE-E1.4 · [P2] แยกข้อความโควต้าหมด จาก "ถามเร็วไป"
`chat-view.tsx:59` — โควต้าหมดโชว์ Retry ที่กดไม่ผ่าน
- [ ] 🔗 BE-E1.5 (`QUOTA_EXCEEDED`) — เอาออกจาก `RETRYABLE_ERRORS`, ใส่ `UPGRADE_ERRORS`
- [ ] `applyApiError` (`chat-view.tsx:112`) ใช้ server message ก่อน: `message ?? ERROR_MESSAGES[code]` · **S**

## 🟡 E2 — เดือนแรก (Admin CMS ฝั่ง FE)

### FE-E2.1 · [P2] Cost + spend-by-model ใน usage panel
- [ ] 🔗 BE-E2.4 — cost column + spend-by-model rollup ใน `usage-panel.tsx` + fallback-rate tile · **S**

### FE-E2.2 · [P2] AI config manager — badge สถานะจริง
- [ ] 🔗 BE-E2.7: badge "กำลังใช้งานจริง" บน config ที่ resolve จริง
- [ ] ปุ่มทดสอบโชว์ red/amber เมื่อ fallback (`ai-configs-manager.tsx:669` ตอนนี้ green หลอก)
- [ ] block save ถ้ายังไม่ผ่าน test (คู่ BE-E2.6) · **S**

### FE-E2.3 · [P2] Payments panel — เลือก package + เตือน amount ไม่ตรง
`payments-panel.tsx:87` hardcode "PRO"
- [ ] 🔗 BE-E2.1: admin เลือก package ตอนอนุมัติ + เตือนแดงเมื่อ `amount!==pkg.price` + แสดงราคา package ข้างสลิป
- [ ] แสดงสลิปผ่าน authenticated route (BE-E0.6) — ซูมบนมือถือได้ · **M**

### FE-E2.4 · [P2] Admin เห็น badge "แจ้งเตือนส่งไม่สำเร็จ"
- [ ] 🔗 BE-E0.3: โชว์ `notifyError` บน payment row · **S**

### FE-E2.5 · [P2] Dead knob "โมเดล AI ของหมวดนี้"
`categories-manager.tsx:317` — save แต่ runtime ไม่อ่าน
- [ ] ตัดสินใจกับ BE: honor override → คงไว้ · ไม่ → ลบ Field (317-333) · **S**

### FE-E2.6 · [P2] Ghost empty threads หายจาก sidebar
`chat-view.tsx:290` — send ที่ fail/block ทิ้ง thread ว่างค้าง
- [ ] 🔗 BE-E2.8: conversation สร้าง lazy ตอนสำเร็จ / รอ BE filter · **S**

### FE-E2.7 · [P2] หน้า marketing เป็น `force-dynamic` ทั้งหมด — ยิง Postgres ทุก request
`src/app/(public)/{page,pricing,privacy,terms,disclaimer,help,contact}.tsx` ตั้ง `export const dynamic = "force-dynamic"` ทุกไฟล์ → คนไม่ได้ล็อกอินเปิดหน้าแรกก็ยิง DB ทุกครั้ง แถมยัง**ยังเห็นของเก่าอยู่ 45-60 วิ** หลัง admin publish (เพราะ cache เป็น time-based ไม่มี tag) = แย่ทั้งสองทาง
- [ ] เอา `force-dynamic` ออก → ใช้ static/ISR
- [ ] 🔗 BE-E2.12: BE เปลี่ยนเป็น tag-based cache + `revalidateTag()` ตอน publish → publish แล้วขึ้นทันที · **M**

### FE-E2.8 · [P3] Disclaimer "เพื่อความบันเทิง" ไม่อยู่ตรงจุดที่ส่งคำทำนาย
ตอนนี้อยู่แค่ footer `/disclaimer` + CMS defaults · หน้าแชทโชว์แค่บรรทัด AI generic (`chat-view.tsx:769` "อาจให้ข้อมูลที่ไม่ถูกต้อง… โปรดใช้วิจารณญาณ")
- [ ] เพิ่ม disclaimer เพื่อความบันเทิงตรงจุดที่ผลคำทำนายถูกส่ง (ประเด็นความเสี่ยงเชิงกฎหมายสำหรับธุรกิจดูดวง) · **S**

## ⚪ E3 — ทีหลังได้
- [ ] Streaming render (FE ครึ่ง): render ทีละ token จาก ReadableStream แทน spinner 10-30s 🔗 BE · **L** — ช่องว่างใหญ่สุดเทียบ ChatGPT
- [ ] Web Push ฝั่ง user: แจ้งเมื่อสลิปอนุมัติ หน้าอัปเดตเองไม่ต้อง refresh · **M**
- [ ] Focus trap mobile drawer + a11y (aria, contrast) · **S**

## 📋 Cross-team contract (2 คนคุยก่อนเริ่ม E1)
| Contract | BE | FE |
|---|---|---|
| `GET /api/me/usage` | BE-E1.3 | FE-E1.1 |
| `pendingPayment` ใน bootstrap | BE-E0.3/shell | FE-E0.2 |
| code `QUOTA_EXCEEDED` | BE-E1.5 | FE-E1.4 |
| top-up product (code/ราคา) | BE-E1.4 | FE-E1.3 |
| `reviewNote` column | BE-E2.3 | FE-E1.2 |
| `estimatedCost`+price fields | BE-E2.4 | FE-E2.1 |
| `Payment.packageId`+เลือก package | BE-E2.1 | FE-E2.3 |
| authenticated slip route | BE-E0.6 | FE-E2.3 |

**ลำดับ:** FE เริ่ม E0 (FE-E0.1/E0.3) ทันทีไม่รอใคร · BE ลุย E0 ทั้งหมด (blocker เปิดจริง) · พอ BE-E1.3 เสร็จ FE จับ FE-E1.1
