import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Seeds baseline data (spec 18): categories, Free + Pro packages, prompt
 * templates, one Gemini config (env-referenced key), and an admin user.
 *
 * All values here are editable defaults — the client will confirm final
 * categories, Free/Pro split, quotas and pricing (see README Open Questions).
 */

const CATEGORIES = [
  {
    slug: "self",
    nameTh: "ตัวตน",
    accessLevel: "FREE",
    sortOrder: 1,
    icon: "user",
    suggestedQuestions: ["จุดแข็งของฉันคืออะไร", "ฉันควรพัฒนาตัวเองด้านไหน", "บุคลิกที่แท้จริงของฉันเป็นอย่างไร"],
  },
  {
    slug: "career",
    nameTh: "การงาน",
    accessLevel: "FREE",
    sortOrder: 2,
    icon: "briefcase",
    suggestedQuestions: ["งานสายไหนเหมาะกับฉัน", "ช่วงนี้ควรเปลี่ยนงานไหม", "โอกาสก้าวหน้าในงานเป็นอย่างไร"],
  },
  {
    slug: "finance",
    nameTh: "การเงิน",
    accessLevel: "PRO",
    sortOrder: 3,
    icon: "coins",
    suggestedQuestions: ["การเงินช่วงนี้เป็นอย่างไร", "ควรลงทุนหรือเก็บออม", "มีเกณฑ์รายได้เพิ่มไหม"],
  },
  {
    slug: "love",
    nameTh: "ความรัก",
    accessLevel: "PRO",
    sortOrder: 4,
    icon: "heart",
    suggestedQuestions: ["ความรักช่วงนี้เป็นอย่างไร", "เนื้อคู่ของฉันเป็นคนแบบไหน", "ความสัมพันธ์ปัจจุบันจะไปได้ดีไหม"],
  },
  {
    slug: "health",
    nameTh: "สุขภาพ",
    accessLevel: "PRO",
    sortOrder: 5,
    icon: "heart-pulse",
    suggestedQuestions: ["สุขภาพช่วงนี้ต้องระวังอะไร", "ควรดูแลตัวเองด้านไหนเป็นพิเศษ"],
  },
  {
    slug: "fortune",
    nameTh: "โชคลาภ",
    accessLevel: "PRO",
    sortOrder: 6,
    icon: "sparkles",
    suggestedQuestions: ["ช่วงนี้มีเกณฑ์โชคลาภไหม", "เลขนำโชคของฉันคืออะไร", "วันไหนเป็นวันมงคลของฉัน"],
  },
  {
    slug: "overview",
    nameTh: "ภาพรวมชีวิต",
    accessLevel: "PRO",
    sortOrder: 7,
    icon: "compass",
    suggestedQuestions: ["ภาพรวมชีวิตปีนี้เป็นอย่างไร", "ช่วงนี้ควรโฟกัสเรื่องใด"],
  },
] as const;

async function main() {
  // ---- Prompt templates ----
  const persona = await prisma.promptTemplate.upsert({
    where: { code: "persona.default" },
    update: {},
    create: {
      code: "persona.default",
      name: "แม่หมอ (Default Persona)",
      type: "PERSONA",
      content:
        "คุณคือแม่หมอผู้ให้คำปรึกษาด้านโหราศาสตร์ พูดจาอบอุ่น สุภาพ น่าเชื่อถือ " +
        "ไม่ทำนายแบบฟันธง ไม่สร้างความกลัว และไม่พูดว่าตนเองเป็น AI",
      version: 1,
    },
  });

  // ---- Packages ----
  const freePkg = await prisma.package.upsert({
    where: { code: "FREE" },
    update: {},
    create: {
      code: "FREE",
      name: "Free",
      type: "FREE",
      price: 0,
      creditQuota: 3,
      dailyLimit: 3,
      description: "ทดลองใช้งานฟรี เข้าถึงหมวดพื้นฐาน",
    },
  });

  await prisma.package.upsert({
    where: { code: "PRO" },
    update: {},
    create: {
      code: "PRO",
      name: "Pro",
      type: "PRO",
      price: 199,
      billingLabel: "ต่อเดือน",
      creditQuota: 100,
      monthlyLimit: 100,
      description: "ปลดล็อกทุกหมวดหมู่ พร้อมคำอ่านแบบละเอียด",
    },
  });

  // ---- Gemini AI config (key referenced by env NAME only) ----
  await prisma.aIProviderConfig.upsert({
    where: { id: "seed-gemini-default" },
    update: {},
    create: {
      id: "seed-gemini-default",
      provider: "GEMINI",
      modelId: "gemini-2.5-flash",
      displayName: "Gemini 2.5 Flash (free-tier default)",
      secretReference: "GEMINI_API_KEY",
      planScope: "ALL",
      promptTemplateId: persona.id,
      versionLabel: "v1",
      notes: "Seed default. Model id is editable from Admin CMS.",
    },
  });

  // ---- Categories ----
  for (const c of CATEGORIES) {
    await prisma.horoscopeCategory.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        slug: c.slug,
        nameTh: c.nameTh,
        icon: c.icon,
        accessLevel: c.accessLevel,
        creditCost: 1,
        sortOrder: c.sortOrder,
        suggestedQuestions: [...c.suggestedQuestions],
        promptTemplateId: persona.id,
      },
    });
  }

  // ---- Admin user + wallet + default Free subscription ----
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@horasard.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "SUPER_ADMIN" },
    create: {
      email: adminEmail,
      name: "Admin",
      role: "SUPER_ADMIN",
      passwordHash,
    },
  });

  await prisma.creditWallet.upsert({
    where: { userId: admin.id },
    update: {},
    create: { userId: admin.id, balance: freePkg.creditQuota },
  });

  console.log(`✅ Seed complete. Admin: ${adminEmail}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
