import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { authOrApiKey } from '../middleware/authOrApiKey';
import { validateBody, validateQuery } from '../middleware/validation';
import { z } from 'zod';
import { databaseService } from '../services/databaseService';
import { mapDataService } from '../services/mapDataService';
import { statisticsService } from '../services/statisticsService';
import logger from '../utils/logger';
import { requireInfraRole } from '../middleware/authorizeInfra';

const router = Router();

// Require authentication for all infrastructure routes
router.use(authOrApiKey());

/**
 * GET /api/infrastructures
 * List all infrastructures for the authenticated user
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Get userId from auth middleware
    const userId = req.userId;

    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const infrastructures = await databaseService.getUserInfrastructures(userId);

    res.json({
      infrastructures,
      count: infrastructures.length,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get infrastructures');
    res.status(500).json({ error: 'Failed to retrieve infrastructures' });
  }
});

/**
 * POST /api/infrastructures
 * Create a new infrastructure
 */
const CreateInfrastructureSchema = z.object({
  name: z.string().min(1),
  type: z.string().optional(),
  bbox: z.object({
    minLat: z.number(),
    maxLat: z.number(),
    minLon: z.number(),
    maxLon: z.number(),
  }),
  mode_onboarding: z.string().optional(),
});

router.post(
  '/',
  validateBody(CreateInfrastructureSchema),
  async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      logger.info({ userId: req.userId, body: req.body }, 'Creating infrastructure');

      // Convert bbox from {minLat, maxLat, minLon, maxLon} to GeoJSON Polygon
      const { minLat, maxLat, minLon, maxLon } = req.body.bbox;
      const bboxPolygon = {
        type: 'Polygon' as const,
        coordinates: [
          [
            [minLon, minLat],
            [maxLon, minLat],
            [maxLon, maxLat],
            [minLon, maxLat],
            [minLon, minLat],
          ],
        ],
      };

      const infrastructure = await databaseService.createInfrastructure(req.userId, {
        name: req.body.name,
        type: req.body.type,
        bbox: bboxPolygon,
        mode_onboarding: req.body.mode_onboarding,
      });

      logger.info({ infrastructureId: infrastructure.id }, 'Infrastructure created successfully');
      res.status(201).json(infrastructure);
    } catch (error) {
      logger.error({ error, userId: req.userId, body: req.body }, 'Failed to create infrastructure');
      res.status(500).json({ error: 'Failed to create infrastructure', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
);

/**
 * GET /api/infrastructures/:id
 * Get a specific infrastructure
 */
router.get(
  '/:id',
  requireInfraRole('read', 'params', 'id'),
  async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const infrastructures = await databaseService.getUserInfrastructures(req.userId);
      const infrastructure = infrastructures.find((infra) => infra.id === req.params.id);
      res.json(infrastructure);
    } catch (error) {
      logger.error({ error }, 'Failed to get infrastructure');
      res.status(500).json({ error: 'Failed to retrieve infrastructure' });
    }
  }
);

/**
 * GET /api/infrastructures/:id/map-data
 * Get GeoJSON map data for visualization
 * Returns all points with their latest deformation data, color-coded by risk
 * 
 * Response includes:
 * - GeoJSON FeatureCollection with all monitoring points
 * - Color coding based on displacement magnitude
 * - Risk assessment (critical, high, medium, low, stable, unknown)
 * - Trend analysis (accelerating, stable, decelerating)
 * - Comprehensive metadata and statistics
 * 
 * Cached for 5 minutes to optimize performance
 */
router.get(
  '/:id/map-data',
  requireInfraRole('read', 'params', 'id'),
  validateQuery(z.object({
    limit: z.coerce.number().int().min(1).max(100000).optional(),
    minLat: z.coerce.number().optional(),
    maxLat: z.coerce.number().optional(),
    minLon: z.coerce.number().optional(),
    maxLon: z.coerce.number().optional(),
  })),
  async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const { limit, minLat, maxLat, minLon, maxLon } = req.query as unknown as {
        limit?: number;
        minLat?: number;
        maxLat?: number;
        minLon?: number;
        maxLon?: number;
      };
      const bbox =
        typeof minLat === 'number' && typeof maxLat === 'number' && typeof minLon === 'number' && typeof maxLon === 'number'
          ? { minLat, maxLat, minLon, maxLon }
          : undefined;

      // Get map data with all visualization metadata
      const mapData = await mapDataService.getMapData(id, { limit, bbox });

      // Set cache headers (5 minutes)
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.setHeader('X-Total-Points', mapData.metadata.totalPoints.toString());
      res.setHeader('X-Active-Points', mapData.metadata.activePoints.toString());

      res.json(mapData);
    } catch (error) {
      logger.error({
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        infrastructureId: req.params.id
      }, 'Failed to get map data');
      res.status(500).json({
        error: 'Failed to retrieve map data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * GET /api/infrastructures/:id/statistics
 * Get comprehensive statistical analysis for an infrastructure
 * 
 * Returns advanced analytics including:
 * - Overview (points, measurements, time span)
 * - Displacement statistics (mean, median, distribution)
 * - Velocity analysis (trends, acceleration)
 * - Spatial analysis (centroid, hotspots)
 * - Data quality metrics
 * - Trend projections
 * - Alert summaries
 * 
 * Cached for 10 minutes to optimize performance
 */
router.get(
  '/:id/statistics',
  requireInfraRole('read', 'params', 'id'),
  async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;

      logger.info({ userId: req.userId, infrastructureId: id }, 'Fetching statistics');

      logger.info({ infrastructureId: id }, 'Infrastructure found, calculating statistics');

      // Retrieve infrastructure to include its name in response
      const infrastructures = await databaseService.getUserInfrastructures(req.userId);
      const infrastructure = infrastructures.find((infra) => infra.id === id);

      // Calculate comprehensive statistics
      let statistics;
      try {
        statistics = await statisticsService.getInfrastructureStatistics(id);
        logger.info({ infrastructureId: id }, 'Statistics calculated successfully');
      } catch (statsError) {
        logger.warn({ infrastructureId: id, error: statsError }, 'Statistics calculation failed, returning minimal stats');
        // Return minimal stats if calculation fails
        statistics = {
          overview: {
            totalPoints: 0,
            activePoints: 0,
            totalMeasurements: 0,
            timeSpan: 'N/A',
          },
          displacement: {
            mean: 0,
            median: 0,
            min: 0,
            max: 0,
            stdDev: 0,
          },
          velocity: {
            mean: null,
            median: null,
          },
        };
      }

      // Set cache headers (10 minutes)
      res.setHeader('Cache-Control', 'public, max-age=600');
      res.setHeader('X-Calculation-Intensive', 'true');

      res.json({
        infrastructureId: id,
        infrastructureName: infrastructure?.name ?? 'Unknown',
        calculatedAt: new Date().toISOString(),
        statistics,
      });
    } catch (error) {
      logger.error({ error, infrastructureId: req.params.id, errorMessage: error instanceof Error ? error.message : 'Unknown error', errorStack: error instanceof Error ? error.stack : undefined }, 'Failed to get statistics');
      res.status(500).json({ error: 'Failed to retrieve statistics', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  }
);

/**
 * GET /api/infrastructures/:id/points-geojson
 * Get all points for an infrastructure as GeoJSON FeatureCollection
 */
router.get(
  '/:id/points-geojson',
  async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;

      // Verify infrastructure belongs to user
      const infrastructures = await databaseService.getUserInfrastructures(req.userId);
      const infrastructure = infrastructures.find((infra) => infra.id === id);

      if (!infrastructure) {
        res.status(404).json({ error: 'Infrastructure not found' });
        return;
      }

      // Get all points as GeoJSON
      const points = await databaseService.getPointsByInfrastructure(id);

      const features = points.map((point: any) => {
        // Handle both geom (WKT converted) and geometry formats
        const coords = point.geom?.coordinates || point.geometry?.coordinates;
        return {
          type: 'Feature',
          id: point.id,
          geometry: {
            type: 'Point',
            coordinates: coords || [0, 0],
          },
          properties: {
            id: point.id,
            infrastructureId: point.infrastructure_id,
          },
        };
      });

      const geojson = {
        type: 'FeatureCollection',
        features,
      };

      res.json(geojson);
    } catch (error) {
      logger.error({ error, infrastructureId: req.params.id }, 'Failed to get points GeoJSON');
      res.status(500).json({ error: 'Failed to retrieve points' });
    }
  }
);

/**
 * PATCH /api/infrastructures/:id
 * Update infrastructure (name/type)
 */
const UpdateInfrastructureSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.string().nullable().optional(),
});

router.patch(
  '/:id',
  requireInfraRole('admin', 'params', 'id'),
  validateBody(UpdateInfrastructureSchema),
  async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      const { name, type } = req.body as { name?: string; type?: string | null };

      const updated = await databaseService.updateInfrastructure(id, { name, type: typeof type === 'undefined' ? undefined : type });

      res.json(updated);
    } catch (error) {
      logger.error({ error, infrastructureId: req.params.id }, 'Failed to update infrastructure');
      res.status(500).json({ error: 'Failed to update infrastructure' });
    }
  }
);

/**
 * DELETE /api/infrastructures/:id
 * Delete infrastructure (owner only)
 */
router.delete(
  '/:id',
  requireInfraRole('owner', 'params', 'id'),
  async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id } = req.params;
      await databaseService.deleteInfrastructure(id);
      res.status(204).send();
    } catch (error) {
      logger.error({ error, infrastructureId: req.params.id }, 'Failed to delete infrastructure');
      res.status(500).json({ error: 'Failed to delete infrastructure' });
    }
  }
);

export default router;

