import type { SendEmailResult } from "@/server/email/mailer";
import { prisma } from "@/server/db";
import { sendEmail } from "@/server/email/mailer";
import { sendWebPushToAdmins } from "@/server/push/web-push-service";

function appBaseUrl(): string {
  return (
    process.env.APP_BASE_URL ||
    process.env.AUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/** Fire-and-forget admin alerts when a user submits a payment slip. */
export async function notifyAdminsNewPayment(input: {
  paymentId: string;
  amount: number;
  userEmail: string;
  userName?: string | null;
  reference?: string | null;
}): Promise<void> {
  const link = `${appBaseUrl()}/admin/payments`;
  const title = `สลิปใหม่รอตรวจ — ฿${input.amount}`;
  const body =
    `${input.userName ?? input.userEmail} ส่งหลักฐานโอน ฿${input.amount}` +
    (input.reference ? ` (อ้างอิง ${input.reference})` : "");

  const text = [
    title,
    "",
    body,
    "",
    `เปิดตรวจ: ${link}`,
  ].join("\n");

  const alertEmail = process.env.ADMIN_ALERT_EMAIL?.trim();
  const adminEmails = alertEmail
    ? [alertEmail]
    : (
        await prisma.user.findMany({
          where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE" },
          select: { email: true },
          take: 20,
        })
      ).map((u) => u.email);

  await Promise.allSettled([
    ...adminEmails.map((to) =>
      sendEmail({
        to,
        subject: `[HoraSard] ${title}`,
        text,
        html: `<p>${body}</p><p><a href="${link}">เปิดหน้าตรวจการโอนเงิน</a></p>`,
      }),
    ),
    sendWebPushToAdmins({
      title,
      body,
      url: "/admin/payments",
      tag: `payment-${input.paymentId}`,
    }),
  ]);
}

export async function notifyUserPaymentReviewed(input: {
  userEmail: string;
  approved: boolean;
  amount: number;
  note?: string | null;
}): Promise<SendEmailResult> {
  const link = `${appBaseUrl()}/account`;
  const title = input.approved
    ? `อนุมัติการชำระเงิน ฿${input.amount} แล้ว`
    : `คำขอชำระเงิน ฿${input.amount} ไม่ผ่าน`;
  const text = [
    title,
    input.note ? `หมายเหตุ: ${input.note}` : "",
    "",
    `ดูบัญชี: ${link}`,
  ]
    .filter(Boolean)
    .join("\n");

  return sendEmail({
    to: input.userEmail,
    subject: `[HoraSard] ${title}`,
    text,
    html: `<p>${title}</p>${input.note ? `<p>หมายเหตุ: ${input.note}</p>` : ""}<p><a href="${link}">เปิดหน้าบัญชี</a></p>`,
  });
}

/** Persist customer email delivery outcome for admin visibility (BE-E0.3). */
export async function persistPaymentNotifyResult(
  paymentId: string,
  result: SendEmailResult,
): Promise<void> {
  await prisma.payment.update({
    where: { id: paymentId },
    data: result.ok
      ? { notifiedAt: new Date(), notifyError: null }
      : { notifyError: result.error },
  });
}
