# Backend — M4 รายการรอ/ค้าง (Waitlist)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **M4 BN + deploy ปิดแล้ว** — production https://horaai.vercel.app
- ✅ B3 rate-limit code + B4 deploy/migrate/seed/smoke public
- 🟡 Manual E2E smoke + Google OAuth redirect URI ยังค้าง

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- Push `be/m4-rate-limit` ไป origin
- `prisma migrate deploy` + `db:seed` บน Supabase prod
- Vercel deploy + sync 14 env vars + redeploy โดยไม่ bundle `.env`
- Smoke 5/5 public APIs บน production

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- ไม่มีใหม่

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)

### รอ manual / PM
| รายการ | สถานะ |
|--------|--------|
| Google OAuth redirect URI | ต้องเพิ่มใน Google Console |
| Manual smoke (sign-in → แชท) | ยังไม่รัน |
| Merge branches → `main` | 6 commits รอ merge |
| Resend / Turnstile / Upstash | optional — ยังไม่มีใน Vercel |

### รอ PM (ไม่บล็อก go-live)
| รายการ | สถานะ |
|--------|--------|
| Quota/ราคา/Pro expiry | ใช้ค่า seed default |

## Checklist งานต่อไป (Next Steps)
- [x] B3 implement Upstash rate-limit
- [x] B4 deploy + env Vercel + migrate/seed prod
- [x] smoke public APIs
- [ ] Google OAuth redirect + manual smoke
- [ ] (Optional) เพิ่ม Resend/Upstash/Turnstile แล้ว `npm run deploy:env`
