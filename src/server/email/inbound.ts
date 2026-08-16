import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/server/db";
import { sendEmail } from "@/server/email/mailer";
import { env } from "@/config/env";

const SUPPORT_INBOX = "support@horasard.com";

type InboundPayload = {
  type?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string[] | string;
    cc?: string[] | string;
    subject?: string;
    text?: string;
    html?: string;
    message_id?: string;
  };
};

function asList(value: string[] | string | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function header(headers: Headers, name: string): string | null {
  return headers.get(name) ?? headers.get(name.toLowerCase());
}

/** Verify Resend/Svix webhook signatures. */
export function verifyResendWebhook(
  rawBody: string,
  headers: Headers,
  secret: string,
): boolean {
  const id = header(headers, "svix-id");
  const timestamp = header(headers, "svix-timestamp");
  const signature = header(headers, "svix-signature");
  if (!id || !timestamp || !signature) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest("base64");

  return signature.split(/[\s]+/).some((part) => {
    const value = part.replace(/^v1[,=]/, "");
    if (!value) return false;
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

async function supportRecipients(): Promise<string[]> {
  const alert = env.ADMIN_ALERT_EMAIL?.trim();
  if (alert) return [alert];
  const staff = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE" },
    select: { email: true },
    take: 10,
  });
  return staff.map((row) => row.email).filter(Boolean);
}

/** Forward an inbound support@ message to the admin alert inbox. */
export async function forwardInboundSupport(payload: InboundPayload): Promise<{
  forwarded: boolean;
  reason?: string;
}> {
  const data = payload.data ?? {};
  const to = asList(data.to).join(", ").toLowerCase();
  const addressedToSupport =
    to.includes(SUPPORT_INBOX) ||
    asList(data.cc).join(", ").toLowerCase().includes(SUPPORT_INBOX);
  if (!addressedToSupport && payload.type && payload.type !== "email.received") {
    return { forwarded: false, reason: "ignored-event" };
  }

  const recipients = await supportRecipients();
  if (recipients.length === 0) {
    return { forwarded: false, reason: "no-recipient" };
  }

  const from = data.from?.trim() || "(unknown sender)";
  const subject = data.subject?.trim() || "(no subject)";
  const body =
    data.text?.trim() ||
    data.html?.replace(/<[^>]+>/g, " ").trim() ||
    "(no body — open Resend receiving to read the original)";

  const text = [
    `จดหมายเข้า ${SUPPORT_INBOX}`,
    `จาก: ${from}`,
    `ถึง: ${to || SUPPORT_INBOX}`,
    `เรื่อง: ${subject}`,
    data.message_id ? `Message-ID: ${data.message_id}` : "",
    "",
    body,
  ]
    .filter((line) => line !== "")
    .join("\n");

  const results = await Promise.all(
    recipients.map((recipient) =>
      sendEmail({
        to: recipient,
        subject: `[HoraSard support] ${subject}`,
        text,
      }),
    ),
  );
  const forwarded = results.some((row) => row.ok);
  return forwarded ? { forwarded: true } : { forwarded: false, reason: "send-failed" };
}
