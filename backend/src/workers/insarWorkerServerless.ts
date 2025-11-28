import dotenv from 'dotenv';
dotenv.config();

import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config';
import { asfDownloadService } from '../services/asfDownloadService';
import { gdalService } from '../services/gdalService';
import { velocityCalculationService } from '../services/velocityCalculationService';
import { getRunPodService, RunPodServerlessService } from '../services/runpodServerlessService';
import prisma from '../db/client';
import logger from '../utils/logger';
import { jobsCompletedTotal, jobsFailedTotal, jobProcessingDurationSeconds } from '../metrics/metrics';

/**
 * InSAR Worker V2 - RunPod Serverless Edition
 * =============================================
 * 
 * Cette version utilise RunPod Serverless pour le traitement GPU.
 * Avantages:
 *   - Pas de coût quand inactif (pay-per-job)
 *   - Auto-scaling automatique
 *   - Environnement ISCE3 pré-configuré dans l'image Docker
 *   - Pas de perte de setup lors d'arrêts
 * 
 * Pipeline:
 *   1. Recevoir job depuis BullMQ
 *   2. Préparer les URLs de téléchargement ASF
 *   3. Soumettre à RunPod Serverless
 *   4. Récupérer les résultats (via webhook ou polling)
 *   5. Stocker les déformations en base
 *   6. Calculer les vélocités
 */

interface InSARJobData {
    jobId: string;
    infrastructureId: string;
    createdAt: number;
    referenceGranule?: string;
    secondaryGranule?: string;
    useServerless?: boolean; // Flag pour utiliser RunPod Serverless
}

// Redis connection for BullMQ
const redisConnection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
};

// Create queue
export const insarQueueV2 = new Queue<InSARJobData>('insar-processing-v2', {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3, // Moins de retries car RunPod gère les erreurs
        backoff: {
            type: 'exponential',
            delay: 60000, // 1 minute
        },
        removeOnComplete: {
            age: 86400,
            count: 1000,
        },
        removeOnFail: {
            age: 604800,
        },
    },
});

// Worker processor - RunPod Serverless
async function processInSARJobServerless(job: Job<InSARJobData>): Promise<void> {
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
        // Initialize RunPod service
        runpodService = getRunPodService();
    } catch (error) {
        logger.error({ error }, 'Failed to initialize RunPod service - falling back to local');
        throw error;
    }

    try {
        // 1. Verify job exists
        const existingJob = await prisma.job.findUnique({
            where: { id: jobId },
            select: { id: true, status: true, infrastructure_id: true }
        });

        if (!existingJob) {
            throw new Error(`Job ${jobId} not found in database`);
        }

        // 2. Update status to PROCESSING
        await prisma.job.update({
            where: { id: jobId },
            data: {
                status: 'PROCESSING',
                hy3_job_type: 'RUNPOD_SERVERLESS',
            },
        });

        // 3. Get infrastructure bbox
        const bboxQuery = await prisma.$queryRaw<Array<{
            bbox_geojson: string;
        }>>`
      SELECT ST_AsGeoJSON(ST_Envelope(bbox::geometry)) as bbox_geojson
      FROM infrastructures
      WHERE id = ${infrastructureId}
    `;

        const bboxGeoJSON = JSON.parse(bboxQuery[0].bbox_geojson);
        const coords = bboxGeoJSON.coordinates[0];

        // Extract bbox bounds
        const lons = coords.map((c: number[]) => c[0]);
        const lats = coords.map((c: number[]) => c[1]);
        const bbox = {
            west: Math.min(...lons),
            east: Math.max(...lons),
            south: Math.min(...lats),
            north: Math.max(...lats)
        };

        // 4. Get infrastructure points
        const points = await prisma.$queryRaw<Array<{
            id: string;
            latitude: number;
            longitude: number;
        }>>`
      SELECT 
        id,
        ST_Y(geom::geometry) as latitude,
        ST_X(geom::geometry) as longitude
      FROM points
      WHERE infrastructure_id = ${infrastructureId}
    `;

        logger.info({ jobId, pointCount: points.length }, 'Retrieved infrastructure points');

        // 5. Get ASF download URLs
        const downloadUrls = await asfDownloadService.getDownloadUrls(
            referenceGranule!,
            secondaryGranule!
        );

        // 6. Build webhook URL for results
        const webhookUrl = process.env.WEBHOOK_BASE_URL
            ? `${process.env.WEBHOOK_BASE_URL}/api/webhook/runpod`
            : undefined;

        // 7. Submit to RunPod Serverless
        logger.info({ jobId }, 'Submitting to RunPod Serverless');

        const runpodInput = {
            job_id: jobId,
            infrastructure_id: infrastructureId,
            reference_granule: referenceGranule!,
            secondary_granule: secondaryGranule!,
            reference_url: downloadUrls.reference,
            secondary_url: downloadUrls.secondary,
            bbox,
            points: points.map(p => ({
                id: p.id,
                lat: p.latitude,
                lon: p.longitude
            })),
            webhook_url: webhookUrl
        };

        // Use sync mode for now (wait for completion)
        // In production, use async mode with webhook
        const result = await runpodService.submitJobSync(runpodInput, 45 * 60 * 1000); // 45 min timeout

        if (!result || result.status !== 'success') {
            throw new Error(`RunPod processing failed: ${result?.error || 'Unknown error'}`);
        }

        logger.info({
            jobId,
            processingTime: result.processing_time_seconds,
            validPoints: result.results?.statistics?.valid_points
        }, 'RunPod processing completed');

        // 8. Store displacement results
        const displacementPoints = result.results?.displacement_points || [];

        if (displacementPoints.length > 0) {
            const today = new Date().toISOString().split('T')[0];
            const batchSize = 100;
            let insertedCount = 0;

            for (let i = 0; i < displacementPoints.length; i += batchSize) {
                const batch = displacementPoints.slice(i, i + batchSize);

                // Validate UUIDs
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                const validBatch = batch.filter(p =>
                    p.valid &&
                    uuidRegex.test(p.point_id) &&
                    !isNaN(p.displacement_mm)
                );

                if (validBatch.length === 0) continue;

                const values = validBatch.map(point => {
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

            // 9. Calculate velocities
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

        // 10. Update job status to SUCCEEDED
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

        // Update job status to FAILED
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

logger.info('Creating InSAR V2 worker (RunPod Serverless)...');

// Create worker
export const insarWorkerV2 = new Worker<InSARJobData>(
    'insar-processing-v2',
    processInSARJobServerless,
    {
        connection: redisConnection,
        concurrency: 10, // RunPod gère la concurrence, on peut en envoyer plus
        limiter: {
            max: 20,
            duration: 60000,
        },
    }
);

logger.info('InSAR V2 worker created');

// Event handlers
insarWorkerV2.on('completed', (job) => {
    logger.info({ jobId: job.data.jobId }, 'Worker V2 completed job');
    try {
        jobsCompletedTotal.inc();
        const start = (job.processedOn ?? job.timestamp) as number | undefined;
        const end = (job.finishedOn ?? Date.now()) as number | undefined;
        if (start && end) {
            jobProcessingDurationSeconds.observe((end - start) / 1000);
        }
    } catch { }
});

insarWorkerV2.on('failed', (job, error) => {
    if (job) {
        logger.error({ jobId: job.data.jobId, error: error.message }, 'Worker V2 failed job');
    }
    try { jobsFailedTotal.inc(); } catch { }
});

insarWorkerV2.on('error', (error) => {
    logger.error({ error }, 'Worker V2 error');
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing worker V2 gracefully');
    await insarWorkerV2.close();
    await insarQueueV2.close();
    process.exit(0);
});

logger.info('InSAR V2 worker initialized and ready');
