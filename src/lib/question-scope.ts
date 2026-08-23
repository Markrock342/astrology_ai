export type HoroscopeCategorySlug =
  | "self"
  | "career"
  | "finance"
  | "love"
  | "health"
  | "fortune"
  | "overview";

const CATEGORY_KEYWORDS: Record<HoroscopeCategorySlug, readonly string[]> = {
  self: [
    "ตัวตน",
    "บุคลิก",
    "นิสัย",
    "จุดแข็ง",
    "จุดอ่อน",
    "ความมั่นใจ",
    "พัฒนาตัวเอง",
    "ทิศทางชีวิต",
    "เป้าหมายชีวิต",
  ],
  career: [
    "การงาน",
    "อาชีพ",
    "สมัครงาน",
    "เปลี่ยนงาน",
    "เลื่อนตำแหน่ง",
    "เจ้านาย",
    "ลูกน้อง",
    "บริษัท",
    "ธุรกิจ",
    "ฟรีแลนซ์",
    "การเรียน",
    "สอบ",
    "งาน",
  ],
  finance: [
    "การเงิน",
    "รายได้",
    "รายจ่าย",
    "เก็บออม",
    "เงินเก็บ",
    "ลงทุน",
    "ทรัพย์สิน",
    "กำไร",
    "ขาดทุน",
    "หนี้",
    "เงิน",
  ],
  love: [
    "ความรัก",
    "ความสัมพันธ์",
    "คนรัก",
    "เนื้อคู่",
    "คนคุย",
    "แต่งงาน",
    "แฟน",
    "โสด",
    "คู่ครอง",
  ],
  health: [
    "สุขภาพ",
    "เจ็บป่วย",
    "ร่างกาย",
    "อาการ",
    "โรค",
    "นอนไม่หลับ",
    "การนอน",
    "เครียด",
  ],
  fortune: [
    "โชคลาภ",
    "ลาภลอย",
    "วันมงคล",
    "เลขมงคล",
    "ฤกษ์",
    "หวย",
    "โชค",
  ],
  overview: ["ภาพรวม", "ดวงโดยรวม", "ทุกเรื่อง", "ชีวิตปีนี้", "ปีนี้เป็นยังไง"],
};

function normalizeQuestion(question: string): string {
  return question.normalize("NFKC").toLocaleLowerCase("th").replace(/\s+/g, " ");
}

/**
 * Detect an obvious cross-category question. Generic questions are allowed;
 * ambiguous questions that mention the selected category are also allowed.
 * The AI prompt remains a second boundary for phrasing the classifier misses.
 */
export function detectQuestionScopeMismatch(
  question: string,
  currentSlug: string,
): HoroscopeCategorySlug | null {
  const normalized = normalizeQuestion(question);
  const scores = Object.entries(CATEGORY_KEYWORDS).map(([slug, keywords]) => ({
    slug: slug as HoroscopeCategorySlug,
    score: keywords.reduce(
      (total, keyword) => total + (normalized.includes(keyword) ? 1 : 0),
      0,
    ),
  }));

  const current = scores.find((entry) => entry.slug === currentSlug);
  if ((current?.score ?? 0) > 0) return null;

  const best = scores.sort((a, b) => b.score - a.score)[0];
  return best && best.score > 0 && best.slug !== currentSlug ? best.slug : null;
}

export function categoryScopeInstruction(
  slug: string,
  label: string,
): string {
  const keywords = CATEGORY_KEYWORDS[slug as HoroscopeCategorySlug];
  const scope = keywords?.slice(0, 7).join(", ") ?? label;
  return `ขอบเขตคำตอบ: หมวด「${label}」เท่านั้น (เช่น ${scope}) ห้ามตอบแทนหมวดอื่น หากคำถามหลุดขอบเขตให้บอกผู้ใช้เลือกหมวดที่ตรงก่อน`;
}
