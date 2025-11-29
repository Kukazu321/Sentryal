import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import prisma from '../db/client';
import { velocityCalculationService } from '../services/velocityCalculationService';
import axios from 'axios';
import * as GeoTIFF from 'geotiff';

const router = Router();

/**
 * Helper function to extract value from GeoTIFF at lat/lon
 */
async function extractValueFromGeoTIFF(image: any, lat: number, lon: number): Promise<number | null> {
    try {
        const origin = image.getOrigin();
        const resolution = image.getResolution();
        const bbox = image.getBoundingBox();

        // Check if point is inside bbox
        if (lon < bbox[0] || lon > bbox[2] || lat < bbox[1] || lat > bbox[3]) {
            return null;
        }

        // Calculate pixel coordinates
        const x = Math.floor((lon - origin[0]) / resolution[0]);
        const y = Math.floor((lat - origin[1]) / resolution[1]);

        const width = image.getWidth();
        const height = image.getHeight();

        if (x < 0 || x >= width || y < 0 || y >= height) {
            return null;
        }

        // Read pixel value
        const window = [x, y, x + 1, y + 1];
        const rasters = await image.readRasters({ window });
        const value = rasters[0][0];

        // Check for NoData (usually -9999 or NaN)
        if (value === -9999 || isNaN(value)) {
            return null;
        }

        return value;
    } catch (e) {
        return null;
    }
}

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
            const { statistics, interferogram_url, coherence_url, displacement_url } = results;
            let { displacement_points } = results;

            // If points missing but we have displacement URL, extract them here
            if ((!displacement_points || displacement_points.length === 0) && displacement_url) {
                logger.info({ jobId }, 'Extracting displacement points from raster...');

                try {
                    // 1. Get infrastructure points
                    const points = await prisma.$queryRaw<Array<{
                        id: string;
                        latitude: number;
                        longitude: number;
                    }>>`
                        SELECT id, ST_Y(geom::geometry) as latitude, ST_X(geom::geometry) as longitude
                        FROM points
                        WHERE infrastructure_id = ${existingJob.infrastructure_id}
                    `;

                    // 2. Download GeoTIFFs
                    const dispResponse = await axios.get(displacement_url, { responseType: 'arraybuffer' });
                    const dispTiff = await GeoTIFF.fromArrayBuffer(dispResponse.data);
                    const dispImage = await dispTiff.getImage();

                    let cohImage = null;
                    if (coherence_url) {
                        try {
                            const cohResponse = await axios.get(coherence_url, { responseType: 'arraybuffer' });
                            const cohTiff = await GeoTIFF.fromArrayBuffer(cohResponse.data);
                            cohImage = await cohTiff.getImage();
                        } catch (e) {
                            logger.warn('Failed to download coherence raster, skipping coherence extraction');
                        }
                    }

                    // 3. Extract values
                    displacement_points = [];
                    for (const point of points) {
                        const disp = await extractValueFromGeoTIFF(dispImage, point.latitude, point.longitude);

                        if (disp !== null) {
                            let coh = 0;
                            if (cohImage) {
                                const cohVal = await extractValueFromGeoTIFF(cohImage, point.latitude, point.longitude);
                                if (cohVal !== null) coh = cohVal;
                            }

                            displacement_points.push({
                                point_id: point.id,
                                displacement_mm: disp,
                                coherence: coh,
                                valid: true
                            });
                        }
                    }

                    logger.info({ jobId, count: displacement_points.length }, 'Extracted points from raster');

                    // Update statistics
                    if (!statistics) {
                        results.statistics = {
                            valid_points: displacement_points.length
                        };
                    } else {
                        results.statistics.valid_points = displacement_points.length;
                    }

                } catch (extractionError) {
                    logger.error({ error: extractionError, jobId }, 'Failed to extract points from raster');
                }
            }

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
                        statistics: results.statistics || {}
                    }
                }
            });

            logger.info({
                jobId,
                duration: Date.now() - startTime,
                validPoints: results.statistics?.valid_points || 0
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
