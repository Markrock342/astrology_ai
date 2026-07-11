import type { PrismaClient } from "@prisma/client";

/** Demo prompts + knowledge for AI chat (editable in Admin CMS). */
export async function seedAiContent(prisma: PrismaClient) {
  const system = await prisma.promptTemplate.upsert({
    where: { code: "system.default" },
    update: {
      content:
        "ให้คำแนะนำเชิงบวก ไม่ทำนายแบบฟันธงหรือสร้างความกลัว " +
        "ไม่แทนคำปรึกษาทางการแพทย์ การเงิน กฎหมาย หรือการตัดสินใจสำคัญในชีวิต " +
        "ถ้าข้อมูลดวงไม่ครบ ให้บอกตรง ๆ ว่าอ้างอิงได้แค่ส่วนที่มี",
    },
    create: {
      code: "system.default",
      name: "กฎความปลอดภัย (System)",
      type: "SYSTEM",
      content:
        "ให้คำแนะนำเชิงบวก ไม่ทำนายแบบฟันธงหรือสร้างความกลัว " +
        "ไม่แทนคำปรึกษาทางการแพทย์ การเงิน กฎหมาย หรือการตัดสินใจสำคัญในชีวิต " +
        "ถ้าข้อมูลดวงไม่ครบ ให้บอกตรง ๆ ว่าอ้างอิงได้แค่ส่วนที่มี",
      version: 1,
    },
  });

  const persona = await prisma.promptTemplate.upsert({
    where: { code: "persona.default" },
    update: {
      content:
        "คุณคือแม่หมอผู้ให้คำปรึกษาด้านโหราศาสตร์ไทย (สุริยยาตร์) พูดจาอบอุ่น สุภาพ น่าเชื่อถือ " +
        "อ้างอิงตำแหน่งดาวและลัคนาจากพื้นดวงที่ระบบให้มา — ห้ามแต่งดาวหรือราศีเอง " +
        "ไม่พูดว่าตนเป็น AI ไม่สร้างความกลัว ไม่ฟันธงเรื่องชีวิตและความตาย",
    },
    create: {
      code: "persona.default",
      name: "แม่หมอ (Default Persona)",
      type: "PERSONA",
      content:
        "คุณคือแม่หมอผู้ให้คำปรึกษาด้านโหราศาสตร์ไทย (สุริยยาตร์) พูดจาอบอุ่น สุภาพ น่าเชื่อถือ " +
        "อ้างอิงตำแหน่งดาวและลัคนาจากพื้นดวงที่ระบบให้มา — ห้ามแต่งดาวหรือราศีเอง " +
        "ไม่พูดว่าตนเป็น AI ไม่สร้างความกลัว ไม่ฟันธงเรื่องชีวิตและความตาย",
      version: 1,
    },
  });

  await prisma.promptTemplate.upsert({
    where: { code: "format.default" },
    update: {},
    create: {
      code: "format.default",
      name: "รูปแบบคำตอบ",
      type: "FORMAT",
      content:
        "ตอบเป็นภาษาไทย สุภาพ อ่านง่าย 2–4 ย่อหน้าสั้น " +
        "เริ่มด้วยภาพรวม แล้วอธิบายจากดาว/ลัคนาที่เกี่ยวข้องกับคำถาม " +
        "ปิดท้ายด้วยข้อคิดหรือคำแนะนำเชิงบวก 1–2 ประโยค ไม่ใช้ markdown หัวข้อ #",
      version: 1,
    },
  });

  const globalDocs = [
    {
      title: "หลักการโหรไทย (Demo)",
      sortOrder: 1,
      content:
        "ระบบใช้หลักโหรไทยสุริยยาตร์ (สุรยยาต) อายนางศ์ลาหิรี " +
        "คำนวณลัคนาแบบอันโตนาถีสำรับ (ปรับเวลาเกิดเทียบอาทิตย์อุทัย) " +
        "ราหูใช้กฎ 8 ราศีจากมฤตยู ทักษานับจากกลางลัคนา " +
        "คำทำนายมีไว้เพื่อการไตร่ตรอง ไม่ใช่คำสั่งขั้นสุดท้าย",
    },
    {
      title: "วิธีอ่านดาว 10 ดวง",
      sortOrder: 2,
      content:
        "อาทิตย์ = ตัวตน เกียรติ บิดา · จันทร์ = จิตใจ แม่ ครอบครัว · อังคาร = ความกล้า การต่อสู้ " +
        "พุธ = การสื่อสาร การเรียน · พฤหัส = โชค ครู ความรู้ · ศุกร์ = ความรัก ศิลปะ เงิน " +
        "เสาร์ = ความอดทน อุปสรรค · รahu/เกตุ = กรรม จุดเปลี่ยน · มฤตยู = การเปลี่ยนแปลงใหญ่",
    },
    {
      title: "ข้อจำกัด Demo (ยังไม่มี engine เต็ม)",
      sortOrder: 99,
      content:
        "ถ้าผู้ใช้ถามเรื่องดวงจร (Transit) หรือตารางทักษา/ตรีวัยแบบละเอียด " +
        "ให้ตอบว่าฟีเจอร์นั้นกำลังพัฒนา และให้คำแนะนำจากพื้นดวงเดิมที่มีแทน",
    },
  ];

  for (const doc of globalDocs) {
    await prisma.knowledgeDoc.upsert({
      where: { id: `seed-knowledge-global-${doc.sortOrder}` },
      update: { title: doc.title, content: doc.content, sortOrder: doc.sortOrder },
      create: {
        id: `seed-knowledge-global-${doc.sortOrder}`,
        title: doc.title,
        content: doc.content,
        sortOrder: doc.sortOrder,
        categoryId: null,
        enabled: true,
      },
    });
  }

  const categories = await prisma.horoscopeCategory.findMany();
  const categoryKnowledge: Record<string, { title: string; content: string }> = {
    self: {
      title: "หมวดตัวตน — แนวทางตอบ",
      content:
        "เน้นลัคนา อาทิตย์ จันทร์ และดาวในเรือน 1 " +
        "พูดถึงบุคลิก จุดแข็ง จุดที่ควรระวัง ไม่ตัดสินค่าคนด้วยดาวเดียว",
    },
    career: {
      title: "หมวดการงาน — แนวทางตอบ",
      content:
        "ดูอาทิตย์ เสาร์ รahu เรือน 10 และเรือน 6 " +
        "แนะนำทิศทางอาชีพ จังหวะเปลี่ยนงาน ความอดทน ไม่รับประกันตำแหน่งหรือเงินเดือน",
    },
    finance: {
      title: "หมวดการเงิน — แนวทางตอบ",
      content:
        "ดูเรือน 2 11 ศุกร์ พฤหัส เสาร์ " +
        "พูดเรื่องวินัยการเงิน โอกาส ความเสี่ยง ไม่แนะนำการลงทุนเฉพาะเจาะจง",
    },
    love: {
      title: "หมวดความรัก — แนวทางตอบ",
      content:
        "ดูเรือน 7 ศุกร์ จันทร์ อังคาร " +
        "เน้นการสื่อสาร ความเข้าใจ ไม่ฟันธงแต่ง/หย่า",
    },
    health: {
      title: "หมวดสุขภาพ — แนวทางตอบ",
      content:
        "ดูเรือน 6 8 อาทิตย์ จันทร์ เสาร์ " +
        "แนะนำดูแลตัวเอง ลดความเครียด ไม่วินิจฉัยโรค ไม่แทนแพทย์",
    },
    fortune: {
      title: "หมวดโชคลาภ — แนวทางตอบ",
      content:
        "ดูเรือน 9 11 อาทิตย์ พฤหัส ศุกร์ " +
        "พูดเรื่องจังหวะ โอกาส ความกตัญญู ไม่รับประกันหวยหรือเลขนำโชค",
    },
    overview: {
      title: "หมวดภาพรวมชีวิต — แนวทางตอบ",
      content:
        "สรุปลัคนาและดาวสำคัญหลายเรือน ให้ภาพใหญ่ของช่วงชีวิต " +
        "เชื่อมหลายด้านเข้าด้วยกันอย่างสมดุล",
    },
  };

  for (const cat of categories) {
    const k = categoryKnowledge[cat.slug];
    if (!k) continue;
    await prisma.knowledgeDoc.upsert({
      where: { id: `seed-knowledge-cat-${cat.slug}` },
      update: { title: k.title, content: k.content, categoryId: cat.id },
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
