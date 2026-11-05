import type { PrismaClient } from "@prisma/client";
import { seedKnowledgeSafely } from "./seed-knowledge-safe";
import { MYHORA_STYLE_CATEGORY_DOCS } from "./seed-knowledge-myhora";

/** Demo prompts + knowledge for AI chat (editable in Admin CMS). */
export async function seedAiContent(prisma: PrismaClient) {
  const system = await prisma.promptTemplate.upsert({
    where: { code: "system.default" },
    update: {
      content:
        "ให้คำแนะนำเชิงบวก ไม่ทำนายแบบฟันธงหรือสร้างความกลัว " +
        "ไม่แทนคำปรึกษาทางการแพทย์ การเงิน กฎหมาย หรือการตัดสินใจสำคัญในชีวิต " +
        "ต้องอ้างอิงเฉพาะพื้นดวง/ดวงจรที่ระบบคำนวณให้มาเท่านั้น ห้ามแต่งตำแหน่งดาว ลัคนา หรือทักษาเอง " +
        "ห้ามบอกว่า engine หรือระบบคำนวณยังไม่พร้อม/ยังพัฒนา — ถ้ามีตารางดวงใน prompt ให้ตอบจากตารางนั้น " +
        "ถ้าข้อมูลดวงไม่พอสำหรับคำถาม ให้บอกข้อจำกัดอย่างสุภาพ",
    },
    create: {
      code: "system.default",
      name: "กฎความปลอดภัย (System)",
      type: "SYSTEM",
      content:
        "ให้คำแนะนำเชิงบวก ไม่ทำนายแบบฟันธงหรือสร้างความกลัว " +
        "ไม่แทนคำปรึกษาทางการแพทย์ การเงิน กฎหมาย หรือการตัดสินใจสำคัญในชีวิต " +
        "ต้องอ้างอิงเฉพาะพื้นดวง/ดวงจรที่ระบบคำนวณให้มาเท่านั้น ห้ามแต่งตำแหน่งดาว ลัคนา หรือทักษาเอง " +
        "ห้ามบอกว่า engine หรือระบบคำนวณยังไม่พร้อม/ยังพัฒนา — ถ้ามีตารางดวงใน prompt ให้ตอบจากตารางนั้น " +
        "ถ้าข้อมูลดวงไม่พอสำหรับคำถาม ให้บอกข้อจำกัดอย่างสุภาพ",
      version: 1,
    },
  });

  const PERSONA_DEFAULT =
    "คุณคืออาจารย์โหราศาสตร์ผู้ให้คำปรึกษาด้านโหราศาสตร์ไทย (สุริยยาตร์) พูดจาอบอุ่น สุภาพ น่าเชื่อถือ ไม่ระบุเพศ " +
    "มีน้ำเสียงเป็นตัวตนชัดเจน — เรียกผู้ถามอย่างเป็นมิตร อธิบายเป็นคำปรึกษา ไม่ใช่รายงานเครื่องจักร " +
    "อ้างอิงตำแหน่งดาวและลัคนาจากพื้นดวงที่ engine คำนวณให้มาเท่านั้น — ห้ามแต่งดาวหรือราศีเอง " +
    "ไม่พูดว่าตนเป็น AI ไม่สร้างความกลัว ไม่ฟันธงเรื่องชีวิตและความตาย " +
    "ห้ามบอกว่าฟีเจอร์คำนวณดวงยังไม่เปิดหรือยังพัฒนา " +
    "รักษาบุคลิกนี้ทุกเทิร์นของการสนทนา";

  const FORMAT_DEFAULT =
    "ตอบเป็นภาษาไทย สุภาพ อ่านง่าย เหมือนคุยกับแชท AI สมัยใหม่ " +
    "โครงร่างแนะนำ: เปิดด้วยสรุปสั้น → ## หัวข้อย่อยตามประเด็น → รายการหรือตาราง Markdown เมื่อสรุปหลายจุด → ปิดท้ายข้อคิดเชิงบวก 1–2 ประโยค " +
    "เริ่มด้วยภาพรวม แล้วอธิบายจากดาว/ลัคนาที่เกี่ยวข้องกับคำถาม " +
    "ห้ามเกริ่นว่ากำลังอ้างอิงพื้นดวงหรืออธิบายว่ากราฟคืออะไร — ตอบคำถามตรง ๆ " +
    "รักษาบุคลิกจาก persona ตลอดคำตอบ";

  const persona = await prisma.promptTemplate.upsert({
    where: { code: "persona.default" },
    update: { content: PERSONA_DEFAULT },
    create: {
      code: "persona.default",
      name: "อาจารย์โหราศาสตร์ (Default Persona)",
      type: "PERSONA",
      content: PERSONA_DEFAULT,
      version: 1,
    },
  });

  await prisma.promptTemplate.upsert({
    where: { code: "format.default" },
    update: { content: FORMAT_DEFAULT },
    create: {
      code: "format.default",
      name: "รูปแบบคำตอบ",
      type: "FORMAT",
      content: FORMAT_DEFAULT,
      version: 1,
    },
  });

  await seedKnowledgeSafely(prisma, true);

  const categories = await prisma.horoscopeCategory.findMany();
  for (const cat of categories) {
    if (!MYHORA_STYLE_CATEGORY_DOCS[cat.slug]) continue;
    await prisma.horoscopeCategory.update({
      where: { id: cat.id },
      data: {
        promptTemplateId: persona.id,
        description: cat.description ?? `คำปรึกษาหมวด${cat.nameTh} — อ้างอิงพื้นดวงเดิม`,
      },
    });
  }

  return { system, persona };
}
