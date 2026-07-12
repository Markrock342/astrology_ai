# 🟦 Handoff — Frontend (เพื่อน B)

**Repo:** https://github.com/Markrock342/astrology_ai  
**Branch:** `main`  
**Production:** https://astrology-ai-three.vercel.app  
**รายละเอียดเต็ม:** [FE_ASSIGN.md](https://github.com/Markrock342/astrology_ai/blob/main/FE_ASSIGN.md) · คู่ BE: [HANDOFF_BE.md](https://github.com/Markrock342/astrology_ai/blob/main/HANDOFF_BE.md)

**กติกา:** commit ทีละ ID (`FE-E1.1` …) · ยึด error จาก server (`message ?? ERROR_MESSAGES[code]`) · เทสมือบนมือถือ · **อย่าแก้ Prisma / payment-service** — รอ API จาก BE แล้วต่อ UI

---

## สถานะตอนรับงาน

E0 FE หลักเสร็จแล้ว (ETA, pending banner, INTERNAL retry, lint).  
ยังไม่มีหน้า usage จริง — นี่คือหัวใจ sprint นี้

---

## งานของคุณ (ลำดับทำ)

### 0) Smoke มือบน production · **S** (เริ่มได้เลย)

https://astrology-ai-three.vercel.app

- [ ] Register / login
- [ ] Pro แชท + ดวงจร (transit)
- [ ] ประวัติเธรดหลัง refresh
- [ ] ส่งสลิป → เห็น banner “รออนุมัติ” บน app shell
- [ ] จดบั๊กสั้น ๆ กลับ PM

---

### 1) FE-E1.1 · [P1] หน้า usage ให้ user · **M** 🔗 รอ BE-E1.3

**คุย contract กับ BE ก่อน** — แล้ว mock UI ได้เลยระหว่างรอ API

| ไฟล์ | ลิงก์ |
|------|--------|
| Account UI | https://github.com/Markrock342/astrology_ai/blob/main/src/components/account/account-view.tsx |
| Chat header / errors | https://github.com/Markrock342/astrology_ai/blob/main/src/components/app/chat-view.tsx |
| App bootstrap data | https://github.com/Markrock342/astrology_ai/blob/main/src/components/app/app-data-provider.tsx |
| Credits API (อ้างอิง pattern) | https://github.com/Markrock342/astrology_ai/blob/main/src/app/api/me/credits/route.ts |
| Pending banner (pattern) | https://github.com/Markrock342/astrology_ai/blob/main/src/components/app/pending-payment-banner.tsx |

- [ ] ขยาย `MyPackage` → โชว์ `ใช้ไปแล้ว x/y วันนี้` + progress bar
- [ ] balance บน chat header
- [ ] (option) ราคาต่อคำถามก่อนส่ง + usage history list
- [ ] ต่อ `GET /api/me/usage` เมื่อ BE พร้อม

---

### 2) FE-E1.4 · [P2] แยกโควต้าหมดจาก “ถามเร็วไป” · **S** 🔗 รอ BE-E1.5

| ไฟล์ | ลิงก์ |
|------|--------|
| Error map | https://github.com/Markrock342/astrology_ai/blob/main/src/components/app/chat-view.tsx |

- [ ] เมื่อมี `QUOTA_EXCEEDED` — เอาออกจาก `RETRYABLE_ERRORS` ใส่กลุ่มอัปเกรด/รอวันใหม่
- [ ] `applyApiError` ใช้ `message ?? ERROR_MESSAGES[code]`
- [ ] อย่าโชว์ปุ่ม Retry ที่กดแล้วไม่ผ่าน

---

### 3) FE-E1.2 · [P2] การ์ด REJECTED + ส่งใหม่ · **S**

| ไฟล์ | ลิงก์ |
|------|--------|
| Payment submit | https://github.com/Markrock342/astrology_ai/blob/main/src/components/account/payment-submit-card.tsx |
| Private slip stream | https://github.com/Markrock342/astrology_ai/blob/main/src/app/api/payments/proof/%5Bid%5D/route.ts |
| Proof helper | https://github.com/Markrock342/astrology_ai/blob/main/src/server/payment/payment-proof.ts |

- [ ] โชว์เหตุผลแอดมิน (ถ้า BE มี `reviewNote` / note) + thumbnail
- [ ] ปุ่ม “ส่งสลิปใหม่” + ลิงก์ติดต่อ
- [ ] ยืนยันหลัง REJECTED ส่งใหม่ได้ทันที (ไม่ติด pending เก่า)

---

### 4) FE-E1.3 · [P1] ฟอร์ม top-up สำหรับ Pro · **M** 🔗 รอ BE-E1.4

| ไฟล์ | ลิงก์ |
|------|--------|
| Submit flow เดิม | https://github.com/Markrock342/astrology_ai/blob/main/src/components/account/payment-submit-card.tsx |
| Account page | https://github.com/Markrock342/astrology_ai/blob/main/src/app/(app)/account/page.tsx |

- [ ] ฟอร์มเติมเครดิตเมื่อ Pro active + เครดิตใกล้หมด
- [ ] reuse payment-submit flow (upload slip → pending banner)

---

### 5) (ถ้าเร็ว) polish ที่ไม่รอ BE

| งาน | ลิงก์ |
|------|--------|
| FE-E2.3 ซูมสลิป admin ผ่าน auth route | https://github.com/Markrock342/astrology_ai/blob/main/src/components/admin/payments-panel.tsx |
| FE-E2.8 disclaimer ตรงจุดคำทำนาย | https://github.com/Markrock342/astrology_ai/blob/main/src/components/app/chat-view.tsx |
| Marketing `force-dynamic` (คู่ BE cache) | https://github.com/Markrock342/astrology_ai/tree/main/src/app/(public) |

---

## สิ่งที่ BE ทำแล้ว — ใช้ได้เลย

| ของ | ลิงก์ |
|------|--------|
| Banner รออนุมัติ | https://github.com/Markrock342/astrology_ai/blob/main/src/components/app/pending-payment-banner.tsx |
| Bootstrap `pendingPayment` | https://github.com/Markrock342/astrology_ai/blob/main/src/server/app/bootstrap-service.ts |
| Private slip upload | https://github.com/Markrock342/astrology_ai/blob/main/src/app/api/payments/proof/route.ts |
| Stream slip (owner/admin) | https://github.com/Markrock342/astrology_ai/blob/main/src/app/api/payments/proof/%5Bid%5D/route.ts |

สลิปต้องแสดงผ่าน `/api/payments/proof/[id]` — **ห้ามใช้ public blob URL ตรง ๆ**

---

## Sync กับ BE

| คุณรอ | จาก BE |
|--------|--------|
| `GET /api/me/usage` | BE-E1.3 |
| `QUOTA_EXCEEDED` | BE-E1.5 |
| top-up product | BE-E1.4 |
| `reviewNote` (optional) | BE-E2.3 |

ระหว่างรอ: mock UI + smoke ได้ทันที

---

## คำสั่งที่ใช้บ่อย

```bash
npm run dev
npm run typecheck
npm run lint
```
