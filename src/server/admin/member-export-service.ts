import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { memberCsv, signupRangeStart, type ExportRange } from "@/lib/member-export";
import { likeLiteral } from "./user-admin-service";
import { writeAudit } from "@/server/audit/audit-service";

export async function exportMembers(range: ExportRange, actor: { id: string; ip?: string }, filters: { search?: string; status?: "ACTIVE" | "DISABLED" } = {}, now = new Date()) {
  const rows = await prisma.user.findMany({
    where: { role: "USER", createdAt: { gte: signupRangeStart(range, now), lte: now },
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search ? { OR: [{ email: { contains: likeLiteral(filters.search), mode: "insensitive" as const } }, { name: { contains: likeLiteral(filters.search), mode: "insensitive" as const } }] } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 100001,
    select: { email: true, status: true, createdAt: true,
      usageWallet: { select: { includedBalanceUnits: true, purchasedBalanceUnits: true, periodEndsAt: true, purchasedExpiresAt: true } },
      payments: { where: { status: "APPROVED", packageCode: { not: null } }, orderBy: [{ paidAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }, { id: "desc" }], take: 1, select: { packageCode: true, paidAt: true, createdAt: true } },
    },
  });
  if (rows.length > 100000) throw new AppError("VALIDATION", "จำนวนสมาชิกเกิน 100,000 ราย กรุณาเลือกช่วงวันที่สั้นลง");
  const packages = await prisma.package.findMany({ select: { code: true, name: true } });
  const names = new Map(packages.map(p => [p.code, p.name]));
  const csv = memberCsv(rows.map(row => {
    const purchase = row.payments[0];
    return { ...row, wallet: row.usageWallet, packageName: purchase?.packageCode ? names.get(purchase.packageCode) ?? purchase.packageCode : "Free", purchasedAt: purchase ? purchase.paidAt ?? purchase.createdAt : null };
  }), now);
  await writeAudit({ adminUserId: actor.id, action: "user.export", entityType: "user", after: { range, dateBasis: "signup", rows: rows.length }, ipAddress: actor.ip });
  return csv;
}
