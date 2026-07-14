/**
 * Client-side thread message cache for soft chat switching (Khui-like UX).
 * Survives sidebar navigation without waiting on a full refetch.
 */

export type CachedChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  modelId?: string;
  status?: "SUCCESS" | "FAILED" | "TIMEOUT" | "PENDING";
  chartSnapshot?: unknown;
  transitSnapshot?: unknown;
  summaryLine?: string;
  followUps?: string[];
};

export type CachedThreadPayload = {
  messages: CachedChatMessage[];
  categorySlug?: string | null;
  mode?: "NATAL" | "TRANSIT" | null;
  transitDate?: string | null;
  transitTime?: string | null;
  fetchedAt: number;
};

const cache = new Map<string, CachedThreadPayload>();
const inflight = new Map<string, Promise<CachedThreadPayload | null>>();

export function getCachedThread(threadId: string): CachedThreadPayload | null {
  return cache.get(threadId) ?? null;
}

/**
 * Warm the cache with what the caller owns, PRESERVING what it doesn't.
 *
 * ChatView writes only messages/category/mode as you chat. Replacing the entry
 * wholesale dropped transitDate/transitTime, and prefetchThread then served
 * that gutted copy for 30s — so revisiting a ดวงจร thread lost its
 * "โหมดดวงจร · <date>" header until the cache expired.
 */
export function setCachedThread(
  threadId: string,
  payload: Omit<CachedThreadPayload, "fetchedAt"> & { fetchedAt?: number },
) {
  const prev = cache.get(threadId);
  cache.set(threadId, {
    ...prev,
    ...payload,
    fetchedAt: payload.fetchedAt ?? Date.now(),
  });
}

export function invalidateCachedThread(threadId: string) {
  cache.delete(threadId);
  inflight.delete(threadId);
}

/** Drop every cached thread — after "clear all history", nothing may survive. */
export function clearThreadCache() {
  cache.clear();
  inflight.clear();
}

export async function prefetchThread(
  threadId: string,
  options?: { timeoutMs?: number },
): Promise<CachedThreadPayload | null> {
  const existing = cache.get(threadId);
  if (existing && Date.now() - existing.fetchedAt < 30_000) return existing;

  const pending = inflight.get(threadId);
  if (pending) return pending;

  const timeoutMs = options?.timeoutMs ?? 10_000;

  const job = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`/api/conversations/${threadId}`, {
        signal: controller.signal,
      });
      const json = await res.json().catch(() => null);
      // The thread is definitively gone (deleted here, in another tab, or on
      // another device). Keeping the stale entry made it render as a live chat
      // forever — a network blip, by contrast, must NOT evict a good copy.
      if (res.status === 404 || json?.error?.code === "NOT_FOUND") {
        cache.delete(threadId);
        return null;
      }
      if (!res.ok || !json?.ok) return null;
      const payload: CachedThreadPayload = {
        messages: json.data.messages ?? [],
        categorySlug: json.data.categorySlug ?? null,
        mode: json.data.mode === "TRANSIT" ? "TRANSIT" : "NATAL",
        transitDate: json.data.transitDate ?? null,
        transitTime: json.data.transitTime ?? null,
        fetchedAt: Date.now(),
      };
      cache.set(threadId, payload);
      return payload;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
      inflight.delete(threadId);
    }
  })();

  inflight.set(threadId, job);
  return job;
}
