# Backend — M4 รายการรอ/ค้าง (Waitlist)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **B3 rate-limit code พร้อม** — Upstash Redis เมื่อมี env, fallback in-memory เมื่อไม่มี
- ✅ Payment tests + deploy checklist + smoke script
- ⏳ **B4 ค้างการตั้งค่า** — env Vercel, domain, Resend (ทำแยกรอบ)

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `src/lib/rate-limit.ts` — Upstash sliding window + in-memory fallback
- `await rateLimit()` บน auth, readings, chat messages routes
- `tests/rate-limit.test.ts`
- PM decision บันทึก: Upstash (ก) · `NEXT_PUBLIC_APP_PHASE=3`

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- ไม่มี

## สิ่งที่ยังค้างอยู่และปัหาที่ทราบ (Pending & Known Issues)

### รอรอบตั้งค่า .env / Vercel (แยกจากโค้ด)

| รายการ | หมายเหตุ |
|--------|----------|
| `UPSTASH_REDIS_REST_URL` + `_TOKEN` | สร้างที่ upstash.com แล้วใส่ Vercel |
| `NEXT_PUBLIC_APP_PHASE=3` | ตั้งบน Vercel ตอน deploy |
| `AUTH_URL` / `APP_BASE_URL` | ใช้ `*.vercel.app` ก่อน จนกว่าจะมี domain |
| `RESEND_API_KEY` + `EMAIL_FROM` | อีเมลจริง |
| migrate + seed prod | `DIRECT_URL` มีใน local แล้ว |
| Manual smoke test | หลัง deploy |

### รอ PM (ไม่บล็อกโค้ดแล้ว)

| รายการ | สถานะ |
|--------|--------|
| Quota/ราคา/Pro expiry | ยังใช้ค่า seed default |

## Checklist งานต่อไป (Next Steps)
- [x] B3 implement Upstash rate-limit
- [ ] รอบตั้งค่า: copy env ไป Vercel ([backend_m4_deploy.md](./backend_m4_deploy.md))
- [ ] smoke test หลัง deploy
