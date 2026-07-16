import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/env", () => ({
  resolveSecret: (name: string) =>
    name === "GEMINI_API_KEY" ? "env-gemini-key" : undefined,
}));

vi.mock("@/lib/crypto/secret-box", async () => {
  const actual = await vi.importActual<typeof import("@/lib/crypto/secret-box")>(
    "@/lib/crypto/secret-box",
  );
  return actual;
});

import {
  _cacheSizeForTests,
  _resetKeyCacheForTests,
  invalidateKeyCache,
  resolveApiKey,
} from "@/server/ai/secret-resolver";
import { encryptSecret } from "@/lib/crypto/secret-box";
import { randomBytes } from "node:crypto";

const MASTER = randomBytes(32).toString("base64");

describe("secret-resolver", () => {
  beforeEach(() => {
    _resetKeyCacheForTests();
    process.env.AI_SECRET_ENC_KEY = MASTER;
  });

  it("decrypts encryptedApiKey and caches the result", async () => {
    const plain = "db-stored-key-9999";
    const encryptedApiKey = encryptSecret(plain, MASTER);

    const first = await resolveApiKey({
      id: "cfg-1",
      encryptedApiKey,
      secretReference: "GEMINI_API_KEY",
    });
    expect(first).toBe(plain);
    expect(_cacheSizeForTests()).toBe(1);

    // Second call should hit cache (same value) without needing decrypt again
    const second = await resolveApiKey({
      id: "cfg-1",
      encryptedApiKey: "v1:tampered:should:not-be-used",
      secretReference: null,
    });
    expect(second).toBe(plain);
  });

  it("falls back to env when no encrypted key", async () => {
    const key = await resolveApiKey({
      id: "cfg-env",
      encryptedApiKey: null,
      secretReference: "GEMINI_API_KEY",
    });
    expect(key).toBe("env-gemini-key");
  });

  it("invalidateKeyCache clears a single entry", async () => {
    const encryptedApiKey = encryptSecret("k", MASTER);
    await resolveApiKey({ id: "cfg-x", encryptedApiKey, secretReference: null });
    expect(_cacheSizeForTests()).toBe(1);
    invalidateKeyCache("cfg-x");
    expect(_cacheSizeForTests()).toBe(0);
  });

  it("returns undefined when nothing is configured", async () => {
    const key = await resolveApiKey({
      id: "cfg-empty",
      encryptedApiKey: null,
      secretReference: "MISSING_ENV",
    });
    expect(key).toBeUndefined();
  });
});
