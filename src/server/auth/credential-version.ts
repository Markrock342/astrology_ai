import { createHash } from "node:crypto";

/**
 * A short fingerprint of the account's password hash, carried in the session
 * token. Sessions are 90-day JWTs that nothing revoked: after a password reset
 * or change, every old session — including one an attacker held — kept
 * working. The token's fingerprint must match the current password, so any
 * password change ends every other session. No schema change needed.
 */
export function credentialVersion(passwordHash: string | null | undefined): string {
  return createHash("sha256").update(`cv:${passwordHash ?? "none"}`).digest("base64url").slice(0, 16);
}
