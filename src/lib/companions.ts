import { z } from "zod";
import { resolveForeignPlace } from "@/lib/foreign-places";

/**
 * Another person read alongside the user in one question — a partner, a
 * parent, a child. Their birth data travels with the message and is used to
 * compute their chart for that answer; it is not stored on the server. The
 * browser keeps the people a user has added so they can be picked again.
 */
export const COMPANION_RELATIONS = [
  "partner",
  "spouse",
  "father",
  "mother",
  "child",
  "sibling",
  "friend",
  "business",
  "other",
] as const;

export type CompanionRelation = (typeof COMPANION_RELATIONS)[number];

export const COMPANION_RELATION_LABEL: Record<CompanionRelation, string> = {
  partner: "แฟน",
  spouse: "คู่สมรส",
  father: "พ่อ",
  mother: "แม่",
  child: "ลูก",
  sibling: "พี่น้อง",
  friend: "เพื่อน",
  business: "หุ้นส่วน",
  other: "คนอื่น",
};

/**
 * The houses of the USER's chart that a relationship is read from:
 * ปัตนิ 7 and ปุตตะ 5 for love, พันธุ 4 for mother and home, ศุภะ 9 for father
 * and elders, สหัชชะ 3 for siblings, ลาภะ 11 for friends and gains.
 */
export const RELATION_HOUSES: Record<CompanionRelation, number[]> = {
  partner: [7, 5],
  spouse: [7, 5, 4],
  father: [9, 4],
  mother: [4, 9],
  child: [5],
  sibling: [3],
  friend: [11, 3],
  business: [7, 11],
  other: [7, 11],
};

export const MAX_COMPANIONS = 3;

export const companionSchema = z.object({
  nickname: z.string().trim().min(1).max(40),
  relation: z.enum(COMPANION_RELATIONS),
  /** Gregorian YYYY-MM-DD. */
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** HH:MM, or null when unknown — then lagna and houses are not used. */
  birthTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  country: z.string().trim().min(1).max(60).default("ไทย"),
  province: z.string().trim().min(1).max(80),
  district: z.string().trim().max(80).default(""),
}).refine(
  (c) => c.country === "ไทย" || resolveForeignPlace(c.country, c.province, c.district) !== null,
  { message: "ระบบยังไม่รู้จักสถานที่เกิดนี้ — พิมพ์ชื่อเมืองใหญ่ที่ใกล้ที่สุดเป็นภาษาอังกฤษ", path: ["district"] },
);

export type Companion = z.infer<typeof companionSchema>;

export const companionsSchema = z.array(companionSchema).max(MAX_COMPANIONS);

/** Question wording that asks about someone else, for a nudge to add them. */
export const COMPANION_QUESTION_PATTERN =
  /สมพงษ์|ดวงคู่|เข้ากัน|ดวงแฟน|ดวงสามี|ดวงภรรยา|ดวงพ่อ|ดวงแม่|ดวงลูก|คู่กับ|กับแฟน|กับสามี|กับภรรยา/;
