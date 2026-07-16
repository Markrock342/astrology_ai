import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedAiContent } from "./seed-ai-content";
import { seedCmsDefaults } from "./seed-cms-defaults";

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
  // Prompts + knowledge seeded after categories (see seedAiContent).

  // ---- Packages ----
  const freePkg = await prisma.package.upsert({
    where: { code: "FREE" },
    update: {
      features: [
        "เครดิต 3 ครั้ง",
        "หมวดพื้นดวงเดิม (ตัวตน + การงาน)",
        "ดูหมวดได้ — สนทนา AI ต้องอัปเกรด Pro",
      ],
    },
    create: {
      code: "FREE",
      name: "Free",
      type: "FREE",
      price: 0,
      creditQuota: 3,
      dailyLimit: 3,
      description: "ทดลองใช้งานฟรี เข้าถึงหมวดพื้นฐาน",
      features: [
        "เครดิต 3 ครั้ง",
        "หมวดพื้นดวงเดิม (ตัวตน + การงาน)",
        "ดูหมวดได้ — สนทนา AI ต้องอัปเกรด Pro",
      ],
    },
  });

  await prisma.package.upsert({
    where: { code: "PRO" },
    update: {
      features: [
        "เครดิต 100 ครั้ง",
        "ปลดล็อกทุกหมวด + โหมดดวงจร",
        "คำถามแนะนำครบทุกหมวด",
      ],
      upgradeSteps: [
        "โอนเงินตามยอดแพ็กเกจ Pro (199 บาท)",
        "แจ้งหลักฐานการโอนให้แอดมิน",
        "แอดมินตรวจสอบและเปิดสิทธิ์ Pro ให้บัญชีของคุณ",
      ],
    },
    create: {
      code: "PRO",
      name: "Pro",
      type: "PRO",
      price: 199,
      billingLabel: "ต่อเดือน",
      creditQuota: 100,
      monthlyLimit: 100,
      description: "ปลดล็อกทุกหมวดหมู่ พร้อมคำอ่านแบบละเอียด",
      features: [
        "เครดิต 100 ครั้ง",
        "ปลดล็อกทุกหมวด + โหมดดวงจร",
        "คำถามแนะนำครบทุกหมวด",
      ],
      upgradeSteps: [
        "โอนเงินตามยอดแพ็กเกจ Pro (199 บาท)",
        "แจ้งหลักฐานการโอนให้แอดมิน",
        "แอดมินตรวจสอบและเปิดสิทธิ์ Pro ให้บัญชีของคุณ",
      ],
    },
  });

  await prisma.package.upsert({
    where: { code: "CREDIT_TOPUP" },
    update: {
      creditOnly: true,
      features: [
        "เติมเครดิต 50 ครั้ง",
        "สำหรับสมาชิก Pro ที่เครดิตหมด",
        "ไม่เปลี่ยนแพ็กเกจหรือวันหมดอายุ",
      ],
    },
    create: {
      code: "CREDIT_TOPUP",
      name: "เติมเครดิต",
      type: "PRO",
      creditOnly: true,
      price: 99,
      billingLabel: "ครั้งเดียว",
      creditQuota: 50,
      description: "เติมเครดิตเพิ่มสำหรับสมาชิก Pro (ไม่ต่ออายุแพ็กเกจ)",
      features: [
        "เติมเครดิต 50 ครั้ง",
        "สำหรับสมาชิก Pro ที่เครดิตหมด",
        "ไม่เปลี่ยนแพ็กเกจหรือวันหมดอายุ",
      ],
      upgradeSteps: [
        "โอนเงินตามยอดเติมเครดิต (99 บาท)",
        "เลือกแพ็กเกจ \"เติมเครดิต\" ตอนส่งสลิป",
        "แอดมินตรวจสอบและเติมเครดิตให้บัญชีของคุณ",
      ],
    },
  });

  // ---- Gemini AI configs (encrypted key preferred; no env secretReference) ----
  // Free/Pro use different models: Free gets flash-lite, Pro gets 3.5 flash.
  // Both editable from Admin CMS (/admin/ai-configs).
  const geminiPlain = process.env.GEMINI_API_KEY?.trim();
  const canEncryptAiKey =
    Boolean(geminiPlain) &&
    Boolean(process.env.AI_SECRET_ENC_KEY?.trim());
  let seedSecretFields:
    | { encryptedApiKey: string; keyLast4: string; secretReference: null }
    | { encryptedApiKey?: undefined; keyLast4?: undefined; secretReference: null } = {
    secretReference: null,
  };
  if (canEncryptAiKey && geminiPlain) {
    const { encryptSecret, last4 } = await import("../src/lib/crypto/secret-box");
    seedSecretFields = {
      encryptedApiKey: encryptSecret(geminiPlain),
      keyLast4: last4(geminiPlain),
      secretReference: null,
    };
  } else {
    console.warn(
      "[seed] GEMINI_API_KEY or AI_SECRET_ENC_KEY missing — AI configs created without stored key; paste key in Admin → โมเดล AI",
    );
  }

  await prisma.aIProviderConfig.upsert({
    where: { id: "seed-gemini-default" },
    update: {
      modelId: "gemini-3.1-flash-lite",
      displayName: "Gemini 3.1 Flash Lite (fallback ทุกแพลน)",
      planScope: "ALL",
      secretReference: null,
      ...(seedSecretFields.encryptedApiKey
        ? {
            encryptedApiKey: seedSecretFields.encryptedApiKey,
            keyLast4: seedSecretFields.keyLast4,
          }
        : {}),
    },
    create: {
      id: "seed-gemini-default",
      provider: "GEMINI",
      modelId: "gemini-3.1-flash-lite",
      displayName: "Gemini 3.1 Flash Lite (fallback ทุกแพลน)",
      planScope: "ALL",
      promptTemplateId: undefined,
      versionLabel: "v1",
      notes: "Seed default. Model id is editable from Admin CMS.",
      ...seedSecretFields,
    },
  });

  await prisma.aIProviderConfig.upsert({
    where: { id: "seed-gemini-free" },
    update: {
      modelId: "gemini-3.1-flash-lite",
      displayName: "Free — Gemini 3.1 Flash Lite (ประหยัด)",
      planScope: "FREE",
      secretReference: null,
      ...(seedSecretFields.encryptedApiKey
        ? {
            encryptedApiKey: seedSecretFields.encryptedApiKey,
            keyLast4: seedSecretFields.keyLast4,
          }
        : {}),
    },
    create: {
      id: "seed-gemini-free",
      provider: "GEMINI",
      modelId: "gemini-3.1-flash-lite",
      displayName: "Free — Gemini 3.1 Flash Lite (ประหยัด)",
      planScope: "FREE",
      maxOutputTokens: 1024,
      fallbackConfigId: "seed-gemini-default",
      promptTemplateId: undefined,
      versionLabel: "v1",
      notes: "Free users: cheaper model, shorter answers.",
      ...seedSecretFields,
    },
  });

  await prisma.aIProviderConfig.upsert({
    where: { id: "seed-gemini-pro" },
    update: {
      modelId: "gemini-3.5-flash",
      displayName: "Pro — Gemini 3.5 Flash (ละเอียด)",
      planScope: "PRO",
      secretReference: null,
      ...(seedSecretFields.encryptedApiKey
        ? {
            encryptedApiKey: seedSecretFields.encryptedApiKey,
            keyLast4: seedSecretFields.keyLast4,
          }
        : {}),
    },
    create: {
      id: "seed-gemini-pro",
      provider: "GEMINI",
      modelId: "gemini-3.5-flash",
      displayName: "Pro — Gemini 3.5 Flash (ละเอียด)",
      planScope: "PRO",
      maxOutputTokens: 4096,
      fallbackConfigId: "seed-gemini-default",
      promptTemplateId: undefined,
      versionLabel: "v1",
      notes: "Pro users: fuller model, longer answers.",
      ...seedSecretFields,
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
        promptTemplateId: undefined,
      },
    });
  }

  const { persona } = await seedAiContent(prisma);
  await seedCmsDefaults(prisma);
  await prisma.aIProviderConfig.updateMany({
    data: { promptTemplateId: persona.id },
  });

  // ---- Admin user + wallet + default Free subscription ----
  const WEAK_ADMIN_PASSWORDS = new Set(["ChangeMe123!", "changeme", "password", "admin"]);
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@horasard.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 12) {
    throw new Error(
      "SEED_ADMIN_PASSWORD is required (min 12 chars). Refusing to seed a weak/missing admin password.",
    );
  }
  if (WEAK_ADMIN_PASSWORDS.has(adminPassword)) {
    throw new Error(
      "SEED_ADMIN_PASSWORD matches a known published default. Set a unique strong password before seeding.",
    );
  }
  const passwordHash = await bcrypt.hash(adminPassword, 12);

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
