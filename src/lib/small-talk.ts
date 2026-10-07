/**
 * Messages that are not a question: "เทส", "สวัสดีครับ", "555", "ขอบคุณค่ะ".
 * "เทส" got a full birth-chart reading — and was charged for it.
 */
const PARTICLE = "(?:ครับ|คับ|ค่ะ|คะ|จ้า|จ้ะ|นะ|น้า|ฮะ|อะ|ค้าบ|ครับผม)*";
const SMALL_TALK = new RegExp(
  `^(?:เทส+|เทสต์|เทสๆ|test(?:ing)?|ทดสอบ(?:ระบบ)?|ลอง(?:ดู|พิมพ์|ระบบ)?|hi+|hello|hey|สวัสดี|หวัดดี|ดีจ้า|ดีครับ|ดีค่ะ|ok(?:ay)?|โอเค|โอเคร|ได้|ครับ|ค่ะ|อืม+|เออ|อ้อ|5{2,}|ฮ่า+|ฮา+|\\?+|\\.+|!+)${PARTICLE}$`,
  "i",
);
const THANKS = new RegExp(`^(?:ขอบคุณ(?:มาก)?|ขอบใจ|thx|thanks?|thank you|ty)${PARTICLE}$`, "i");

function bare(message: string): string {
  return message
    .trim()
    .toLowerCase()
    .replace(/[\s​]+/g, "")
    .replace(/[😀-🙏🤍-🧿❤️👍🙏✨]/gu, "")
    .replace(/(.)\1{3,}/g, "$1$1$1");
}

export type SmallTalkKind = "greeting" | "thanks";

export function smallTalkKind(message: string): SmallTalkKind | null {
  const m = bare(message);
  if (!m || m.length > 24) return null;
  if (THANKS.test(m)) return "thanks";
  if (SMALL_TALK.test(m)) return "greeting";
  return null;
}

export function smallTalkReply(kind: SmallTalkKind): string {
  if (kind === "thanks") {
    return "ยินดีค่ะ ถ้ามีเรื่องไหนอยากให้แม่หมอดูต่อ พิมพ์คำถามมาได้เลยนะคะ";
  }
  return [
    "แม่หมอพร้อมแล้วค่ะ พิมพ์เรื่องที่อยากรู้มาได้เลย เช่น",
    "- เดือนนี้วันไหนดีที่สุดสำหรับเรื่องงาน",
    "- ความรักปีนี้เป็นยังไง",
    "- นิสัยและจุดแข็งของฉันจากดวงกำเนิด",
    "",
    "*ข้อความนี้ไม่ใช่คำทำนาย และไม่ถูกหักโควตา*",
  ].join("\n");
}
