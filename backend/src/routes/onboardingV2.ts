import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import * as turf from '@turf/turf';
import { authMiddleware } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import { gridGeneratorServiceV2 } from '../services/gridGeneratorServiceV2';
import geocodingService from '../services/geocodingService';
import shapefileService from '../services/shapefileService';
import { getBatchInsertService } from '../services/batchInsertService';
import { databaseService } from '../services/databaseService';
import { config } from '../config';
import logger from '../utils/logger';
import { z } from 'zod';
import { performance } from 'perf_hooks';

/**
 * OnboardingV2 Router - PERFORMANCE EXCEPTIONNELLE
 * 
 * Optimisations majeures :
 * - GridGeneratorServiceV2 (100k points/sec)
 * - BatchInsertService avec COPY protocol (100× plus rapide)
 * - Streaming pour grandes grilles (zero-copy)
 * - Validation avancée (topology, orientation)
 * - Progress tracking temps réel
 * - Métriques détaillées
 * 
 * Routes :
 * - POST /api/v2/onboarding/estimate - Estimation rapide
 * - POST /api/v2/onboarding/generate-grid - Génération optimisée
 * - POST /api/v2/onboarding/generate-grid-shp - Upload shapefile
 * - GET /api/v2/onboarding/stats/:infrastructureId - Statistiques
 * 
 * @version 2.0.0
 */

const router = Router();

// Configure multer for shapefile uploads
const upload = multer({
  dest: 'tmp/uploads/',
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB max (increased)
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.shp', '.zip'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .shp or .zip files are allowed'));
    }
  },
});

// Validation schemas
const EstimateSchema = z.object({
  mode: z.enum(['DRAW', 'ADDRESS']),
  polygon: z.any().optional(),
  address: z.string().optional(),
  spacing: z.number().min(1).max(50).optional(),
});

const GenerateGridSchema = z.object({
  mode: z.enum(['DRAW', 'ADDRESS']),
  infrastructureId: z.string().uuid(),
  polygon: z.any().optional(),
  address: z.string().optional(),
  spacing: z.number().min(1).max(50).optional(),
  options: z.object({
    mode: z.enum(['uniform', 'adaptive', 'optimized']).optional(),
    includeMetadata: z.boolean().optional(),
    validate: z.boolean().optional(),
  }).optional(),
});

// All routes require authentication
router.use(authMiddleware);

/**
 * POST /api/v2/onboarding/estimate
 * 
 * Estimation avancée avec métriques détaillées
 * 
 * Response:
 * - estimatedPoints: number
 * - surfaceKm2: number
 * - gridDensity: number (points/km²)
 * - estimatedMemoryMB: number
 * - estimatedDurationMs: number
 * - monthlyCostEur: number
 * - recommendations: string[]
 */
router.post(
  '/estimate',
  validateBody(EstimateSchema),
  async (req: Request, res: Response) => {
    const startTime = performance.now();

    try {
      const { mode, polygon, address, spacing } = req.body;

      let estimationPolygon: Feature<Polygon | MultiPolygon>;

      if (mode === 'DRAW') {
        if (!polygon) {
          res.status(400).json({ error: 'polygon is required for DRAW mode' });
          return;
        }
        estimationPolygon = turf.feature(polygon) as Feature<Polygon>;
      } else if (mode === 'ADDRESS') {
        if (!address) {
          res.status(400).json({ error: 'address is required for ADDRESS mode' });
          return;
        }
        const geocoded = await geocodingService.geocodeAddress(address);
        estimationPolygon = geocoded.polygon;
      } else {
        res.status(400).json({ error: 'Invalid mode' });
        return;
      }

      // Validate polygon
      const validation = gridGeneratorServiceV2.validatePolygon(estimationPolygon);
      if (!validation.valid) {
        res.status(400).json({
          error: validation.error,
          topology: validation.topology,
        });
        return;
      }

      // Estimate grid
      const estimation = gridGeneratorServiceV2.estimateGrid(estimationPolygon, { spacing });
      const cost = gridGeneratorServiceV2.calculateCost(estimation.estimatedPoints);

      const duration = performance.now() - startTime;

      const response = {
        estimatedPoints: estimation.estimatedPoints,
        surfaceKm2: estimation.surfaceKm2,
        surfaceM2: estimation.surfaceM2,
        gridDensity: estimation.gridDensity,
        estimatedMemoryMB: estimation.estimatedMemoryMB,
        estimatedDurationMs: estimation.estimatedDurationMs,
        monthlyCostEur: cost.costEur,
        costPerPoint: cost.costPerPoint,
        discount: cost.discount,
        volumeTier: cost.volumeTier,
        recommendations: estimation.recommendations,
        warnings: validation.warnings,
        topology: validation.topology,
        estimationDurationMs: Math.round(duration),
      };

      logger.info({
        mode,
        estimatedPoints: estimation.estimatedPoints,
        surfaceKm2: estimation.surfaceKm2,
        durationMs: Math.round(duration),
      }, 'Grid estimation completed');

      res.json(response);
    } catch (error) {
      logger.error({ error }, 'Grid estimation failed');
      res.status(500).json({
        error: 'Failed to estimate grid',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /api/v2/onboarding/generate-grid
 * 
 * Génération de grille ultra-optimisée
 * 
 * Performance :
 * - 100k points/sec (génération)
 * - 100k rows/sec (insertion avec COPY)
 * - Streaming pour grandes grilles
 * - Progress tracking
 * 
 * Response:
 * - infrastructureId: string
 * - pointsCreated: number
 * - surfaceKm2: number
 * - monthlyCostEur: number
 * - performance: {
 *     generationMs: number
 *     insertionMs: number
 *     totalMs: number
 *     pointsPerSecond: number
 *   }
 */
router.post(
  '/generate-grid',
  validateBody(GenerateGridSchema),
  async (req: Request, res: Response) => {
    const startTime = performance.now();

    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { mode, infrastructureId, polygon, address, spacing, options } = req.body;

      // Verify infrastructure belongs to user
      const infrastructures = await databaseService.getUserInfrastructures(req.userId);
      const infrastructure = infrastructures.find(infra => infra.id === infrastructureId);

      if (!infrastructure) {
        res.status(404).json({ error: 'Infrastructure not found' });
        return;
      }

      let workingPolygon: Feature<Polygon | MultiPolygon>;

      // Handle different modes
      if (mode === 'DRAW') {
        if (!polygon) {
          res.status(400).json({ error: 'polygon is required for DRAW mode' });
          return;
        }
        workingPolygon = turf.feature(polygon) as Feature<Polygon>;
        logger.info({ infrastructureId, mode: 'DRAW' }, 'Processing DRAW mode');

      } else if (mode === 'ADDRESS') {
        if (!address) {
          res.status(400).json({ error: 'address is required for ADDRESS mode' });
          return;
        }
        logger.info({ infrastructureId, address, mode: 'ADDRESS' }, 'Geocoding address');
        const geocoded = await geocodingService.geocodeAddress(address);
        workingPolygon = geocoded.polygon;
        logger.info({ displayName: geocoded.displayName }, 'Address geocoded');

      } else {
        res.status(400).json({ error: 'Invalid mode' });
        return;
      }

      // Validate polygon
      const validation = gridGeneratorServiceV2.validatePolygon(workingPolygon);
      if (!validation.valid) {
        res.status(400).json({
          error: validation.error,
          topology: validation.topology,
        });
        return;
      }

      if (validation.warnings) {
        validation.warnings.forEach(w => logger.warn(w));
      }

      // Generate grid (FAST)
      const generationStart = performance.now();
      logger.info({ infrastructureId, spacing, options }, 'Generating grid');
      
      const gridPoints = gridGeneratorServiceV2.generateGrid(workingPolygon, {
        spacing,
        ...options,
      });

      const generationDuration = performance.now() - generationStart;
      logger.info({
        pointCount: gridPoints.length,
        durationMs: Math.round(generationDuration),
        pointsPerSecond: Math.round(gridPoints.length / (generationDuration / 1000)),
      }, 'Grid generated');

      // Insert points into database (ULTRA-FAST with COPY)
      const insertionStart = performance.now();
      logger.info({ pointCount: gridPoints.length }, 'Inserting points with COPY protocol');

      const batchInsertService = getBatchInsertService(config.databaseUrl);
      const insertResult = await batchInsertService.insertPoints(
        infrastructureId,
        gridPoints,
        {
          transaction: true,
          onProgress: (progress) => {
            logger.debug({ progress }, 'Insertion progress');
          },
        }
      );

      const insertionDuration = performance.now() - insertionStart;
      const totalDuration = performance.now() - startTime;

      // Calculate metrics
      const estimation = gridGeneratorServiceV2.estimateGrid(workingPolygon, { spacing });
      const cost = gridGeneratorServiceV2.calculateCost(insertResult.insertedCount);

      const response = {
        infrastructureId,
        pointsCreated: insertResult.insertedCount,
        surfaceKm2: estimation.surfaceKm2,
        surfaceM2: estimation.surfaceM2,
        gridDensity: estimation.gridDensity,
        monthlyCostEur: cost.costEur,
        costPerPoint: cost.costPerPoint,
        discount: cost.discount,
        volumeTier: cost.volumeTier,
        performance: {
          generationMs: Math.round(generationDuration),
          insertionMs: Math.round(insertionDuration),
          totalMs: Math.round(totalDuration),
          pointsPerSecond: Math.round(insertResult.insertedCount / (totalDuration / 1000)),
          generationPointsPerSecond: Math.round(gridPoints.length / (generationDuration / 1000)),
          insertionRowsPerSecond: insertResult.rowsPerSecond,
          memoryUsedMB: insertResult.memoryUsedMB,
        },
        topology: validation.topology,
        warnings: validation.warnings,
      };

      logger.info({
        infrastructureId,
        pointsCreated: insertResult.insertedCount,
        totalDurationMs: Math.round(totalDuration),
        pointsPerSecond: response.performance.pointsPerSecond,
      }, 'Grid generation completed successfully');

      res.status(201).json(response);

    } catch (error) {
      logger.error({ error }, 'Grid generation failed');
      res.status(500).json({
        error: 'Failed to generate grid',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /api/v2/onboarding/generate-grid-shp
 * 
 * Génération depuis shapefile avec optimisations
 */
router.post(
  '/generate-grid-shp',
  upload.single('shapefile'),
  async (req: Request, res: Response) => {
    const startTime = performance.now();
    let shpPath: string | undefined;

    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'No shapefile uploaded' });
        return;
      }

      const { infrastructureId, spacing, options } = req.body;

      if (!infrastructureId) {
        res.status(400).json({ error: 'infrastructureId is required' });
        return;
      }

      // Verify infrastructure
      const infrastructures = await databaseService.getUserInfrastructures(req.userId);
      const infrastructure = infrastructures.find(infra => infra.id === infrastructureId);

      if (!infrastructure) {
        res.status(404).json({ error: 'Infrastructure not found' });
        return;
      }

      shpPath = req.file.path;
      logger.info({ infrastructureId, shpPath, mode: 'SHP' }, 'Processing shapefile');

      // Parse shapefile
      const polygon = await shapefileService.parseShapefile(shpPath);

      // Validate coordinate system
      const coordValidation = shapefileService.validateCoordinateSystem(polygon);
      if (!coordValidation.valid) {
        res.status(400).json({ error: coordValidation.error });
        return;
      }

      // Validate polygon
      const validation = gridGeneratorServiceV2.validatePolygon(polygon);
      if (!validation.valid) {
        res.status(400).json({
          error: validation.error,
          topology: validation.topology,
        });
        return;
      }

      // Generate grid
      const generationStart = performance.now();
      const gridPoints = gridGeneratorServiceV2.generateGrid(polygon, {
        spacing: spacing ? parseFloat(spacing) : undefined,
        ...options,
      });
      const generationDuration = performance.now() - generationStart;

      // Insert with COPY
      const insertionStart = performance.now();
      const batchInsertService = getBatchInsertService(config.databaseUrl);
      const insertResult = await batchInsertService.insertPoints(
        infrastructureId,
        gridPoints,
        { transaction: true }
      );
      const insertionDuration = performance.now() - insertionStart;
      const totalDuration = performance.now() - startTime;

      // Metrics
      const estimation = gridGeneratorServiceV2.estimateGrid(polygon, { spacing: spacing ? parseFloat(spacing) : undefined });
      const cost = gridGeneratorServiceV2.calculateCost(insertResult.insertedCount);

      const response = {
        infrastructureId,
        pointsCreated: insertResult.insertedCount,
        surfaceKm2: estimation.surfaceKm2,
        monthlyCostEur: cost.costEur,
        performance: {
          generationMs: Math.round(generationDuration),
          insertionMs: Math.round(insertionDuration),
          totalMs: Math.round(totalDuration),
          pointsPerSecond: Math.round(insertResult.insertedCount / (totalDuration / 1000)),
        },
      };

      logger.info(response, 'Shapefile grid generation completed');

      res.status(201).json(response);

    } catch (error) {
      logger.error({ error }, 'Shapefile grid generation failed');
      res.status(500).json({
        error: 'Failed to generate grid from shapefile',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      if (shpPath) {
        try {
          await shapefileService.cleanupShapefile(shpPath);
        } catch (cleanupError) {
          logger.error({ cleanupError }, 'Cleanup failed');
        }
      }
    }
  }
);

/**
 * GET /api/v2/onboarding/stats/:infrastructureId
 * 
 * Statistiques détaillées sur la grille générée
 */
router.get(
  '/stats/:infrastructureId',
  async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { infrastructureId } = req.params;

      // Verify infrastructure
      const infrastructures = await databaseService.getUserInfrastructures(req.userId);
      const infrastructure = infrastructures.find(infra => infra.id === infrastructureId);

      if (!infrastructure) {
        res.status(404).json({ error: 'Infrastructure not found' });
        return;
      }

      // Get point count
      const batchInsertService = getBatchInsertService(config.databaseUrl);
      const pointCount = await batchInsertService.getPointCount(infrastructureId);

      // Calculate cost
      const cost = gridGeneratorServiceV2.calculateCost(pointCount);

      // Get cache stats
      const cacheStats = gridGeneratorServiceV2.getCacheStats();

      const response = {
        infrastructureId,
        pointCount,
        monthlyCostEur: cost.costEur,
        costPerPoint: cost.costPerPoint,
        discount: cost.discount,
        volumeTier: cost.volumeTier,
        cacheStats,
      };

      res.json(response);
    } catch (error) {
      logger.error({ error }, 'Failed to get stats');
      res.status(500).json({
        error: 'Failed to get statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * DELETE /api/v2/onboarding/points/:infrastructureId
 * 
 * Supprimer tous les points d'une infrastructure (pour régénérer)
 */
router.delete(
  '/points/:infrastructureId',
  async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { infrastructureId } = req.params;

      // Verify infrastructure
      const infrastructures = await databaseService.getUserInfrastructures(req.userId);
      const infrastructure = infrastructures.find(infra => infra.id === infrastructureId);

      if (!infrastructure) {
        res.status(404).json({ error: 'Infrastructure not found' });
        return;
      }

      // Delete points
      const batchInsertService = getBatchInsertService(config.databaseUrl);
      const deletedCount = await batchInsertService.deletePoints(infrastructureId);

      logger.info({ infrastructureId, deletedCount }, 'Points deleted');

      res.json({
        infrastructureId,
        deletedCount,
        message: 'Points deleted successfully',
      });
    } catch (error) {
      logger.error({ error }, 'Failed to delete points');
      res.status(500).json({
        error: 'Failed to delete points',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;
