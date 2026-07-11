import { z } from "zod";
import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import {
  deletePushSubscription,
  isWebPushConfigured,
  saveAdminPushSubscription,
} from "@/server/push/web-push-service";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

/** POST /api/admin/push/subscribe — register Web Push for the signed-in admin. */
export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    if (!isWebPushConfigured()) {
      return ok({ subscribed: false, reason: "VAPID not configured" });
    }
    const body = subscribeSchema.parse(await req.json());
    await saveAdminPushSubscription({
      userId: admin.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    });
    return ok({ subscribed: true });
  });
}

/** DELETE /api/admin/push/subscribe — remove this device subscription. */
export async function DELETE(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const body = unsubscribeSchema.parse(await req.json());
    await deletePushSubscription(body.endpoint, admin.id);
    return ok({ deleted: true });
  });
}
