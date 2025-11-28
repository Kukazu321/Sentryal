import { Router, Request, Response } from 'express';
import { authOrApiKey } from '../middleware/authOrApiKey';
import { validateBody, validateQuery } from '../middleware/validation';
import {
  CreatePointsSchema,
  CreatePointsGeoJSONSchema,
} from '../schemas/validation';
import { databaseService } from '../services/databaseService';
import logger from '../utils/logger';
import { z } from 'zod';
import { requireInfraRole } from '../middleware/authorizeInfra';

const router = Router();

// All routes require authentication (JWT or API key)
router.use(authOrApiKey());

/**
 * GET /api/points
 * List points for an infrastructure
 * Query params: infrastructureId (required)
 */
router.get(
  '/',
  validateQuery(z.object({ infrastructureId: z.string().uuid() })),
  requireInfraRole('read', 'query', 'infrastructureId'),
  async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { infrastructureId } = req.query as { infrastructureId: string };

      // Verify infrastructure belongs to user
      const infrastructures = await databaseService.getUserInfrastructures(req.userId);
      const infrastructure = infrastructures.find((infra) => infra.id === infrastructureId);

      if (!infrastructure) {
        res.status(404).json({ error: 'Infrastructure not found' });
        return;
      }

      const points = await databaseService.getPointsByInfrastructure(infrastructureId);

      res.json({
        points,
        count: points.length,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get points');
      res.status(500).json({ error: 'Failed to retrieve points' });
    }
  }
);

/**
 * POST /api/points
 * Create points in batch
 * Accepts either:
 * - { infrastructureId, points: [{lat, lng}, ...] }
 * - { infrastructureId, geojson: FeatureCollection }
 */
router.post('/', async (req: Request, res: Response) => {
  // Enforce write access based on body.infrastructureId
  // The middleware needs infraId in body, so run it inline here
  const infraId = req.body?.infrastructureId;
  if (!infraId) {
    // Will be validated below by schemas; continue
  } else {
    const mw = requireInfraRole('write', 'body', 'infrastructureId');
    await (mw as any)(req, res, () => { });
    if (res.headersSent) return; // Authorization failed
  }
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Verify infrastructure belongs to user
    const infrastructures = await databaseService.getUserInfrastructures(req.userId);

    let infrastructureId: string;
    let points: Array<{ lat: number; lng: number }>;

    // Check if request is GeoJSON FeatureCollection
    if (req.body.geojson && req.body.geojson.type === 'FeatureCollection') {
      const validated = CreatePointsGeoJSONSchema.parse(req.body);
      infrastructureId = validated.infrastructureId;

      // Extract points from GeoJSON
      points = validated.geojson.features.map((feature) => {
        const [lng, lat] = feature.geometry.coordinates;
        return { lat, lng };
      });
    } else {
      // Regular points array
      const validated = CreatePointsSchema.parse(req.body);
      infrastructureId = validated.infrastructureId;
      points = validated.points as { lat: number; lng: number; }[];
    }

    const infrastructure = infrastructures.find((infra) => infra.id === infrastructureId);

    if (!infrastructure) {
      res.status(404).json({ error: 'Infrastructure not found' });
      return;
    }

    const created = await databaseService.createPoints(infrastructureId, points);

    res.status(201).json({
      points: created,
      count: created.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn({ error: error.issues }, 'Validation error');
      res.status(400).json({
        error: 'Validation error',
        details: error.issues.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
      return;
    }

    logger.error({ error }, 'Failed to create points');
    res.status(500).json({ error: 'Failed to create points' });
  }
});

export default router;

