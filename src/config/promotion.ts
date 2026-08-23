/**
 * Temporary launch promotion approved for horasard.com.
 *
 * Keeping the window in code makes plan checks deterministic across web and
 * workers. Existing users are backfilled by the matching Prisma migration;
 * provisioning applies the same grant to sign-ups created during the window.
 */
export const LAUNCH_PRO_PROMOTION = {
  id: "horasard-pro-month-2026-08",
  startsAt: new Date("2026-08-23T00:00:00+07:00"),
  endsAt: new Date("2026-09-23T23:59:59+07:00"),
  creditGrant: 50,
} as const;

export function isLaunchProPromotionActive(now = new Date()): boolean {
  return (
    now.getTime() >= LAUNCH_PRO_PROMOTION.startsAt.getTime() &&
    now.getTime() <= LAUNCH_PRO_PROMOTION.endsAt.getTime()
  );
}
