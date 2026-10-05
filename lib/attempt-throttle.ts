/**
 * Counts attempts per key in a sliding window, in memory.
 *
 * Enough to stop a script trying passwords or flooding someone's inbox: the
 * counts reset on a restart and are per copy of the app, which a determined
 * attacker could spread across, but not a script hammering one address.
 */
type Bucket = { count: number; resetAt: number };

export function createAttemptThrottle(windowMs: number, maxAttempts: number) {
  const buckets = new Map<string, Bucket>();

  function sweep(now: number) {
    if (buckets.size < 1000) {
      return;
    }

    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
  }

  return {
    /** True while the key still has attempts left. Does not count one. */
    isAllowed(key: string) {
      const bucket = buckets.get(key);
      return !bucket || bucket.resetAt <= Date.now() || bucket.count < maxAttempts;
    },
    /** Counts one attempt against the key. */
    record(key: string) {
      const now = Date.now();
      sweep(now);
      const bucket = buckets.get(key);

      if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return;
      }

      bucket.count += 1;
    },
    /** Forgets the key, after a success. */
    reset(key: string) {
      buckets.delete(key);
    },
  };
}
