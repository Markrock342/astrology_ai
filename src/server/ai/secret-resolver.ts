import { decryptSecret, SecretBoxError } from "@/lib/crypto/secret-box";
import { resolveSecret } from "@/config/env";
import { defaultSecretRefForProvider } from "@/lib/ai-config-guards";
import type { SupportedAIProvider } from "@/config/ai-provider-models";

/**
 * Resolve an AI provider API key for a config row.
 *
 * Priority:
 * 1. encryptedApiKey in DB → decrypt with AI_SECRET_ENC_KEY
 * 2. secretReference → process.env[name] (legacy / fallback)
 * 3. provider default env (GEMINI_API_KEY / OPENAI_API_KEY) if decrypt fails
 *    after a host key rotation.
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
  provider?: string | null;
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
    try {
      key = decryptSecret(config.encryptedApiKey);
    } catch (err) {
      if (!(err instanceof SecretBoxError)) throw err;
      // Host AI_SECRET_ENC_KEY rotated (e.g. Vercel → VPS) — use env fallback.
      console.error(
        `[ai-key] decrypt failed for config ${config.id}; falling back to env`,
      );
    }
  }
  if (!key && config.secretReference) {
    key = resolveSecret(config.secretReference);
  }
  if (!key && (config.provider === "GEMINI" || config.provider === "OPENAI")) {
    key = resolveSecret(
      defaultSecretRefForProvider(config.provider as SupportedAIProvider),
    );
  }

  if (key) {
    cache.set(config.id, { key, expiresAt: now + CACHE_TTL_MS });
  } else {
    cache.delete(config.id);
  }

  return key;
}
