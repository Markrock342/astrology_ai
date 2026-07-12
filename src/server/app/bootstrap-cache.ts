import { revalidateTag } from "next/cache";

/** Bust per-user shell cache after thread/payment changes. */
export function invalidateUserBootstrap(userId: string) {
  try {
    revalidateTag(`bootstrap-${userId}`, {});
  } catch {
    /* no-op outside Next request context (tests/scripts) */
  }
}
