import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { isWebPushConfigured } from "@/server/push/web-push-service";
import { prisma } from "@/server/db";

/** GET /api/admin/push/status — whether VAPID is ready + public key for subscribe. */
export async function GET() {
  return handle(async () => {
    const admin = await requireAdmin();
    const publicKey =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || "";
    const [registeredDevices, thisAdminDevices] = await Promise.all([
      prisma.pushSubscription.count({
        where: { user: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, status: "ACTIVE" } },
      }),
      prisma.pushSubscription.count({ where: { userId: admin.id } }),
    ]);
    return ok({
      configured: isWebPushConfigured() && Boolean(publicKey),
      publicKey,
      registeredDevices,
      thisAdminDevices,
    });
  });
}
