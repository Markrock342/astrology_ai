# Backend — M4 รายการรอ/ค้าง (Waitlist)

## สถานะปัจจุบัน
- ✅ โค้ด M4 BN + FE + engine + Wave D บน `main`
- ✅ **Wave E HANDOFF_BE ครบ** บน branch `be/wave-e-handoff` (รอ merge)
- ⬜ Manual E2E smoke + ยืนยัน Google OAuth URI บนโดเมนจริง

## ปิดแล้ว
- [x] B3 Upstash rate-limit (+ in-memory fallback)
- [x] B4 deploy docs / migrate notes / smoke public
- [x] Merge engine + F2 + rate-limit → `main` (PR #9)
- [x] Transit conversation create + empty-thread load
- [x] Wave E: usage API, quota atomic, top-up, notify fields, account delete

## ค้างมือ / PM
| รายการ | สถานะ |
|--------|--------|
| Merge `be/wave-e-handoff` | รอ PR |
| Seed `CREDIT_TOPUP` บน prod | หลังตั้ง `SEED_ADMIN_PASSWORD` ที่ไม่ใช่ default |
| Google OAuth redirect URI | ตรวจ `{AUTH_URL}/api/auth/callback/google` |
| Manual smoke | ยังต้องรันบน production |
| Upstash (optional) | Resend+Turnstile มีบน prod แล้ว |
| แจ้ง FE contracts | `/api/me/usage`, `QUOTA_EXCEEDED`, `creditOnly`, notify fields |

## Next
- [ ] Merge Wave E → `main`
- [ ] Manual smoke ตาม `M4_HANDOFF.md` §4
- [ ] Wave E2 ตาม `BE_ASSIGN.md` § E2 (packageId FK, cron, cost)
