# HoraSard Standard v1

มาตรฐานการคำนวณดวงกำเนิด (natal) ที่โปรเจกต์ถือเป็นของตัวเอง — ไม่พึ่ง scrape ตอนรันเทส และไม่เคลมว่าเป็นตราประทับจากหน่วยงานภายนอก

**สถานะ:** locked 2026-07-12  
**Golden fixtures:** `tests/fixtures/horasard-golden-v1.json` (20 เคส)  
**Regression test:** `tests/horasard-standard-v1.test.ts`  
**Entrypoint ที่ล็อก:** `computeNatalChartFormula()` (ไม่ผ่าน myhora scrape)

---

## 1. การตั้งค่าที่ประกาศใช้ (v1)

จาก `CALCULATION_SETTINGS` (`src/server/horoscope/engine/newhora/data/calculationSettings.ts`):

| คีย์ | ค่า | ความหมายสั้น ๆ |
|------|-----|----------------|
| `calendar` | `suryayat` | สุริยยาตร์ |
| `ayanamsa` | `lahiri` | ลาหิรี |
| `timeMethod` | `antonathi_samrap_sunrise_local` | อันโตนาทีสามัญ · สมผุสอาทิตย์อุทัย · เวลาท้องถิ่น |
| `rahuRule` | `eight_signs_aquarius` | ราหู ๘ ราศีกุมภ์ |
| `taksaRahuLord` | `mercury_night` | ทักษา ราหู = พุธกลางคืน |
| `taksaCountFrom` | `center` | ทักษานับตากลาง |

สิ่งที่ **ยังไม่รวมใน Standard v1** (ดู `MYHORA_OPTIONS_EXCLUDED`): ตรีวัยเต็ม, กาลจักร, พารณสี, ชันษาจร, มุมโยค ฯลฯ

---

## 2. ลำดับแหล่งข้อมูล (formula path)

`computeNatalChartFormula` → `computeFullChartSync` เลือกแหล่งตามนี้:

1. **Birth-time reference** (`suryayat100/referenceCharts.ts`)  
   - คีย์วันเวลา + พิกัดสถานที่  
   - ใช้เมื่อมีเคสที่เทียบ myhora ราศีจักรตามเวลาเกิดแล้ว  
   - `calculationSource`: `suryayat-100-reference`  
   - **authority สูงสุดใน repo ตอนนี้** (ภายนอกยืนยันแล้ว 2 เคส)

2. **Year calendar JSON** (`suryayat100/years/*.json`, พ.ศ. ~2484–2583)  
   - ดาวสมผุสรายวันจากปฏิทินปี (อ้างอิงเวลาปฏิทิน ไม่ใช่ลัคนาตามเวลาเกิดเสมอ)  
   - `calculationSource`: `suryayat-100-year` (หรือชื่อใกล้เคียงตาม pipeline)  
   - **ช่องว่างที่รู้แล้ว:** ถ้า year entry ไม่มีลัคนา ระบบอาจตกไปใช้ค่าเริ่มต้น (`เมษ`) — ลัคนาชุดนี้จึงเป็น *provisional* จนกว่าจะมี birth-time lagna จริง

3. **Formula pipeline** (astronomy-engine + กฎไทยที่ประกาศ)  
   - เมื่ออยู่นอกช่วงปีปฏิทิน / ไม่มี year entry  
   - `calculationSource`: `formula-pipeline`  
   - ล็อกเป็น regression ของสูตรใน repo ไม่ใช่ใบรับรองจาก myhora

Scrape myhora ตอนรันไทม์แชท **อยู่นอก Standard v1** — ใช้เป็น parity / สำรองเท่านั้น ไม่ใช่แหล่งความจริงของเทสนี้

---

## 3. สิ่งที่ golden ยืนยันต่อเคส

| ฟิลด์ | ความหมาย |
|-------|----------|
| `expect.source` | path ที่ engine เลือกต้องคงที่ |
| `expect.lagna` | ชื่อราศีลัคนา (string ที่ engine คืน) |
| `expect.planets` | แผนที่ชื่อดาว → ราศี sidereal (10 ดวง) |
| `expect.taksaCountMin` | จำนวนแถวทักษาขั้นต่ำ |

### ระดับ `authority`

| Tag | ความหมาย | เมื่อพังควรทำอย่างไร |
|-----|----------|----------------------|
| `myhora-parity` | เทียบ myhora เวลาเกิดแล้ว (อยู่ใน `referenceCharts`) | ตรวจก่อนว่าเปลี่ยนสูตรตั้งใจหรือพิกัด/คีย์พัง — อย่าแก้ fixture มั่ว |
| `formula-locked` | snapshot สูตรนอกช่วงปฏิทินปี | อัปเดต fixture ได้ถ้าเปลี่ยนสูตรโดยตั้งใจ + บันทึกใน PR |
| `suryayat-year-locked` | snapshot จาก year JSON (+ ลัคนาที่อาจ provisional) | อัปเดตเมื่อ scrape ปฏิทินปีใหม่หรือแก้ lookup — อย่าเคลมว่าลัคนาถูกต้อง 100% |

---

## 4. ชุด 20 golden cases (สรุป)

| # | id | authority |
|---|-----|-----------|
| 1–2 | `ref-2006-bangkok-pranakorn`, `ref-2001-bangkok-bangkae` | myhora-parity |
| 3–4 | `formula-1938-bangkok`, `formula-2045-chiangmai` | formula-locked |
| 5–20 | `year-*` (16 เคส กระจายปี/จังหวัด) | suryayat-year-locked |

รายละเอียด input/expect อยู่ใน JSON fixture

---

## 5. วิธีรัน / อัปเดต fixture

```bash
npm test -- tests/horasard-standard-v1.test.ts
```

อัปเดตค่าที่ล็อก (เมื่อเปลี่ยนสูตรโดยตั้งใจ):

1. รันสคริปต์สร้าง JSON ใหม่ (หรือแก้ `tests/fixtures/horasard-golden-v1.json` ด้วยมืออย่างระมัดระวัง)
2. อัปเดต `lockedAt` ใน fixture + บรรทัดสถานะในเอกสารนี้
3. ใน PR อธิบายว่าทำไมค่าใหม่ถูกต้องกว่า (โดยเฉพาะ `myhora-parity`)

---

## 6. เป้าหมายหลัง v1 (ไม่ทำในรอบนี้)

- เพิ่ม birth-time reference ให้ครบ ≥20 เคสที่เทียบ myhora จริง (ยกระดับจาก year-locked)
- แก้ lagna path ของ year calendar ให้ไม่ fallback `เมษ` โดยไม่ตั้งใจ
- แยก assert องศา/ทักษาละเอียดเมื่อสูตรองศามั่นคง
- เอกสาร Standard v1.1 เมื่อ settings หรือแหล่งข้อมูลเปลี่ยน

---

## 7. ความสัมพันธ์กับเอกสารอื่น

- Runtime scrape + fallback: [newhora-integration.md](./newhora-integration.md)
- Settings labels: `calculationSettings.ts`
- Year scrape offline: `npm run scrape:suryayat`
