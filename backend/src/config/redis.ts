/**
 * Redis Configuration for BullMQ
 * Centralized Redis connection settings used by all workers
 */

// Parse REDIS_URL if provided
function parseRedisUrl(url?: string) {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        return {
            host: parsed.hostname,
            port: parseInt(parsed.port) || 6379,
            password: parsed.password || undefined,
        };
    } catch {
        return null;
    }
}

const redisFromUrl = parseRedisUrl(process.env.REDIS_URL);

// Redis connection for BullMQ
export const redisConnection = {
    host: redisFromUrl?.host || process.env.REDIS_HOST || 'localhost',
    port: redisFromUrl?.port || parseInt(process.env.REDIS_PORT || '6379'),
    password: redisFromUrl?.password || process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null, // Required for BullMQ
};
