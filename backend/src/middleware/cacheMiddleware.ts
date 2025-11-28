import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/**
 * Simple in-memory cache middleware for expensive operations
 * Note: For production, consider using Redis for distributed caching
 */

// In-memory cache
const cache = new Map<string, { data: any; expires: number }>();

/**
 * Clean expired cache entries
 */
function cleanExpiredCache() {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (value.expires < now) {
      cache.delete(key);
    }
  }
}

// Clean cache every 60 seconds
setInterval(cleanExpiredCache, 60000);

/**
 * Cache middleware factory
 * @param ttl Time to live in seconds (default: 5 minutes)
 * @param keyPrefix Prefix for cache keys
 */
export function cacheMiddleware(ttl: number = 300, keyPrefix: string = 'cache') {
  return (req: Request, res: Response, next: NextFunction) => {
    // Generate cache key from request
    const cacheKey = `${keyPrefix}:${req.method}:${req.originalUrl}`;

    try {
      // Try to get cached response
      const cached = cache.get(cacheKey);
      const now = Date.now();

      if (cached && cached.expires > now) {
        logger.debug({ cacheKey }, 'Cache hit');
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        // Convert BigInt in cached data before sending
        const convertBigInt = (obj: any): any => {
          if (obj === null || obj === undefined) return obj;
          if (typeof obj === 'bigint') return Number(obj);
          if (obj instanceof Date) return obj;
          if (Array.isArray(obj)) return obj.map(convertBigInt);
          if (typeof obj === 'object' && obj.constructor === Object) {
            const converted: any = {};
            for (const key in obj) {
              if (Object.prototype.hasOwnProperty.call(obj, key)) {
                converted[key] = convertBigInt(obj[key]);
              }
            }
            return converted;
          }
          return obj;
        };
        return res.json(convertBigInt(cached.data));
      }

      logger.debug({ cacheKey }, 'Cache miss');

      // Helper function to convert BigInt to Number for JSON serialization
      const convertBigInt = (obj: any): any => {
        if (obj === null || obj === undefined) return obj;
        if (typeof obj === 'bigint') return Number(obj);
        if (obj instanceof Date) return obj;
        if (Array.isArray(obj)) return obj.map(convertBigInt);
        if (typeof obj === 'object' && obj.constructor === Object) {
          const converted: any = {};
          for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
              converted[key] = convertBigInt(obj[key]);
            }
          }
          return converted;
        }
        return obj;
      };

      // Store original res.json function
      const originalJson = res.json.bind(res);

      // Override res.json to cache the response
      res.json = function (body: any) {
        // Convert BigInt to Number before caching and sending
        const convertedBody = convertBigInt(body);
        
        // Cache the response
        cache.set(cacheKey, {
          data: convertedBody,
          expires: now + (ttl * 1000),
        });
        logger.debug({ cacheKey, ttl }, 'Response cached');

        // Set cache headers
        res.setHeader('X-Cache', 'MISS');
        res.setHeader('X-Cache-Key', cacheKey);
        res.setHeader('Cache-Control', `public, max-age=${ttl}`);

        // Call original json function with converted body
        return originalJson(convertedBody);
      };

      next();
    } catch (error) {
      logger.warn({ error, cacheKey }, 'Cache middleware error, proceeding without cache');
      next();
    }
  };
}

/**
 * Invalidate cache for a specific pattern
 * @param pattern Cache key pattern (e.g., 'cache:map-data')
 */
export function invalidateCache(pattern: string): void {
  try {
    let count = 0;
    for (const key of cache.keys()) {
      if (key.includes(pattern)) {
        cache.delete(key);
        count++;
      }
    }
    if (count > 0) {
      logger.info({ pattern, count }, 'Cache invalidated');
    }
  } catch (error) {
    logger.error({ error, pattern }, 'Failed to invalidate cache');
  }
}

/**
 * Clear all cache
 */
export function clearAllCache(): void {
  try {
    cache.clear();
    logger.info('All cache cleared');
  } catch (error) {
    logger.error({ error }, 'Failed to clear cache');
  }
}
