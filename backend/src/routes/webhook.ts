import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import prisma from '../db/client';
import { velocityCalculationService } from '../services/velocityCalculationService';

const router = Router();

/**
 * POST /api/webhook/runpod
 * Webhook endpoint for RunPod Serverless job completion
 * 
 * Called by RunPod when an InSAR processing job completes.
 * Updates database with results and triggers velocity calculation.
 */
router.post('/runpod', async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
        const payload = req.body;

        // Verify webhook signature if configured
        const signature = req.headers['x-runpod-signature'] as string;
        if (process.env.RUNPOD_WEBHOOK_SECRET && signature) {
            const crypto = require('crypto');
            const expectedSignature = crypto
                .createHmac('sha256', process.env.RUNPOD_WEBHOOK_SECRET)
                .update(JSON.stringify(payload))
                .digest('hex');

            if (signature !== expectedSignature) {
                logger.warn({ signature }, 'Invalid webhook signature');
                res.status(401).json({ error: 'Invalid signature' });
                return;
            }
        }

        const { job_id: jobId, status, results, error, processing_time_seconds } = payload;

        logger.info({
            jobId,
            status,
            processingTime: processing_time_seconds
        }, 'Received RunPod webhook');

        if (!jobId) {
            logger.warn('Webhook missing job_id');
            res.status(400).json({ error: 'Missing job_id' });
            return;
        }

        // Get job from database
        const existingJob = await prisma.job.findUnique({
            where: { id: jobId },
            select: { id: true, status: true, infrastructure_id: true }
        });

        if (!existingJob) {
            logger.warn({ jobId }, 'Job not found for webhook');
            res.status(404).json({ error: 'Job not found' });
            return;
        }

        // Handle failure
        if (status === 'error') {
            await prisma.job.update({
                where: { id: jobId },
                data: {
                    status: 'FAILED',
                    completed_at: new Date(),
                    error_message: error || 'Unknown error from RunPod'
                }
            });

            logger.error({ jobId, error }, 'RunPod job failed');
            res.json({ received: true, status: 'failed' });
            return;
        }

        // Process successful results
        if (status === 'success' && results) {
            const { displacement_points, statistics, interferogram_url, coherence_url, displacement_url } = results;

            // Store displacement measurements
            if (displacement_points && displacement_points.length > 0) {
                const today = new Date().toISOString().split('T')[0];
                const batchSize = 100;
                let insertedCount = 0;

                for (let i = 0; i < displacement_points.length; i += batchSize) {
                    const batch = displacement_points.slice(i, i + batchSize);

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

                logger.info({ jobId, insertedCount }, 'Deformations stored from webhook');

                // Calculate velocities
                try {
                    const velocityUpdates = await velocityCalculationService.calculateInfrastructureVelocities(
                        existingJob.infrastructure_id
                    );
                    if (velocityUpdates.length > 0) {
                        await velocityCalculationService.updateVelocitiesInDatabase(velocityUpdates);
                        logger.info({ jobId, updatedPoints: velocityUpdates.length }, 'Velocities updated');
                    }
                } catch (velocityError) {
                    logger.warn({ error: velocityError, jobId }, 'Velocity calculation failed (non-critical)');
                }
            }

            // Update job status
            await prisma.job.update({
                where: { id: jobId },
                data: {
                    status: 'SUCCEEDED',
                    completed_at: new Date(),
                    processing_time_ms: processing_time_seconds ? processing_time_seconds * 1000 : null,
                    hy3_product_urls: {
                        interferogram: interferogram_url || '',
                        coherence: coherence_url || '',
                        displacement: displacement_url || '',
                        statistics: statistics || {}
                    }
                }
            });

            logger.info({
                jobId,
                duration: Date.now() - startTime,
                validPoints: statistics?.valid_points || 0
            }, 'RunPod job completed successfully');
        }

        res.json({ received: true, status: 'success' });

    } catch (error) {
        logger.error({
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        }, 'Webhook processing failed');

        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/webhook/health
 * Health check for webhook endpoint
 */
router.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
