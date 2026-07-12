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

export function setCachedThread(
  threadId: string,
  payload: Omit<CachedThreadPayload, "fetchedAt"> & { fetchedAt?: number },
) {
  cache.set(threadId, {
    ...payload,
    fetchedAt: payload.fetchedAt ?? Date.now(),
  });
}

export function invalidateCachedThread(threadId: string) {
  cache.delete(threadId);
  inflight.delete(threadId);
}

export async function prefetchThread(
  threadId: string,
): Promise<CachedThreadPayload | null> {
  const existing = cache.get(threadId);
  if (existing && Date.now() - existing.fetchedAt < 30_000) return existing;

  const pending = inflight.get(threadId);
  if (pending) return pending;

  const job = (async () => {
    try {
      const res = await fetch(`/api/conversations/${threadId}`);
      const json = await res.json().catch(() => null);
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
      inflight.delete(threadId);
    }
  })();

  inflight.set(threadId, job);
  return job;
}
