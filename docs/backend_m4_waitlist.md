# Backend — M4 รายการรอ/ค้าง (Waitlist)

## สถานะปัจจุบัน
- ✅ โค้ด M4 BN + FE + engine + Wave D บน `main`
- ✅ B3 rate-limit + B4 deploy docs/scripts
- ⬜ Manual E2E smoke + ยืนยัน Google OAuth URI บนโดเมนจริง

## ปิดแล้ว
- [x] B3 Upstash rate-limit (+ in-memory fallback)
- [x] B4 deploy docs / migrate notes / smoke public
- [x] Merge engine + F2 + rate-limit → `main` (PR #9)
- [x] Transit conversation create + empty-thread load

## ค้างมือ / PM
| รายการ | สถานะ |
|--------|--------|
| Google OAuth redirect URI | ตรวจ `{AUTH_URL}/api/auth/callback/google` |
| Manual smoke | ยังต้องรันบน production |
| Upstash / Resend / Turnstile | Resend+Turnstile มีบน prod แล้ว · Upstash optional |
| โดเมนหลัก | ยืนยัน `horaai.vercel.app` vs `astrology-ai-three.vercel.app` |

## Next
- [ ] Manual smoke ตาม `M4_HANDOFF.md` §4
- [ ] (Optional) เพิ่ม `UPSTASH_*` แล้ว `npm run deploy:env`
