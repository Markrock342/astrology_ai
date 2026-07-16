import { describe, expect, it } from "vitest";
import { encryptSecret, last4 } from "@/lib/crypto/secret-box";
import { randomBytes } from "node:crypto";

/**
 * Mirrors ai-admin-service toPublicAIConfig / redactConfigSecrets —
 * ensures list/audit payloads never leak ciphertext or plaintext keys.
 */
function toPublicAIConfig<T extends { encryptedApiKey?: string | null }>(row: T) {
  const { encryptedApiKey, ...rest } = row;
  return {
    ...rest,
    hasStoredKey: Boolean(encryptedApiKey),
  };
}

function redactConfigSecrets<T extends Record<string, unknown>>(row: T) {
  const { encryptedApiKey, ...rest } = row as T & { encryptedApiKey?: string | null };
  return {
    ...rest,
    encryptedApiKey: undefined,
    hasStoredKey: Boolean(encryptedApiKey),
  };
}

const MASTER = randomBytes(32).toString("base64");

describe("AI config key secrecy", () => {
  it("list payload exposes hasStoredKey + keyLast4 only", () => {
    const plain = "sk-live-super-secret-key";
    const row = {
      id: "cfg1",
      displayName: "Flash",
      encryptedApiKey: encryptSecret(plain, MASTER),
      keyLast4: last4(plain),
      secretReference: "GEMINI_API_KEY",
    };

    const publicRow = toPublicAIConfig(row);
    expect(publicRow.hasStoredKey).toBe(true);
    expect(publicRow.keyLast4).toBe("-key");
    expect(publicRow).not.toHaveProperty("encryptedApiKey");
    expect(JSON.stringify(publicRow)).not.toContain(plain);
    expect(JSON.stringify(publicRow)).not.toContain("v1:");
  });

  it("audit redact strips encryptedApiKey", () => {
    const plain = "sk-audit-secret";
    const before = {
      id: "cfg1",
      encryptedApiKey: encryptSecret(plain, MASTER),
      keyLast4: last4(plain),
      modelId: "gemini-2.5-flash",
    };
    const redacted = redactConfigSecrets(before);
    expect(redacted.encryptedApiKey).toBeUndefined();
    expect(redacted.hasStoredKey).toBe(true);
    expect(JSON.stringify(redacted)).not.toContain(plain);
    expect(JSON.stringify(redacted)).not.toContain("v1:");
  });
});
