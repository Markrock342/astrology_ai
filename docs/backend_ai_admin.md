# Backend — Admin AI CMS (M3 บางส่วน)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- 🚧 **เริ่มแล้วบน main** (commit `8a0f4da`+) — CRUD prompts, AI provider configs, knowledge docs + test endpoint; ยังไม่ครบ M3 (ขาด ai-usage logs API)
- เปิดใช้เมื่อ `FEATURES.aiAdmin` = true (`NEXT_PUBLIC_APP_PHASE` ≥ 3 หรือไม่ตั้งใน dev)

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `src/server/admin/ai-admin-service.ts` — CRUD prompts, ai-configs, knowledge + `assertAiAdminEnabled()`
- `src/app/api/admin/prompts/*` — list/create/update/delete
- `src/app/api/admin/ai-configs/*` — list/create/update/delete
- `POST /api/admin/ai-configs/:id/test` — ยิงทดสอบ model จริง (ไม่หักเครดิต)
- `src/app/api/admin/knowledge/*` — knowledge base สำหรับ inject ใน prompt
- `prisma/schema.prisma` — โมเดล `KnowledgeDoc`
- FE: `prompts-manager.tsx`, `ai-configs-manager.tsx`, `knowledge-manager.tsx`
- ทุก mutation → `writeAudit()` ใน transaction

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: Demo Vercel ต้องซ่อน AI CMS จนกว่าจะจ่าย milestone ถัดไป
  - [วิธีที่ลองแก้]: `src/config/features.ts` + `assertAiAdminEnabled()` + ซ่อนเมนู admin (`aiOnly: true`)

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- ยังไม่มี `GET /api/admin/ai-usage` (หน้า `/admin/usage` เป็น stub)
- `KnowledgeDoc` อาจยังไม่มีตารางใน DB ถ้าไม่ได้ migrate หลังเพิ่ม schema
- API key เก็บแค่ `secretReference` — ต้องตั้ง env (`GEMINI_API_KEY`, `OPENAI_API_KEY`) เอง

## Checklist งานต่อไป (Next Steps)
- [ ] migration สำหรับ `knowledge_docs` (ถ้ายังไม่มี)
- [ ] `GET /api/admin/ai-usage` + เชื่อมหน้า usage
- [ ] test: admin AI routes + `assertAiAdminEnabled` + audit
- [ ] inject knowledge docs ใน prompt-builder ตอน generate (ถ้ายังไม่ครบ)
