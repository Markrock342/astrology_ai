# Backend — Admin AI CMS (M3/M4)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **ครบบน main** — CRUD prompts (บุคลิก/system/format), AI configs, knowledge + test endpoint + ai-usage + draft/publish/revisions
- ✅ **Knowledge + persona inject หลัง multi-turn** — `reading-service` โหลด knowledge ที่ `enabled` แล้วส่งเข้า `buildSystemPrompt` ทุกครั้ง (รวม path แชทต่อเนื่อง)
- ✅ CMS ขยาย: FAQ, announcements, site settings, SEO keys, audit logs, AI status health
- เปิดใช้เมื่อ `FEATURES.aiAdmin` = true (`NEXT_PUBLIC_APP_PHASE` ≥ 3 หรือไม่ตั้งใน dev)

## หน้า Admin ที่ใช้จริง
| Path | ชื่อเมนู | หน้าที่ |
|------|---------|---------|
| `/admin/prompts` | บุคลิก AI | กำหนดลักษณะการพูด / กฎ safety / รูปแบบคำตอบ |
| `/admin/knowledge` | คลังความรู้ | ใส่ตำรา/ความรู้ให้ AI อ้างอิง |
| `/admin/ai-configs` | โมเดล AI | เลือก model + ผูก persona + ทดสอบ |
| `/admin/usage` | บันทึก AI | usage / latency / error |

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `src/server/admin/ai-admin-service.ts` — CRUD prompts, ai-configs, knowledge + `assertAiAdminEnabled()`
- `POST /api/admin/ai-configs/:id/test` — ยิงทดสอบ model จริง (ไม่หักเครดิต)
- `GET /api/admin/ai-usage` — สรุป usage/cost สำหรับหน้า `/admin/usage`
- Draft/publish: `POST .../prompts/:id/{draft,publish}`, `knowledge/:id/{draft,publish}`, `settings/:key/{draft,publish,discard-draft}`
- `content-revision-service.ts` + `GET /api/admin/revisions`, `POST .../restore`
- Seed: `prisma/seed-ai-content.ts` — persona แม่หมอ + knowledge ตัวอย่าง
- ทุก mutation → `writeAudit()` ใน transaction

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: Demo Vercel ต้องซ่อน AI CMS จนกว่าจะจ่าย milestone ถัดไป
  - [วิธีที่ลองแก้]: `features.ts` + `assertAiAdminEnabled()` + ซ่อนเมนู admin (`aiOnly: true`)

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- API key เก็บแค่ `secretReference` — ต้องตั้ง env (`GEMINI_API_KEY`, `OPENAI_API_KEY`) เอง
- Knowledge ที่ inject คือฟิลด์ `content` ที่ publish แล้ว + `enabled=true` (draft ยังไม่เข้าแชทจนกว่า publish)
- ยังไม่มี automated test ครบทุก admin AI route (ไม่บล็อก handoff)

## Checklist งานต่อไป (Next Steps)
- [x] Knowledge inject ตรวจแล้วหลัง multi-turn (`reading-service` → `buildSystemPrompt`)
- [ ] (Optional) test `assertAiAdminEnabled` + admin mutations + audit
- [ ] Manual: แก้ persona/knowledge บน prod แล้วถามแชทยืนยัน
