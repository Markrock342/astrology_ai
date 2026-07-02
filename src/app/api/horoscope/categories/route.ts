import { prisma } from "@/server/db";
import { handle, ok } from "@/lib/http";

/** Public-ish list of enabled categories (spec 5.5 dashboard uses this). */
export async function GET() {
  return handle(async () => {
    const categories = await prisma.horoscopeCategory.findMany({
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
      },
    });
    return ok(categories);
  });
}
