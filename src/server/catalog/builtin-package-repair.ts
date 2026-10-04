import { prisma } from "@/server/db";

/**
 * Put the built-in packages back to the type they are defined as.
 *
 * Until 4 Oct 2026 saving a package in the admin form turned it into FREE
 * (Zod 4's `.partial()` filled the create schema's `type: "FREE"` default for
 * the field the form does not send — see partialNoDefaults). Saving PRO made
 * every Pro subscriber Free; saving CREDIT_TOPUP made it grant Pro. Rows
 * already flipped are repaired once per server instance, before plans are read.
 */
let repaired: Promise<void> | null = null;

export function repairBuiltInPackages(): Promise<void> {
  repaired ??= (async () => {
    const pro = await prisma.package.updateMany({
      where: { code: "PRO", type: { not: "PRO" } },
      data: { type: "PRO" },
    });
    const topUp = await prisma.package.updateMany({
      where: { code: "CREDIT_TOPUP", OR: [{ type: { not: "PRO" } }, { creditOnly: false }] },
      data: { type: "PRO", creditOnly: true },
    });
    if (pro.count || topUp.count) {
      console.warn(`[packages] repaired built-in rows: PRO ${pro.count}, CREDIT_TOPUP ${topUp.count}`);
    }
  })().catch((err) => {
    repaired = null;
    console.warn("[packages] repair failed:", err instanceof Error ? err.message : err);
  });
  return repaired;
}
