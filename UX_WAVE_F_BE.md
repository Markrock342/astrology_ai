# UX Wave F — เพื่อน A (Backend) · 1 วัน

> **สถานะบน `be/ux-wave-f`:** ✅ P0 ครบ — `phase` SSE, `answerMode`, `summaryLine`/`followUps` ใน `done` · P1 (`balanceAfter`, feedback) ยังค้าง

**Repo:** https://github.com/Markrock342/astrology_ai  
**คู่กับ:** [UX_WAVE_F_FE.md](./UX_WAVE_F_FE.md) (เพื่อน B)  
**Production:** https://astrology-ai-three.vercel.app  
**Branch:** fork → branch ตัวเอง → PR เข้า `main`

---

## เป้าวันนี้ (P0)

| ID | งาน |
|----|-----|
| UX-BE-F1.1 | SSE ส่ง phase `chart` → `memory` → `writing` |
| UX-BE-F1.2 | `summaryLine` + `followUps` ใน done event |
| UX-BE-F1.3 | รับ `answerMode: brief \| detailed` |

**P1 ถ้าเหลือเวลา:** `balanceAfter` ใน done · feedback API (thumbs)

---

## Setup

```bash
git clone https://github.com/Markrock342/astrology_ai.git
cd astrology_ai && npm install
# ขอ .env.local จากหัวหน้าทีม
npm run typecheck && npm test
```

**Sync กับ B ตอน 13:00** — ยืนยัน contract ด้านล่างว่า field ตรงกัน

---

## สิ่งที่ต้องส่งให้ FE (ห้ามเปลี่ยนชื่อ field)

### SSE `status`

```json
{ "type": "status", "phase": "chart" }
{ "type": "status", "phase": "memory" }
{ "type": "status", "phase": "writing" }
```

### SSE `done` — เพิ่ม field

```json
{
  "type": "done",
  "reading": { "...เดิม..." },
  "summaryLine": "ภาพรวม: …",
  "followUps": ["…", "…", "…"],
  "creditCost": 1,
  "balanceAfter": 88
}
```

- `followUps`: 0–3 ข้อ, ไทย, ≤60 ตัวอักษร
- `summaryLine`: optional, ≤120 ตัวอักษร
- `creditCost` / `balanceAfter`: P1

### Body รับจาก FE

```json
{ "content": "…", "answerMode": "brief" }
```

`brief` → ลด `maxOutputTokens` + hint ตอบสั้นใน prompt

---

## Checklist

### UX-BE-F1.1 · SSE phased status
- [x] ส่ง `phase: chart` ก่อนโหลด chart
- [x] ส่ง `phase: memory` ก่อน build prompt
- [x] ส่ง `phase: writing` ก่อนเรียก Gemini
- ไฟล์: `src/app/api/conversations/[id]/messages/route.ts`, `src/server/horoscope/reading-service.ts`

### UX-BE-F1.2 · followUps + summaryLine
- [x] หลังตอบเสร็จ — Flash-Lite สร้าง 3 chip + 1 บรรทัดสรุป
- [x] fail → `followUps: []` ไม่พังเทิร์น · **ไม่หักเครดิต user**
- [x] test mock ผ่าน (`tests/follow-up-suggestions.test.ts`)

### UX-BE-F1.3 · answerMode
- [x] zod schema ใน messages route
- [x] `resolveMaxOutputTokens` ลดเมื่อ `brief`
- [x] test: `tests/reading-output-tokens.test.ts`

### UX-BE-F2.2 · (P1) balanceAfter ใน done

### UX-BE-F2.1 · (P1) `POST .../messages/[messageId]/feedback`

---

## ตรวจก่อน PR

```bash
npm run typecheck && npm test
```

DevTools → Network → EventStream: เห็น 3 phase ก่อน delta แรก

---

## Prompt ใส่ AI

```
Repo: https://github.com/Markrock342/astrology_ai
อ่าน UX_WAVE_F_BE.md

ทำ P0:
1. SSE phase chart/memory/writing
2. summaryLine + followUps ใน done (Flash-Lite, ไม่หักเครดิต)
3. answerMode brief/detailed

อย่าเปลี่ยนชื่อ field ใน contract · npm test ต้องผ่าน
```

---

## ลิงก์โค้ด

| ไฟล์ | URL |
|------|-----|
| messages route | https://github.com/Markrock342/astrology_ai/blob/main/src/app/api/conversations/%5Bid%5D/messages/route.ts |
| reading-service | https://github.com/Markrock342/astrology_ai/blob/main/src/server/horoscope/reading-service.ts |
| message-service | https://github.com/Markrock342/astrology_ai/blob/main/src/server/horoscope/message-service.ts |
| constants | https://github.com/Markrock342/astrology_ai/blob/main/src/config/constants.ts |
