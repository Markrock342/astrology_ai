# Production ops checklist (HoraSard)

ตั้ง env **บน Vercel production** แยกจาก local/staging — อย่า copy `.env` ทั้งไฟล์ไป prod

## ก่อนเปิดรับเงิน self-serve

| # | รายการ | Env / action | ตรวจยังไง |
|---|--------|--------------|-----------|
| 1 | หมุนรหัส admin | เปลี่ยนรหัสหลังเคยหลุดใน repo | login `/admin` ด้วยรหัสใหม่ |
| 2 | Upstash Redis | `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | `/admin` → ops health = `upstash` (ไม่มี Upstash แล้ว auth จะ fail-closed) |
| 3 | Resend | `RESEND_API_KEY` + `EMAIL_FROM` (โดเมนที่ยืนยันแล้ว ไม่ใช่ sandbox) | สมัคร/ลืมรหัส → ได้อีเมลจริง |
| 4 | Blob สลิป | `BLOB_READ_WRITE_TOKEN` | อัปโหลดสลิปบน `/account` สำเร็จ |
| 5 | AI key encryption | `AI_SECRET_ENC_KEY` (อยู่นอก sync allowlist) | บันทึก API key ใน `/admin/ai-configs` ได้ |
| 6 | Cron | `CRON_SECRET` + Vercel Cron เปิด | `GET /api/cron/slip-retention` ด้วย Bearer ผ่าน |
| 7 | Admin 2FA | enroll TOTP หลัง login | เข้า `/admin` ต้องใส่รหัสแอป |

## Smoke path

1. Register → verify email  
2. กรอกวันเกิด → ถาม Free  
3. ส่งสลิป → admin อนุมัติ Pro  
4. Chat หมวด Pro + ดวงจร  
5. ดูวันหมดอายุบน `/account` → ต่ออายุ  
6. ลบบัญชีทดสอบ (บัญชีทดลอง) จาก `/account`

## Staging vs production

- คนละ `DATABASE_URL`, `AUTH_SECRET`, AI keys, Resend, Blob, Upstash  
- Seed admin ใช้แค่ staging/local — ห้ามรหัสอ่อนบน prod  
