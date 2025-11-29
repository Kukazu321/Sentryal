import dotenv from 'dotenv';
dotenv.config();

import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config';
import { asfDownloadService } from '../services/asfDownloadService';
import { getRunPodService, RunPodServerlessService } from '../services/runpodServerlessService';
import { velocityCalculationService } from '../services/velocityCalculationService';
import prisma from '../db/client';
import logger from '../utils/logger';
import { jobsCompletedTotal, jobsFailedTotal, jobProcessingDurationSeconds } from '../metrics/metrics';

/**
 * InSAR Worker - Processes InSAR jobs using RunPod Serverless
 * 
 * Pipeline:
 *   1. Receive job from BullMQ
 *   2. Get ASF download URLs
 *   3. Submit to RunPod Serverless (ISCE3 on GPU)
 *   4. Store displacement results in database
 *   5. Calculate velocities
 */

interface InSARJobData {
  jobId: string;
  infrastructureId: string;
  createdAt: number;
  referenceGranule?: string;
  secondaryGranule?: string;
  hyp3JobId?: string | null;
}

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
const redisConnection = {
  host: redisFromUrl?.host || process.env.REDIS_HOST || 'localhost',
  port: redisFromUrl?.port || parseInt(process.env.REDIS_PORT || '6379'),
  password: redisFromUrl?.password || process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required for BullMQ
};

// Create queue
export const insarQueue = new Queue<InSARJobData>('insar-processing', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 120, // Retry up to 120 times (60 minutes with 30s polling)
    backoff: {
      type: 'fixed',
      delay: 30000, // 30 seconds between polls
    },
    removeOnComplete: {
      age: 86400, // Keep completed jobs for 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 604800, // Keep failed jobs for 7 days
    },
  },
});

// Worker processor - RunPod Serverless Implementation
async function processInSARJob(job: Job<InSARJobData>): Promise<void> {
  const { jobId, infrastructureId, referenceGranule, secondaryGranule } = job.data;
  const startTime = Date.now();

  logger.info({
    jobId,
    attempt: job.attemptsMade,
    referenceGranule,
    secondaryGranule,
  }, 'Starting RunPod Serverless InSAR processing');

  let runpodService: RunPodServerlessService;

  try {
    // 1. Initialize RunPod service
    runpodService = getRunPodService();
    logger.info({}, 'RunPod service initialized');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize RunPod service');
    throw error;
  }

  try {
    // 2. Verify job exists
    const existingJob = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, status: true, infrastructure_id: true }
    });

    if (!existingJob) {
      throw new Error(`Job ${jobId} not found in database`);
    }

    // 3. Update status to PROCESSING
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'PROCESSING',
        hy3_job_type: 'RUNPOD_SERVERLESS',
      },
    });

    logger.info({ jobId }, 'Job status updated to PROCESSING');

    // 4. Get infrastructure bbox (stored as JSON text, not PostGIS)
    const infraResult = await prisma.$queryRaw<Array<{ bbox: string }>>`
      SELECT bbox FROM infrastructures WHERE id = ${infrastructureId}
    `;

    if (!infraResult[0] || !infraResult[0].bbox) {
      throw new Error(`Infrastructure ${infrastructureId} not found or has no bbox`);
    }

    // Parse bbox from JSON string
    let bboxGeoJSON: any;
    try {
      bboxGeoJSON = typeof infraResult[0].bbox === 'string'
        ? JSON.parse(infraResult[0].bbox)
        : infraResult[0].bbox;
    } catch {
      throw new Error('Invalid bbox format in infrastructure');
    }

    // Extract bbox bounds from GeoJSON Polygon
    const coords = bboxGeoJSON.coordinates?.[0] || [];
    const lons = coords.map((c: number[]) => c[0]);
    const lats = coords.map((c: number[]) => c[1]);
    const bbox = {
      west: Math.min(...lons),
      east: Math.max(...lons),
      south: Math.min(...lats),
      north: Math.max(...lats)
    };

    logger.info({ jobId, bbox }, 'Bbox extracted from infrastructure');

    // 5. Get infrastructure points (geom stored as JSON text)
    const pointsRaw = await prisma.$queryRaw<Array<{
      id: string;
      geom: string;
    }>>`
      SELECT id, geom FROM points
      WHERE infrastructure_id = ${infrastructureId}
      AND geom IS NOT NULL
    `;

    const points = pointsRaw.map(p => {
      try {
        const geomJson = JSON.parse(p.geom);
        return {
          id: p.id,
          lat: geomJson.coordinates[1],
          lon: geomJson.coordinates[0]
        };
      } catch {
        return null;
      }
    }).filter(p => p !== null) as Array<{ id: string; lat: number; lon: number }>;

    logger.info({ jobId, pointCount: points.length }, 'Retrieved infrastructure points');

    // 6. Get ASF download URLs
    logger.info({ jobId, referenceGranule, secondaryGranule }, 'Getting ASF download URLs');

    const downloadUrls = await asfDownloadService.getDownloadUrls(
      referenceGranule!,
      secondaryGranule!
    );

    logger.info({ jobId }, 'ASF download URLs retrieved');

    // 7. Build webhook URL for results (optional)
    const webhookUrl = process.env.WEBHOOK_BASE_URL
      ? `${process.env.WEBHOOK_BASE_URL}/api/webhook/runpod`
      : undefined;

    // 8. Submit to RunPod Serverless
    logger.info({ jobId }, 'Submitting to RunPod Serverless');

    const runpodInput = {
      job_id: jobId,
      infrastructure_id: infrastructureId,
      reference_granule: referenceGranule!,
      secondary_granule: secondaryGranule!,
      reference_url: downloadUrls.reference,
      secondary_url: downloadUrls.secondary,
      bbox,
      points,
      webhook_url: webhookUrl
    };

    // Use sync mode - wait for completion (2 min timeout for debugging)
    const result = await runpodService.submitJobSync(runpodInput, 2 * 60 * 1000);

    if (!result || result.status !== 'success') {
      throw new Error(`RunPod processing failed: ${result?.error || 'Unknown error'}`);
    }

    logger.info({
      jobId,
      processingTime: result.processing_time_seconds,
      validPoints: result.results?.statistics?.valid_points
    }, 'RunPod processing completed');

    // 9. Store displacement results
    const displacementPoints = result.results?.displacement_points || [];

    if (displacementPoints.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const batchSize = 100;
      let insertedCount = 0;

      for (let i = 0; i < displacementPoints.length; i += batchSize) {
        const batch = displacementPoints.slice(i, i + batchSize);

        // Validate UUIDs
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const validBatch = batch.filter((p: any) =>
          p.valid &&
          uuidRegex.test(p.point_id) &&
          !isNaN(p.displacement_mm)
        );

        if (validBatch.length === 0) continue;

        const values = validBatch.map((point: any) => {
          const coherence = !isNaN(point.coherence) ? point.coherence : 'NULL';
          return `(gen_random_uuid(), '${point.point_id}'::uuid, '${jobId}'::uuid, '${today}', ${point.displacement_mm}, ${coherence}, NOW())`;
        }).join(',\n');

        await prisma.$executeRawUnsafe(`
          INSERT INTO deformations (
            id, point_id, job_id, date, displacement_mm, coherence, created_at
          ) VALUES ${values}
          ON CONFLICT (point_id, job_id, date) DO UPDATE SET
            displacement_mm = EXCLUDED.displacement_mm,
            coherence = EXCLUDED.coherence
        `);

        insertedCount += validBatch.length;
      }

      logger.info({ jobId, insertedCount }, 'Deformations stored');

      // 10. Calculate velocities
      try {
        const velocityUpdates = await velocityCalculationService.calculateInfrastructureVelocities(infrastructureId);
        if (velocityUpdates.length > 0) {
          await velocityCalculationService.updateVelocitiesInDatabase(velocityUpdates);
          logger.info({ jobId, updatedPoints: velocityUpdates.length }, 'Velocities updated');
        }
      } catch (velocityError) {
        logger.warn({ error: velocityError, jobId }, 'Velocity calculation failed (non-critical)');
      }
    }

    // 11. Update job status to SUCCEEDED
    const processingTime = Date.now() - startTime;

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'SUCCEEDED',
        completed_at: new Date(),
        hy3_product_urls: {
          interferogram: result.results?.interferogram_url || '',
          coherence: result.results?.coherence_url || '',
          displacement: result.results?.displacement_url || '',
          statistics: result.results?.statistics
        },
        processing_time_ms: processingTime
      },
    });

    logger.info({
      jobId,
      processingTime,
      status: 'SUCCEEDED',
    }, 'InSAR job completed successfully');

  } catch (error) {
    logger.error({
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      jobId,
      attempt: job.attemptsMade,
    }, 'InSAR job processing failed');

    // Update job status to FAILED if retries exhausted
    if (job.attemptsMade >= (job.opts.attempts || 3)) {
      try {
        await prisma.job.update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            completed_at: new Date(),
            error_message: error instanceof Error ? error.message : 'Unknown error'
          },
        });
        logger.error({ jobId }, 'Job marked as FAILED');
      } catch (dbError) {
        logger.error({ error: dbError, jobId }, 'Failed to update job status');
      }
    }

    throw error;
  }
}

logger.info('Creating InSAR worker...');

// Create worker
export const insarWorker = new Worker<InSARJobData>(
  'insar-processing',
  processInSARJob,
  {
    connection: redisConnection,
    concurrency: 5, // Process up to 5 jobs in parallel
    limiter: {
      max: 10, // Max 10 jobs per duration
      duration: 60000, // 1 minute (rate limit for ISCE3 processing)
    },
  }
);

logger.info('InSAR worker created successfully');

// Worker event handlers
insarWorker.on('completed', (job) => {
  logger.info({ jobId: job.data.jobId }, 'Worker completed job');
  try {
    jobsCompletedTotal.inc();
    const start = (job.processedOn ?? job.timestamp) as number | undefined;
    const end = (job.finishedOn ?? Date.now()) as number | undefined;
    if (start && end) {
      jobProcessingDurationSeconds.observe((end - start) / 1000);
    }
  } catch { }
});

insarWorker.on('failed', (job, error) => {
  if (job) {
    logger.error(
      { jobId: job.data.jobId, error: error.message },
      'Worker failed job'
    );
  }
  try { jobsFailedTotal.inc(); } catch { }
});

insarWorker.on('error', (error) => {
  logger.error({ error }, 'Worker error');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing worker gracefully');
  await insarWorker.close();
  await insarQueue.close();
  process.exit(0);
});

logger.info('InSAR worker initialized and ready to process jobs');
