import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { addCredits } from "@/server/credit/credit-service";
import { writeAudit } from "@/server/audit/audit-service";
import {
  notifyAdminsNewPayment,
  notifyUserPaymentReviewed,
  persistPaymentNotifyResult,
} from "@/server/payment/payment-notify";
import {
  assertOwnedProofPath,
  deletePaymentProofBlob,
} from "@/server/payment/payment-proof";

type Actor = { id: string; ip?: string };

export type SubmitPaymentInput = {
  amount: number;
  proofPath: string;
  packageCode?: string;
};

const paymentListSelect = {
  id: true,
  amount: true,
  status: true,
  reference: true,
  note: true,
  proofUrl: true,
  packageCode: true,
  reviewedAt: true,
  notifiedAt: true,
  notifyError: true,
  createdAt: true,
} as const;

/** User submits a manual payment request (POST /api/payments/manual). */
export async function submitManualPayment(userId: string, input: SubmitPaymentInput) {
  if (!input.proofPath?.trim()) {
    throw new AppError("VALIDATION", "กรุณาอัปโหลดสลิปการโอนเงิน");
  }
  const proofPath = assertOwnedProofPath(userId, input.proofPath);

  const pending = await prisma.payment.count({
    where: { userId, status: "PENDING" },
  });
  if (pending > 0) {
    throw new AppError("DUPLICATE_REQUEST", "มีคำขอชำระเงินรอตรวจสอบอยู่แล้ว");
  }

  if (input.packageCode) {
    const pkg = await prisma.package.findFirst({
      where: { code: input.packageCode, enabled: true },
      select: { id: true, price: true },
    });
    if (!pkg) throw new AppError("NOT_FOUND", "ไม่พบแพ็กเกจที่เลือก");
    if (input.amount !== pkg.price) {
      throw new AppError(
        "VALIDATION",
        `จำนวนเงินต้องตรงกับราคาแพ็กเกจ (${pkg.price} บาท)`,
      );
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user) throw new AppError("NOT_FOUND", "User not found");

  const payment = await prisma.payment.create({
    data: {
      userId,
      amount: input.amount,
      packageCode: input.packageCode,
      proofUrl: proofPath,
      status: "PENDING",
    },
    select: {
      id: true,
      amount: true,
      status: true,
      packageCode: true,
      proofUrl: true,
      createdAt: true,
    },
  });

  void notifyAdminsNewPayment({
    paymentId: payment.id,
    amount: payment.amount,
    userEmail: user.email,
    userName: user.name,
  }).catch((err) => console.error("[payment-notify]", err));

  return payment;
}

export async function listMyPayments(userId: string) {
  return prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: paymentListSelect,
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
        ...paymentListSelect,
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

  const packageCode =
    input.packageCode ?? payment.packageCode ?? "PRO";
  const pkg = input.status === "APPROVED"
    ? await prisma.package.findUnique({
        where: { code: packageCode },
        select: {
          id: true,
          code: true,
          creditQuota: true,
          creditOnly: true,
        },
      })
    : null;
  if (input.status === "APPROVED" && !pkg) {
    throw new AppError("NOT_FOUND", "Package not found");
  }

  const result = await prisma.$transaction(async (tx) => {
    const cas = await tx.payment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: {
        status: input.status,
        note: input.note ?? payment.note,
        packageCode,
        reviewedByAdminId: actor.id,
        reviewedAt: new Date(),
        paidAt: input.status === "APPROVED" ? new Date() : null,
      },
    });
    if (cas.count === 0) {
      throw new AppError("VALIDATION", "คำขอนี้ถูกตรวจสอบแล้ว");
    }

    const updated = await tx.payment.findUniqueOrThrow({
      where: { id: paymentId },
      select: {
        id: true,
        status: true,
        amount: true,
        reviewedAt: true,
        userId: true,
        packageCode: true,
      },
    });

    let subscription = null;
    if (input.status === "APPROVED" && pkg) {
      if (pkg.creditOnly) {
        if (pkg.creditQuota > 0) {
          await addCredits(
            payment.userId,
            pkg.creditQuota,
            {
              type: "PROMOTION",
              referenceType: "payment",
              referenceId: paymentId,
              note: `เติมเครดิตจากการชำระเงิน ${payment.amount} บาท (${pkg.code})`,
              createdByAdminId: actor.id,
            },
            tx,
          );
        }
      } else {
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
    }

    await writeAudit(
      {
        adminUserId: actor.id,
        action: input.status === "APPROVED" ? "payment.approve" : "payment.reject",
        entityType: "payment",
        entityId: paymentId,
        before: { status: payment.status, userId: payment.userId },
        after: { ...updated, subscription, packageCode, creditOnly: pkg?.creditOnly ?? false },
        ipAddress: actor.ip,
      },
      tx,
    );

    return { payment: updated, subscription };
  });

  if (input.status === "REJECTED") {
    void deletePaymentProofBlob(payment.proofUrl);
  }

  try {
    const notifyResult = await notifyUserPaymentReviewed({
      userEmail: payment.user.email,
      approved: input.status === "APPROVED",
      amount: payment.amount,
      note: input.note ?? payment.note,
    });
    await persistPaymentNotifyResult(paymentId, notifyResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : "notify failed";
    await persistPaymentNotifyResult(paymentId, { ok: false, error: message });
    console.error("[payment-user-notify]", err);
  }

  return result;
}
