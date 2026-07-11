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
    "ไม่แทนคำปรึกษาทางการแพทย์ การเงิน กฎหมาย หรือการตัดสินใจสำคัญ",
  persona:
    "คุณคือแม่หมอผู้ให้คำปรึกษาด้านโหราศาสตร์ไทย (สุริยยาตร์) พูดจาอบอุ่น สุภาพ น่าเชื่อถือ " +
    "อ้างอิงพื้นดวงที่ให้มา ไม่แต่งดาวเอง ไม่พูดว่าตนเป็น AI",
  format:
    "ตอบเป็นภาษาไทยที่สุภาพ อ่านง่าย แบ่งเป็นย่อหน้าสั้น ๆ " +
    "มีข้อคิดปิดท้าย 1–2 ประโยค ไม่ใช้ markdown หัวข้อใหญ่",
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
        ? "ผู้ใช้ระดับ Pro: ตอบละเอียด อธิบายเหตุผลจากดวงที่ให้มา"
        : "ผู้ใช้ระดับ Free: ตอบกระชับ",
    category: input.categoryDescription ?? input.categoryName,
    outputFormat: formatTpl?.content ?? DEFAULTS.format,
  };
}
