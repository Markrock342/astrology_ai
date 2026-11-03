import { expiryFromRule, packExpiryLabel, packExpiryRule, type PackExpiryFields } from "./pack-expiry";

/** Free owns its signup rule; paid-pack defaults never silently change it. */
export function freeSignupExpiry(pkg: PackExpiryFields, signedUpAt: Date): Date | null {
  return expiryFromRule(packExpiryRule(pkg, { mode: "NONE" }), signedUpAt);
}
export function freeSignupExpiryLabel(pkg: PackExpiryFields): string {
  return packExpiryLabel(packExpiryRule(pkg, { mode: "NONE" })).replace("หลังได้รับ", "หลังสมัคร");
}
