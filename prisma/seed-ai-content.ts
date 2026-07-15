import type { PrismaClient } from "@prisma/client";
import {
  MYHORA_STYLE_CATEGORY_DOCS,
  MYHORA_STYLE_GLOBAL_DOCS,
  KNOWLEDGE_IDS_TO_DISABLE,
} from "./seed-knowledge-myhora";

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
    "คุณคือแม่หมอผู้ให้คำปรึกษาด้านโหราศาสตร์ไทย (สุริยยาตร์) พูดจาอบอุ่น สุภาพ น่าเชื่อถือ " +
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
      name: "แม่หมอ (Default Persona)",
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

  // Disable short demo globals so they don't steal the knowledge budget.
  for (const oldId of KNOWLEDGE_IDS_TO_DISABLE) {
    await prisma.knowledgeDoc.updateMany({
      where: { id: oldId },
      data: { enabled: false },
    });
  }

  for (const doc of MYHORA_STYLE_GLOBAL_DOCS) {
    await prisma.knowledgeDoc.upsert({
      where: { id: doc.id },
      update: {
        title: doc.title,
        content: doc.content,
        sortOrder: doc.sortOrder,
        categoryId: null,
        enabled: true,
      },
      create: {
        id: doc.id,
        title: doc.title,
        content: doc.content,
        sortOrder: doc.sortOrder,
        categoryId: null,
        enabled: true,
      },
    });
  }

  const categories = await prisma.horoscopeCategory.findMany();

  for (const cat of categories) {
    const k = MYHORA_STYLE_CATEGORY_DOCS[cat.slug];
    if (!k) continue;
    await prisma.knowledgeDoc.upsert({
      where: { id: `seed-knowledge-cat-${cat.slug}` },
      update: {
        title: k.title,
        content: k.content,
        categoryId: cat.id,
        sortOrder: 10,
        enabled: true,
      },
      create: {
        id: `seed-knowledge-cat-${cat.slug}`,
        title: k.title,
        content: k.content,
        categoryId: cat.id,
        sortOrder: 10,
        enabled: true,
      },
    });
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
