import { prisma } from "@/server/db";

/** Normalize an email for lookups/storage (trim + lowercase). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type EmailAuthStatus = {
  /** An account with this email exists. */
  exists: boolean;
  /** The account can sign in with a password (has a passwordHash set). */
  hasPassword: boolean;
};

/**
 * Decide how the sign-in surface should behave for a given email:
 *   - exists=false            → treat as registration (ask password twice)
 *   - exists=true, hasPassword→ ask for the password (login)
 *   - exists=true, !hasPassword → account is Google-only (guide to Google)
 *
 * Note: this intentionally reveals whether an email is registered so the single
 * sign-in surface can branch. That is a deliberate UX trade-off (account
 * enumeration) accepted for this consumer flow.
 */
export async function getEmailAuthStatus(rawEmail: string): Promise<EmailAuthStatus> {
  const email = normalizeEmail(rawEmail);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { passwordHash: true },
  });
  return {
    exists: Boolean(user),
    hasPassword: Boolean(user?.passwordHash),
  };
}
