# Backend — Admin AI CMS (M3/M4)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ CRUD prompts, AI configs, knowledge, usage, feedback, audit
- ✅ **Admin วาง API key ใน UI** — เข้ารหัส AES-256-GCM ใน DB (`encryptedApiKey` + `keyLast4`); กุญแจหลัก `AI_SECRET_ENC_KEY` บนโฮสต์; cache 60s
- ✅ สร้างโมเดลใหม่ต้องวาง API key (ฟอร์มว่าง — ไม่ prefill env / preset)
- ✅ Legacy env fallback (`secretReference`) เหลือเฉพาะ whitelist: `GEMINI_API_KEY` | `OPENAI_API_KEY` และเฉพาะแถวเก่า/rollback
- ✅ OpenAI-compatible + Base URL (HTTPS สาธารณะเท่านั้น; Gemini ไม่รับ baseUrl)
- ✅ Health/test ตรวจ **primary เท่านั้น** (ไม่ผ่านด้วย fallback)
- ✅ Routing: category + planScope + tie-break deterministic; ผูกโมเดลต่อหมวดที่ฟอร์ม AI Config → หมวด
- เปิดใช้เมื่อ `FEATURES.aiAdmin` = true
- **คู่มือใช้งานละเอียด (เพื่อน/AI อ่านได้):** [`SETTINGS_MODEL_AI.md`](../SETTINGS_MODEL_AI.md)

## หน้า Admin ที่ใช้จริง
| Path | ชื่อเมนู | หน้าที่ |
|------|---------|---------|
| `/admin/prompts` | บุคลิก AI | ลักษณะการพูด / safety / รูปแบบคำตอบ |
| `/admin/knowledge` | คลังความรู้ | ตำราให้ AI อ้างอิง |
| `/admin/ai-configs` | โมเดล AI | model + วาง API key + ทดสอบ + Base URL |
| `/admin/theme` | โลโก้ & ธีม | โลโก้ + สี (ดู frontend doc) |
| `/admin/usage` | บันทึก AI | usage / latency / error |
| `/admin/feedback` | ฟีดแบ็กคำตอบ | thumbs + คำถามคู่กัน |

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- Create ต้องมี `apiKey`; ฟอร์มส่ง `planScope`; highlight แถวที่เพิ่งสร้าง
- Migrate seed configs → encrypted key + ซ่อม FREE/PRO/ALL (`scripts/migrate-ai-config-keys.ts`)
- `generateOnce` สำหรับ health/test; chat ยังใช้ `generateWithFallback`
- ลบ dead `HoroscopeCategory.aiConfigId` (migration `20260717020000_drop_category_ai_config_id`)
- Base URL guard + secretReference whitelist (`src/lib/ai-config-guards.ts`)
- Tests: `tests/ai-config-guards.test.ts`, อัปเดต `router-fallback`, `ai-provider-models`
- คู่มือราก [`SETTINGS_MODEL_AI.md`](../SETTINGS_MODEL_AI.md) — UI ทุกปุ่ม/ช่อง + ที่มา `AI_SECRET_ENC_KEY` + troubleshooting quota/TIMEOUT

### ตั้งกุญแจหลักบนโฮสต์ (ครั้งเดียว)
```bash
# Windows (ไม่มี openssl):  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
AI_SECRET_ENC_KEY="<ค่า 32-byte base64>"
```
ตั้งบนทุกโฮสต์ที่รันแอป — แอดมินไม่ต้องแตะหลังติดตั้ง

### Key resolution
1. `encryptedApiKey` ใน DB → decrypt ด้วย `AI_SECRET_ENC_KEY` (ถ้า decrypt พัง **ไม่** fallback ไป env)
2. ถ้าไม่มี encrypted key → `secretReference` ที่อยู่ใน whitelist เท่านั้น → `process.env[name]`
3. Base URL: admin-trusted HTTPS สาธารณะเท่านั้น (ไม่มี allowlist host เพิ่ม — จำกัดสิทธิ์ admin)

### ผูกโมเดลกับหมวด/แพลน
- ตั้งที่ `/admin/ai-configs` ช่อง «ใช้กับหมวด» / «ใช้กับแพลน» (`AIProviderConfig.categoryId` + `planScope`)
- **ไม่** มีตัวเลือกโมเดลในหน้า Categories อีกแล้ว (เคยเป็น dead knob)

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: feedback 500 จาก Prisma client เก่า → `assertFeedbackClient` + `prisma generate`
- [ปัญหา]: `prisma generate` EPERM บน Windows → หยุด `npm run dev` ก่อน gen
- [ปัญหา]: ชื่อ env ผิด `AI_SECRET_KEY` → ต้องเป็น `AI_SECRET_ENC_KEY` และยาวพอ (32 bytes)
- [ปัญหา]: ฟอร์มไม่ส่ง `planScope` → Free/Pro ใน DB เป็น ALL ทั้งหมด → แก้แล้ว
- [ปัญหา]: health เขียวเพราะ fallback → ใช้ `generateOnce` แล้ว
- [ปัญหา]: ฟอร์มโชว์ `GEMINI_API_KEY` ทั้งที่ตั้งใจใช้ DB key → ไม่ prefill แล้ว; migrate seed เป็น encrypted

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- ไม่ตั้ง `AI_SECRET_ENC_KEY` = บันทึก key จากแอดมินไม่ได้
- ยังไม่มี adapter Claude/Anthropic
- OpenAI-compatible ยังไม่ stream แบบ token-by-token (ตอบเป็นก้อนเดียวใน stream mode)
- Estimated cost ของโมเดล OpenAI ยังใช้ pricing placeholder ถ้ายังไม่อยู่ใน `ai-pricing.ts`
- Billing banner ในแอดมินยังโฟกัส Gemini เป็นหลัก

## Checklist งานต่อไป (Next Steps)
- [x] Encrypted API keys + test-before-save + cache
- [x] Repair create/edit + migrate legacy env refs + primary-only health
- [ ] Smoke บน staging/prod หลัง deploy
- [ ] (Optional) Anthropic adapter เมื่อลูกค้าต้องการ
