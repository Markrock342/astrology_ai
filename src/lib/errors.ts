/**
 * Centralized error types and codes. Route handlers translate AppError into
 * HTTP responses; the AI/reading flow uses these codes for the UI states
 * (no quota, locked, timeout, provider error) described in spec 5.6.
 */

export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "USER_DISABLED"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CATEGORY_LOCKED"
  | "CHAT_REQUIRES_PRO"
  | "TRANSIT_REQUIRES_PRO"
  | "FOLLOWUP_REQUIRES_PRO"
  | "EMAIL_NOT_VERIFIED"
  | "EDIT_LIMIT_REACHED"
  | "NO_QUOTA"
  | "CHART_NOT_READY"
  | "AI_TIMEOUT"
  | "AI_PROVIDER_ERROR"
  | "AI_INVALID_OUTPUT"
  | "DUPLICATE_REQUEST"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "FEATURE_DISABLED"
  | "INTERNAL";

const STATUS: Record<AppErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  USER_DISABLED: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CATEGORY_LOCKED: 403,
  CHAT_REQUIRES_PRO: 403,
  TRANSIT_REQUIRES_PRO: 403,
  FOLLOWUP_REQUIRES_PRO: 403,
  EMAIL_NOT_VERIFIED: 403,
  EDIT_LIMIT_REACHED: 409,
  NO_QUOTA: 402,
  CHART_NOT_READY: 422,
  AI_TIMEOUT: 504,
  AI_PROVIDER_ERROR: 502,
  AI_INVALID_OUTPUT: 502,
  DUPLICATE_REQUEST: 409,
  RATE_LIMITED: 429,
  QUOTA_EXCEEDED: 403,
  FEATURE_DISABLED: 403,
  INTERNAL: 500,
};

export class AppError extends Error {
  constructor(
    public code: AppErrorCode,
    message?: string,
    public details?: unknown,
  ) {
    super(message ?? code);
    this.name = "AppError";
  }

  get status(): number {
    return STATUS[this.code];
  }
}
