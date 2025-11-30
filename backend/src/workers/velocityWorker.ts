import { Worker, Job, Queue } from 'bullmq';
import { redisConnection } from '../config/redis';
import logger from '../utils/logger';
import { velocityCalculationService } from '../services/velocityCalculationService';

/**
 * Velocity Calculation Worker
 * 
 * Processes velocity calculations in background to avoid blocking the webhook.
 * This ensures the API remains responsive while heavy computations run separately.
 */

export interface VelocityJobData {
  infrastructureId: string;
  jobId: string;
  triggeredBy: 'webhook' | 'manual';
}

// Create velocity calculation queue
export const velocityQueue = new Queue<VelocityJobData>('velocity-calculation', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 100,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
});

/**
 * Process velocity calculation job
 */
async function processVelocityCalculation(job: Job<VelocityJobData>): Promise<void> {
  const { infrastructureId, jobId, triggeredBy } = job.data;
  const startTime = Date.now();

  try {
    logger.info(
      { jobId, infrastructureId, triggeredBy, velocityJobId: job.id },
      'Starting velocity calculation'
    );

    // Calculate velocities for all points in infrastructure
    const velocityUpdates = await velocityCalculationService.calculateInfrastructureVelocities(
      infrastructureId
    );

    if (velocityUpdates.length === 0) {
      logger.warn(
        { jobId, infrastructureId, velocityJobId: job.id },
        'No velocity updates calculated (insufficient data)'
      );
      return;
    }

    // Update velocities in database
    await velocityCalculationService.updateVelocitiesInDatabase(velocityUpdates);

    const duration = Date.now() - startTime;
    logger.info(
      {
        jobId,
        infrastructureId,
        velocityJobId: job.id,
        updatedPoints: velocityUpdates.length,
        durationMs: duration,
      },
      'Velocity calculation completed successfully'
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(
      {
        error,
        jobId,
        infrastructureId,
        velocityJobId: job.id,
        durationMs: duration,
      },
      'Velocity calculation failed'
    );
    throw error; // Let BullMQ handle retry logic
  }
}

// Create velocity worker
export const velocityWorker = new Worker<VelocityJobData>(
  'velocity-calculation',
  processVelocityCalculation,
  {
    connection: redisConnection,
    concurrency: 2, // Process 2 velocity calculations in parallel
    limiter: {
      max: 10, // Max 10 jobs per duration
      duration: 60000, // 1 minute
    },
  }
);

// Worker event handlers
velocityWorker.on('completed', (job) => {
  logger.info(
    { velocityJobId: job.id, infrastructureId: job.data.infrastructureId },
    'Velocity worker completed job'
  );
});

velocityWorker.on('failed', (job, err) => {
  logger.error(
    {
      error: err,
      velocityJobId: job?.id,
      infrastructureId: job?.data.infrastructureId,
      attemptsMade: job?.attemptsMade,
    },
    'Velocity worker failed job'
  );
});

velocityWorker.on('error', (err) => {
  logger.error({ error: err }, 'Velocity worker error');
});

logger.info('Velocity calculation worker created and ready');
