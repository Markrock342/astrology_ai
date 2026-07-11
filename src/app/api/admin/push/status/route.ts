import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import { isWebPushConfigured } from "@/server/push/web-push-service";

/** GET /api/admin/push/status — whether VAPID is ready + public key for subscribe. */
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const publicKey =
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || "";
    return ok({
      configured: isWebPushConfigured() && Boolean(publicKey),
      publicKey,
    });
  });
}
