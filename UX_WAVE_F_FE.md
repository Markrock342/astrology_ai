# UX Wave F — เพื่อน B (Frontend) · 1 วัน

**Repo:** https://github.com/Markrock342/astrology_ai  
**คู่กับ:** [UX_WAVE_F_BE.md](./UX_WAVE_F_BE.md) (เพื่อน A)  
**Production:** https://astrology-ai-three.vercel.app  
**Branch:** `fe/ux-wave-f` → PR [#16](https://github.com/Markrock342/astrology_ai/pull/16)

---

## เป้าวันนี้ (P0)

| ID | งาน | รอ BE? | สถานะ |
|----|-----|--------|--------|
| UX-FE-F1.2 | เครดิตก่อนส่งใต้ composer | **ไม่รอ** — เริ่มเลย | ✅ |
| UX-FE-F1.1 | Thinking 3 phase จาก SSE | รอ A F1.1 (mock ก่อนได้) | ✅ |
| UX-FE-F1.3 | follow-up chips | รอ A F1.2 | ✅ |
| UX-FE-F1.4 | สรุป 1 บรรทัด (callout) | รอ A F1.2 | ✅ |

**P1:** toggle สั้น/ละเอียด · คลิกตารางดวง · mobile ⋯ · thumbs · draft — ✅

---

## Setup

```bash
git clone https://github.com/Markrock342/astrology_ai.git
cd astrology_ai && npm install
# ขอ .env.local จากหัวหน้าทีม
npm run typecheck && npm run lint
```

**Sync กับ A ตอน 13:00** — ลองแชทร่วมว่า phase / chips / summary ขึ้นจริง

---

## สิ่งที่รอจาก BE (contract)

### SSE `status` → แสดงใน ThinkingIndicator

| phase | ข้อความ |
|-------|---------|
| `chart` | กำลังคำนวณพื้นดวง… |
| `memory` | กำลังวิเคราะห์เรือนและดาว… |
| `writing` | กำลังเขียนคำทำนาย… |

### SSE `done` → ใช้ field ใหม่

```json
{
  "summaryLine": "ภาพรวม: …",
  "followUps": ["…", "…", "…"]
}
```

### ส่งไป BE

```json
{ "content": "…", "answerMode": "brief" }
```

---

## Checklist

### UX-FE-F1.2 · เครดิตก่อนส่ง
- [x] ใต้ composer: `ใช้ {cost} เครดิต · คงเหลือ {balance}`
- [x] ใช้ `useMyUsage` + `DEFAULTS.creditCostPerReading`
- [x] หลังตอบเสร็จ — refresh usage bar
- ไฟล์: `src/components/app/chat-view.tsx`, `chat-usage-bar.tsx`

### UX-FE-F1.1 · Staged thinking
- [x] parse SSE `{ type:"status", phase }` ใน `chat-view.tsx`
- [x] `ThinkingIndicator` แสดงข้อความตาม phase
- [x] ยังนับเวลา elapsed เหมือนเดิม

### UX-FE-F1.3 · Follow-up chips
- [x] chip 0–3 ใต้คำตอบ assistant (หลัง stream จบ)
- [x] คลิก → ส่งถามต่อในเธรดเดิม
- [x] ซ่อนขณะ streaming

### UX-FE-F1.4 · summaryLine callout
- [x] กล่องสรุป 1 บรรทัดก่อน markdown หลัก
- [x] ไม่พังบนมือถือ

### UX-FE-F2.1 · (P1) toggle กระชับ/ละเอียด + localStorage
- [x] ส่ง `answerMode` ไป BE · persist ใน localStorage

### UX-FE-F2.2 · (P1) คลิกแถวใน `chart-evidence-table.tsx` → pre-fill composer
- [x] แตะแถว → ใส่คำถามใน composer

### UX-FE-F2.3 · (P1) mobile ⋯ menu · ย้าย scroll FAB
- [x] ⋯ overflow บนมือถือ · FAB อยู่ใน scroll area
- [x] draft localStorage · thumbs local (รอ BE feedback API)

---

## ตรวจก่อน PR

```bash
npm run typecheck && npm run lint
```

เทสมือ **มือถือ**: แชท 3 เทิร์น · chip กดได้ · เครดิตก่อนส่งตรง

---

## Prompt ใส่ AI

```
Repo: https://github.com/Markrock342/astrology_ai
อ่าน UX_WAVE_F_FE.md

ทำ P0:
1. เครดิตก่อนส่งใต้ composer (เริ่มเลย)
2. ThinkingIndicator 3 phase จาก SSE status
3. follow-up chips จาก done event
4. summaryLine callout

รอ field จาก BE ตาม contract — ยังไม่มีให้ mock ก่อน
npm run lint ต้องผ่าน · เทสมือมือถือ
```

---

## ลิงก์โค้ด

| ไฟล์ | URL |
|------|-----|
| chat-view | https://github.com/Markrock342/astrology_ai/blob/fe/ux-wave-f/src/components/app/chat-view.tsx |
| chat-usage-bar | https://github.com/Markrock342/astrology_ai/blob/fe/ux-wave-f/src/components/app/chat-usage-bar.tsx |
| chart-evidence-table | https://github.com/Markrock342/astrology_ai/blob/fe/ux-wave-f/src/components/app/chart-evidence-table.tsx |
| use-my-usage | https://github.com/Markrock342/astrology_ai/blob/fe/ux-wave-f/src/hooks/use-my-usage.ts |
| PR | https://github.com/Markrock342/astrology_ai/pull/16 |
