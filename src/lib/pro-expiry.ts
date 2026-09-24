/**
 * When does this account's Pro end?
 *
 * The user's own active Pro subscription is the source of truth — an admin sets
 * it in /admin/users, and `expiresAt: null` there means "ไม่มีวันหมดอายุ"
 * (Pro forever). The launch promotion only fills in for someone who has no Pro
 * subscription at all, so an admin-set date is never silently replaced by the
 * promotion's end date.
 */
export type ProExpiryInput = {
  /** The account's own ACTIVE Pro subscription; null when it has none. */
  subscription: { expiresAt: Date | null } | null;
  promotionActive: boolean;
  promotionEndsAt: Date;
  /** A quiet promotion is never announced and never counted down. */
  promotionSilent?: boolean;
};

export type ProExpiry = {
  /** When Pro ends; null means it does not end (forever, or not Pro at all). */
  endsAt: Date | null;
  /** True only for Pro that genuinely never expires. */
  neverExpires: boolean;
  /** Whether the promotion still adds anything worth announcing. */
  showPromotion: boolean;
};

export function resolveProExpiry({
  subscription,
  promotionActive,
  promotionEndsAt,
  promotionSilent = false,
}: ProExpiryInput): ProExpiry {
  const own = subscription ?? null;
  // Pro that already outlasts the promotion gains nothing from it — announcing
  // "Pro ถึง 23 ก.ย." would read as if their plan ended that day.
  const outlastsPromotion =
    own !== null &&
    (own.expiresAt === null || own.expiresAt.getTime() > promotionEndsAt.getTime());

  return {
    endsAt: own
      ? own.expiresAt
      : promotionActive && !promotionSilent
        ? promotionEndsAt
        : null,
    neverExpires: own !== null && own.expiresAt === null,
    showPromotion: promotionActive && !outlastsPromotion && !promotionSilent,
  };
}

/**
 * The admin form's two choices → the `expiresAt` the API stores.
 * A picked day ends at the END of that day in Bangkok, so "31 ธ.ค." keeps Pro
 * working all of 31 ธ.ค. rather than expiring at midnight as it begins.
 */
export function subscriptionExpiryPayload(
  mode: "date" | "forever",
  isoDay: string,
): string | null {
  if (mode === "forever") return null;
  return new Date(`${isoDay}T23:59:59+07:00`).toISOString();
}
