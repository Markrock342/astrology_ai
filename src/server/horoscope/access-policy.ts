import type { AccessLevel, ConversationMode } from "@prisma/client";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { getEffectivePlan } from "@/server/user/account-service";

/**
 * Who may ask the AI for a reading.
 *
 * Free is a **trial**, not a viewer tier — usage granted at sign-up must be
 * spendable. Walls that keep the trial from becoming an open bar:
 *
 *  1. Pro-only *topics in the question* stay locked (see question-scope).
 *  2. Verified email — stops farming throwaway accounts for the trial grant.
 *
 * Follow-ups are allowed on Free: each turn still spends usage / a quota slot
 * (same as ChatGPT). Blocking them made the chat feel broken ("คุยต่อไม่ได้").
 *
 * Cost-weighted balance + optional package request limits are enforced separately.
 */
export async function assertCanRequestReading(input: {
  userId: string;
  categoryAccessLevel: AccessLevel;
  mode: ConversationMode;
  /** Kept for callers/logging; Free follow-ups are allowed. */
  isFollowUp: boolean;
  /** Natal category briefing is free — do not require email verification. */
  skipEmailVerify?: boolean;
}): Promise<"FREE" | "PRO"> {
  const plan = await getEffectivePlan(input.userId);
  if (plan === "PRO") return plan;

  if (input.categoryAccessLevel === "PRO") {
    throw new AppError(
      "CATEGORY_LOCKED",
      "หมวดนี้สำหรับสมาชิก Pro — อัปเกรดเพื่อปลดล็อก",
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { emailVerifiedAt: true, passwordHash: true },
  });
  // OAuth accounts have no password and are verified by the provider.
  // Natal intros skip this wall — they do not spend trial usage.
  if (
    !input.skipEmailVerify &&
    user?.passwordHash &&
    !user.emailVerifiedAt
  ) {
    throw new AppError(
      "EMAIL_NOT_VERIFIED",
      "กรุณายืนยันอีเมลก่อนใช้ usage ทดลอง — เราส่งลิงก์ยืนยันไปให้แล้ว",
    );
  }

  return plan;
}
