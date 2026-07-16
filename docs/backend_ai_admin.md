# Backend — Admin AI CMS (M3/M4)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ CRUD prompts, AI configs, knowledge, usage, feedback, audit
- ✅ **Admin เปลี่ยน API key เองได้** — เข้ารหัส AES-256-GCM ใน DB (`encryptedApiKey` + `keyLast4`); กุญแจหลัก `AI_SECRET_ENC_KEY` ใน env ตั้งครั้งเดียวบนโฮสต์; cache 60s; env `secretReference` เป็น fallback
- ✅ `POST /api/admin/ai-configs/test-key` ทดสอบ key ก่อนบันทึก
- เปิดใช้เมื่อ `FEATURES.aiAdmin` = true

## หน้า Admin ที่ใช้จริง
| Path | ชื่อเมนู | หน้าที่ |
|------|---------|---------|
| `/admin/prompts` | บุคลิก AI | ลักษณะการพูด / safety / รูปแบบคำตอบ |
| `/admin/knowledge` | คลังความรู้ | ตำราให้ AI อ้างอิง |
| `/admin/ai-configs` | โมเดล AI | model + วาง API key + ทดสอบ |
| `/admin/theme` | โลโก้ & ธีม | โลโก้ + สี (ดู frontend doc) |
| `/admin/usage` | บันทึก AI | usage / latency / error |
| `/admin/feedback` | ฟีดแบ็กคำตอบ | thumbs + คำถามคู่กัน |

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- Migration `20260716150000_ai_config_encrypted_key`
- `src/lib/crypto/secret-box.ts`, `src/server/ai/secret-resolver.ts`
- Router/adapters ใช้ `apiKey` ที่ resolve แล้ว; audit ไม่เก็บ ciphertext
- UI: ช่อง API Key แบบ masked + ปุ่มเปลี่ยน/ทดสอบ
- Tests: `secret-box`, `secret-resolver`, `ai-config-key-secrecy`

### ตั้งกุญแจหลักบนโฮสต์ (ครั้งเดียว)
```bash
# Windows (ไม่มี openssl):  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
AI_SECRET_ENC_KEY="<ค่า 32-byte base64>"
```
ตั้งบนทุกโฮสต์ที่รันแอป — แอดมินไม่ต้องแตะหลังติดตั้ง

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: feedback 500 จาก Prisma client เก่า → `assertFeedbackClient` + `prisma generate`
- [ปัญหา]: `prisma generate` EPERM บน Windows → หยุด `npm run dev` ก่อน gen
- [ปัญหา]: ชื่อ env ผิด `AI_SECRET_KEY` → ต้องเป็น `AI_SECRET_ENC_KEY` และยาวพอ (32 bytes)

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- ไม่ตั้ง `AI_SECRET_ENC_KEY` = บันทึก key จากแอดมินไม่ได้ (ใช้ env fallback ได้)
- ยังไม่มี adapter Claude/Anthropic

## Checklist งานต่อไป (Next Steps)
- [x] Encrypted API keys + test-before-save + cache
- [ ] Smoke บน staging/prod หลัง deploy
- [ ] (Optional) Anthropic adapter เมื่อลูกค้าต้องการ
