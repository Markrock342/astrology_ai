/**
 * UI-side navigation/mock data for the app shell + chat.
 *
 * TODO(backend): categories (with Free/Pro tier + suggestedQuestions) come from
 * GET /api/horoscope/categories, and chat threads from GET /api/conversations.
 * This mock keeps the frontend testable until those endpoints exist.
 */

export type Tier = "FREE" | "PRO";

export type Category = {
  slug: string;
  label: string;
  tier: Tier;
  suggestedQuestions: string[];
};

/** พื้นดวงเดิม (natal) categories — matches design 03. */
export const NATAL_CATEGORIES: Category[] = [
  {
    slug: "self",
    label: "ตัวตน",
    tier: "FREE",
    suggestedQuestions: [
      "ช่วงนี้ฉันควรโฟกัสเรื่องอะไร",
      "จุดแข็งของฉันคืออะไร",
      "ฉันเหมาะกับเส้นทางแบบไหน",
    ],
  },
  {
    slug: "work",
    label: "การงาน",
    tier: "FREE",
    suggestedQuestions: [
      "ช่วงนี้ควรเปลี่ยนงานได้ไหม",
      "เนื้องานจะเป็นยังไง",
      "ช่วงไหนดีเรื่องการงาน",
    ],
  },
  {
    slug: "finance",
    label: "การเงิน",
    tier: "PRO",
    suggestedQuestions: ["การเงินช่วงนี้เป็นอย่างไร", "ควรลงทุนหรือเก็บออม"],
  },
  {
    slug: "love",
    label: "ความรัก",
    tier: "PRO",
    suggestedQuestions: ["ความรักช่วงนี้เป็นอย่างไร", "เนื้อคู่ของฉันเป็นแบบไหน"],
  },
  {
    slug: "health",
    label: "สุขภาพ",
    tier: "PRO",
    suggestedQuestions: ["ต้องระวังสุขภาพเรื่องใด", "ช่วงนี้ควรดูแลตัวเองยังไง"],
  },
  {
    slug: "luck",
    label: "โชคลาภ",
    tier: "PRO",
    suggestedQuestions: ["ช่วงนี้ดวงโชคลาภเป็นยังไง", "เลขมงคลของฉัน"],
  },
];

/** Chat history threads (mock). */
export type Thread = { id: string; title: string };

export const MOCK_THREADS: Thread[] = [
  { id: "t1", title: "หัวข้อเราใช้ข้อความเริ่มต้นของการสนทนา" },
  { id: "t2", title: "หัวข้อเราใช้ข้อความเริ่มต้นของการสนทนา" },
  { id: "t3", title: "หัวข้อเราใช้ข้อความเริ่มต้นของการสนทนา" },
];

export function findCategory(slug: string | null): Category | undefined {
  if (!slug) return undefined;
  return NATAL_CATEGORIES.find((c) => c.slug === slug);
}

/** Mock user shown in the bottom bar / settings. */
export const MOCK_USER = {
  name: "Username",
  tier: "FREE" as Tier,
  birthEditCount: 0, // used → x/1
};
