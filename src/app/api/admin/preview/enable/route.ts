import { cookies } from "next/headers";
import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/server/auth/rbac";
import {
  PREVIEW_COOKIE,
  PREVIEW_MAX_AGE_SEC,
} from "@/server/cms/preview-constants";

/** POST /api/admin/preview/enable — set httpOnly preview cookie (30 min). */
export async function POST() {
  return handle(async () => {
    await requireAdmin();
    const jar = await cookies();
    jar.set(PREVIEW_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: PREVIEW_MAX_AGE_SEC,
    });
    return ok({ enabled: true, expiresInSec: PREVIEW_MAX_AGE_SEC });
  });
}

/** DELETE /api/admin/preview/enable — clear preview cookie. */
export async function DELETE() {
  return handle(async () => {
    await requireAdmin();
    const jar = await cookies();
    jar.delete(PREVIEW_COOKIE);
    return ok({ enabled: false });
  });
}
