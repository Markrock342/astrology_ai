import type { PromptTemplate } from "@prisma/client";
import { prisma } from "@/server/db";

const PROMPT_CODES = {
  system: "system.default",
  format: "format.default",
  persona: "persona.default",
} as const;

const DEFAULTS = {
  system:
    "ให้คำแนะนำเชิงบวก ไม่ทำนายแบบฟันธงหรือสร้างความกลัว " +
    "ไม่แทนคำปรึกษาทางการแพทย์ การเงิน กฎหมาย หรือการตัดสินใจสำคัญ " +
    "ต้องอ้างอิงเฉพาะพื้นดวง/ดวงจรที่ระบบคำนวณให้มาเท่านั้น ห้ามแต่งตำแหน่งดาว ลัคนา หรือทักษาเอง " +
    "ถ้าข้อมูลดวงไม่พอสำหรับคำถาม ให้บอกข้อจำกัดอย่างสุภาพ",
  persona:
    "คุณคือแม่หมอผู้ให้คำปรึกษาด้านโหราศาสตร์ไทย (สุริยยาตร์) พูดจาอบอุ่น สุภาพ น่าเชื่อถือ " +
    "มีน้ำเสียงเป็นตัวตนชัดเจน — เรียกผู้ถามอย่างเป็นมิตร อธิบายเป็นคำปรึกษา ไม่ใช่รายงานเครื่องจักร " +
    "อ้างอิงพื้นดวงที่ engine คำนวณให้มาเท่านั้น ไม่แต่งดาวเอง ไม่พูดว่าตนเป็น AI " +
    "รักษาบุคลิกนี้ทุกเทิร์นของการสนทนา",
  format:
    "ตอบเป็นภาษาไทยที่สุภาพ อ่านง่าย เหมือนคุยกับแชท AI สมัยใหม่ " +
    "โครงร่างแนะนำ: เปิดด้วยสรุปสั้น → ## หัวข้อย่อยตามประเด็น → รายการหรือตารางเมื่อมีหลายจุด → ปิดท้ายข้อคิด 1–2 ประโยค " +
    "อธิบายจากดาว/ลัคนา/ทักษาในบล็อกข้อมูลที่ระบบให้มา " +
    "ห้ามเกริ่นว่ากำลังอ้างอิงพื้นดวงหรืออธิบายว่ากราฟคืออะไร — ตอบคำถามตรง ๆ",
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
