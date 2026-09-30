import { prisma } from "@/server/db";

/**
 * How the local engine computes a Thai chart, as a knowledge doc the team can
 * read in /admin/knowledge.
 *
 * It is created DISABLED: the AI never computes positions (it reads the
 * engine's blocks), so the numbers would only cost prompt budget. We cannot
 * write to the production database from outside, so the app creates the doc
 * itself the first time an admin lists the knowledge base — once, and never
 * over a copy an admin has since edited.
 */
export const ENGINE_FORMULA_DOC_ID = "kb-team-engine-formulas";

export const ENGINE_FORMULA_DOC = {
  id: ENGINE_FORMULA_DOC_ID,
  title: "สูตรคำนวณดวงของ engine (สำหรับทีม — ไม่ส่งให้ AI)",
  sortOrder: 999,
  content: `เอกสารนี้ปิดไว้โดยตั้งใจ (enabled = false) — เป็นคู่มือสำหรับทีม ไม่ได้ส่งเข้า prompt ของ AI
ค่าทั้งหมดตรงกับโค้ดใน src/server/horoscope/engine/newhora/ และเทสต์ใน tests/fallback-lagna.test.ts

## ใช้เมื่อไร
ดวงกำเนิดดึงจาก myhora ก่อน ถ้าดึงไม่ได้ (เช่นโดน Cloudflare บล็อก) จะใช้ engine ในเครื่อง
ดวงคู่ (คนที่ผู้ใช้เพิ่มเข้ามา) ใช้ engine ในเครื่องเสมอ

## ตำแหน่งดาว
- พ.ศ. 2484–2583: ราศีดาวจากปฏิทินสุริยยาตร์ 100 ปี (ข้อมูลจาก myhora)
- นอกช่วงนั้น: คำนวณ
  - ดาวทั่วไป: ตำแหน่งดาราศาสตร์ ลบอายนางศะลาหิรี
  - ราหู: ราหูเฉลี่ย (mean node) ลบอายนางศะ
  - เกตุ: เกตุไทย เดินถอยหลังครบรอบทุก 679 วัน
    เกตุ = 357.3212 − (360/679) × (วันนับจาก J2000.0 เวลา UT)
    ตรงกับตาราง 100 ปี 98.7% ส่วนที่ไม่ตรงอยู่ห่างรอยต่อราศีไม่ถึง 0.6°

## ลัคนา — อันโตนาทีสามัญ สมผุสอาทิตย์อุทัย ปรับเวลาท้องถิ่น (แบบ myhora)
1. จุดเริ่ม = สมผุสอาทิตย์แบบสุริยยาตร์ ณ เวลาเกิด
   (อาทิตย์ลาหิรี + ค่าแก้ ตรงกับ myhora ภายใน 3 ลิปดา — ฟังก์ชัน suriyayatSunLongitude)
2. นับนาทีจากอาทิตย์ขึ้นจริงของวันไทยนั้น ณ พิกัดที่เกิด
   ถ้าเกิดหลังเที่ยงคืนแต่ก่อนอาทิตย์ขึ้น ให้นับจากอาทิตย์ขึ้นของวันก่อน
3. ปรับเวลาท้องถิ่น: บวก (ลองจิจูด − 105) × 4 นาที
   เช่น กรุงเทพฯ −18 นาที · อุบลฯ −0.6 · แม่ฮ่องสอน −28
4. เดินจากจุดเริ่มไปตามราศีด้วยจำนวนนาทีนั้น โดยแต่ละราศีใช้เวลาขึ้นตามตารางอันโตนาทีสามัญ (นาที):
   เมษ 120 · พฤษภ 96 · มิถุน 72 · กรกฎ 120 · สิงห์ 144 · กันย์ 168
   ตุลย์ 168 · พิจิก 144 · ธนู 120 · มกร 72 · กุมภ์ 96 · มีน 120 (รวม 1440)

## ตรวจกับ myhora แล้ว
16 ดวงที่แคปจาก myhora (กรุงเทพฯ โคราช อุบลฯ กาญจนบุรี เชียงใหม่ สกลนคร นราธิวาส แม่สอด นครพนม ภูเก็ต แม่ฮ่องสอน — กลางวัน กลางคืน และก่อนรุ่ง)
ราศีตรงทุกดวง · องศาห่างไม่เกิน 0.12° ในดวงที่ myhora แสดงองศา

## สิ่งที่ไม่ใช่สูตรนี้ (อย่าย้อนกลับไปใช้)
- ลัคนาดาราศาสตร์ (ascendant ลบลาหิรี): ห่าง myhora 5–12° และผิดราศีบางดวง
- อาทิตย์อุทัยคงที่ 06:00: ห่าง 3–6° (เว็บส่วนใหญ่ใช้แบบนี้)
- ตารางอันโตนาทีชุดเก่า 197, 215, 208…: ไม่มีที่มา ห่าง 7–16°
- หน้า calendar-ascendant ของ myhora ไม่ปรับเวลาท้องถิ่น จึงให้ค่าต่างจากหน้าดูดวงปกติ

## ถ้าจะแก้สูตร
ให้รัน tests/fallback-lagna.test.ts — ทั้ง 16 ดวงต้องยังผ่าน
ดวงที่คำนวณด้วยสูตรเก่าจะถูกคำนวณใหม่เองเมื่อเปลี่ยน FORMULA_LAGNA_METHOD ใน src/types/chart.ts
อย่าเพิ่ม CHART_EVIDENCE_VERSION ระหว่างที่ myhora ยังบล็อก ไม่งั้นดวงจาก myhora จะถูกแทนด้วยดวงจากสูตร`,
} as const;

let ensured: Promise<void> | null = null;

/** Create the doc once per server instance if it is missing. Never overwrites. */
export function ensureEngineFormulaDoc(): Promise<void> {
  ensured ??= prisma.knowledgeDoc
    .upsert({
      where: { id: ENGINE_FORMULA_DOC_ID },
      create: {
        id: ENGINE_FORMULA_DOC.id,
        title: ENGINE_FORMULA_DOC.title,
        content: ENGINE_FORMULA_DOC.content,
        sortOrder: ENGINE_FORMULA_DOC.sortOrder,
        enabled: false,
        categoryId: null,
      },
      update: {},
    })
    .then(() => undefined)
    .catch((err) => {
      ensured = null;
      console.warn("[knowledge] engine formula doc:", err instanceof Error ? err.message : err);
    });
  return ensured;
}
