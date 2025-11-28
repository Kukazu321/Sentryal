import dotenv from 'dotenv';
dotenv.config();

import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config';
import { gmtsarService } from '../services/gmtsarService';
import { isceService } from '../services/isceService';
import { asfDownloadService } from '../services/asfDownloadService';
import { gdalService } from '../services/gdalService';
import { velocityCalculationService } from '../services/velocityCalculationService';
import prisma from '../db/client';
import logger from '../utils/logger';
import { jobsCompletedTotal, jobsFailedTotal, jobProcessingDurationSeconds } from '../metrics/metrics';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';

/**
 * InSAR Worker - Processes InSAR jobs using GMTSAR
 * 
 * Full Processing Pipeline:
 * 1. Setup GMTSAR working directory
 * 2. Download SAR granules from ASF
 * 3. Run GMTSAR processing workflow
 * 4. Extract displacement at infrastructure points
 * 5. Store results in database
 */

interface InSARJobData {
  jobId: string; // Our DB job ID
  infrastructureId: string;
  createdAt: number;
  referenceGranule?: string; // Sentinel-1 granule name (reference image)
  secondaryGranule?: string; // Sentinel-1 granule name (secondary image)
  referenceGranulePath?: string; // Path to downloaded reference granule
  secondaryGranulePath?: string; // Path to downloaded secondary granule
  demPath?: string; // Path to DEM file
  bbox?: { north: number; south: number; east: number; west: number };
  hyp3JobId?: string | null;
}

// Redis connection for BullMQ
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
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

// Worker processor - GMTSAR Implementation
async function processInSARJob(job: Job<InSARJobData>): Promise<void> {
  const { jobId, infrastructureId, referenceGranule, secondaryGranule, demPath, bbox } = job.data;
  const startTime = Date.now();
  let workingDir: string | null = null;

  logger.info(
    {
      jobId,
      attempt: job.attemptsMade,
      referenceGranule,
      secondaryGranule,
    },
    'Starting ISCE3 InSAR processing pipeline',
  );

  try {
    // 1. Verify ISCE3 installation
    const isceCheck = await isceService.checkInstallation();
    if (!isceCheck.installed) {
      throw new Error(`ISCE3 not properly installed: ${isceCheck.error}`);
    }

    logger.info({ version: isceCheck.version }, 'ISCE3 verified');

    // 2. Create working directory for this job
    // Use Linux path for production
    workingDir = path.join('/tmp', 'isce_processing', jobId);
    await fs.mkdir(workingDir, { recursive: true });
    logger.info({ jobId, workingDir }, 'Created ISCE3 working directory');

    // 3. Verify job exists before updating
    const existingJob = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, status: true, infrastructure_id: true }
    });

    if (!existingJob) {
      throw new Error(`Job ${jobId} not found in database. It may have been deleted.`);
    }

    logger.info({ jobId, currentStatus: existingJob.status }, 'Job found, updating to PROCESSING');

    // 4. Update job status to PROCESSING
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'PROCESSING',
        hy3_job_type: 'ISCE3',
      },
      select: { id: true, status: true }
    });

    // 5. Get infrastructure bbox for processing
    const infra = await prisma.infrastructure.findUnique({
      where: { id: infrastructureId }
    });

    if (!infra) {
      throw new Error(`Infrastructure ${infrastructureId} not found`);
    }

    // Extract bbox from infrastructure geometry
    const bboxQuery = await prisma.$queryRaw<Array<{
      bbox_geojson: any;
    }>>`
      SELECT ST_AsGeoJSON(bbox::geometry) as bbox_geojson
      FROM infrastructures
      WHERE id = ${infrastructureId}
    `;

    const bboxGeoJSON = JSON.parse(bboxQuery[0].bbox_geojson);

    logger.info({ jobId, bbox: bboxGeoJSON }, 'Processing bbox retrieved');

    // 6. Download SAR granules from ASF
    logger.info({ jobId, referenceGranule, secondaryGranule }, 'Downloading SAR granules from ASF');

    // Create raw directory for GMTSAR
    const rawDir = path.join(workingDir, 'raw');
    await fs.mkdir(rawDir, { recursive: true });

    const downloadResult = await asfDownloadService.downloadInSARPair(
      referenceGranule,
      secondaryGranule,
      rawDir
    );

    if (downloadResult.error || !downloadResult.reference || !downloadResult.secondary) {
      throw new Error(`Failed to download SAR data: ${downloadResult.error}`);
    }

    logger.info({
      jobId,
      referencePath: downloadResult.reference,
      secondaryPath: downloadResult.secondary
    }, 'SAR granules downloaded successfully');

    // 7. Run ISCE3 InSAR processing
    logger.info({ jobId }, 'Starting ISCE3 InSAR processing');

    const result = await isceService.processInSARPair({
      referenceGranule: downloadResult.reference,
      secondaryGranule: downloadResult.secondary,
      bbox: bboxGeoJSON,
      outputDir: workingDir
    });

    if (!result.success) {
      throw new Error(`ISCE3 processing failed: ${result.error}`);
    }

    logger.info(
      {
        jobId,
        interferogram: result.interferogram,
        coherence: result.coherence,
        unwrapped: result.unwrapped,
      },
      'ISCE3 processing completed',
    );

    // 8. Extract displacement at infrastructure points
    logger.info({ jobId, infrastructureId }, 'Extracting displacement at infrastructure points');

    const points = await prisma.$queryRaw<
      Array<{
        id: string;
        latitude: number;
        longitude: number;
      }>
    >`
      SELECT 
        id,
        ST_Y(geom::geometry) as latitude,
        ST_X(geom::geometry) as longitude
      FROM points
      WHERE infrastructure_id = ${infrastructureId}
    `;

    logger.info({ jobId, pointCount: points.length }, 'Retrieved infrastructure points');

    if (points.length === 0) {
      logger.warn({ jobId, infrastructureId }, 'No points found for infrastructure');
    } else {
      // Extract real displacement values from ISCE3 GeoTIFF outputs using GDAL
      logger.info({ jobId }, 'Extracting displacement values from GeoTIFF using GDAL');

      // ISCE3 outputs are already geocoded GeoTIFFs
      // displacement is in result.interferogram (which is actually the displacement map in our service implementation)
      // Wait, let's check isceService implementation of result object
      // It returns { interferogram: final_disp, coherence: final_coh, ... }

      if (!result.interferogram || !result.coherence) {
        throw new Error('ISCE3 did not produce required output files (displacement/coherence)');
      }

      const extractionResult = await gdalService.extractDisplacementAtPoints(
        result.interferogram,
        result.coherence,
        points
      );

      const displacementPoints = extractionResult.points.filter(p => p.valid);

      logger.info(
        {
          jobId,
          pointsExtracted: displacementPoints.length,
          validPoints: extractionResult.stats.validCount,
          invalidPoints: extractionResult.stats.invalidCount,
          meanDisplacement: extractionResult.stats.meanDisplacement,
          meanCoherence: extractionResult.stats.meanCoherence,
          displacementRange: {
            min: extractionResult.stats.minDisplacement,
            max: extractionResult.stats.maxDisplacement
          }
        },
        'Displacement extracted from GeoTIFF',
      );

      // 9. Store deformations in database
      if (displacementPoints.length > 0) {
        logger.info(
          {
            jobId,
            pointCount: displacementPoints.length,
          },
          'Storing deformations in database',
        );

        const batchSize = 100;
        let insertedCount = 0;

        for (let i = 0; i < displacementPoints.length; i += batchSize) {
          const batch = displacementPoints.slice(i, i + batchSize);

          // Validate and prepare batch data for parameterized insertion
          const today = new Date().toISOString().split('T')[0];

          // Validate all UUIDs in batch
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          for (const point of batch) {
            if (!uuidRegex.test(point.pointId)) {
              throw new Error(`Invalid point ID: ${point.pointId}`);
            }
          }

          // Build parameterized VALUES - only validated numeric/uuid data
          const values = batch
            .map((point) => {
              const coherence = !isNaN(point.coherence) ? point.coherence : 'NULL';
              const displacement = !isNaN(point.losDisplacementMm) ? point.losDisplacementMm : 'NULL';
              return `(gen_random_uuid(), '${point.pointId}'::uuid, '${jobId}'::uuid, '${today}', ${displacement}, ${coherence}, NOW())`;
            })
            .join(',\n');

          try {
            // Note: values are validated (UUIDs checked, numbers validated with isNaN)
            await prisma.$executeRawUnsafe(`
              INSERT INTO deformations (
                id,
                point_id,
                job_id,
                date,
                displacement_mm,
                coherence,
                created_at
              ) VALUES ${values}
              ON CONFLICT (point_id, job_id, date) DO UPDATE SET
                displacement_mm = EXCLUDED.displacement_mm,
                coherence = EXCLUDED.coherence
            `);

            insertedCount += batch.length;
          } catch (insertError) {
            logger.error(
              {
                error: insertError,
                jobId,
                batchNumber: Math.floor(i / batchSize) + 1,
              },
              'Batch insert failed',
            );
            throw insertError;
          }
        }

        logger.info({ jobId, insertedCount }, 'Deformations stored successfully');

        // 9. Calculate velocities
        logger.info({ jobId, infrastructureId }, 'Calculating velocities');
        try {
          const velocityUpdates = await velocityCalculationService.calculateInfrastructureVelocities(infrastructureId);

          if (velocityUpdates.length > 0) {
            await velocityCalculationService.updateVelocitiesInDatabase(velocityUpdates);
            logger.info(
              {
                jobId,
                updatedPoints: velocityUpdates.length,
              },
              'Velocities calculated and updated',
            );
          } else {
            logger.info({ jobId }, 'Insufficient data for velocity calculation');
          }
        } catch (velocityError) {
          logger.warn({ error: velocityError, jobId }, 'Velocity calculation failed (non-critical)');
        }
      }
    }

    // 8. Update job status to SUCCEEDED
    const processingTime = Date.now() - startTime;

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: 'SUCCEEDED',
        completed_at: new Date(),
        hy3_product_urls: {
          interferogram: result.interferogram || '',
          coherence: result.coherence || '',
          unwrapped: result.unwrapped || '',
        },
        processing_time_ms: processingTime
      },
      select: { id: true, status: true }
    });

    // 9. Cleanup working directory (optional in dev mode)
    if (config.nodeEnv === 'production' && workingDir) {
      try {
        await fs.rm(workingDir, { recursive: true, force: true });
        logger.info({ jobId, workingDir }, 'Cleaned up ISCE3 working directory');
      } catch (cleanupError) {
        logger.warn({ error: cleanupError, jobId }, 'Failed to cleanup working directory');
      }
    } else {
      logger.info({ jobId, workingDir }, 'Kept ISCE3 working directory for debugging');
    }

    logger.info(
      {
        jobId,
        processingTime,
        status: 'SUCCEEDED',
      },
      'InSAR job completed successfully',
    );
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        jobId,
        attempt: job.attemptsMade,
      },
      'InSAR job processing failed',
    );

    // Update job status to FAILED if retries exhausted
    if (job.attemptsMade >= (job.opts.attempts || 120)) {
      try {
        await prisma.job.update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            completed_at: new Date(),
            error_message: error instanceof Error ? error.message : 'Unknown error'
          },
          select: { id: true, status: true }
        });

        logger.error({ jobId }, 'Job marked as FAILED after max retries');
      } catch (dbError) {
        logger.error({ error: dbError, jobId }, 'Failed to update job status');
      }
    }

    throw error; // Re-throw to trigger retry
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
