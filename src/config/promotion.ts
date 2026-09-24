/**
 * Temporary promotion approved for horasard.com.
 *
 * Keeping the window in code makes plan checks deterministic across web and
 * workers, and makes extending a promotion a deploy rather than a database
 * operation. While the window is open `getEffectivePlan` returns PRO for
 * everyone; the AI budget is granted per user on first contact (see
 * ensurePromotionUsageGrant) and at sign-up (see provisioning).
 *
 * History: the first run was a launch month, 23 Aug – 23 Sep 2026.
 */
export const LAUNCH_PRO_PROMOTION = {
  id: "horasard-pro-week-2026-09",
  startsAt: new Date("2026-09-24T00:00:00+07:00"),
  endsAt: new Date("2026-10-01T23:59:59+07:00"),
  /** Credits added once per account, as the previous run did. */
  creditGrant: 50,
  /** Share of the Pro package's AI budget granted — 100 = the bar reads 100%. */
  usageGrantPercent: 100,
  /**
   * Given quietly and taken back quietly: no promotion banner, no "Pro
   * ใกล้หมดอายุ · ต่ออายุ" countdown, no end date on the account page. People
   * simply have Pro, and on the last day they simply don't. Accounts with their
   * own Pro subscription still see their own dates — that is their plan.
   */
  silent: true,
} as const;

export function getLaunchPromotionCreditReferenceId(userId: string) {
  return `${LAUNCH_PRO_PROMOTION.id}:${userId}`;
}

/** Ledger key for the AI-budget half of the grant, separate from credits. */
export function getLaunchPromotionUsageReferenceId(userId: string) {
  return `usage:${getLaunchPromotionCreditReferenceId(userId)}`;
}

export function isLaunchProPromotionActive(now = new Date()): boolean {
  return (
    now.getTime() >= LAUNCH_PRO_PROMOTION.startsAt.getTime() &&
    now.getTime() <= LAUNCH_PRO_PROMOTION.endsAt.getTime()
  );
}

/**
 * A silent promotion's end date must not leak into what users see. The AI
 * budget it grants carries the promotion's end as its period end, and the
 * account page prints that as "รีเซ็ต …" — so it is blanked here for users.
 * Admin views read the wallet directly and still see it.
 */
export function hideSilentPromotionDate(date: Date | null): Date | null {
  if (!date || !LAUNCH_PRO_PROMOTION.silent) return date;
  return date.getTime() === LAUNCH_PRO_PROMOTION.endsAt.getTime() ? null : date;
}

/**
 * The Pro subscription that provisioning writes for a sign-up during the
 * window, as opposed to a plan someone paid for or an admin set. A silent
 * promotion treats it as "no subscription of their own", or its end date would
 * surface as "Pro ใกล้หมดอายุ · ต่ออายุ" and on the account page.
 */
export function isSilentPromotionSubscription(
  sub: { expiresAt: Date | null; activationSource?: string | null } | null,
): boolean {
  if (!sub || !LAUNCH_PRO_PROMOTION.silent) return false;
  return (
    sub.activationSource === "SYSTEM_DEFAULT" &&
    sub.expiresAt !== null &&
    sub.expiresAt.getTime() === LAUNCH_PRO_PROMOTION.endsAt.getTime()
  );
}
