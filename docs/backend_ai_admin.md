# Backend — Admin AI CMS (M3/M4)

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- ✅ **ครบบน main** (`3796e65`) — CRUD prompts, AI configs, knowledge + test endpoint + ai-usage + draft/publish/revisions
- ✅ CMS ขยาย: FAQ, announcements, site settings, SEO keys, audit logs, AI status health
- เปิดใช้เมื่อ `FEATURES.aiAdmin` = true (`NEXT_PUBLIC_APP_PHASE` ≥ 3 หรือไม่ตั้งใน dev)

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- `src/server/admin/ai-admin-service.ts` — CRUD prompts, ai-configs, knowledge + `assertAiAdminEnabled()`
- `POST /api/admin/ai-configs/:id/test` — ยิงทดสอบ model จริง (ไม่หักเครดิต)
- `GET /api/admin/ai-usage` — สรุป usage/cost สำหรับหน้า `/admin/usage`
- Draft/publish: `POST .../prompts/:id/{draft,publish}`, `knowledge/:id/{draft,publish}`, `settings/:key/{draft,publish,discard-draft}`
- `content-revision-service.ts` + `GET /api/admin/revisions`, `POST .../restore`
- `settings-admin-service.ts`, `cms-content-admin-service.ts`, `ai-status-service.ts`
- FE: managers ครบ + dashboard (`31412b9`, `3796e65`)
- ทุก mutation → `writeAudit()` ใน transaction

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: Demo Vercel ต้องซ่อน AI CMS จนกว่าจะจ่าย milestone ถัดไป
  - [วิธีที่ลองแก้]: `features.ts` + `assertAiAdminEnabled()` + ซ่อนเมนู admin (`aiOnly: true`)

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- API key เก็บแค่ `secretReference` — ต้องตั้ง env (`GEMINI_API_KEY`, `OPENAI_API_KEY`) เอง
- Knowledge inject ใน prompt-builder — ตรวจซ้ำว่าครบทุก path หลัง B1 multi-turn
- ยังไม่มี automated test admin AI routes + audit (B2)

## Checklist งานต่อไป (Next Steps)
- [ ] B2: test `assertAiAdminEnabled` + admin mutations + audit
- [ ] ตรวจ knowledge inject หลัง refactor multi-turn prompt
