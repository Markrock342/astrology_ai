import webpush from "web-push";
import { prisma } from "@/server/db";

function configureVapid(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@horasard.local";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export function isWebPushConfigured(): boolean {
  return Boolean(
    (process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) &&
      process.env.VAPID_PRIVATE_KEY,
  );
}

export async function saveAdminPushSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}) {
  return prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      userId: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
    },
    update: {
      userId: input.userId,
      p256dh: input.p256dh,
      auth: input.auth,
    },
  });
}

export async function deletePushSubscription(endpoint: string, userId: string) {
  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId },
  });
}

export async function sendWebPushToAdmins(payload: {
  title: string;
  body: string;
  url: string;
  tag?: string;
}): Promise<{ sent: number; failed: number }> {
  if (!configureVapid()) return { sent: 0, failed: 0 };

  const rows = await prisma.pushSubscription.findMany({
    where: {
      user: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE" },
    },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });

  let sent = 0;
  let failed = 0;
  const json = JSON.stringify(payload);

  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          json,
        );
        sent += 1;
      } catch (err) {
        failed += 1;
        const status = (err as { statusCode?: number })?.statusCode;
        // Gone / expired subscription
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.delete({ where: { id: row.id } }).catch(() => {});
        }
        console.error("[web-push] send failed", status ?? err);
      }
    }),
  );

  return { sent, failed };
}
