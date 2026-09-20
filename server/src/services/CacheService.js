/**
 * Ultra-fast In-Memory LRU/TTL Cache Service
 * Eliminates redundant cloud database roundtrips for read-heavy dashboards and catalogs.
 */
class MemoryCacheService {
  constructor() {
    this.cache = new Map();
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }

  set(key, data, ttlMs = 15000) {
    this.cache.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
    // Keep cache bounded
    if (this.cache.size > 300) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  invalidate(pattern = null) {
    if (!pattern) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

export const CacheService = new MemoryCacheService();
