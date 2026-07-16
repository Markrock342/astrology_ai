import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM secret box for AI API keys stored in the DB.
 * Format: `v1:<iv_b64>:<tag_b64>:<cipher_b64>`
 *
 * Master key comes from `AI_SECRET_ENC_KEY` (32 raw bytes as base64 or 64-char hex).
 * Set once on the host; admins never touch it — they only paste provider API keys
 * into the admin UI, which are encrypted before persistence.
 */

const VERSION = "v1";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const ALG = "aes-256-gcm";

export class SecretBoxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretBoxError";
  }
}

/** Parse AI_SECRET_ENC_KEY (base64 or hex) into a 32-byte Buffer. */
export function parseMasterKey(raw: string): Buffer {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new SecretBoxError("AI_SECRET_ENC_KEY is empty");
  }

  let buf: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    buf = Buffer.from(trimmed, "hex");
  } else {
    buf = Buffer.from(trimmed, "base64");
  }

  if (buf.length !== KEY_BYTES) {
    throw new SecretBoxError(
      `AI_SECRET_ENC_KEY must decode to ${KEY_BYTES} bytes (got ${buf.length})`,
    );
  }
  return buf;
}

export function isEncryptionConfigured(
  envKey: string | undefined = process.env.AI_SECRET_ENC_KEY,
): boolean {
  if (!envKey?.trim()) return false;
  try {
    parseMasterKey(envKey);
    return true;
  } catch {
    return false;
  }
}

function requireKey(envKey?: string): Buffer {
  const raw = envKey ?? process.env.AI_SECRET_ENC_KEY;
  if (!raw?.trim()) {
    throw new SecretBoxError(
      "AI_SECRET_ENC_KEY is not set — cannot encrypt/decrypt admin-managed API keys",
    );
  }
  return parseMasterKey(raw);
}

/** Encrypt plaintext → `v1:iv:tag:cipher` (all base64). */
export function encryptSecret(plain: string, envKey?: string): string {
  if (!plain) throw new SecretBoxError("Cannot encrypt empty secret");
  const key = requireKey(envKey);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALG, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/** Decrypt `v1:iv:tag:cipher` → plaintext. Throws if tampered or wrong key. */
export function decryptSecret(payload: string, envKey?: string): string {
  if (!payload) throw new SecretBoxError("Cannot decrypt empty payload");
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new SecretBoxError("Invalid encrypted payload format");
  }
  const [, ivB64, tagB64, cipherB64] = parts;
  const key = requireKey(envKey);
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const encrypted = Buffer.from(cipherB64, "base64");

  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new SecretBoxError("Decryption failed — wrong key or tampered data");
  }
}

/** Last 4 characters for masked UI (`••••1234`). */
export function last4(plain: string): string {
  if (plain.length <= 4) return plain;
  return plain.slice(-4);
}

/** Mask for display: `••••1234` or `••••` when unknown. */
export function maskKey(keyLast4: string | null | undefined): string {
  if (!keyLast4) return "••••";
  return `••••${keyLast4}`;
}
