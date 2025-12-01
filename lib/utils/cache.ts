/**
 * Simple in-memory cache with TTL (Time To Live)
 * For serverless environments, each instance has its own cache
 * Upgrade to Redis for production multi-instance deployments
 */

interface CacheEntry<T> {
  data: T
  expires: number
}

const cache = new Map<string, CacheEntry<any>>()

/**
 * Get cached value if it exists and hasn't expired
 */
export function getCached<T>(key: string): T | null {
  const entry = cache.get(key)

  if (!entry) {
    return null
  }

  // Check if expired
  if (Date.now() > entry.expires) {
    cache.delete(key)
    return null
  }

  return entry.data as T
}

/**
 * Store value in cache with TTL
 * @param key - Cache key
 * @param data - Data to cache
 * @param ttlMs - Time to live in milliseconds (default: 5 minutes)
 */
export function setCache<T>(key: string, data: T, ttlMs: number = 300000): void {
  cache.set(key, {
    data,
    expires: Date.now() + ttlMs
  })
}

/**
 * Remove specific key from cache
 */
export function invalidateCache(key: string): void {
  cache.delete(key)
}

/**
 * Remove all cache entries matching pattern
 * @param pattern - Regex pattern to match keys
 */
export function invalidateCachePattern(pattern: RegExp): void {
  for (const key of cache.keys()) {
    if (pattern.test(key)) {
      cache.delete(key)
    }
  }
}

/**
 * Clear entire cache
 */
export function clearCache(): void {
  cache.clear()
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number
  keys: string[]
  hitRate?: number
} {
  return {
    size: cache.size,
    keys: Array.from(cache.keys())
  }
}
