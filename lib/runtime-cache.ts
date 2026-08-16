import "server-only";

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const DEFAULT_MAX_CACHE_ENTRIES = 128;
const CACHE_SWEEP_INTERVAL_MS = 30_000;
let lastCacheSweepAt = 0;
let cacheSweepTimer: ReturnType<typeof setTimeout> | null = null;

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

function getMaxCacheEntries() {
  const configured = Number(process.env.WORKBIT_MEMORY_CACHE_MAX_ENTRIES);
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : DEFAULT_MAX_CACHE_ENTRIES;
}

function pruneCache(now: number, force = false) {
  if (!force && now - lastCacheSweepAt < CACHE_SWEEP_INTERVAL_MS) {
    return;
  }

  lastCacheSweepAt = now;

  for (const [key, entry] of cacheStore) {
    if (entry.expiresAt <= now) {
      cacheStore.delete(key);
    }
  }

  const maxEntries = getMaxCacheEntries();
  while (cacheStore.size > maxEntries) {
    const oldestKey = cacheStore.keys().next().value as string | undefined;
    if (!oldestKey) {
      break;
    }
    cacheStore.delete(oldestKey);
  }
}

function scheduleCacheSweep() {
  if (cacheSweepTimer || cacheStore.size === 0) {
    return;
  }

  cacheSweepTimer = setTimeout(() => {
    cacheSweepTimer = null;
    pruneCache(getNow(), true);
    scheduleCacheSweep();
  }, CACHE_SWEEP_INTERVAL_MS);
  cacheSweepTimer.unref?.();
}

function shouldUseMemoryCache() {
  const driver = process.env.CACHE_DRIVER?.trim().toLowerCase();
  return !driver || driver === "memory";
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
  pruneCache(now);
  const existing = cacheStore.get(key) as CacheEntry<T> | undefined;

  if (existing && existing.expiresAt > now) {
    cacheStore.delete(key);
    cacheStore.set(key, existing);
    return existing.value;
  }

  if (existing) {
    cacheStore.delete(key);
  }

  const pending = pendingStore.get(key) as Promise<T> | undefined;

  if (pending) {
    return pending;
  }

  const nextPromise = loader()
    .then((value) => {
      if (pendingStore.get(key) !== nextPromise) {
        return value;
      }

      cacheStore.set(key, {
        value,
        expiresAt: getNow() + ttlMs,
      });
      pruneCache(getNow(), cacheStore.size > getMaxCacheEntries());
      scheduleCacheSweep();
      return value;
    })
    .finally(() => {
      if (pendingStore.get(key) === nextPromise) {
        pendingStore.delete(key);
      }
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
