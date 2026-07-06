import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { addCredits } from "@/server/credit/credit-service";
import { writeAudit } from "@/server/audit/audit-service";

type Actor = { id: string; ip?: string };

export type SubmitPaymentInput = {
  amount: number;
  reference?: string;
  note?: string;
  proofUrl?: string;
};

/** User submits a manual payment request (POST /api/payments/manual). */
export async function submitManualPayment(userId: string, input: SubmitPaymentInput) {
  const pending = await prisma.payment.count({
    where: { userId, status: "PENDING" },
  });
  if (pending > 0) {
    throw new AppError("DUPLICATE_REQUEST", "มีคำขอชำระเงินรอตรวจสอบอยู่แล้ว");
  }

  return prisma.payment.create({
    data: {
      userId,
      amount: input.amount,
      reference: input.reference,
      note: input.note,
      proofUrl: input.proofUrl,
      status: "PENDING",
    },
    select: {
      id: true,
      amount: true,
      status: true,
      reference: true,
      createdAt: true,
    },
  });
}

export async function listMyPayments(userId: string) {
  return prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      amount: true,
      status: true,
      reference: true,
      note: true,
      proofUrl: true,
      reviewedAt: true,
      createdAt: true,
    },
  });
}

export type ListPaymentsArgs = {
  page: number;
  pageSize: number;
  status?: "PENDING" | "APPROVED" | "REJECTED";
};

export async function listPayments(args: ListPaymentsArgs) {
  const where = args.status ? { status: args.status } : {};
  const [total, items] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (args.page - 1) * args.pageSize,
      take: args.pageSize,
      select: {
        id: true,
        amount: true,
        status: true,
        reference: true,
        note: true,
        proofUrl: true,
        reviewedAt: true,
        createdAt: true,
        user: { select: { id: true, email: true, name: true } },
        reviewer: { select: { email: true, name: true } },
      },
    }),
  ]);
  return { total, page: args.page, pageSize: args.pageSize, items };
}

export async function reviewPayment(
  paymentId: string,
  input: { status: "APPROVED" | "REJECTED"; note?: string; packageCode?: string },
  actor: Actor,
) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { user: { select: { id: true, email: true } } },
  });
  if (!payment) throw new AppError("NOT_FOUND", "Payment not found");
  if (payment.status !== "PENDING") {
    throw new AppError("VALIDATION", "คำขอนี้ถูกตรวจสอบแล้ว");
  }

  const packageCode = input.packageCode ?? "PRO";
  const pkg = input.status === "APPROVED"
    ? await prisma.package.findUnique({ where: { code: packageCode } })
    : null;
  if (input.status === "APPROVED" && !pkg) {
    throw new AppError("NOT_FOUND", "Package not found");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: input.status,
        note: input.note ?? payment.note,
        reviewedByAdminId: actor.id,
        reviewedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        amount: true,
        reviewedAt: true,
        userId: true,
      },
    });

    let subscription = null;
    if (input.status === "APPROVED" && pkg) {
      await tx.userSubscription.updateMany({
        where: { userId: payment.userId, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      });

      subscription = await tx.userSubscription.create({
        data: {
          userId: payment.userId,
          packageId: pkg.id,
          status: "ACTIVE",
          activationSource: "PAYMENT",
        },
        select: { id: true, package: { select: { code: true, creditQuota: true } } },
      });

      if (pkg.creditQuota > 0) {
        await addCredits(
          payment.userId,
          pkg.creditQuota,
          {
            type: "PACKAGE_RENEWAL",
            referenceType: "payment",
            referenceId: paymentId,
            note: `อนุมัติชำระเงิน ${payment.amount} บาท`,
            createdByAdminId: actor.id,
          },
          tx,
        );
      }
    }

    await writeAudit(
      {
        adminUserId: actor.id,
        action: input.status === "APPROVED" ? "payment.approve" : "payment.reject",
        entityType: "payment",
        entityId: paymentId,
        before: { status: payment.status, userId: payment.userId },
        after: { ...updated, subscription, packageCode },
        ipAddress: actor.ip,
      },
      tx,
    );

    return { payment: updated, subscription };
  });
}
