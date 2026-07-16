import { decryptSecret } from "@/lib/crypto/secret-box";
import { resolveSecret } from "@/config/env";

/**
 * Resolve an AI provider API key for a config row.
 *
 * Priority:
 * 1. encryptedApiKey in DB → decrypt with AI_SECRET_ENC_KEY
 * 2. secretReference → process.env[name] (legacy / fallback)
 *
 * In-memory cache (TTL 60s) avoids repeated DB decrypts when many chats
 * hit the same config concurrently. Invalidate on admin create/update/delete.
 */

const CACHE_TTL_MS = 60_000;

type CacheEntry = { key: string; expiresAt: number };

const cache = new Map<string, CacheEntry>();

export type SecretResolveInput = {
  id: string;
  encryptedApiKey?: string | null;
  secretReference?: string | null;
};

export function invalidateKeyCache(configId?: string) {
  if (configId) cache.delete(configId);
  else cache.clear();
}

/** Test helper — peek cache size / clear without going through invalidate. */
export function _resetKeyCacheForTests() {
  cache.clear();
}

export function _cacheSizeForTests() {
  return cache.size;
}

/**
 * Resolve the plaintext API key for a config. Returns undefined if neither
 * encrypted key nor env fallback is available.
 */
export async function resolveApiKey(
  config: SecretResolveInput,
): Promise<string | undefined> {
  const now = Date.now();
  const hit = cache.get(config.id);
  if (hit && hit.expiresAt > now) return hit.key;

  let key: string | undefined;

  if (config.encryptedApiKey) {
    key = decryptSecret(config.encryptedApiKey);
  } else if (config.secretReference) {
    key = resolveSecret(config.secretReference);
  }

  if (key) {
    cache.set(config.id, { key, expiresAt: now + CACHE_TTL_MS });
  } else {
    cache.delete(config.id);
  }

  return key;
}
