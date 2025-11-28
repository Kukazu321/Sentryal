import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import type { Feature, Polygon } from 'geojson';
import * as turf from '@turf/turf';
import { authMiddleware } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import {
  GenerateGridDrawSchema,
  GenerateGridAddressSchema,
  EstimateGridDrawSchema,
  EstimateGridAddressSchema,
  GridEstimationResponseSchema,
  GridGenerationResponseSchema,
} from '../schemas/validation';
import gridGeneratorService from '../services/gridGeneratorService';
import geocodingService from '../services/geocodingService';
import shapefileService from '../services/shapefileService';
import { databaseService } from '../services/databaseService';
import logger from '../utils/logger';

const router = Router();

// Configure multer for shapefile uploads
const upload = multer({
  dest: 'tmp/uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB max
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.shp' || ext === '.zip') {
      cb(null, true);
    } else {
      cb(new Error('Only .shp or .zip shapefiles are allowed'));
    }
  },
});

// All routes require authentication
router.use(authMiddleware);

/**
 * POST /api/onboarding/estimate
 * 
 * Estimate grid points and cost before generation
 * Supports DRAW and ADDRESS modes (SHP requires file upload)
 */
router.post(
  '/estimate',
  async (req: Request, res: Response) => {
    try {
      const { mode, polygon, address } = req.body;

      let estimationPolygon: Feature<Polygon>;

      if (mode === 'DRAW') {
        // Validate DRAW mode
        const validation = EstimateGridDrawSchema.safeParse(req.body);
        if (!validation.success) {
          res.status(400).json({
            error: 'Invalid request',
            details: (validation as any).error.errors,
          });
          return;
        }

        estimationPolygon = turf.feature(polygon as any) as Feature<Polygon>;
      } else if (mode === 'ADDRESS') {
        // Validate ADDRESS mode
        const validation = EstimateGridAddressSchema.safeParse(req.body);
        if (!validation.success) {
          res.status(400).json({
            error: 'Invalid request',
            details: (validation as any).error.errors,
          });
          return;
        }

        // Geocode address
        const geocoded = await geocodingService.geocodeAddress(address);
        estimationPolygon = geocoded.polygon;
      } else {
        res.status(400).json({
          error: 'Invalid mode. Use DRAW or ADDRESS for estimation.',
        });
        return;
      }

      // Validate polygon
      const polygonValidation = gridGeneratorService.validatePolygon(estimationPolygon);
      if (!polygonValidation.valid) {
        res.status(400).json({
          error: polygonValidation.error,
        });
        return;
      }

      // Estimate points
      const estimation = gridGeneratorService.estimatePointCount(estimationPolygon);
      const cost = gridGeneratorService.calculateMonthlyCost(estimation.estimatedPoints);

      const bboxArray = turf.bbox(estimationPolygon);
      const response = {
        estimatedPoints: estimation.estimatedPoints,
        surfaceKm2: estimation.surfaceKm2,
        surfaceM2: estimation.surfaceM2,
        monthlyCostEur: cost.costEur,
        warnings: polygonValidation.warnings,
        bbox: {
          minLat: bboxArray[1],
          maxLat: bboxArray[3],
          minLon: bboxArray[0],
          maxLon: bboxArray[2],
        },
      };

      logger.info(response, 'Grid estimation completed');

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
 * POST /api/onboarding/generate-grid
 * 
 * Generate 5-meter precision grid for an infrastructure
 * 
 * Modes:
 * - DRAW: User draws polygon on map (GeoJSON)
 * - ADDRESS: User enters address (geocoded via Nominatim)
 * - SHP: User uploads shapefile (parsed and converted)
 */
router.post(
  '/generate-grid',
  async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { mode, infrastructureId } = req.body;

      // Verify infrastructure belongs to user
      const infrastructures = await databaseService.getUserInfrastructures(req.userId);
      const infrastructure = infrastructures.find(infra => infra.id === infrastructureId);

      if (!infrastructure) {
        res.status(404).json({ error: 'Infrastructure not found' });
        return;
      }

      let polygon: Feature<Polygon>;

      // Handle different modes
      if (mode === 'DRAW') {
        // Mode DRAW: GeoJSON polygon provided directly
        const validation = GenerateGridDrawSchema.safeParse(req.body);
        if (!validation.success) {
          res.status(400).json({
            error: 'Invalid request',
            details: (validation as any).error.errors,
          });
          return;
        }

        polygon = turf.feature(validation.data.polygon as any) as Feature<Polygon>;
        logger.info({ infrastructureId, mode: 'DRAW' }, 'Processing DRAW mode');

      } else if (mode === 'ADDRESS') {
        // Mode ADDRESS: Geocode address to polygon
        const validation = GenerateGridAddressSchema.safeParse(req.body);
        if (!validation.success) {
          res.status(400).json({
            error: 'Invalid request',
            details: (validation as any).error.errors,
          });
          return;
        }

        logger.info({ infrastructureId, address: validation.data.address, mode: 'ADDRESS' }, 'Geocoding address');

        const geocoded = await geocodingService.geocodeAddress(validation.data.address);
        polygon = geocoded.polygon;

        logger.info({
          displayName: geocoded.displayName,
          bbox: geocoded.boundingBox,
        }, 'Address geocoded successfully');

      } else {
        res.status(400).json({
          error: 'Invalid mode. Use /generate-grid-shp for SHP uploads.',
        });
        return;
      }

      // Validate polygon
      const polygonValidation = gridGeneratorService.validatePolygon(polygon);
      if (!polygonValidation.valid) {
        res.status(400).json({
          error: polygonValidation.error,
        });
        return;
      }

      // Generate grid
      logger.info({ infrastructureId }, 'Generating grid');
      const gridPoints = gridGeneratorService.generateGrid(polygon);

      logger.info({ pointCount: gridPoints.length }, 'Grid generated, inserting into database');

      // Insert points into database (batch)
      if (!infrastructureId) {
        throw new Error('Failed to determine infrastructureId');
      }
      const createdPoints = await databaseService.createPoints(
        infrastructureId,
        gridPoints
      );

      // Calculate metrics
      const estimation = gridGeneratorService.estimatePointCount(polygon);
      const cost = gridGeneratorService.calculateMonthlyCost(createdPoints.length);
      const duration = Date.now() - startTime;

      const response = {
        infrastructureId,
        pointsCreated: createdPoints.length,
        surfaceKm2: estimation.surfaceKm2,
        monthlyCostEur: cost.costEur,
        generationTimeMs: duration,
      };

      logger.info(response, 'Grid generation completed successfully');

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
 * POST /api/onboarding/generate-grid-shp
 * 
 * Generate grid from uploaded shapefile
 * Requires multipart/form-data with .shp file
 */
router.post(
  '/generate-grid-shp',
  upload.single('shapefile'),
  async (req: Request, res: Response) => {
    const startTime = Date.now();
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

      let { infrastructureId, name } = req.body as { infrastructureId?: string; name?: string };

      // Verify infrastructure belongs to user
      const infrastructures = await databaseService.getUserInfrastructures(req.userId);
      let infrastructure = infrastructureId
        ? infrastructures.find(infra => infra.id === infrastructureId)
        : undefined;

      shpPath = req.file.path;
      logger.info({ infrastructureId, shpPath, mode: 'SHP' }, 'Processing shapefile upload');

      // Parse shapefile
      const polygon = await shapefileService.parseShapefile(shpPath);

      // Validate coordinate system
      const coordValidation = shapefileService.validateCoordinateSystem(polygon);
      if (!coordValidation.valid) {
        res.status(400).json({
          error: coordValidation.error,
        });
        return;
      }

      // Auto-create infrastructure if not provided
      if (!infrastructure) {
        if (!name || name.trim().length === 0) {
          res.status(400).json({ error: 'name is required when infrastructureId is not provided' });
          return;
        }

        const bboxArr = turf.bbox(polygon);
        const bboxPolygon = {
          type: 'Polygon' as const,
          coordinates: [
            [
              [bboxArr[0], bboxArr[1]],
              [bboxArr[2], bboxArr[1]],
              [bboxArr[2], bboxArr[3]],
              [bboxArr[0], bboxArr[3]],
              [bboxArr[0], bboxArr[1]],
            ],
          ],
        };

        const created = await databaseService.createInfrastructure(req.userId, {
          name,
          bbox: bboxPolygon,
          mode_onboarding: 'SHP',
        });

        infrastructure = created;
        infrastructureId = created.id;
        logger.info({ infrastructureId }, 'Infrastructure auto-created from shapefile bbox');
      }

      // Validate polygon
      const polygonValidation = gridGeneratorService.validatePolygon(polygon);
      if (!polygonValidation.valid) {
        res.status(400).json({
          error: polygonValidation.error,
        });
        return;
      }

      // Generate grid
      logger.info({ infrastructureId }, 'Generating grid from shapefile');
      const gridPoints = gridGeneratorService.generateGrid(polygon);

      logger.info({ pointCount: gridPoints.length }, 'Grid generated, inserting into database');

      // Insert points into database (batch)
      if (!infrastructureId) {
        throw new Error('Failed to determine infrastructureId');
      }
      const createdPoints = await databaseService.createPoints(
        infrastructureId,
        gridPoints
      );

      // Calculate metrics
      const estimation = gridGeneratorService.estimatePointCount(polygon);
      const cost = gridGeneratorService.calculateMonthlyCost(createdPoints.length);
      const duration = Date.now() - startTime;

      const response = {
        infrastructureId,
        pointsCreated: createdPoints.length,
        surfaceKm2: estimation.surfaceKm2,
        monthlyCostEur: cost.costEur,
        generationTimeMs: duration,
      };

      logger.info(response, 'Grid generation from shapefile completed successfully');

      res.status(201).json(response);

    } catch (error) {
      logger.error({ error }, 'Shapefile grid generation failed');
      res.status(500).json({
        error: 'Failed to generate grid from shapefile',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      // Cleanup shapefile
      if (shpPath) {
        try {
          await shapefileService.cleanupShapefile(shpPath);
        } catch (cleanupError) {
          logger.error({ cleanupError, shpPath }, 'Failed to cleanup shapefile');
        }
      }
    }
  }
);

export default router;
