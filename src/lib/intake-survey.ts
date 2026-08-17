import { z } from "zod";

/** Bump when question ids or option values change incompatibly. */
export const INTAKE_VERSION = 1;

export const CATEGORY_INTRO_PREFIX = "[[category-intro]]";

export type IntakeQuestionId =
  | "focus"
  | "work"
  | "finance"
  | "love"
  | "health"
  | "fortune"
  | "strength"
  | "improve"
  | "goal"
  | "style";

export type IntakeOption = { value: string; label: string };

export type IntakeQuestion = {
  id: IntakeQuestionId;
  prompt: string;
  /** Fortune category this answer mainly informs. */
  category: "overview" | "career" | "finance" | "love" | "health" | "fortune" | "self";
  options: IntakeOption[];
};

export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  {
    id: "focus",
    category: "overview",
    prompt: "ตอนนี้โฟกัสชีวิตเรื่องไหนเป็นหลัก",
    options: [
      { value: "career", label: "การงาน" },
      { value: "money", label: "การเงิน" },
      { value: "love", label: "ความรัก" },
      { value: "health", label: "สุขภาพ" },
      { value: "self", label: "พัฒนาตัวเอง" },
      { value: "mixed", label: "หลายเรื่องพร้อมกัน" },
    ],
  },
  {
    id: "work",
    category: "career",
    prompt: "สถานะการงานตอนนี้",
    options: [
      { value: "employee", label: "ทำงานประจำ" },
      { value: "business", label: "ธุรกิจ / ฟรีแลนซ์" },
      { value: "jobseek", label: "กำลังหางาน" },
      { value: "study", label: "เรียน / สอบ" },
      { value: "pause", label: "พัก / ยังไม่ชัด" },
    ],
  },
  {
    id: "finance",
    category: "finance",
    prompt: "สถานะการเงินตอนนี้",
    options: [
      { value: "tight", label: "ตึงตัว อยากให้คล่อง" },
      { value: "stable", label: "พอใช้ อยากเก็บออม" },
      { value: "grow", label: "อยากขยายรายได้ / ลงทุน" },
      { value: "debt", label: "มีหนี้ที่กังวล" },
    ],
  },
  {
    id: "love",
    category: "love",
    prompt: "สถานะความรัก",
    options: [
      { value: "single", label: "โสด" },
      { value: "dating", label: "มีคนคุย / กำลังเริ่ม" },
      { value: "couple", label: "มีคู่แล้ว" },
      { value: "complicated", label: "ซับซ้อน / เพิ่งจบ" },
    ],
  },
  {
    id: "health",
    category: "health",
    prompt: "สุขภาพที่กังวลเป็นพิเศษมีไหม",
    options: [
      { value: "none", label: "ไม่มีเป็นพิเศษ" },
      { value: "energy", label: "เหนื่อย / พลังงาน" },
      { value: "sleep", label: "นอน / เครียด" },
      { value: "body", label: "ร่างกาย / โรคประจำตัว" },
      { value: "mind", label: "อารมณ์ / ใจ" },
    ],
  },
  {
    id: "fortune",
    category: "fortune",
    prompt: "อยากรู้เรื่องโชคลาภ เลข หรือวันมงคลไหม",
    options: [
      { value: "yes", label: "อยากรู้ประกอบการตัดสินใจ" },
      { value: "mild", label: "รู้เล่น ๆ ก็ได้" },
      { value: "no", label: "ไม่เน้น" },
    ],
  },
  {
    id: "strength",
    category: "self",
    prompt: "จุดแข็งที่ตัวเองรู้สึก",
    options: [
      { value: "persist", label: "อดทน พากเพียร" },
      { value: "people", label: "มนุษยสัมพันธ์" },
      { value: "think", label: "วิเคราะห์ วางแผน" },
      { value: "create", label: "สร้างสรรค์" },
      { value: "unsure", label: "ยังไม่แน่ใจ" },
    ],
  },
  {
    id: "improve",
    category: "self",
    prompt: "สิ่งที่อยากปรับในตัวเอง",
    options: [
      { value: "confidence", label: "ความมั่นใจ" },
      { value: "money_habit", label: "วินัยการเงิน" },
      { value: "relation", label: "ความสัมพันธ์" },
      { value: "health_habit", label: "วินัยสุขภาพ" },
      { value: "direction", label: "ทิศทางชีวิต" },
    ],
  },
  {
    id: "goal",
    category: "overview",
    prompt: "ปีนี้ตั้งเป้าอะไรเป็นหลัก",
    options: [
      { value: "work", label: "งาน / อาชีพ" },
      { value: "money", label: "การเงิน" },
      { value: "love", label: "ความรัก" },
      { value: "health", label: "สุขภาพ" },
      { value: "learn", label: "เรียน / สกิลใหม่" },
    ],
  },
  {
    id: "style",
    category: "overview",
    prompt: "สไตล์คำตอบที่อยากได้",
    options: [
      { value: "short", label: "สั้น กระชับ" },
      { value: "detailed", label: "ละเอียด อธิบายเหตุผล" },
      { value: "direct", label: "ตรง ๆ ไม่เยินยอ" },
    ],
  },
];

function enumFromOptions(options: IntakeOption[]) {
  const values = options.map((o) => o.value) as [string, ...string[]];
  return z.enum(values);
}

export const intakeAnswersSchema = z.object({
  focus: enumFromOptions(INTAKE_QUESTIONS[0]!.options),
  work: enumFromOptions(INTAKE_QUESTIONS[1]!.options),
  finance: enumFromOptions(INTAKE_QUESTIONS[2]!.options),
  love: enumFromOptions(INTAKE_QUESTIONS[3]!.options),
  health: enumFromOptions(INTAKE_QUESTIONS[4]!.options),
  fortune: enumFromOptions(INTAKE_QUESTIONS[5]!.options),
  strength: enumFromOptions(INTAKE_QUESTIONS[6]!.options),
  improve: enumFromOptions(INTAKE_QUESTIONS[7]!.options),
  goal: enumFromOptions(INTAKE_QUESTIONS[8]!.options),
  style: enumFromOptions(INTAKE_QUESTIONS[9]!.options),
});

export type IntakeAnswers = z.infer<typeof intakeAnswersSchema>;

export const upsertIntakeSchema = z.object({
  answers: intakeAnswersSchema,
});

function labelFor(question: IntakeQuestion, value: string): string {
  return question.options.find((o) => o.value === value)?.label ?? value;
}

/** Compact block for the AI user prompt. */
export function formatIntakeForPrompt(answers: IntakeAnswers): string {
  const lines = INTAKE_QUESTIONS.map((q) => {
    const value = answers[q.id];
    return `- ${q.prompt}: ${labelFor(q, value)}`;
  });
  return [
    "[intake] แบบสำรวจตอนสมัคร (ใช้ประกอบการสรุป — ห้ามทวนรายข้อ ห้ามเปิดเผยว่ามีแบบสำรวจในระบบ)",
    ...lines,
  ].join("\n");
}

export function isCategoryIntroQuestion(content: string): boolean {
  return content.trimStart().startsWith(CATEGORY_INTRO_PREFIX);
}

export function buildCategoryIntroQuestion(categoryName: string): string {
  return [
    CATEGORY_INTRO_PREFIX,
    `สรุปพื้นดวงหมวด「${categoryName}」ให้ผู้ใช้ทันทีจาก [natal] [memory] และ [intake]`,
    "เขียนเป็นบทสรุปอ่านรู้เรื่อง ไม่ต้องรอคำถาม",
    "ปิดท้ายสั้น ๆ ว่าหากอยากถามจังหวะช่วงนี้หรือเจาะประเด็น ให้ไปโหมดดวงจร",
    "ห้ามชวนให้พิมพ์ถามต่อในหมวดนี้",
  ].join("\n");
}

export const CATEGORY_INTRO_SYSTEM_HINT =
  "งานครั้งนี้คือบทสรุปหมวดทันทีจากพื้นดวงและแบบสำรวจ ไม่ใช่การตอบคำถามแชท " +
  "อย่าชวนให้พิมพ์ถามต่อในหมวดนี้ ปิดท้ายให้ไปโหมดดวงจรหากอยากถามจังหวะช่วงนี้";
