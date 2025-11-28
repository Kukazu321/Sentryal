import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { databaseService } from '../services/databaseService';
import { velocityCalculationService } from '../services/velocityCalculationService';
import logger from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * POST /api/velocity/calculate/:infrastructureId
 * Calculate velocities for all points in an infrastructure
 * 
 * This is a compute-intensive operation that:
 * 1. Fetches time series data for all points
 * 2. Performs weighted linear regression
 * 3. Detects and removes outliers
 * 4. Calculates acceleration and predictions
 * 5. Updates database with results
 * 
 * Should be called:
 * - After new deformation data is added
 * - Periodically (e.g., daily) for active infrastructures
 * - On-demand for analysis
 */
router.post(
  '/calculate/:infrastructureId',
  async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { infrastructureId } = req.params;

      // Verify infrastructure belongs to user
      const infrastructures = await databaseService.getUserInfrastructures(req.userId);
      const infrastructure = infrastructures.find((infra) => infra.id === infrastructureId);

      if (!infrastructure) {
        res.status(404).json({ error: 'Infrastructure not found' });
        return;
      }

      logger.info(
        { infrastructureId, userId: req.userId },
        'Starting velocity calculation'
      );

      // Calculate velocities for all points
      const updates = await velocityCalculationService.calculateInfrastructureVelocities(
        infrastructureId
      );

      if (!updates || updates.length === 0) {
        res.status(200).json({
          message: 'No points with sufficient data for velocity calculation',
          updatedPoints: 0,
          processingTime: Date.now() - startTime,
        });
        return;
      }

      // Update database with calculated velocities
      await velocityCalculationService.updateVelocitiesInDatabase(updates);

      const processingTime = Date.now() - startTime;

      logger.info(
        {
          infrastructureId,
          updatedPoints: (updates || []).length,
          processingTime,
        },
        'Velocity calculation completed'
      );

      const safeUpdates: any[] = updates || [];

      res.json({
        message: 'Velocity calculation completed successfully',
        updatedPoints: safeUpdates.length,
        processingTime,
        summary: {
          averageVelocity:
            safeUpdates.length > 0
              ? safeUpdates.reduce((sum, u) => sum + u.velocity_mm_year, 0) / safeUpdates.length
              : 0,
          qualityDistribution: getQualityDistribution(safeUpdates),
        },
      });
    } catch (error) {
      logger.error(
        { error, infrastructureId: req.params.infrastructureId },
        'Failed to calculate velocities'
      );
      res.status(500).json({ error: 'Failed to calculate velocities' });
    }
  }
);

/**
 * GET /api/velocity/point/:pointId
 * Get detailed velocity analysis for a specific point
 * 
 * Returns comprehensive velocity information including:
 * - Current velocity and acceleration
 * - Confidence intervals
 * - Data quality metrics
 * - Future predictions
 */
router.get(
  '/point/:pointId',
  async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { pointId } = req.params;

      // Verify point belongs to user's infrastructure
      const point = await databaseService.getPointsByInfrastructure(''); // TODO: Get infra ID
      // Simplified verification - in production, add proper ownership check

      const result = await velocityCalculationService.calculatePointVelocity(pointId);

      if (!result) {
        res.status(404).json({
          error: 'Insufficient data for velocity calculation',
          message: 'At least 3 measurements are required',
        });
        return;
      }

      res.json({
        pointId,
        velocity: result,
      });
    } catch (error) {
      logger.error({ error, pointId: req.params.pointId }, 'Failed to get point velocity');
      res.status(500).json({ error: 'Failed to retrieve velocity data' });
    }
  }
);

/**
 * Helper function to get quality distribution
 */
function getQualityDistribution(
  updates: Array<{ metadata: { data_quality: string } }>
): Record<string, number> {
  return updates.reduce(
    (acc, update) => {
      const quality = update.metadata.data_quality;
      acc[quality] = (acc[quality] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
}

export default router;
