# 🟩 Handoff — Backend (เพื่อน A)

**Repo:** https://github.com/Markrock342/astrology_ai  
**Branch:** `main`  
**Production:** https://astrology-ai-three.vercel.app  
**รายละเอียดเต็ม:** [BE_ASSIGN.md](https://github.com/Markrock342/astrology_ai/blob/main/BE_ASSIGN.md) · คู่ FE: [HANDOFF_FE.md](https://github.com/Markrock342/astrology_ai/blob/main/HANDOFF_FE.md)

**กติกา:** commit ทีละ ID (`BE-E1.2` …) · schema ใช้ `npm run db:migrate` (อย่า `db push` บน main) · เขียน test คู่ทุกงาน P1 · **อย่าแก้ UI** — ส่ง contract ให้ FE ก่อนลงมือ API ที่ FE รอ

---

## สถานะตอนรับงาน

E0 โค้ดหลักเสร็จแล้ว (private slip, reject blob cleanup, CAS approve, chart pin).  
Ops (Resend / Upstash) ทำโดย PM — ไม่ใช่งานคุณ

---

## งานของคุณ (ลำดับทำ)

### 1) BE-E0.3 · [P1] persist `notifiedAt` / `notifyError` บน Payment · **S**

ตอน notify ล้มเหลวต้องบันทึกได้ เพื่อให้ admin เห็น badge

| ไฟล์ | ลิงก์ |
|------|--------|
| Payment review + notify | https://github.com/Markrock342/astrology_ai/blob/main/src/server/payment/payment-service.ts |
| Email notify | https://github.com/Markrock342/astrology_ai/blob/main/src/server/payment/payment-notify.ts |
| Prisma schema | https://github.com/Markrock342/astrology_ai/blob/main/prisma/schema.prisma |
| Mailer | https://github.com/Markrock342/astrology_ai/blob/main/src/server/email/mailer.ts |

- [ ] เพิ่ม field บน `Payment` + migrate
- [ ] เซ็ตตอน `notifyUserPaymentReviewed` สำเร็จ/ล้มเหลว
- [ ] ส่ง field ใน admin payments list API (FE-E2.4 จะโชว์ badge)

---

### 2) BE-E1.2 · [P1] Quota atomic · **M**

ตอนนี้ pre-check นอก transaction → ยิงพร้อมกันทะลุ cap

| ไฟล์ | ลิงก์ |
|------|--------|
| Quota | https://github.com/Markrock342/astrology_ai/blob/main/src/server/credit/quota-service.ts |
| Charge tx | https://github.com/Markrock342/astrology_ai/blob/main/src/server/horoscope/reading-service.ts |
| Deduct credits | https://github.com/Markrock342/astrology_ai/blob/main/src/server/credit/credit-service.ts |
| Tests | https://github.com/Markrock342/astrology_ai/tree/main/tests |

- [ ] re-run count **ใน** `$transaction` ก่อน `deductCredits`
- [ ] `FOR UPDATE` บน `credit_wallets` ต้น tx
- [ ] test: N concurrent, `dailyLimit=1` → SUCCESS แค่ 1

---

### 3) BE-E1.3 · [P1] `GET /api/me/usage` · **M** 🔗 คู่ FE-E1.1

**คุย field กับ FE 15 นาทีก่อนลงมือ**

ตัวอย่าง contract ที่เสนอ:

```json
{
  "balance": 12,
  "dailyLimit": 20,
  "monthlyLimit": null,
  "usedToday": 3,
  "usedThisMonth": 41,
  "history": { "items": [], "nextCursor": null }
}
```

| ไฟล์ | ลิงก์ |
|------|--------|
| Pattern API `/api/me/*` | https://github.com/Markrock342/astrology_ai/tree/main/src/app/api/me |
| Credits API (อ้างอิง) | https://github.com/Markrock342/astrology_ai/blob/main/src/app/api/me/credits/route.ts |
| Quota helpers | https://github.com/Markrock342/astrology_ai/blob/main/src/server/credit/quota-service.ts |
| Account service (limit ถูกทิ้ง) | https://github.com/Markrock342/astrology_ai/blob/main/src/server/account/account-service.ts |

- [ ] สร้าง `src/app/api/me/usage/route.ts`
- [ ] reuse `bangkokBoundaries` + count จาก quota-service
- [ ] (optional) paginated history จาก CreditTransaction / readings

---

### 4) BE-E1.5 · [P2] แยก `QUOTA_EXCEEDED` · **S** 🔗 คู่ FE-E1.4

| ไฟล์ | ลิงก์ |
|------|--------|
| Quota throw | https://github.com/Markrock342/astrology_ai/blob/main/src/server/credit/quota-service.ts |
| Rate limit (เก็บ `RATE_LIMITED` ไว้ที่นี่) | https://github.com/Markrock342/astrology_ai/blob/main/src/server/security/rate-limit.ts |

- [ ] โควต้าหมด → `QUOTA_EXCEEDED` (ไม่ใช่ `RATE_LIMITED`)
- [ ] บอก FE ว่า error code ใหม่พร้อมใช้

---

### 5) BE-E1.4 · [P1] Credit top-up product · **M** 🔗 คู่ FE-E1.3

Pro เครดิตหมดซื้อซ้ำไม่ได้ — ต้องมี product เติมเครดิตอย่างเดียว

| ไฟล์ | ลิงก์ |
|------|--------|
| Review / grant | https://github.com/Markrock342/astrology_ai/blob/main/src/server/payment/payment-service.ts |
| Packages | https://github.com/Markrock342/astrology_ai/blob/main/prisma/schema.prisma |
| Admin review API | https://github.com/Markrock342/astrology_ai/tree/main/src/app/api/admin/payments |

- [ ] product / flag “credit-only top-up”
- [ ] `reviewPayment` แยก branch: top-up vs package (ไม่แตะ subscription)
- [ ] ส่ง API/contract ให้ FE ทำฟอร์ม

---

### 6) (ถ้าเร็ว) BE-E1.6 · [P1] ลบบัญชี PDPA · **M**

| ไฟล์ | ลิงก์ |
|------|--------|
| Admin user GET อย่างเดียว | https://github.com/Markrock342/astrology_ai/tree/main/src/app/api/admin/users |
| Slip delete helper | https://github.com/Markrock342/astrology_ai/blob/main/src/server/payment/payment-proof.ts |
| Privacy copy | https://github.com/Markrock342/astrology_ai/blob/main/src/server/cms/cms-keys.ts |

- [ ] `DELETE /api/me/account`
- [ ] `DELETE /api/admin/users/[id]` + `requireSuperAdmin` + audit
- [ ] ลบ slip blobs ที่เกี่ยวข้อง

---

## อย่าทำตอนนี้ (Wave E2 — sprint ถัดไป)

`packageId` FK, cost tracking, streaming, cron, receipt, marketing cache — ดู [BE_ASSIGN.md § E2](https://github.com/Markrock342/astrology_ai/blob/main/BE_ASSIGN.md)

---

## Sync กับ FE

| คุณส่ง | FE รอ |
|--------|--------|
| `GET /api/me/usage` | FE-E1.1 |
| `QUOTA_EXCEEDED` | FE-E1.4 |
| top-up product + review branch | FE-E1.3 |
| `notifiedAt` / `notifyError` | FE-E2.4 |

**เจ้าของ schema `Payment` / `Package` = คุณ** — FE ไม่แก้ Prisma

---

## คำสั่งที่ใช้บ่อย

```bash
npm run typecheck
npm test
npm run lint
npm run db:migrate
```
