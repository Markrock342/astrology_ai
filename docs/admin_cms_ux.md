# Admin CMS UX — Preview, Health, Models

## สถานะปัจจุบันของฟีเจอร์นี้ (Current Status)
- หน้า Admin AI Models: Gemini + OpenAI-compatible — สร้างโมเดลต้องวาง API key (เข้ารหัสใน DB)
- ฟอร์มเพิ่มโมเดล: ช่อง Model ID / ชื่อ / Base URL **ว่างให้พิมพ์เอง** (ไม่มี preset dropdown + ค่าแนะนำ)
- Health check / ปุ่มทดสอบ: ตรวจโมเดลหลักเท่านั้น (ไม่ผ่านด้วย fallback)
- ผูกโมเดลต่อหมวด/แพลนที่ฟอร์ม AI Config (ไม่ใช่หน้า Categories)
- **คู่มือละเอียดสำหรับเพื่อน/AI:** [`SETTINGS_MODEL_AI.md`](../SETTINGS_MODEL_AI.md) (รากโปรเจกต์)

## งานที่เพิ่งทำเสร็จ (Recently Completed)
- ฟอร์มเพิ่มโมเดล: Model ID เป็นช่องพิมพ์เดียว ไม่พรีฟิลล์ค่าแนะนำ
- Create ต้องมี `apiKey`; ส่ง `planScope`; highlight แถวใหม่
- Seed Gemini migrate เป็น encrypted key + scope FREE/PRO/ALL
- Health primary-only + ลบ dead category `aiConfigId`
- เขียนคู่มือราก `SETTINGS_MODEL_AI.md` (UI + key + fallback + troubleshooting)

## บันทึกการแก้บัค (Bug & Troubleshooting Log)
- [ปัญหา]: กดดูตัวอย่างจาก `/admin/landing` แล้วเด้งไปแชท → แก้แล้ว
- [ปัญหา]: ตรวจการเชื่อมต่อค้าง / ไม่เห็นผล → แก้แล้ว
- [ปัญหา]: master–detail สับสน / `setEditingHasStoredKey` → แก้แล้ว
- [ปัญหา]: ฟอร์มโชว์ `GEMINI_API_KEY` / preset → ไม่ prefill; Model ID พิมพ์เอง
- [ปัญหา]: `planScope` ไม่ถูกบันทึก → แก้แล้ว
- [ปัญหา]: health เขียวทั้งที่ primary พัง (ผ่าน fallback) → ใช้ primary-only
- [ปัญหา]: ทดสอบ `gemini-3.5-flash` ได้ TIMEOUT / UNAVAILABLE / free_tier quota 20 → เป็นฝั่ง Google (โหลดหนักหรือเพดานฟรี) ไม่ใช่ key ผิด; ดูคู่มือ §9

## สิ่งที่ยังค้างอยู่และปัญหาที่ทราบ (Pending & Known Issues)
- Soft-nav ยังอยู่ branch `fix/dashboard-soft-nav`
- Anthropic/Claude ยังไม่รองรับ
- Smoke staging/prod ยัง manual
- OpenAI-compatible ต้องสร้างแถวใน DB เองจากฟอร์ม (ยังไม่มี seed GPT)

## Checklist งานต่อไป (Next Steps)
- [ ] Smoke staging: สร้าง OpenAI-compatible + Base URL, health รายโมเดล, chat Free/Pro routing
- [ ] (ถ้าต้องการ) merge soft-nav / Anthropic เป็นงานแยก
- [x] Repair AI model config (encrypted path + routing/health)
- [x] คู่มือ `SETTINGS_MODEL_AI.md`
