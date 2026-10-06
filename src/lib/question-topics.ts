import { HOUSE_NAMES, normalizeSignName, SIGNS } from "@/lib/chart-theme";
import { lordOfSign } from "@/lib/thai-dignity";

/**
 * Which houses a question is about, from the team's 17-topic table (the
 * reading method in prompt-builder). Graders found answers reasoning from
 * the wrong house — a question about a home read from ภพ 1 or ลาภะ instead of
 * ภพ 4 พันธุ — because the model was left to pick. The houses are named for it.
 */
export type QuestionTopic = { label: string; houses: number[] };

const TOPICS: Array<QuestionTopic & { re: RegExp }> = [
  { label: "บ้าน รถ ที่ดิน", houses: [4], re: /บ้าน(?!เกิด)|ที่ดิน|คอนโด|อสังหา|ออกรถ|ซื้อรถ|รถใหม่|ย้ายบ้าน|ที่อยู่อาศัย/ },
  { label: "ครอบครัว", houses: [4], re: /ครอบครัว|พ่อแม่|พ่อ|แม่|ญาติ|คนในบ้าน/ },
  { label: "บุตร", houses: [5], re: /ลูก(?!ค้า|น้อง)|มีบุตร|ตั้งครรภ์|ท้อง/ },
  { label: "ความรักและคู่ครอง", houses: [7, 5], re: /รัก|แฟน|คู่ครอง|เนื้อคู่|แต่งงาน|สามี|ภรรยา|โสด|คบ|เลิก|คืนดี|จีบ|สมพงษ์/ },
  { label: "หุ้นส่วนและคู่สัญญา", houses: [7], re: /หุ้นส่วน|ร่วมทุน|คู่ค้า/ },
  { label: "การงาน", houses: [10, 6], re: /งาน|อาชีพ|เลื่อนตำแหน่ง|หัวหน้า|สัมภาษณ์|ลาออก|ตกงาน/ },
  { label: "ธุรกิจและการค้า", houses: [10, 2, 11], re: /ธุรกิจ|ค้าขาย|เปิดร้าน|กิจการ|ลูกค้า|ขายของ/ },
  { label: "การเงิน", houses: [2, 11], re: /เงิน|รายได้|ทรัพย์|หนี้|กู้|ออม|ลงทุน|หุ้น|รวย|มั่งมี|ฐานะ/ },
  { label: "โชคลาภ", houses: [11, 5], re: /โชค|ลาภ|เสี่ยงโชค|รางวัล/ },
  { label: "สุขภาพ", houses: [1, 6, 8], re: /สุขภาพ|ป่วย|เจ็บ|โรค|หมอ|ผ่าตัด|ร่างกาย|ออกกำลัง/ },
  { label: "การเดินทางไกลและต่างประเทศ", houses: [9], re: /ต่างประเทศ|เดินทางไกล|ต่างแดน|เมืองนอก|บินไป|ย้ายไปอยู่/ },
  { label: "การเดินทางใกล้และเพื่อนฝูง", houses: [3], re: /เดินทาง(?!ไกล)|เที่ยว|เพื่อน|พี่น้อง/ },
  { label: "การสื่อสาร เอกสาร สัญญา", houses: [3], re: /สัญญา|เอกสาร|เซ็น|เจรจา|ติดต่อ/ },
  { label: "การเรียนและการสอบ", houses: [4, 9], re: /เรียน|สอบ|ศึกษา|ทุน(?:การศึกษา)?|ปริญญา/ },
  { label: "ผู้ใหญ่อุปถัมภ์", houses: [9], re: /ผู้ใหญ่|อุปถัมภ์|เจ้านาย|นาย/ },
  { label: "อุปสรรค ศัตรู คดีความ", houses: [6], re: /ศัตรู|คู่แข่ง|คดี|ฟ้อง|อุปสรรค|ถูกโกง/ },
  { label: "เรื่องเบื้องหลังและศัตรูลับ", houses: [12], re: /เบื้องหลัง|ศัตรูลับ|ลับ ๆ|แอบ/ },
];

export function questionTopics(question: string): QuestionTopic[] {
  const hits = TOPICS.filter((t) => t.re.test(question));
  return hits.map(({ label, houses }) => ({ label, houses }));
}

export function topicHousesOf(question: string): number[] {
  return [...new Set(questionTopics(question).flatMap((t) => t.houses))];
}

/** "[question_focus] เรื่องที่ถาม: … → ภพ 4 พันธุ (ราศีมีน เจ้าเรือนพฤหัสบดี)". */
export function formatQuestionFocus(question: string, lagna: string | null | undefined): string | null {
  const topics = questionTopics(question);
  if (!topics.length || !lagna) return null;
  const idx = (SIGNS as readonly string[]).indexOf(normalizeSignName(lagna));
  if (idx < 0) return null;
  const house = (h: number) => {
    const sign = SIGNS[(idx + h - 1) % 12]!;
    return `ภพ ${h} ${HOUSE_NAMES[h - 1]} (ราศี${sign} เจ้าเรือน${lordOfSign(sign) ?? "—"})`;
  };
  return (
    "[question_focus] เรื่องที่ถามและภพที่ต้องใช้เป็นหลัก (ห้ามอ้างภพอื่นว่าเป็นเรือนของเรื่องนี้): " +
    topics.map((t) => `${t.label} → ${t.houses.map(house).join(" · ")}`).join(" | ")
  );
}
