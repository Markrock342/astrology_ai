import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as OTPAuth from "otpauth";

// Deterministic clock so the TOTP time-step is stable across the test.
const FIXED_NOW = 1_770_000_000_000; // ms

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  cookieSet: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  prisma: { user: { findUnique: mocks.findUnique, update: mocks.update } },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mocks.cookieSet, get: () => undefined, delete: () => {} }),
}));
vi.mock("@/server/audit/audit-service", () => ({ writeAudit: vi.fn() }));

// Deterministic encryption: identity, so decryptTotpSecret returns the base32.
vi.mock("@/lib/crypto/secret-box", () => ({
  isEncryptionConfigured: () => true,
  encryptSecret: (s: string) => s,
  decryptSecret: (s: string) => s,
}));

import { verifyTotpLogin } from "@/server/auth/admin-2fa-service";

const secret = new OTPAuth.Secret({ size: 20 });
const totp = new OTPAuth.TOTP({
  algorithm: "SHA1",
  digits: 6,
  period: 30,
  secret,
});

describe("verifyTotpLogin replay guard", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "x".repeat(44);
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW);
  });
  afterEach(() => vi.restoreAllMocks());

  it("accepts a fresh code then rejects the SAME code as replay", async () => {
    const code = totp.generate({ timestamp: FIXED_NOW });
    const step = Math.floor(FIXED_NOW / 30_000);

    // First use: no prior step → accepted, records the step.
    mocks.findUnique.mockResolvedValueOnce({
      totpSecretEnc: secret.base32,
      totpBackupCodesJson: [],
      totpLastStep: null,
    });
    await expect(verifyTotpLogin("admin-1", code)).resolves.toBeUndefined();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { totpLastStep: step } }),
    );
    expect(mocks.cookieSet).toHaveBeenCalled();

    // Replay: same code, stored step == this code's step → rejected.
    mocks.cookieSet.mockClear();
    mocks.findUnique.mockResolvedValueOnce({
      totpSecretEnc: secret.base32,
      totpBackupCodesJson: [],
      totpLastStep: step,
    });
    await expect(verifyTotpLogin("admin-1", code)).rejects.toMatchObject({
      code: "VALIDATION",
    });
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("rejects a wrong code outright", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      totpSecretEnc: secret.base32,
      totpBackupCodesJson: [],
      totpLastStep: null,
    });
    await expect(verifyTotpLogin("admin-1", "000000")).rejects.toMatchObject({
      code: "VALIDATION",
    });
  });
});
