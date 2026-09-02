import { AppError } from "@/lib/errors";
import { detectMentionedCategories } from "@/lib/question-scope";
import { prisma } from "@/server/db";

/**
 * Free users share one chat with Pro. They may ask anything that is not a
 * Pro-only topic; mentioning finance/love/health/fortune/overview forces upgrade.
 * Pro is unrestricted — no "open that category" redirect.
 */
export async function assertQuestionAllowedForPlan(input: {
  plan: "FREE" | "PRO";
  question: string;
}) {
  if (input.plan === "PRO") return;

  const slugs = detectMentionedCategories(input.question);
  if (slugs.length === 0) return;

  const targets = await prisma.horoscopeCategory.findMany({
    where: { slug: { in: slugs }, enabled: true },
    select: { slug: true, nameTh: true, accessLevel: true },
  });
  const locked = targets.find((target) => target.accessLevel === "PRO");
  if (!locked) return;

  throw new AppError(
    "CATEGORY_LOCKED",
    `หมวด「${locked.nameTh}」ใช้ได้ใน Pro — อัปเกรดเพื่อถามเรื่องนี้`,
    {
      targetSlug: locked.slug,
      targetLabel: locked.nameTh,
      requiresPro: true,
    },
  );
}
