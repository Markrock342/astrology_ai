import { auth } from "@/auth";

/**
 * Read the current session without treating decrypt failures as fatal.
 * Auth.js already returns `null` when the JWT cookie cannot be decrypted
 * (e.g. AUTH_SECRET changed), but it still logs JWTSessionError — clear the
 * localhost session cookie in DevTools if those logs persist.
 */
export async function getSessionOrNull() {
  try {
    return await auth();
  } catch (err) {
    console.warn(
      "[auth] getSessionOrNull failed — treating as signed out:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
