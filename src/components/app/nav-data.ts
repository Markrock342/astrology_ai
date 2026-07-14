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
    slug: "career",
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
    slug: "fortune",
    label: "โชคลาภ",
    tier: "PRO",
    suggestedQuestions: ["ช่วงนี้ดวงโชคลาภเป็นยังไง", "เลขมงคลของฉัน"],
  },
];

/** Chat history threads. */
export type Thread = {
  id: string;
  title: string;
  categorySlug?: string;
  categoryLabel?: string;
  createdAt?: string;
};

export const MOCK_THREADS: Thread[] = [
  { id: "t1", title: "หัวข้อเราใช้ข้อความเริ่มต้นของการสนทนา" },
  { id: "t2", title: "หัวข้อเราใช้ข้อความเริ่มต้นของการสนทนา" },
  { id: "t3", title: "หัวข้อเราใช้ข้อความเริ่มต้นของการสนทนา" },
];

export function findCategory(
  slug: string | null,
  categories: Category[] = NATAL_CATEGORIES,
): Category | undefined {
  if (!slug) return undefined;
  return categories.find((c) => c.slug === slug);
}

/** Built-in fallback questions per slug — used when the API row has none. */
const DEFAULT_SUGGESTIONS: Record<string, string[]> = Object.fromEntries(
  NATAL_CATEGORIES.map((c) => [c.slug, c.suggestedQuestions]),
);

/** Generic starters for any category the fallback map doesn't cover. */
const GENERIC_SUGGESTIONS = [
  "ช่วงนี้ดวงเป็นยังไงบ้าง",
  "มีอะไรที่ควรระวังไหม",
  "ช่วงนี้ควรโฟกัสเรื่องอะไร",
];

/**
 * Map API category row → UI Category.
 * The DB rows often ship without `suggestedQuestions`, which left the empty
 * chat with no starter chips ("ไม่มี preset ให้พิมอะไร"). Fall back to the
 * per-slug defaults, then a generic set, so there is always something to tap.
 */
export function mapApiCategory(c: {
  slug: string;
  nameTh: string;
  accessLevel: string;
  suggestedQuestions?: string[];
}): Category {
  const suggested =
    c.suggestedQuestions && c.suggestedQuestions.length > 0
      ? c.suggestedQuestions
      : (DEFAULT_SUGGESTIONS[c.slug] ?? GENERIC_SUGGESTIONS);
  return {
    slug: c.slug,
    label: c.nameTh,
    tier: c.accessLevel === "PRO" ? "PRO" : "FREE",
    suggestedQuestions: suggested,
  };
}

/** Mock user shown in the bottom bar / settings. */
export const MOCK_USER = {
  name: "Username",
  tier: "FREE" as Tier,
  birthEditCount: 0, // used → x/1
};
