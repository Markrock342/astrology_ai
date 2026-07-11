import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/server/audit/audit-service";

/**
 * Admin catalog service: CRUD for horoscope categories and packages. Every
 * mutation writes an audit log (rule 7). Deletes are blocked when the row is
 * still referenced — disable it instead.
 */

type Actor = { id: string; ip?: string };

export type CategoryCreateInput = {
  slug: string;
  nameTh: string;
  nameEn?: string;
  description?: string;
  icon?: string;
  accessLevel: "FREE" | "PRO";
  creditCost: number;
  enabled: boolean;
  sortOrder: number;
  suggestedQuestions?: string[];
  promptTemplateId?: string | null;
  aiConfigId?: string | null;
};

export type CategoryUpdateInput = Partial<CategoryCreateInput>;

export type PackageCreateInput = {
  code: string;
  name: string;
  type: "FREE" | "PRO";
  price: number;
  billingLabel?: string;
  creditQuota: number;
  dailyLimit?: number | null;
  monthlyLimit?: number | null;
  enabled?: boolean;
  description?: string;
  features?: string[];
  upgradeSteps?: string[];
};

export type PackageUpdateInput = Partial<PackageCreateInput>;

// ---- Categories -----------------------------------------------------------

export function listCategories() {
  return prisma.horoscopeCategory.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function getCategory(id: string) {
  const category = await prisma.horoscopeCategory.findUnique({ where: { id } });
  if (!category) throw new AppError("NOT_FOUND", "Category not found");
  return category;
}

export async function createCategory(input: CategoryCreateInput, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.horoscopeCategory.create({
      data: input as Prisma.HoroscopeCategoryUncheckedCreateInput,
    });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "category.create",
        entityType: "horoscope_category",
        entityId: created.id,
        after: created,
        ipAddress: actor.ip,
      },
      tx,
    );
    return created;
  });
}

export async function updateCategory(id: string, input: CategoryUpdateInput, actor: Actor) {
  const before = await prisma.horoscopeCategory.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "Category not found");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.horoscopeCategory.update({
      where: { id },
      data: input as Prisma.HoroscopeCategoryUncheckedUpdateInput,
    });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "category.update",
        entityType: "horoscope_category",
        entityId: id,
        before,
        after: updated,
        ipAddress: actor.ip,
      },
      tx,
    );
    return updated;
  });
}

export async function deleteCategory(id: string, actor: Actor) {
  const before = await prisma.horoscopeCategory.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "Category not found");

  const [readings, conversations] = await Promise.all([
    prisma.horoscopeReading.count({ where: { categoryId: id } }),
    prisma.conversation.count({ where: { categoryId: id } }),
  ]);
  if (readings > 0 || conversations > 0) {
    throw new AppError(
      "VALIDATION",
      "หมวดนี้มีการใช้งานแล้ว กรุณาปิดการใช้งาน (enabled=false) แทนการลบ",
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.horoscopeCategory.delete({ where: { id } });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "category.delete",
        entityType: "horoscope_category",
        entityId: id,
        before,
        ipAddress: actor.ip,
      },
      tx,
    );
    return { id };
  });
}

// ---- Packages -------------------------------------------------------------

export function listPackages() {
  return prisma.package.findMany({ orderBy: { price: "asc" } });
}

/** Enabled packages for the account page (no secrets). */
export function listPublicPackages() {
  return prisma.package.findMany({
    where: { enabled: true },
    orderBy: { price: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      price: true,
      billingLabel: true,
      creditQuota: true,
      description: true,
      features: true,
      upgradeSteps: true,
    },
  });
}

export async function getPackage(id: string) {
  const pkg = await prisma.package.findUnique({ where: { id } });
  if (!pkg) throw new AppError("NOT_FOUND", "Package not found");
  return pkg;
}

export async function createPackage(input: PackageCreateInput, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.package.create({
      data: input as Prisma.PackageUncheckedCreateInput,
    });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "package.create",
        entityType: "package",
        entityId: created.id,
        after: created,
        ipAddress: actor.ip,
      },
      tx,
    );
    return created;
  });
}

export async function updatePackage(id: string, input: PackageUpdateInput, actor: Actor) {
  const before = await prisma.package.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "Package not found");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.package.update({
      where: { id },
      data: input as Prisma.PackageUncheckedUpdateInput,
    });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "package.update",
        entityType: "package",
        entityId: id,
        before,
        after: updated,
        ipAddress: actor.ip,
      },
      tx,
    );
    return updated;
  });
}

export async function deletePackage(id: string, actor: Actor) {
  const before = await prisma.package.findUnique({ where: { id } });
  if (!before) throw new AppError("NOT_FOUND", "Package not found");

  const subs = await prisma.userSubscription.count({ where: { packageId: id } });
  if (subs > 0) {
    throw new AppError(
      "VALIDATION",
      "แพ็กเกจนี้มีผู้ใช้ผูกอยู่ กรุณาปิดการใช้งาน (enabled=false) แทนการลบ",
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.package.delete({ where: { id } });
    await writeAudit(
      {
        adminUserId: actor.id,
        action: "package.delete",
        entityType: "package",
        entityId: id,
        before,
        ipAddress: actor.ip,
      },
      tx,
    );
    return { id };
  });
}
