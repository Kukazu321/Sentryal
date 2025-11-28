import { Router, Request, Response } from 'express';
import prisma from '../db/client';
import IORedis from 'ioredis';
import { isceService } from '../services/isceService';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const start = Date.now();

  // DB check
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch (e) {
    dbOk = false;
  }

  // Parse REDIS_URL if provided
  const parseRedisUrl = (url?: string) => {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      return { host: parsed.hostname, port: parseInt(parsed.port) || 6379, password: parsed.password || undefined };
    } catch { return null; }
  };
  const redisFromUrl = parseRedisUrl(process.env.REDIS_URL);

  // Redis check
  let redisOk = false;
  try {
    const redis = new IORedis({
      host: redisFromUrl?.host || process.env.REDIS_HOST || 'localhost',
      port: redisFromUrl?.port || parseInt(process.env.REDIS_PORT || '6379'),
      password: redisFromUrl?.password || process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
    });
    await redis.ping();
    await redis.quit();
    redisOk = true;
  } catch (e) {
    redisOk = false;
  }

  // ISCE3 check - verify installation and accessibility in WSL
  let isceOk = false;
  try {
    const result = await isceService.checkInstallation();
    isceOk = result.installed;
  } catch {
    isceOk = false;
  }

  const ok = dbOk && redisOk && isceOk;

  res.status(ok ? 200 : 503).json({
    ok,
    uptimeSeconds: Math.round(process.uptime()),
    durationMs: Date.now() - start,
    services: {
      database: dbOk,
      redis: redisOk,
      isce3: { ok: isceOk },
    },
  });
});

export default router;
