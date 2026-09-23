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
