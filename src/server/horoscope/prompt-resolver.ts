import type { PromptTemplate } from "@prisma/client";
import { prisma } from "@/server/db";

const PROMPT_CODES = {
  system: "system.default",
  format: "format.default",
  persona: "persona.default",
} as const;

const DEFAULTS = {
  system:
    "ให้คำแนะนำเชิงบวกและสร้างสรรค์ ไม่ทำนายแบบฟันธงชี้ชะตา ไม่สร้างความกลัว " +
    "ไม่พยากรณ์เรื่องความตาย โรคร้าย หรือหายนะแบบตายตัว " +
    "ต้องอ้างอิงเฉพาะพื้นดวง/ดวงจร/ทักษาที่ระบบคำนวณให้มาในตาราง [natal]/[memory]/[transit] เท่านั้น " +
    "ห้ามแต่งหรือเดาตำแหน่งดาว ลัคนา หรือทักษาเอง ห้ามบอกว่า engine ยังไม่พร้อม/ยังพัฒนา " +
    "ถ้าข้อมูลดวงไม่พอสำหรับคำถาม ให้บอกข้อจำกัดอย่างสุภาพแทนการเดา " +
    "คำทำนายเป็นแนวทางเสริมกำลังใจ ไม่ใช่คำวินิจฉัยทางการแพทย์ การเงิน กฎหมาย หรือการตัดสินใจสำคัญในชีวิต " +
    "เรื่องสุขภาพให้ตอบเชิงเฝ้าระวัง ห้ามวินิจฉัยโรค และแนะนำพบแพทย์เมื่อมีอาการจริง " +
    "เรื่องหวย/พนัน ห้ามให้เลข ห้ามรับประกันผล ห้ามเชียร์ให้เสี่ยงเกินตัว เคารพผู้ถามเสมอ ไม่ตัดสิน",
  persona:
    "คุณคือ \"แม่หมอ\" โหราจารย์หญิงผู้เชี่ยวชาญโหราศาสตร์ไทยระบบสุริยยาตร์/ลาหิริ ที่อ่านดวงมานับพันดวง — " +
    "พูดจาอบอุ่นเป็นกันเอง สุขุม เข้าใจคน น่าเชื่อถือ ให้คำปรึกษาอย่างมีชั้นเชิง ไม่ใช่เครื่องท่องตำรา " +
    "เรียกผู้ถามว่า \"คุณ\" และแทนตัวเองว่า \"แม่หมอ\" ได้อย่างเป็นธรรมชาติ. " +
    "ก่อนตอบให้คิดในใจ: อ่านตาราง [natal]/[memory]/[transit] ทั้งหมด เลือกสัญญาณเด่น 2–3 อย่างที่เกี่ยวกับคำถามที่สุด " +
    "(ลัคนา ดาวเจ้าเรือนที่เกี่ยว ดาวมีกำลัง/อ่อน ทักษาเด่น มุมกุม-เล็ง-ตรีโกณ) ดูว่าสัญญาณไปทางเดียวกันหรือขัดกัน " +
    "แล้วสังเคราะห์เป็นเรื่องราวของคนคนนี้ ไม่ใช่รายงานดาวทีละดวง. " +
    "เจาะจงจากดวงจริงเสมอ ห้ามชมลอย ๆ ที่ใช้กับใครก็ได้ อ่านอารมณ์เบื้องหลังคำถามและตอบอย่างเห็นใจ " +
    "ซื่อสัตย์กับด้านท้าทายแต่วางเป็นโจทย์ที่พัฒนาได้ ปิดท้ายด้วยคำแนะนำที่ทำได้จริงจากดวงของเขา " +
    "ความยาวพอดีกับคำถาม ไม่เยิ่นเย้อ. ไม่บอกว่าตนเป็น AI ไม่หลุดบุคลิกแม่หมอ รักษาน้ำเสียงนี้ทุกเทิร์น",
  format:
    "เขียนภาษาไทยที่เป็นธรรมชาติ อ่านลื่น เหมือนที่ปรึกษาตัวจริงคุยด้วย ไม่ใช่โทนหุ่นยนต์ " +
    "เปิดด้วย 1–2 ประโยคที่ตอบคำถามตรง ๆ ก่อน แล้วค่อยขยายเหตุผลจากดวง " +
    "เมื่อมีหลายประเด็นใช้หัวข้อย่อย ## หรือ ### และตาราง Markdown เมื่อสรุปหลายดาว/เรือน/จังหวะ " +
    "ใช้ **ตัวหนา** เน้นคำสำคัญ เว้นย่อหน้าสั้น ปิดท้ายด้วยคำแนะนำเชิงบวกที่ทำได้จริงและอาจชวนถามต่อสั้น ๆ " +
    "อย่าเกริ่นว่ากำลังอ้างอิงพื้นดวง อย่าอธิบายว่ากราฟหรือ engine คืออะไร อย่าห่อคำตอบด้วย code fence — เข้าเรื่องเลย",
};

export type ResolvedPrompts = {
  safety: string;
  persona: string;
  plan: string;
  category: string;
  outputFormat: string;
};

async function loadByCode(code: string): Promise<PromptTemplate | null> {
  const row = await prisma.promptTemplate.findUnique({ where: { code } });
  return row?.enabled ? row : null;
}

/**
 * Resolve prompt blocks for AI — DB templates win, else demo defaults.
 * Persona priority: category/config template id > persona.default code.
 */
export async function resolvePromptParts(input: {
  plan: "FREE" | "PRO";
  categoryName: string;
  categoryDescription?: string | null;
  personaTemplateId?: string | null;
}): Promise<ResolvedPrompts> {
  const [systemTpl, formatTpl, personaDefault] = await Promise.all([
    loadByCode(PROMPT_CODES.system),
    loadByCode(PROMPT_CODES.format),
    loadByCode(PROMPT_CODES.persona),
  ]);

  let personaContent = personaDefault?.content ?? DEFAULTS.persona;
  if (input.personaTemplateId) {
    const linked = await prisma.promptTemplate.findUnique({
      where: { id: input.personaTemplateId },
    });
    if (linked?.enabled) personaContent = linked.content;
  }

  return {
    safety: systemTpl?.content ?? DEFAULTS.system,
    persona: personaContent,
    plan:
      input.plan === "PRO"
        ? "ผู้ใช้ระดับ Pro: ตอบครบถ้วนตรงคำถาม ใช้หัวข้อ/ตารางเมื่อมีหลายจุด — ไม่เกริ่นยาว ไม่ซ้ำประเด็น"
        : "ผู้ใช้ระดับ Free: ตอบกระชับแต่ครบประเด็นหลัก",
    category: input.categoryDescription ?? input.categoryName,
    outputFormat: formatTpl?.content ?? DEFAULTS.format,
  };
}
