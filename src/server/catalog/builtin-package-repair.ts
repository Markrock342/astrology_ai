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

export function repairBuiltInPackages(opts: { force?: boolean } = {}): Promise<void> {
  if (opts.force) repaired = null;
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
    // Packages with other codes (a Pro plan the team made, a top-up) were
    // flipped the same way and the code-based repair never saw them — Pro
    // granted "ตลอดไป" on one read as Free. The admin form has no type field,
    // so a PRO → FREE change in the audit log can only be that bug: put back
    // what the row was before it.
    const restored = await restoreFlippedFromAudit();
    if (restored) console.warn(`[packages] restored ${restored} package(s) flipped by the form bug`);
  })().catch((err) => {
    repaired = null;
    console.warn("[packages] repair failed:", err instanceof Error ? err.message : err);
  });
  return repaired;
}

type PackageSnapshot = { type?: string; creditOnly?: boolean };

export async function restoreFlippedFromAudit(): Promise<number> {
  const logs = await prisma.adminAuditLog.findMany({
    where: { action: "package.update" },
    orderBy: { createdAt: "asc" },
    select: { entityId: true, beforeJson: true, afterJson: true },
  });
  const original = new Map<string, PackageSnapshot>();
  for (const log of logs) {
    const before = (log.beforeJson ?? {}) as PackageSnapshot;
    const after = (log.afterJson ?? {}) as PackageSnapshot;
    if (!log.entityId || original.has(log.entityId)) continue;
    if (before.type === "PRO" && after.type === "FREE") original.set(log.entityId, before);
  }
  let count = 0;
  for (const [id, before] of original) {
    const r = await prisma.package.updateMany({
      where: { id, type: "FREE" },
      data: { type: "PRO", creditOnly: Boolean(before.creditOnly) },
    });
    count += r.count;
  }
  return count;
}

