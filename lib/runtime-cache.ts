import "server-only";

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const globalForRuntimeCache = globalThis as typeof globalThis & {
  __workbitRuntimeCacheStore?: Map<string, CacheEntry<unknown>>;
  __workbitRuntimeCachePending?: Map<string, Promise<unknown>>;
};

const cacheStore =
  globalForRuntimeCache.__workbitRuntimeCacheStore ??
  new Map<string, CacheEntry<unknown>>();
const pendingStore =
  globalForRuntimeCache.__workbitRuntimeCachePending ??
  new Map<string, Promise<unknown>>();

if (process.env.NODE_ENV !== "production") {
  globalForRuntimeCache.__workbitRuntimeCacheStore = cacheStore;
  globalForRuntimeCache.__workbitRuntimeCachePending = pendingStore;
}

function getNow() {
  return Date.now();
}

function shouldUseMemoryCache() {
  const driver = process.env.CACHE_DRIVER?.trim().toLowerCase();
  return !driver || driver === "memory" || driver === "redis";
}

export async function getOrSetRuntimeCache<T>(
  key: string,
  ttlMs: number,
  loader: () => Promise<T>
): Promise<T> {
  if (!shouldUseMemoryCache() || ttlMs <= 0) {
    return loader();
  }

  const now = getNow();
  const existing = cacheStore.get(key) as CacheEntry<T> | undefined;

  if (existing && existing.expiresAt > now) {
    return existing.value;
  }

  const pending = pendingStore.get(key) as Promise<T> | undefined;

  if (pending) {
    return pending;
  }

  const nextPromise = loader()
    .then((value) => {
      cacheStore.set(key, {
        value,
        expiresAt: getNow() + ttlMs,
      });
      return value;
    })
    .finally(() => {
      pendingStore.delete(key);
    });

  pendingStore.set(key, nextPromise);
  return nextPromise;
}

export function invalidateRuntimeCache(keyPrefix: string) {
  for (const key of cacheStore.keys()) {
    if (key.startsWith(keyPrefix)) {
      cacheStore.delete(key);
    }
  }

  for (const key of pendingStore.keys()) {
    if (key.startsWith(keyPrefix)) {
      pendingStore.delete(key);
    }
  }
}
