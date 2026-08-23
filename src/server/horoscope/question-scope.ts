import { AppError } from "@/lib/errors";
import { detectQuestionScopeMismatch } from "@/lib/question-scope";
import { prisma } from "@/server/db";

export async function assertQuestionWithinCategory(input: {
  currentSlug: string;
  question: string;
}) {
  const targetSlug = detectQuestionScopeMismatch(
    input.question,
    input.currentSlug,
  );
  if (!targetSlug) return;

  const target = await prisma.horoscopeCategory.findUnique({
    where: { slug: targetSlug },
    select: { slug: true, nameTh: true, accessLevel: true, enabled: true },
  });
  if (!target?.enabled) return;

  throw new AppError(
    "CATEGORY_SCOPE_MISMATCH",
    `คำถามนี้อยู่ในหมวด「${target.nameTh}」 กรุณาเปิดหมวดนั้นเพื่อใช้สิทธิ์ที่ถูกต้อง`,
    {
      targetSlug: target.slug,
      targetLabel: target.nameTh,
      requiresPro: target.accessLevel === "PRO",
    },
  );
}
