/**
 * Short lived, browser-memory cache for the public procurement list endpoint.
 * The API remains `no-store`; this cache only avoids repeat GETs during client
 * navigation and is bounded to prevent unbounded growth in a long-lived tab.
 */

const CACHE_TTL_MS = 10_000;
const MAX_CACHE_ENTRIES = 40;

type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

const responseCache = new Map<string, CacheEntry>();
const pendingRequests = new Map<string, Promise<unknown>>();

export async function fetchPublicProjects<T = unknown>(url: string): Promise<T> {
  const requestUrl = new URL(url, window.location.origin);

  // Only cache the public, read-only list endpoint. Detail, user, and admin
  // endpoints are deliberately excluded from this cache.
  if (
    requestUrl.origin !== window.location.origin ||
    requestUrl.pathname !== '/api/projects'
  ) {
    throw new Error('Only the public projects list endpoint can use this cache');
  }

  const key = `${requestUrl.pathname}${requestUrl.search}`;
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    // Refresh insertion order so the least recently used entry is evicted.
    responseCache.delete(key);
    responseCache.set(key, cached);
    return cached.value as T;
  }

  const pending = pendingRequests.get(key);
  if (pending) return (await pending) as T;

  const request = fetch(key, { method: 'GET', cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Projects request failed: ${response.status}`);
      const value: unknown = await response.json();

      responseCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
      if (responseCache.size > MAX_CACHE_ENTRIES) {
        const oldestKey = responseCache.keys().next().value;
        if (oldestKey) responseCache.delete(oldestKey);
      }
      return value;
    })
    .finally(() => pendingRequests.delete(key));

  pendingRequests.set(key, request);
  return (await request) as T;
}
