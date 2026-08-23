import { z } from "zod";

/** Bump when question ids or option values change incompatibly. */
export const INTAKE_VERSION = 2;

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
  selection: "single" | "multiple";
  /** Values such as "none" cannot be combined with another answer. */
  exclusiveValues?: string[];
  options: IntakeOption[];
};

export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  {
    id: "focus",
    category: "overview",
    selection: "multiple",
    prompt: "ตอนนี้โฟกัสชีวิตเรื่องไหนเป็นหลัก",
    options: [
      { value: "career", label: "การงาน" },
      { value: "money", label: "การเงิน" },
      { value: "love", label: "ความรัก" },
      { value: "health", label: "สุขภาพ" },
      { value: "self", label: "พัฒนาตัวเอง" },
    ],
  },
  {
    id: "work",
    category: "career",
    selection: "multiple",
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
    selection: "multiple",
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
    selection: "single",
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
    selection: "multiple",
    exclusiveValues: ["none"],
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
    selection: "single",
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
    selection: "multiple",
    exclusiveValues: ["unsure"],
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
    selection: "multiple",
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
    selection: "multiple",
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
    selection: "multiple",
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

function multipleFromOptions(
  options: IntakeOption[],
  exclusiveValues: string[] = [],
  legacy?: (value: string) => string[],
) {
  const optionEnum = enumFromOptions(options);
  return z.preprocess(
    (value) => {
      if (typeof value === "string") return legacy?.(value) ?? [value];
      return value;
    },
    z
      .array(optionEnum)
      .min(1)
      .max(options.length)
      .refine((values) => new Set(values).size === values.length, {
        message: "เลือกคำตอบเดิมซ้ำไม่ได้",
      })
      .refine(
        (values) =>
          values.length === 1 ||
          !values.some((value) => exclusiveValues.includes(value)),
        { message: "คำตอบนี้เลือกพร้อมตัวเลือกอื่นไม่ได้" },
      ),
  );
}

const question = (id: IntakeQuestionId) =>
  INTAKE_QUESTIONS.find((item) => item.id === id)!;

export const intakeAnswersSchema = z.object({
  focus: multipleFromOptions(question("focus").options, [], (value) =>
    value === "mixed"
      ? ["career", "money", "love", "health", "self"]
      : [value],
  ),
  work: multipleFromOptions(question("work").options),
  finance: multipleFromOptions(question("finance").options),
  love: enumFromOptions(question("love").options),
  health: multipleFromOptions(
    question("health").options,
    question("health").exclusiveValues,
  ),
  fortune: enumFromOptions(question("fortune").options),
  strength: multipleFromOptions(
    question("strength").options,
    question("strength").exclusiveValues,
  ),
  improve: multipleFromOptions(question("improve").options),
  goal: multipleFromOptions(question("goal").options),
  style: multipleFromOptions(question("style").options),
});

export type IntakeAnswers = z.infer<typeof intakeAnswersSchema>;

export const upsertIntakeSchema = z.object({
  answers: intakeAnswersSchema,
});

function labelFor(question: IntakeQuestion, value: string | string[]): string {
  const values = Array.isArray(value) ? value : [value];
  return values
    .map(
      (answer) =>
        question.options.find((option) => option.value === answer)?.label ??
        answer,
    )
    .join(" · ");
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
    "ปิดท้ายสั้น ๆ ว่าหากอยากถามต่อหรือเจาะประเด็น ให้เปิดดวงจร",
    "ห้ามชวนให้พิมพ์ถามต่อในหมวดนี้",
  ].join("\n");
}

export const CATEGORY_INTRO_SYSTEM_HINT =
  "งานครั้งนี้คือบทสรุปหมวดทันทีจากพื้นดวงและแบบสำรวจ ไม่ใช่การตอบคำถามแชท " +
  "อย่าชวนให้พิมพ์ถามต่อในหมวดนี้ ปิดท้ายให้เปิดดวงจรหากต้องการถามต่อ";
