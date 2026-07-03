import { prisma } from "@/server/db";

/** Enabled categories for the app shell + chat (includes suggested questions). */
export async function listPublicCategories() {
  const rows = await prisma.horoscopeCategory.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      slug: true,
      nameTh: true,
      nameEn: true,
      description: true,
      icon: true,
      accessLevel: true,
      creditCost: true,
      suggestedQuestions: true,
    },
  });

  return rows.map((c) => ({
    ...c,
    suggestedQuestions: Array.isArray(c.suggestedQuestions)
      ? (c.suggestedQuestions as string[])
      : [],
  }));
}
