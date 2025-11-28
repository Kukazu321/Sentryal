import { prisma } from '../db/prisma';
import logger from '../utils/logger';

/**
 * Worker Log Service
 * 
 * Advanced logging system for worker operations with:
 * - Persistent storage in database
 * - Structured error tracking
 * - Retry intelligence
 * - Performance monitoring
 * - Alert triggering
 * 
 * Design principles:
 * - Non-blocking: Logging failures don't crash workers
 * - Efficient: Batch operations where possible
 * - Searchable: Indexed for quick queries
 * - Actionable: Provides context for debugging
 */

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface WorkerLogEntry {
  jobId?: string;
  workerName: string;
  level: LogLevel;
  message: string;
  errorStack?: string;
  metadata?: Record<string, any>;
}

export interface RetryStrategy {
  shouldRetry: boolean;
  delayMs: number;
  reason: string;
}

class WorkerLogService {
  private readonly MAX_RETRIES = 5;
  private readonly BASE_DELAY_MS = 30000; // 30 seconds
  private readonly MAX_DELAY_MS = 600000; // 10 minutes

  /**
   * Log worker event to database
   * Non-blocking - failures are logged to console only
   */
  async log(entry: WorkerLogEntry): Promise<void> {
    try {
      await prisma.workerLog.create({
        data: {
          job_id: entry.jobId,
          worker_name: entry.workerName,
          level: entry.level,
          message: entry.message,
          error_stack: entry.errorStack,
          metadata: entry.metadata ? JSON.parse(JSON.stringify(entry.metadata)) : null,
        },
      });
    } catch (error) {
      // Don't let logging failures crash the worker
      logger.error({ error, entry }, 'Failed to write worker log to database');
    }
  }

  /**
   * Log error with full context
   */
  async logError(
    workerName: string,
    jobId: string | undefined,
    error: Error | unknown,
    context?: Record<string, any>
  ): Promise<void> {
    const errorObj = error instanceof Error ? error : new Error(String(error));

    await this.log({
      jobId,
      workerName,
      level: 'ERROR',
      message: errorObj.message,
      errorStack: errorObj.stack,
      metadata: {
        ...context,
        errorName: errorObj.name,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Determine if job should be retried based on error history
   * Uses exponential backoff with jitter
   */
  async getRetryStrategy(jobId: string, currentAttempt: number): Promise<RetryStrategy> {
    try {
      // Get error history for this job
      const errorLogs = await prisma.workerLog.findMany({
        where: {
          job_id: jobId,
          level: {
            in: ['ERROR', 'FATAL'],
          },
        },
        orderBy: {
          created_at: 'desc',
        },
        take: 10,
      });

      // Check if max retries exceeded
      if (currentAttempt >= this.MAX_RETRIES) {
        return {
          shouldRetry: false,
          delayMs: 0,
          reason: `Maximum retry attempts (${this.MAX_RETRIES}) exceeded`,
        };
      }

      // Analyze error patterns
      const recentErrors = errorLogs.slice(0, 3);
      const errorMessages = recentErrors.map(log => log.message);

      // Don't retry certain fatal errors
      const fatalPatterns = [
        'Authentication failed',
        'Invalid credentials',
        'Infrastructure not found',
        'Unauthorized',
        'Permission denied',
      ];

      const isFatalError = errorMessages.some(msg =>
        fatalPatterns.some(pattern => msg.includes(pattern))
      );

      if (isFatalError) {
        return {
          shouldRetry: false,
          delayMs: 0,
          reason: 'Fatal error detected - retry would not succeed',
        };
      }

      // Check for rapid consecutive failures (circuit breaker pattern)
      if (recentErrors.length >= 3) {
        const timeSpan =
          recentErrors[0].created_at.getTime() - recentErrors[2].created_at.getTime();

        // If 3 failures in less than 5 minutes, increase delay significantly
        if (timeSpan < 300000) {
          return {
            shouldRetry: true,
            delayMs: Math.min(this.BASE_DELAY_MS * 10, this.MAX_DELAY_MS),
            reason: 'Circuit breaker: Multiple rapid failures detected',
          };
        }
      }

      // Calculate exponential backoff with jitter
      const exponentialDelay = this.BASE_DELAY_MS * Math.pow(2, currentAttempt - 1);
      const jitter = Math.random() * 0.3 * exponentialDelay; // ±30% jitter
      const delay = Math.min(exponentialDelay + jitter, this.MAX_DELAY_MS);

      return {
        shouldRetry: true,
        delayMs: Math.round(delay),
        reason: `Retry attempt ${currentAttempt}/${this.MAX_RETRIES} with exponential backoff`,
      };
    } catch (error) {
      logger.error({ error, jobId }, 'Failed to determine retry strategy');

      // Default to retry with base delay
      return {
        shouldRetry: currentAttempt < this.MAX_RETRIES,
        delayMs: this.BASE_DELAY_MS,
        reason: 'Default retry strategy (error in analysis)',
      };
    }
  }

  /**
   * Get error summary for a job
   */
  async getJobErrorSummary(jobId: string): Promise<{
    totalErrors: number;
    lastError: string | null;
    errorTypes: Record<string, number>;
    timeline: Array<{ timestamp: Date; message: string }>;
  }> {
    try {
      const errorLogs = await prisma.workerLog.findMany({
        where: {
          job_id: jobId,
          level: {
            in: ['ERROR', 'FATAL'],
          },
        },
        orderBy: {
          created_at: 'desc',
        },
      });

      // Categorize errors
      const errorTypes: Record<string, number> = {};
      errorLogs.forEach(log => {
        const category = this.categorizeError(log.message);
        errorTypes[category] = (errorTypes[category] || 0) + 1;
      });

      return {
        totalErrors: errorLogs.length,
        lastError: errorLogs[0]?.message || null,
        errorTypes,
        timeline: errorLogs.slice(0, 10).map(log => ({
          timestamp: log.created_at,
          message: log.message,
        })),
      };
    } catch (error) {
      logger.error({ error, jobId }, 'Failed to get job error summary');
      return {
        totalErrors: 0,
        lastError: null,
        errorTypes: {},
        timeline: [],
      };
    }
  }

  /**
   * Get worker health metrics
   */
  async getWorkerHealth(workerName: string, hoursBack: number = 24): Promise<{
    totalLogs: number;
    errorRate: number;
    avgProcessingTime: number | null;
    recentErrors: Array<{ message: string; count: number }>;
  }> {
    try {
      const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

      const logs = await prisma.workerLog.findMany({
        where: {
          worker_name: workerName,
          created_at: {
            gte: since,
          },
        },
        select: {
          level: true,
          message: true,
          metadata: true,
        },
      });

      const totalLogs = logs.length;
      const errorLogs = logs.filter(log => log.level === 'ERROR' || log.level === 'FATAL');
      const errorRate = totalLogs > 0 ? errorLogs.length / totalLogs : 0;

      // Calculate average processing time from metadata
      const processingTimes = logs
        .map(log => {
          const metadata = log.metadata as any;
          return metadata?.processingTimeMs;
        })
        .filter((time): time is number => typeof time === 'number');

      const avgProcessingTime =
        processingTimes.length > 0
          ? processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length
          : null;

      // Group errors by message
      const errorCounts = new Map<string, number>();
      errorLogs.forEach(log => {
        const count = errorCounts.get(log.message) || 0;
        errorCounts.set(log.message, count + 1);
      });

      const recentErrors = Array.from(errorCounts.entries())
        .map(([message, count]) => ({ message, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalLogs,
        errorRate,
        avgProcessingTime,
        recentErrors,
      };
    } catch (error) {
      logger.error({ error, workerName }, 'Failed to get worker health');
      return {
        totalLogs: 0,
        errorRate: 0,
        avgProcessingTime: null,
        recentErrors: [],
      };
    }
  }

  /**
   * Clean old logs (retention policy)
   * Call this periodically (e.g., daily cron job)
   */
  async cleanOldLogs(retentionDays: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      const result = await prisma.workerLog.deleteMany({
        where: {
          created_at: {
            lt: cutoffDate,
          },
          level: {
            in: ['DEBUG', 'INFO'], // Keep errors longer
          },
        },
      });

      logger.info(
        { deletedCount: result.count, retentionDays },
        'Cleaned old worker logs'
      );

      return result.count;
    } catch (error) {
      logger.error({ error }, 'Failed to clean old logs');
      return 0;
    }
  }

  /**
   * Categorize error for analysis
   */
  private categorizeError(message: string): string {
    const categories = [
      { pattern: /network|timeout|ECONNREFUSED|ETIMEDOUT/i, category: 'Network' },
      { pattern: /database|prisma|sql/i, category: 'Database' },
      { pattern: /parse|invalid|malformed/i, category: 'Parsing' },
      { pattern: /auth|unauthorized|forbidden/i, category: 'Authentication' },
      { pattern: /not found|missing/i, category: 'NotFound' },
      { pattern: /memory|heap|allocation/i, category: 'Memory' },
    ];

    for (const { pattern, category } of categories) {
      if (pattern.test(message)) {
        return category;
      }
    }

    return 'Other';
  }

  /**
   * Check if error should trigger alert
   */
  shouldTriggerAlert(level: LogLevel, errorCount: number, timeWindowMinutes: number): boolean {
    // Trigger alert for FATAL errors immediately
    if (level === 'FATAL') {
      return true;
    }

    // Trigger alert if more than 5 errors in 10 minutes
    if (level === 'ERROR' && errorCount > 5 && timeWindowMinutes <= 10) {
      return true;
    }

    return false;
  }
}

export const workerLogService = new WorkerLogService();
