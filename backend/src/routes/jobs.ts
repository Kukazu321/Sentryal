import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { authOrApiKey } from '../middleware/authOrApiKey';
import { requireInfraRole } from '../middleware/authorizeInfra';
import { validateBody, validateQuery } from '../middleware/validation';
import { rateLimiter } from '../middleware/rateLimiter';
import { z } from 'zod';
import { databaseService } from '../services/databaseService';
// HyP3 removed - using GMTSAR instead
import { granuleSearchService } from '../services/granuleSearchService';
import logger from '../utils/logger';
import { prisma, Prisma } from '../db/prisma';
import { insarQueue } from '../workers/insarWorker';
import { jobsEnqueuedTotal } from '../metrics/metrics';

const router = Router();

// All routes require authentication (JWT or API key)
router.use(authOrApiKey());

/**
 * GET /api/jobs
 * List jobs for an infrastructure
 * Query params: infrastructureId (required)
 */
router.get(
  '/',
  validateQuery(z.object({ infrastructureId: z.string().uuid() })),
  requireInfraRole('read', 'query', 'infrastructureId'),
  async (req: Request, res: Response) => {
    try {
      const { infrastructureId } = req.query as { infrastructureId: string };

      const jobs = await databaseService.getJobsByInfrastructure(infrastructureId);

      res.json({
        jobs,
        count: jobs.length,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get jobs');
      res.status(500).json({ error: 'Failed to retrieve jobs' });
    }
  }
);

/**
 * POST /api/jobs
 * DEPRECATED: Use POST /api/jobs/process-insar instead
 * 
 * This route is kept for backward compatibility but redirects to process-insar
 */
router.post(
  '/',
  async (req: Request, res: Response) => {
    res.status(410).json({
      error: 'Endpoint deprecated',
      message: 'Please use POST /api/jobs/process-insar instead',
      newEndpoint: '/api/jobs/process-insar'
    });
  }
);

/**
 * POST /api/jobs/:id/retry
 * Retry a job that failed or got stuck
 * Re-adds the job to the processing queue
 */
router.post(
  '/:id/retry',
  async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;

      // Get job with raw query to avoid Prisma issues
      const jobs = await prisma.$queryRaw<Array<{
        id: string;
        hy3_job_id: string;
        infrastructure_id: string;
        user_id: string;
      }>>`
        SELECT j.id, j.hy3_job_id, j.infrastructure_id, i.user_id
        FROM jobs j
        JOIN infrastructures i ON j.infrastructure_id = i.id
        WHERE j.id = ${id}
      `;

      if (jobs.length === 0) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      const job = jobs[0];

      // Verify ownership
      if (job.user_id !== req.userId) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      // Re-add to queue
      await insarQueue.add('process-insar', {
        jobId: job.id,
        hyp3JobId: null, // No longer using HyP3
        infrastructureId: job.infrastructure_id,
        createdAt: Date.now()
      });
      try { jobsEnqueuedTotal.inc(); } catch { }

      logger.info({ jobId: job.id }, 'Job re-added to queue');

      res.json({
        message: 'Job re-added to processing queue',
        jobId: job.id
      });
    } catch (error) {
      logger.error({ error }, 'Failed to retry job');
      res.status(500).json({ error: 'Failed to retry job' });
    }
  }
);

/**
 * GET /api/jobs/:id
 * Get a specific job
 */
router.get(
  '/:id',
  async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;

      // Get all infrastructures for user
      const infrastructures = await databaseService.getUserInfrastructures(req.userId);
      const infrastructureIds = infrastructures.map((infra) => infra.id);

      // Find job
      const allJobs = await Promise.all(
        infrastructureIds.map((infraId) => databaseService.getJobsByInfrastructure(infraId))
      );
      const job = allJobs.flat().find((j) => j.id === id);

      if (!job) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      res.json(job);
    } catch (error) {
      logger.error({ error }, 'Failed to get job');
      res.status(500).json({ error: 'Failed to retrieve job' });
    }
  }
);

/**
 * POST /api/jobs/process-insar
 * Create and start InSAR processing job
 * Phase 4: Full implementation with HyP3 integration
 */
router.post(
  '/process-insar',
  rateLimiter({ maxJobsPerHour: 5, maxJobsPerDay: 20, maxActiveJobs: 3 }),
  validateBody(z.object({
    infrastructureId: z.string().uuid(),
    // Mode 1: Date range (existing)
    dateRange: z.object({
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
    }).optional(),
    // Mode 2: Target date - find N closest images
    targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    imageCount: z.number().int().min(2).max(5).optional(), // Number of images to find (default 3)
    // Mode 3: Specific dates - find closest image for each
    specificDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(2).max(5).optional(),
    options: z.object({
      looks: z.string().optional(),
      includeDEM: z.boolean().optional(),
      includeIncMap: z.boolean().optional(),
      includeLosDisplacement: z.boolean().optional()
    }).optional()
  })),
  requireInfraRole('write', 'body', 'infrastructureId'),
  async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const { infrastructureId, dateRange, targetDate, imageCount, specificDates, options } = req.body;

      logger.info({
        infrastructureId,
        dateRange,
        targetDate,
        imageCount,
        specificDates,
        userId: req.userId
      }, '[PROCESS-INSAR] 1. Request received');

      // Check if infrastructure has points
      logger.info({ infrastructureId }, '[PROCESS-INSAR] 2. Checking infrastructure has points');
      const points = await databaseService.getPointsByInfrastructure(infrastructureId);
      logger.info({ infrastructureId, pointCount: points.length }, '[PROCESS-INSAR] 3. Points retrieved');

      if (points.length === 0) {
        logger.warn({ infrastructureId }, '[PROCESS-INSAR] ERROR: No points found');
        res.status(400).json({
          error: 'Infrastructure has no points. Generate grid first.'
        });
        return;
      }

      logger.info({
        infrastructureId,
        pointsCount: points.length,
        dateRange,
        targetDate,
        imageCount,
        specificDates
      }, '[PROCESS-INSAR] 4. Starting InSAR processing');

      // Calculate aggregated bbox from points
      logger.info({ infrastructureId }, '[PROCESS-INSAR] 5. Calculating bbox');
      const bbox = await databaseService.getAggregatedBbox(infrastructureId);
      logger.info({ infrastructureId, bbox }, '[PROCESS-INSAR] 6. Bbox calculated');

      let pairs: any[] = [];
      let selectedPair: any;

      // Mode 1: Target date - find N closest images and create pairs
      if (targetDate) {
        logger.info({ targetDate }, '[PROCESS-INSAR] 7. Mode: Target date');
        const count = imageCount || 3;
        logger.info({ targetDate, count }, '[PROCESS-INSAR] 8. Finding closest granules');

        const closestGranules = await granuleSearchService.findClosestGranules(bbox, targetDate, count);
        logger.info({ closestGranules: closestGranules.length }, '[PROCESS-INSAR] 9. Granules found');

        if (closestGranules.length < 2) {
          logger.warn({ found: closestGranules.length }, '[PROCESS-INSAR] ERROR: Not enough granules');
          res.status(404).json({
            error: 'Not enough granules found',
            message: `Found ${closestGranules.length} granules, need at least 2 for InSAR pairs.`
          });
          return;
        }

        // Create pairs from closest granules
        logger.info({ count: closestGranules.length }, '[PROCESS-INSAR] 10. Creating pairs');
        pairs = await granuleSearchService.createPairsFromGranules(closestGranules);
        logger.info({ pairs: pairs.length }, '[PROCESS-INSAR] 11. Pairs created');

        if (pairs.length === 0) {
          logger.warn({}, '[PROCESS-INSAR] ERROR: No pairs created');
          res.status(404).json({
            error: 'No suitable InSAR pairs found',
            message: 'Could not create InSAR pairs from the closest granules (may need same track/orbit).'
          });
          return;
        }

        selectedPair = pairs[0]; // Use best pair
        logger.info({ selectedPair: selectedPair?.reference?.granuleName }, '[PROCESS-INSAR] 12. Best pair selected');
      }
      // Mode 2: Specific dates - find closest image for each date
      else if (specificDates && specificDates.length > 0) {
        logger.info({ specificDates }, 'Mode: Specific dates - finding closest granules for each date');

        const granulesMap = await granuleSearchService.findGranulesForDates(bbox, specificDates);

        if (granulesMap.size < 2) {
          res.status(404).json({
            error: 'Not enough granules found',
            message: `Found ${granulesMap.size} granules, need at least 2 for InSAR pairs.`
          });
          return;
        }

        // Convert map to array and create pairs
        const granules = Array.from(granulesMap.values());
        pairs = await granuleSearchService.createPairsFromGranules(granules);

        if (pairs.length === 0) {
          res.status(404).json({
            error: 'No suitable InSAR pairs found',
            message: 'Could not create InSAR pairs from the selected granules (may need same track/orbit).'
          });
          return;
        }

        selectedPair = pairs[0]; // Use best pair
      }
      // Mode 3: Date range (existing behavior)
      else {
        logger.info({ dateRange }, 'Mode: Date range - finding best pairs in range');

        pairs = await granuleSearchService.findInSARPairs(bbox, dateRange || {
          start: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end: new Date().toISOString().split('T')[0]
        });

        if (pairs.length === 0) {
          res.status(404).json({
            error: 'No suitable Sentinel-1 pairs found',
            message: 'No Sentinel-1 SLC granules found for this area and date range. Try expanding the date range or check if the area is covered by Sentinel-1.'
          });
          return;
        }

        selectedPair = pairs[0]; // Use best pair
      }

      // For specific dates mode, create multiple jobs (one per pair) for parallel processing
      // For other modes, create single job
      const shouldCreateMultipleJobs = (specificDates && specificDates.length > 0) && pairs.length > 1;
      const pairsToProcess = shouldCreateMultipleJobs ? pairs : [selectedPair];

      logger.info({
        mode: shouldCreateMultipleJobs ? 'multiple-jobs' : 'single-job',
        pairsCount: pairsToProcess.length
      }, '[PROCESS-INSAR] 13. Creating InSAR jobs');

      const createdJobs = [];
      const jobPromises = [];

      for (let i = 0; i < pairsToProcess.length; i++) {
        const pair = pairsToProcess[i];
        logger.info({
          pairIndex: i,
          reference: pair.reference.granuleName,
          secondary: pair.secondary.granuleName,
          temporalBaseline: pair.temporalBaselineDays,
          perpBaseline: pair.perpendicularBaselineMeters,
          quality: pair.quality
        }, '[PROCESS-INSAR] 14. Creating job for pair');

        try {
          // Store job in database - will be processed with GMTSAR
          logger.info({ infrastructureId }, '[PROCESS-INSAR] 15. Creating database job entry');
          const job = await databaseService.createJob(infrastructureId, {
            hy3_job_id: null, // No longer using HyP3
            hy3_job_type: 'GMTSAR', // Using GMTSAR instead
            status: 'PENDING',
            bbox,
          });
          logger.info({ jobId: job.id, createdAt: job.created_at }, '[PROCESS-INSAR] 16. Database job created');

          // Store granule pair info in hy3_product_urls (repurposed as metadata) for GMTSAR processing
          logger.info({ jobId: job.id }, '[PROCESS-INSAR] 17. Updating job metadata');
          await prisma.job.update({
            where: { id: job.id },
            data: {
              hy3_product_urls: {
                referenceGranule: pair.reference.granuleName,
                secondaryGranule: pair.secondary.granuleName,
                temporalBaseline: pair.temporalBaselineDays,
                perpendicularBaseline: pair.perpendicularBaselineMeters,
                quality: pair.quality
              }
            },
            select: {
              id: true,
              status: true,
              hy3_product_urls: true
            }
          });
          logger.info({ jobId: job.id }, '[PROCESS-INSAR] 18. Metadata updated');

          // Add to processing queue (BullMQ) - these will be processed in parallel with GMTSAR
          logger.info({ jobId: job.id }, '[PROCESS-INSAR] 19. Adding to queue');
          await insarQueue.add('process-insar', {
            jobId: job.id,
            hyp3JobId: null, // No longer using HyP3
            infrastructureId,
            createdAt: Date.now(),
            referenceGranule: pair.reference.granuleName,
            secondaryGranule: pair.secondary.granuleName,
          });
          logger.info({ jobId: job.id }, '[PROCESS-INSAR] 20. Added to queue');
          try { jobsEnqueuedTotal.inc(); } catch { }

          createdJobs.push({
            jobId: job.id,
            hy3JobId: null, // No longer using HyP3
            status: job.status,
            createdAt: job.created_at,
            pair: {
              reference: pair.reference.granuleName,
              secondary: pair.secondary.granuleName,
              temporalBaseline: pair.temporalBaselineDays
            }
          });

          logger.info({
            jobId: job.id
          }, 'InSAR job created and queued');
        } catch (e) {
          logger.error({ error: e, pairIndex: i }, '[PROCESS-INSAR] Error creating job for pair');
          // Continue processing other pairs
        }
      }

      const duration = Date.now() - startTime;

      logger.info({
        jobsCount: createdJobs.length,
        durationMs: duration,
        parallel: shouldCreateMultipleJobs
      }, 'InSAR jobs created successfully');

      // Frontend compatibility: return single jobId for single job, array for multiple
      if (shouldCreateMultipleJobs) {
        res.status(201).json({
          jobs: createdJobs,
          jobsCount: createdJobs.length,
          infrastructureId,
          pointsCount: points.length,
          bbox,
          estimatedDuration: `${createdJobs.length} jobs processing in parallel (3-5 min each)`,
          parallel: true,
          createdAt: new Date().toISOString()
        });
      } else {
        // Single job mode - return jobId for frontend compatibility
        res.status(201).json({
          jobId: createdJobs[0]?.jobId,
          hy3JobId: null,
          status: createdJobs[0]?.status || 'PENDING',
          createdAt: createdJobs[0]?.createdAt,
          pair: createdJobs[0]?.pair,
          infrastructureId,
          pointsCount: points.length,
          bbox,
          estimatedDuration: '3-5 minutes'
        });
      }
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        errorType: error instanceof Error ? error.constructor.name : typeof error
      }, '[PROCESS-INSAR] FATAL ERROR - Failed to create InSAR job');
      res.status(500).json({
        error: 'Failed to create InSAR job',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * DELETE /api/jobs/:id
 * Cancel/delete a job
 */
router.delete(
  '/:id',
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      logger.info({ jobId: id, userId: req.userId }, 'DELETE job request');

      if (!req.userId) {
        logger.warn({ jobId: id }, 'Unauthorized: no userId');
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Get job and verify it belongs to user's infrastructure
      logger.debug({ jobId: id }, 'Fetching job from database');

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        logger.warn({ jobId: id }, 'Invalid UUID format');
        res.status(400).json({ error: 'Invalid job ID format' });
        return;
      }

      const job = await prisma.job.findUnique({
        where: { id },
        select: {
          id: true,
          infrastructure_id: true,
          status: true
        }
      });

      if (!job) {
        logger.warn({ jobId: id }, 'Job not found');
        res.status(404).json({ error: 'Job not found' });
        return;
      }

      logger.debug({ jobId: id, infrastructureId: job.infrastructure_id, status: job.status }, 'Job found');

      // Verify infrastructure belongs to user and user has write access
      logger.debug({ userId: req.userId, infrastructureId: job.infrastructure_id }, 'Checking infrastructure access');
      const infrastructures = await databaseService.getUserInfrastructures(req.userId);
      const infrastructure = infrastructures.find((infra) => infra.id === job.infrastructure_id);

      if (!infrastructure) {
        logger.warn({ jobId: id, userId: req.userId, infrastructureId: job.infrastructure_id }, 'Access denied: infrastructure not found for user');
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      logger.debug({ jobId: id, status: job.status }, 'Processing job deletion/cancellation');

      // If job is still active, cancel it
      if (job.status === 'PENDING' || job.status === 'PROCESSING') {
        logger.info({ jobId: id, status: job.status }, 'Cancelling active job');

        // Remove from BullMQ queue if still pending
        try {
          logger.debug({ jobId: id }, 'Removing job from BullMQ queue');
          const queueJobs = await insarQueue.getJobs(['waiting', 'active']);
          const queueJob = queueJobs.find(j => j.data.jobId === id);
          if (queueJob) {
            await queueJob.remove();
            logger.info({ jobId: id }, 'Removed job from queue');
          } else {
            logger.debug({ jobId: id }, 'Job not found in queue (may already be processing)');
          }
        } catch (error) {
          logger.warn({ error, jobId: id }, 'Could not remove job from queue');
        }

        // Update job status to CANCELLED
        logger.debug({ jobId: id }, 'Updating job status to CANCELLED');
        await prisma.job.update({
          where: { id },
          data: {
            status: 'CANCELLED',
            completed_at: new Date(),
            error_message: 'Cancelled by user'
          },
          select: {
            id: true,
            status: true,
            completed_at: true
          }
        });

        logger.info({ jobId: id }, 'Job cancelled successfully');

        res.status(200).json({
          message: 'Job cancelled successfully',
          jobId: id
        });
      } else {
        // Job is already completed/failed, just delete it
        logger.info({ jobId: id, status: job.status }, 'Deleting completed/failed job');

        // Delete deformations first (foreign key constraint), then the job
        await prisma.$executeRaw(
          Prisma.sql`DELETE FROM deformations WHERE job_id::text = ${id}`
        );
        await prisma.$executeRaw(
          Prisma.sql`DELETE FROM jobs WHERE id::text = ${id}`
        );

        logger.info({ jobId: id }, 'Job and associated deformations deleted successfully');

        res.status(200).json({
          message: 'Job deleted successfully',
          jobId: id
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error({
        error: errorMessage,
        stack: errorStack,
        jobId: req.params.id,
        userId: req.userId
      }, 'Failed to cancel/delete job');

      res.status(500).json({
        error: 'Failed to cancel/delete job',
        message: errorMessage
      });
    }
  }
);

export default router;

