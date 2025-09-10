// Simple in-memory cache for realtime flight status to reduce external provider calls.
// Not persisted; resets on server restart. Good enough for rate limiting free tier usage.

export interface CachedRealtimeEntry<T> {
  fetchedAt: number; // epoch ms
  data: T;
}

class RealtimeCache {
  private store = new Map<string, CachedRealtimeEntry<unknown>>();
  private maxEntries: number;

  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries;
  }

  get<T>(key: string): CachedRealtimeEntry<T> | undefined {
    return this.store.get(key) as CachedRealtimeEntry<T> | undefined;
  }

  set<T>(key: string, data: T) {
    if (this.store.size >= this.maxEntries) {
      // naive eviction: delete oldest
      let oldestKey: string | null = null;
      let oldestTs = Infinity;
      for (const [k, v] of this.store.entries()) {
        if (v.fetchedAt < oldestTs) { oldestTs = v.fetchedAt; oldestKey = k; }
      }
      if (oldestKey) this.store.delete(oldestKey);
    }
    this.store.set(key, { fetchedAt: Date.now(), data });
  }
}

// Singleton instance
export const realtimeCache = new RealtimeCache();

// TTL strategy (ms) based on status & timing heuristics.
export function computeTTL(params: { status?: string; departed: boolean; landed: boolean; depMs?: number; arrMs?: number; now?: number; }): number {
  const { status, departed, landed, depMs, arrMs } = params;
  const now = params.now ?? Date.now();
  if (landed) return 30 * 60 * 1000; // 30m
  if (!departed) {
    if (depMs) {
      const minsUntilDep = (depMs - now) / 60000;
      if (minsUntilDep > 6 * 60) return 60 * 60 * 1000; // >6h away -> 1h
      if (minsUntilDep > 180) return 30 * 60 * 1000;    // 3-6h -> 30m
      if (minsUntilDep > 60) return 15 * 60 * 1000;     // 1-3h -> 15m
      return 5 * 60 * 1000;                             // <1h -> 5m
    }
    return 15 * 60 * 1000; // unknown dep time
  }
  // Enroute
  if (arrMs) {
    const minsToArr = (arrMs - now) / 60000;
    if (minsToArr > 180) return 15 * 60 * 1000; // >3h remaining
    if (minsToArr > 60) return 10 * 60 * 1000;  // 1-3h
    if (minsToArr > 30) return 5 * 60 * 1000;   // 30-60m
    return 2 * 60 * 1000;                       // final 30m
  }
  return 5 * 60 * 1000;
}
