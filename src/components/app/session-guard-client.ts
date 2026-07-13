"use client";

import { signOut } from "next-auth/react";

const SESSION_ERROR_CODES = new Set(["UNAUTHENTICATED", "NOT_FOUND"]);

/** Sign out and send the user to login when bootstrap/session is stale. */
export async function redirectOnStaleSession(errorCode?: string | null) {
  if (!errorCode || !SESSION_ERROR_CODES.has(errorCode)) return false;
  await signOut({ callbackUrl: "/login?reason=session_expired" });
  return true;
}

export function isStaleSessionError(errorCode?: string | null): boolean {
  return Boolean(errorCode && SESSION_ERROR_CODES.has(errorCode));
}
