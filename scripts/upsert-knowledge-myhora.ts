/**
 * Upsert the myhora-style knowledge corpus into DATABASE_URL.
 *
 *   npm run knowledge:upsert
 *
 * Makes kb-global-* + seed-knowledge-cat-* the sole enabled doctrine set
 * (disables overlapping CMS/demo rows so the 24k prompt budget isn't wasted).
 */
import { PrismaClient } from "@prisma/client";
import {
  KNOWLEDGE_IDS_TO_DISABLE,
  MYHORA_STYLE_CATEGORY_DOCS,
  MYHORA_STYLE_GLOBAL_DOCS,
} from "../prisma/seed-knowledge-myhora";

const prisma = new PrismaClient();

const CANONICAL_GLOBAL_IDS = new Set(MYHORA_STYLE_GLOBAL_DOCS.map((d) => d.id));

async function main() {
  for (const oldId of KNOWLEDGE_IDS_TO_DISABLE) {
    await prisma.knowledgeDoc.updateMany({
      where: { id: oldId },
      data: { enabled: false },
    });
  }

  // Disable non-canonical enabled globals (older CMS uploads that overlap).
  const otherGlobals = await prisma.knowledgeDoc.findMany({
    where: { categoryId: null, enabled: true },
    select: { id: true, title: true },
  });
  for (const row of otherGlobals) {
    if (CANONICAL_GLOBAL_IDS.has(row.id)) continue;
    await prisma.knowledgeDoc.update({
      where: { id: row.id },
      data: { enabled: false },
    });
    console.log(`disabled overlapping global · ${row.title}`);
  }

  // Disable non-seed category guides titled หลักอ่านหมวด* (overlap with seed cats).
  const otherCats = await prisma.knowledgeDoc.findMany({
    where: {
      categoryId: { not: null },
      enabled: true,
      NOT: { id: { startsWith: "seed-knowledge-cat-" } },
    },
    select: { id: true, title: true },
  });
  for (const row of otherCats) {
    await prisma.knowledgeDoc.update({
      where: { id: row.id },
      data: { enabled: false },
    });
    console.log(`disabled overlapping cat · ${row.title}`);
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
    console.log(`OK global · ${doc.title} (${doc.content.length} chars)`);
  }

  const categories = await prisma.horoscopeCategory.findMany({
    select: { id: true, slug: true },
  });

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
    console.log(`OK cat:${cat.slug} · ${k.title} (${k.content.length} chars)`);
  }

  const enabled = await prisma.knowledgeDoc.findMany({
    where: { enabled: true },
    select: { id: true, title: true, content: true, categoryId: true, sortOrder: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
  const globalChars = enabled
    .filter((d) => d.categoryId == null)
    .reduce((n, d) => n + d.content.length, 0);
  for (const d of enabled) {
    console.log(
      `  ${d.categoryId ? "CAT" : "GLB"} #${d.sortOrder} ${d.content.length}c · ${d.title}`,
    );
  }
  console.log(
    `\nEnabled: ${enabled.length} · global ≈ ${globalChars} chars (budget 24000)`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
