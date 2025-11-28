import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma';
import logger from '../utils/logger';

/**
 * Rate limiter middleware
 * Limits the number of InSAR jobs a user can create per time period
 */

interface RateLimitConfig {
  maxJobsPerHour: number;
  maxJobsPerDay: number;
  maxActiveJobs: number;
}

const defaultConfig: RateLimitConfig = {
  maxJobsPerHour: 5,
  maxJobsPerDay: 20,
  maxActiveJobs: 3,
};

export function rateLimiter(config: Partial<RateLimitConfig> = {}) {
  const finalConfig = { ...defaultConfig, ...config };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const userId = req.userId;
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Count jobs created in the last hour
      const jobsLastHour = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int as count
        FROM jobs j
        JOIN infrastructures i ON j.infrastructure_id = i.id
        WHERE i.user_id::text = ${userId}
          AND j.created_at >= ${oneHourAgo}
      `;

      if (jobsLastHour[0].count >= finalConfig.maxJobsPerHour) {
        logger.warn({ userId, count: jobsLastHour[0].count }, 'Rate limit exceeded (hourly)');
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: `Maximum ${finalConfig.maxJobsPerHour} jobs per hour allowed`,
          retryAfter: 3600, // seconds
        });
        return;
      }

      // Count jobs created in the last day
      const jobsLastDay = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int as count
        FROM jobs j
        JOIN infrastructures i ON j.infrastructure_id = i.id
        WHERE i.user_id::text = ${userId}
          AND j.created_at >= ${oneDayAgo}
      `;

      if (jobsLastDay[0].count >= finalConfig.maxJobsPerDay) {
        logger.warn({ userId, count: jobsLastDay[0].count }, 'Rate limit exceeded (daily)');
        res.status(429).json({
          error: 'Rate limit exceeded',
          message: `Maximum ${finalConfig.maxJobsPerDay} jobs per day allowed`,
          retryAfter: 86400, // seconds
        });
        return;
      }

      // Count active jobs (PENDING or PROCESSING)
      const activeJobs = await prisma.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int as count
        FROM jobs j
        JOIN infrastructures i ON j.infrastructure_id = i.id
        WHERE i.user_id::text = ${userId}
          AND j.status IN ('PENDING', 'PROCESSING')
      `;

      if (activeJobs[0].count >= finalConfig.maxActiveJobs) {
        logger.warn({ userId, count: activeJobs[0].count }, 'Too many active jobs');
        res.status(429).json({
          error: 'Too many active jobs',
          message: `Maximum ${finalConfig.maxActiveJobs} active jobs allowed. Please wait for current jobs to complete.`,
        });
        return;
      }

      // All checks passed
      next();
    } catch (error) {
      logger.error({ error }, 'Rate limiter error');
      // Don't block request on rate limiter error
      next();
    }
  };
}
