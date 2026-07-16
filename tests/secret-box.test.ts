import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  isEncryptionConfigured,
  last4,
  maskKey,
  parseMasterKey,
  SecretBoxError,
} from "@/lib/crypto/secret-box";
import { randomBytes } from "node:crypto";

const MASTER = randomBytes(32).toString("base64");
const OTHER = randomBytes(32).toString("base64");

describe("secret-box", () => {
  it("roundtrips plaintext", () => {
    const plain = "sk-test-gemini-abc123XYZ";
    const sealed = encryptSecret(plain, MASTER);
    expect(sealed.startsWith("v1:")).toBe(true);
    expect(decryptSecret(sealed, MASTER)).toBe(plain);
  });

  it("produces different ciphertext each time (random IV)", () => {
    const a = encryptSecret("same-key", MASTER);
    const b = encryptSecret("same-key", MASTER);
    expect(a).not.toBe(b);
    expect(decryptSecret(a, MASTER)).toBe("same-key");
    expect(decryptSecret(b, MASTER)).toBe("same-key");
  });

  it("fails with the wrong master key", () => {
    const sealed = encryptSecret("secret", MASTER);
    expect(() => decryptSecret(sealed, OTHER)).toThrow(SecretBoxError);
  });

  it("fails when ciphertext is tampered", () => {
    const sealed = encryptSecret("secret", MASTER);
    const parts = sealed.split(":");
    // Flip a bit in the cipher segment
    const cipher = Buffer.from(parts[3], "base64");
    cipher[0] = cipher[0]! ^ 0xff;
    parts[3] = cipher.toString("base64");
    expect(() => decryptSecret(parts.join(":"), MASTER)).toThrow(SecretBoxError);
  });

  it("rejects empty plaintext / bad format", () => {
    expect(() => encryptSecret("", MASTER)).toThrow(SecretBoxError);
    expect(() => decryptSecret("not-a-payload", MASTER)).toThrow(SecretBoxError);
  });

  it("parses base64 and hex master keys", () => {
    const hex = randomBytes(32).toString("hex");
    expect(parseMasterKey(hex).length).toBe(32);
    expect(parseMasterKey(MASTER).length).toBe(32);
  });

  it("isEncryptionConfigured reflects env", () => {
    expect(isEncryptionConfigured("")).toBe(false);
    expect(isEncryptionConfigured("short")).toBe(false);
    expect(isEncryptionConfigured(MASTER)).toBe(true);
  });

  it("last4 and maskKey", () => {
    expect(last4("abcdefgh")).toBe("efgh");
    expect(maskKey("efgh")).toBe("••••efgh");
    expect(maskKey(null)).toBe("••••");
  });
});
