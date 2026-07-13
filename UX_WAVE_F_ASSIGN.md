# UX Wave F — 1 วัน · 2 คน (ใช้ AI ช่วย)

**Repo:** https://github.com/Markrock342/astrology_ai  
**ไฟล์นี้บน GitHub:** https://github.com/Markrock342/astrology_ai/blob/main/UX_WAVE_F_ASSIGN.md  
**Production:** https://astrology-ai-three.vercel.app  
**Branch:** `main` (fork → branch ของตัวเอง → PR)

---

## เป้าวันเดียว

ทำให้แชท **รู้สึกเร็วขึ้น · ถามต่อง่ายขึ้น · เห็นเครดิตชัด** — ไม่ต้องครบทุกข้อ ถ้าเวลาไม่พอทำ **P0 ก่อน** แล้ว PR

| ระดับ | ความหมาย |
|-------|----------|
| **P0** | ต้องเสร็จวันนี้ — รวมแล้ว ~6–8 ชม. (มี AI) |
| **P1** | ทำถ้าเหลือเวลา — ไม่บล็อก PR |

**Baseline มีแล้ว อย่าทำซ้ำ:** multiline composer, stop/edit/regenerate, smart scroll, stall recovery, token Phase 1–3

---

## Setup (ทั้งคู่ · 15 นาที)

```bash
git clone https://github.com/Markrock342/astrology_ai.git
cd astrology_ai
npm install
cp .env.example .env.local   # ขอ .env จากหัวหน้าทีม
npm run typecheck && npm test
```

**กติกา**
- งาน **🔗** = ต้อง sync contract กับอีกฝั่งก่อน merge (คุยใน LINE/Discord 5 นาที)
- commit ทีละ task ID · push branch · เปิด PR ตอนเย็น
- ใช้ AI ได้เต็มที่ — แต่ **ต้องรัน test เอง** ก่อน PR

---

## สัญญา API (อ่าน 5 นาที · sync กันตอนเช้า)

### SSE `status` (A ทำ → B แสดง)

```json
{ "type": "status", "phase": "chart" }
{ "type": "status", "phase": "memory" }
{ "type": "status", "phase": "writing" }
```

| phase | FE แสดง |
|-------|---------|
| `chart` | กำลังคำนวณพื้นดวง… |
| `memory` | กำลังวิเคราะห์เรือนและดาว… |
| `writing` | กำลังเขียนคำทำนาย… |

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

### Body ส่งข้อความ — เพิ่ม field

```json
{ "content": "…", "answerMode": "brief" }
```

`brief` | `detailed` (default `detailed`)

---

## ตาราง 1 วัน (แนะนำ)

| เวลา | เพื่อน A (BE) | เพื่อน B (FE) |
|------|---------------|---------------|
| **09:00** | อ่าน contract · เริ่ม F1.1 SSE phase | เริ่ม F1.2 เครดิตก่อนส่ง (ไม่รอ A) |
| **10:30** | F1.2 followUps + summaryLine | F1.1 staged thinking (mock phase ก่อนได้) |
| **12:00** | F1.3 answerMode | F1.3 chips + F1.4 summary callout |
| **13:00** | **Sync กับ B** — ลองแชท local/prod ร่วมกัน | ต่อ integrate จริง |
| **14:00** | F2.2 balanceAfter ใน done | F2.1 toggle สั้น/ละเอียด |
| **15:00** | test + PR draft | F2.2 คลิกตารางดวง · F2.3 mobile ⋯ |
| **16:00** | รวม PR · แก้จาก review | เทสมือมือถือ · PR |

---

# 🟩 เพื่อน A — Backend

**Handoff:** https://github.com/Markrock342/astrology_ai/blob/main/HANDOFF_BE.md

## P0 — วันนี้ต้องเสร็จ

### UX-BE-F1.1 · SSE phased status
- [ ] ส่ง `phase: chart | memory | writing` ใน stream
- [ ] ไฟล์: [`messages/route.ts`](https://github.com/Markrock342/astrology_ai/blob/main/src/app/api/conversations/%5Bid%5D/messages/route.ts), [`reading-service.ts`](https://github.com/Markrock342/astrology_ai/blob/main/src/server/horoscope/reading-service.ts)
- **เสร็จเมื่อ:** Network → EventStream เห็น 3 phase ก่อน delta

### UX-BE-F1.2 · followUps + summaryLine ใน done
- [ ] หลังตอบเสร็จ — Flash-Lite สร้าง 3 chip + 1 บรรทัดสรุป (fail → `[]`)
- [ ] ไม่หักเครดิต user · ไม่ต้อง migrate DB
- **เสร็จเมื่อ:** done event มี field ใหม่ + test ผ่าน

### UX-BE-F1.3 · answerMode brief/detailed
- [ ] body schema + ลด `maxOutputTokens` ตอน `brief`
- [ ] ไฟล์: [`reading-service.ts`](https://github.com/Markrock342/astrology_ai/blob/main/src/server/horoscope/reading-service.ts), [`constants.ts`](https://github.com/Markrock342/astrology_ai/blob/main/src/config/constants.ts)
- **เสร็จเมื่อ:** `brief` สั้นกว่า `detailed` ชัดเจน

## P1 — ถ้าเหลือเวลา

### UX-BE-F2.2 · creditCost + balanceAfter ใน done
- [ ] 🔗 B ใช้แอนิเมชันเครดิต

### UX-BE-F2.1 · feedback API (thumbs)
- [ ] `POST .../messages/[messageId]/feedback` — ต้อง migrate เล็กน้อย

## ตรวจก่อน PR

```bash
npm run typecheck && npm test
```

---

# 🟦 เพื่อน B — Frontend

**Handoff:** https://github.com/Markrock342/astrology_ai/blob/main/HANDOFF_FE.md

## P0 — วันนี้ต้องเสร็จ

### UX-FE-F1.2 · เครดิตก่อนส่ง
- [ ] ใต้ composer: `ใช้ {cost} เครดิต · คงเหลือ {balance}`
- [ ] ไฟล์: [`chat-view.tsx`](https://github.com/Markrock342/astrology_ai/blob/main/src/components/app/chat-view.tsx), [`chat-usage-bar.tsx`](https://github.com/Markrock342/astrology_ai/blob/main/src/components/app/chat-usage-bar.tsx), [`use-my-usage.ts`](https://github.com/Markrock342/astrology_ai/blob/main/src/hooks/use-my-usage.ts)
- **เริ่มได้ทันที ไม่รอ A**

### UX-FE-F1.1 · Staged thinking
- [ ] 🔗 รอ A F1.1 (mock phase ไว้ก่อนได้)
- [ ] แก้ `ThinkingIndicator` ตาม phase 3 แบบ

### UX-FE-F1.3 · Follow-up chips
- [ ] 🔗 รอ A F1.2
- [ ] chip ใต้คำตอบ · คลิก → ส่งถามต่อในเธรดเดิม

### UX-FE-F1.4 · สรุป 1 บรรทัด
- [ ] callout จาก `summaryLine` ก่อน markdown

## P1 — ถ้าเหลือเวลา

### UX-FE-F2.1 · toggle กระชับ/ละเอียด
- [ ] 🔗 A F1.3 · จำใน localStorage

### UX-FE-F2.2 · คลิกตารางดวง → ถามต่อ
- [ ] [`chart-evidence-table.tsx`](https://github.com/Markrock342/astrology_ai/blob/main/src/components/app/chart-evidence-table.tsx)

### UX-FE-F2.3 · mobile ⋯ menu + ย้าย scroll FAB

### UX-FE-F2.4 · thumbs · UX-FE-F2.5 · draft ค้าง

## ตรวจก่อน PR

```bash
npm run typecheck && npm run lint
# มือถือ: แชท 3 เทิร์น · chip · เครดิตก่อนส่ง
```

---

## Prompt แนบให้ AI (copy ไปวาง)

### เพื่อน A — วางใน Cursor/Claude

```
โปรเจกต์: https://github.com/Markrock342/astrology_ai
อ่าน UX_WAVE_F_ASSIGN.md ส่วน Backend P0

ทำตามลำดับ:
1. UX-BE-F1.1 — SSE phase chart/memory/writing ใน messages route + reading-service callback
2. UX-BE-F1.2 — summaryLine + followUps ใน done event (Flash-Lite, ไม่หักเครดิต)
3. UX-BE-F1.3 — answerMode brief/detailed ใน body + ลด output cap

กติกา: อย่า over-engineer · test คู่ทุก task · npm test ต้องผ่าน
Contract API อยู่ใน UX_WAVE_F_ASSIGN.md — ห้ามเปลี่ยน field name โดยไม่บอก FE
```

### เพื่อน B — วางใน Cursor/Claude

```
โปรเจกต์: https://github.com/Markrock342/astrology_ai
อ่าน UX_WAVE_F_ASSIGN.md ส่วน Frontend P0

ทำตามลำดับ:
1. UX-FE-F1.2 — เครดิตก่อนส่งใต้ composer (useMyUsage มีแล้ว)
2. UX-FE-F1.1 — ThinkingIndicator แสดง 3 phase จาก SSE status
3. UX-FE-F1.3 — follow-up chips จาก done event
4. UX-FE-F1.4 — summaryLine callout

กติกา: อย่า over-engineer · เทสมือบนมือถือ · npm run lint ต้องผ่าน
รอ field จาก BE ตาม contract — ถ้ายังไม่มีให้ mock แล้ว integrate ทีหลัง
```

---

## PR checklist (ร่วม · ก่อน merge)

- [ ] P0 ครบทั้ง A + B
- [ ] แชท prod: เห็น 3 phase thinking
- [ ] follow-up chip กดได้ 2 รอบ
- [ ] เครดิตก่อนส่งตรงหลังตอบ
- [ ] `npm test` ผ่าน · ไม่มี conflict กับ `main`

---

## ลิงก์อ้างอิง

| เอกสาร | URL |
|--------|-----|
| งานนี้ | https://github.com/Markrock342/astrology_ai/blob/main/UX_WAVE_F_ASSIGN.md |
| BE ทั้งหมด | https://github.com/Markrock342/astrology_ai/blob/main/BE_ASSIGN.md |
| FE ทั้งหมด | https://github.com/Markrock342/astrology_ai/blob/main/FE_ASSIGN.md |
| Chat UI หลัก | https://github.com/Markrock342/astrology_ai/blob/main/src/components/app/chat-view.tsx |
| M4 handoff | https://github.com/Markrock342/astrology_ai/blob/main/M4_HANDOFF.md |

---

*แจกไฟล์นี้ให้เพื่อน A (BE) + เพื่อน B (FE) · ทำ 1 วันด้วย AI ได้ — โฟกัส P0 ก่อน*
