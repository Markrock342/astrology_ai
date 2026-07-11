# Backend — M4 รายการรอ/ค้าง (Waitlist)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ Code payment/dashboard/deploy path พร้อมบน main
- ⏸️ B3 rate-limit — **รอ PM ตัดสินใจก่อนเขียนโค้ด**
- 🟡 B4 go-live — เตรียมเอกสาร + smoke script แล้ว รอตั้งค่าจริง

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- [backend_m4_deploy.md](./backend_m4_deploy.md) — checklist B4 ครบ
- `scripts/smoke-public-api.mjs` — ตรวจ public endpoints
- `tests/payment-service.test.ts`

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- ไม่มี

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)

### รอ PM (บล็อก — อย่าเริ่มจนกว่าจะเคาะ)

| รายการ | ตัวเลือก | ผลต่องาน |
|--------|----------|----------|
| **B3 Rate-limit production** | (ก) Upstash Redis · (ข) คง in-memory · (ค) เลื่อน | ถ้า (ก) → เพิ่ม `@upstash/ratelimit` + env · ถ้า (ข) → ปิด B3 ไม่มีงานโค้ด |
| **NEXT_PUBLIC_APP_PHASE** ตอน deploy | unset / 2 / 3 | กำหนดฟีเจอร์ที่ลูกค้าเห็นบน prod |
| **Quota/ราคา/Pro expiry** | Free 3 / Pro 100 / 199฿ | ค่า seed + payment approve logic |

### รอ credentials / การดำเนินการ (BN ทำได้หลังได้ค่าจริง)

| รายการ | หมายเหตุ |
|--------|----------|
| ตั้ง env ทั้งหมดบน Vercel | ดู [backend_m4_deploy.md](./backend_m4_deploy.md) |
| migrate + seed Supabase prod | ต้องมี `DIRECT_URL` |
| Google OAuth redirect URI prod | ต้องตรง `AUTH_URL` |
| Resend domain verify | สำหรับ `EMAIL_FROM` |
| Manual smoke test เต็ม flow | หลัง deploy |

## Checklist งานต่อไป (Next Steps)
- [ ] PM → ตัดสินใจ B3 rate-limit
- [ ] PM → ยืนยัน `NEXT_PUBLIC_APP_PHASE` + quota/ราคา
- [ ] BN → ตั้ง env + migrate prod + smoke ([deploy checklist](./backend_m4_deploy.md))
