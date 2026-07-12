import type { AccessLevel, ConversationMode } from "@prisma/client";
import { prisma } from "@/server/db";
import { AppError } from "@/lib/errors";
import { getEffectivePlan } from "@/server/user/account-service";

/**
 * Who may ask the AI for a reading.
 *
 * Free is a **trial**, not a viewer tier. It used to be blanket-blocked from the
 * AI, which made the 3 credits granted at sign-up unspendable — the product
 * advertised a free trial that did not exist, and nobody could see a single
 * reading before wiring 199 THB and waiting a day for approval.
 *
 * So Free may spend its credits, and these are the walls that keep the trial
 * from becoming an open bar:
 *
 *  1. Free categories only — Pro categories stay locked (Package/Category CMS).
 *  2. Natal only — transit is a Pro feature.
 *  3. No follow-ups — every extra turn re-sends the chart, the knowledge docs and
 *     the whole history, so cost grows with each one. A Free user gets one
 *     question per thread; new threads are fine while credits last.
 *  4. Verified email — the grant is per account, and an unverified address is
 *     free to mint, so this is what stops the trial being farmed.
 *
 * The credit balance and the package day/month limits are enforced separately
 * (credit-service, quota-service) and apply to both plans.
 */
export async function assertCanRequestReading(input: {
  userId: string;
  categoryAccessLevel: AccessLevel;
  mode: ConversationMode;
  /** True when the turn continues an existing thread rather than opening one. */
  isFollowUp: boolean;
}): Promise<"FREE" | "PRO"> {
  const plan = await getEffectivePlan(input.userId);
  if (plan === "PRO") return plan;

  if (input.categoryAccessLevel === "PRO") {
    throw new AppError(
      "CATEGORY_LOCKED",
      "หมวดนี้สำหรับสมาชิก Pro — อัปเกรดเพื่อปลดล็อก",
    );
  }

  if (input.mode === "TRANSIT") {
    throw new AppError(
      "TRANSIT_REQUIRES_PRO",
      "โหมดดวงจรสำหรับสมาชิก Pro เท่านั้น",
    );
  }

  if (input.isFollowUp) {
    throw new AppError(
      "FOLLOWUP_REQUIRES_PRO",
      "ถามต่อในบทสนทนาเดิมสำหรับสมาชิก Pro — เริ่มคำถามใหม่ได้ตราบใดที่ยังมีเครดิต",
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { emailVerifiedAt: true, passwordHash: true },
  });
  // OAuth accounts have no password and are verified by the provider.
  if (user?.passwordHash && !user.emailVerifiedAt) {
    throw new AppError(
      "EMAIL_NOT_VERIFIED",
      "กรุณายืนยันอีเมลก่อนใช้เครดิตทดลองฟรี — เราส่งลิงก์ยืนยันไปให้แล้ว",
    );
  }

  return plan;
}
