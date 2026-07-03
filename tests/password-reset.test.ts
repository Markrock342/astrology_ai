import { describe, expect, it } from "vitest";
import { normalizeEmail } from "@/server/auth/account-lookup";
import {
  generateResetToken,
  hashResetToken,
  isResetTokenUsable,
  PASSWORD_RESET_TTL_MS,
} from "@/server/auth/password-reset-service";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  User@Example.COM  ")).toBe("user@example.com");
  });
});

describe("password reset token helpers", () => {
  it("generates a 64-char hex token", () => {
    const token = generateResetToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hashes tokens deterministically", () => {
    expect(hashResetToken("abc")).toBe(hashResetToken("abc"));
    expect(hashResetToken("abc")).not.toBe(hashResetToken("def"));
  });

  it("accepts a fresh unused token", () => {
    const now = new Date("2026-07-03T12:00:00Z");
    expect(
      isResetTokenUsable(
        { expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS), usedAt: null },
        now,
      ),
    ).toBe(true);
  });

  it("rejects expired tokens", () => {
    const now = new Date("2026-07-03T12:00:00Z");
    expect(
      isResetTokenUsable({ expiresAt: new Date(now.getTime() - 1), usedAt: null }, now),
    ).toBe(false);
  });

  it("rejects already-used tokens", () => {
    const now = new Date("2026-07-03T12:00:00Z");
    expect(
      isResetTokenUsable(
        { expiresAt: new Date(now.getTime() + 60_000), usedAt: now },
        now,
      ),
    ).toBe(false);
  });
});
