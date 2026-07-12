import { unstable_cache } from "next/cache";
import type { Prisma, UsageStatus } from "@prisma/client";
import { prisma } from "@/server/db";

/** Read-only admin viewers for audit logs and AI usage logs. */

const getCachedAuditEntityTypes = unstable_cache(
  async () => {
    const rows = await prisma.adminAuditLog.findMany({
      distinct: ["entityType"],
      select: { entityType: true },
      orderBy: { entityType: "asc" },
    });
    return rows.map((e) => e.entityType);
  },
  ["admin-audit-entity-types"],
  { revalidate: 300 },
);

export type ListAuditLogsArgs = {
  page: number;
  pageSize: number;
  search?: string;
  entityType?: string;
};

export async function listAuditLogs(args: ListAuditLogsArgs) {
  const where: Prisma.AdminAuditLogWhereInput = {
    ...(args.entityType ? { entityType: args.entityType } : {}),
    ...(args.search
      ? {
          OR: [
            { action: { contains: args.search, mode: "insensitive" } },
            { entityId: { contains: args.search, mode: "insensitive" } },
            { admin: { email: { contains: args.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, items, entityTypes] = await Promise.all([
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (args.page - 1) * args.pageSize,
      take: args.pageSize,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        ipAddress: true,
        createdAt: true,
        admin: { select: { email: true, name: true } },
      },
    }),
    getCachedAuditEntityTypes(),
  ]);

  return {
    total,
    page: args.page,
    pageSize: args.pageSize,
    items,
    entityTypes,
  };
}

export async function getAuditLogDetail(id: string) {
  return prisma.adminAuditLog.findUnique({
    where: { id },
    select: {
      id: true,
      beforeJson: true,
      afterJson: true,
    },
  });
}

export type ListAiUsageArgs = {
  page: number;
  pageSize: number;
  search?: string;
  status?: UsageStatus;
};

export async function listAiUsage(args: ListAiUsageArgs) {
  const where: Prisma.AIUsageLogWhereInput = {
    ...(args.status ? { status: args.status } : {}),
    ...(args.search
      ? {
          OR: [
            { modelId: { contains: args.search, mode: "insensitive" } },
            { user: { email: { contains: args.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.aIUsageLog.count({ where }),
    prisma.aIUsageLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (args.page - 1) * args.pageSize,
      take: args.pageSize,
      select: {
        id: true,
        provider: true,
        modelId: true,
        status: true,
        inputUsage: true,
        outputUsage: true,
        estimatedCost: true,
        latencyMs: true,
        errorCode: true,
        createdAt: true,
        user: { select: { email: true, name: true } },
      },
    }),
  ]);

  return { total, page: args.page, pageSize: args.pageSize, items };
}
