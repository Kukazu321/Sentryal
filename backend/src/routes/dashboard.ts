import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { databaseService } from '../services/databaseService';
import { prisma } from '../db/prisma';
import { Prisma } from '@prisma/client';
import logger from '../utils/logger';
import { performance } from 'perf_hooks';
import Redis from 'ioredis';
import { config } from '../config';

/**
 * Dashboard Router - PERFORMANCE EXCEPTIONNELLE
 * 
 * Optimisations PostGIS + Redis :
 * - Agrégation spatiale avec ST_ClusterKMeans
 * - Cache Redis pour queries lourdes
 * - Pagination optimisée
 * - Statistiques temps réel
 * - Heatmap data optimisée
 * 
 * Routes :
 * - GET /api/dashboard/:id - Dashboard complet
 * - GET /api/dashboard/:id/deformations - Déformations avec filtres
 * - GET /api/dashboard/:id/heatmap - Données heatmap
 * - GET /api/dashboard/:id/statistics - Statistiques agrégées
 * - GET /api/dashboard/:id/time-series - Série temporelle
 * 
 * @version 1.0.0
 */

const router = Router();

// Parse REDIS_URL if provided
function parseRedisUrl(url?: string) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 6379,
      password: parsed.password || undefined,
    };
  } catch {
    return null;
  }
}
const redisFromUrl = parseRedisUrl(process.env.REDIS_URL);

// Redis client for caching
const redis = new Redis({
  host: redisFromUrl?.host || (config as any).redis?.host || process.env.REDIS_HOST || 'localhost',
  port: redisFromUrl?.port || (config as any).redis?.port || parseInt(process.env.REDIS_PORT || '6379'),
  password: redisFromUrl?.password || (config as any).redis?.password || process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

redis.on('error', (error) => {
  logger.error({ error }, 'Redis connection error');
});

// Cache TTL
const CACHE_TTL = {
  DASHBOARD: 300, // 5 minutes
  STATISTICS: 600, // 10 minutes
  HEATMAP: 300, // 5 minutes
  TIME_SERIES: 600, // 10 minutes
};

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/dashboard/:id
 * 
 * Dashboard complet avec toutes les données
 * 
 * Response:
 * - infrastructure: { id, name, type, bbox, ... }
 * - statistics: { totalPoints, totalDeformations, avgDisplacement, ... }
 * - recentJobs: Job[]
 * - alerts: Alert[]
 */
router.get(
  '/:id',
  async (req: Request, res: Response) => {
    const startTime = performance.now();

    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id: infrastructureId } = req.params;

      // Check cache
      const cacheKey = `dashboard:${infrastructureId}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug({ infrastructureId }, 'Dashboard cache hit');
        res.json(JSON.parse(cached));
        return;
      }

      // Verify infrastructure belongs to user
      const infrastructures = await databaseService.getUserInfrastructures(req.userId);
      const infrastructure = infrastructures.find(infra => infra.id === infrastructureId);

      if (!infrastructure) {
        res.status(404).json({ error: 'Infrastructure not found' });
        return;
      }

      // Get statistics (parallel queries)
      const [
        pointCount,
        deformationStats,
        recentJobs,
        alerts,
      ] = await Promise.all([
        // Point count
        prisma.$queryRaw<[{ count: bigint }]>`
          SELECT COUNT(*) as count
          FROM points
          WHERE infrastructure_id = ${infrastructureId}::uuid
        `,

        // Deformation statistics
        prisma.$queryRaw<[{
          total_deformations: bigint;
          avg_vertical_displacement: number | null;
          min_vertical_displacement: number | null;
          max_vertical_displacement: number | null;
          avg_coherence: number | null;
        }]>`
          SELECT 
            COUNT(*) as total_deformations,
            AVG(vertical_displacement_mm) as avg_vertical_displacement,
            MIN(vertical_displacement_mm) as min_vertical_displacement,
            MAX(vertical_displacement_mm) as max_vertical_displacement,
            AVG(coherence) as avg_coherence
          FROM deformations d
          JOIN points p ON d.point_id = p.id
          WHERE p.infrastructure_id = ${infrastructureId}::uuid
        `,

        // Recent jobs
        databaseService.getJobsByInfrastructure(infrastructureId),

        // Alerts (placeholder - Phase 6)
        Promise.resolve([]),
      ]);

      const stats = deformationStats[0];

      const response = {
        infrastructure,
        statistics: {
          totalPoints: Number(pointCount[0].count),
          totalDeformations: Number(stats.total_deformations),
          avgVerticalDisplacementMm: stats.avg_vertical_displacement
            ? Math.round(stats.avg_vertical_displacement * 100) / 100
            : null,
          minVerticalDisplacementMm: stats.min_vertical_displacement
            ? Math.round(stats.min_vertical_displacement * 100) / 100
            : null,
          maxVerticalDisplacementMm: stats.max_vertical_displacement
            ? Math.round(stats.max_vertical_displacement * 100) / 100
            : null,
          avgCoherence: stats.avg_coherence
            ? Math.round(stats.avg_coherence * 100) / 100
            : null,
        },
        recentJobs: recentJobs.slice(0, 10), // Last 10 jobs
        alerts,
        performance: {
          durationMs: Math.round(performance.now() - startTime),
        },
      };

      // Cache response
      await redis.setex(cacheKey, CACHE_TTL.DASHBOARD, JSON.stringify(response));

      logger.info({
        infrastructureId,
        totalPoints: response.statistics.totalPoints,
        totalDeformations: response.statistics.totalDeformations,
        durationMs: response.performance.durationMs,
      }, 'Dashboard data retrieved');

      res.json(response);
    } catch (error) {
      logger.error({ error }, 'Failed to get dashboard data');
      res.status(500).json({
        error: 'Failed to retrieve dashboard data',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/dashboard/:id/deformations
 * 
 * Déformations avec filtres et pagination
 * 
 * Query params:
 * - limit: number (default: 100)
 * - offset: number (default: 0)
 * - minCoherence: number (filter low quality)
 * - minDisplacement: number (filter small movements)
 * - maxDisplacement: number (filter large movements)
 * - dateFrom: string (ISO date)
 * - dateTo: string (ISO date)
 * 
 * Response:
 * - deformations: Array<{ pointId, lat, lng, verticalDisplacementMm, date, coherence }>
 * - pagination: { total, limit, offset, hasMore }
 */
router.get(
  '/:id/deformations',
  async (req: Request, res: Response) => {
    const startTime = performance.now();

    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id: infrastructureId } = req.params;
      const {
        limit = '100',
        offset = '0',
        minCoherence,
        minDisplacement,
        maxDisplacement,
        dateFrom,
        dateTo,
      } = req.query;

      // Verify infrastructure
      const infrastructures = await databaseService.getUserInfrastructures(req.userId);
      const infrastructure = infrastructures.find(infra => infra.id === infrastructureId);

      if (!infrastructure) {
        res.status(404).json({ error: 'Infrastructure not found' });
        return;
      }

      // Build query with filters
      const limitNum = parseInt(limit as string);
      const offsetNum = parseInt(offset as string);

      // Parse filter values safely
      const minCohVal = minCoherence ? parseFloat(minCoherence as string) : null;
      const minDispVal = minDisplacement ? parseFloat(minDisplacement as string) : null;
      const maxDispVal = maxDisplacement ? parseFloat(maxDisplacement as string) : null;
      const dateFromVal = dateFrom ? (dateFrom as string) : null;
      const dateToVal = dateTo ? (dateTo as string) : null;

      // Get total count with parameterized query
      const countResult = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count
        FROM deformations d
        JOIN points p ON d.point_id = p.id
        WHERE p.infrastructure_id = ${infrastructureId}::uuid
          AND (${minCohVal}::float IS NULL OR d.coherence >= ${minCohVal})
          AND (${minDispVal}::float IS NULL OR ABS(d.vertical_displacement_mm) >= ${minDispVal})
          AND (${maxDispVal}::float IS NULL OR ABS(d.vertical_displacement_mm) <= ${maxDispVal})
          AND (${dateFromVal}::date IS NULL OR d.date >= ${dateFromVal}::date)
          AND (${dateToVal}::date IS NULL OR d.date <= ${dateToVal}::date)
      `;

      const total = Number(countResult[0].count);

      // Get deformations with pagination
      const deformations = await prisma.$queryRaw<Array<{
        point_id: string;
        lat: number;
        lng: number;
        vertical_displacement_mm: number;
        los_displacement_mm: number | null;
        coherence: number | null;
        date: Date;
      }>>`
        SELECT 
          d.point_id,
          ST_Y(p.location::geometry) as lat,
          ST_X(p.location::geometry) as lng,
          d.vertical_displacement_mm,
          d.los_displacement_mm,
          d.coherence,
          d.date
        FROM deformations d
        JOIN points p ON d.point_id = p.id
        WHERE p.infrastructure_id = ${infrastructureId}::uuid
          AND (${minCohVal}::float IS NULL OR d.coherence >= ${minCohVal})
          AND (${minDispVal}::float IS NULL OR ABS(d.vertical_displacement_mm) >= ${minDispVal})
          AND (${maxDispVal}::float IS NULL OR ABS(d.vertical_displacement_mm) <= ${maxDispVal})
          AND (${dateFromVal}::date IS NULL OR d.date >= ${dateFromVal}::date)
          AND (${dateToVal}::date IS NULL OR d.date <= ${dateToVal}::date)
        ORDER BY d.date DESC, ABS(d.vertical_displacement_mm) DESC
        LIMIT ${limitNum}
        OFFSET ${offsetNum}
      `;

      const duration = performance.now() - startTime;

      const response = {
        deformations: deformations.map(d => ({
          pointId: d.point_id,
          lat: d.lat,
          lng: d.lng,
          verticalDisplacementMm: Math.round(d.vertical_displacement_mm * 100) / 100,
          losDisplacementMm: d.los_displacement_mm
            ? Math.round(d.los_displacement_mm * 100) / 100
            : null,
          coherence: d.coherence ? Math.round(d.coherence * 100) / 100 : null,
          date: d.date.toISOString().split('T')[0],
        })),
        pagination: {
          total,
          limit: limitNum,
          offset: offsetNum,
          hasMore: offsetNum + limitNum < total,
        },
        performance: {
          durationMs: Math.round(duration),
        },
      };

      logger.info({
        infrastructureId,
        count: deformations.length,
        total,
        durationMs: Math.round(duration),
      }, 'Deformations retrieved');

      res.json(response);
    } catch (error) {
      logger.error({ error }, 'Failed to get deformations');
      res.status(500).json({
        error: 'Failed to retrieve deformations',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/dashboard/:id/heatmap
 * 
 * Données optimisées pour heatmap
 * 
 * Utilise ST_ClusterKMeans pour agréger les points proches
 * Réduit le nombre de points pour performance frontend
 * 
 * Query params:
 * - clusters: number (default: 1000) - nombre de clusters
 * - minCoherence: number (filter low quality)
 * 
 * Response:
 * - heatmapData: Array<{ lat, lng, intensity, avgDisplacement, pointCount }>
 * - bounds: { minLat, maxLat, minLng, maxLng }
 * - statistics: { totalPoints, clusteredPoints, avgDisplacement }
 */
router.get(
  '/:id/heatmap',
  async (req: Request, res: Response) => {
    const startTime = performance.now();

    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id: infrastructureId } = req.params;
      const { clusters = '1000', minCoherence = '0.3' } = req.query;

      // Check cache
      const cacheKey = `heatmap:${infrastructureId}:${clusters}:${minCoherence}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug({ infrastructureId }, 'Heatmap cache hit');
        res.json(JSON.parse(cached));
        return;
      }

      // Verify infrastructure
      const infrastructures = await databaseService.getUserInfrastructures(req.userId);
      const infrastructure = infrastructures.find(infra => infra.id === infrastructureId);

      if (!infrastructure) {
        res.status(404).json({ error: 'Infrastructure not found' });
        return;
      }

      const clusterCount = parseInt(clusters as string);
      const minCoh = parseFloat(minCoherence as string);

      // Aggregate deformations with spatial clustering (parameterized query)
      const heatmapData = await prisma.$queryRaw<Array<{
        cluster_id: number;
        lat: number;
        lng: number;
        avg_displacement: number;
        max_displacement: number;
        point_count: bigint;
        avg_coherence: number;
      }>>`
        WITH clustered_points AS (
          SELECT 
            ST_ClusterKMeans(p.location::geometry, ${clusterCount}) OVER() as cluster_id,
            p.id as point_id,
            ST_Y(p.location::geometry) as lat,
            ST_X(p.location::geometry) as lng,
            d.vertical_displacement_mm,
            d.coherence
          FROM points p
          LEFT JOIN LATERAL (
            SELECT vertical_displacement_mm, coherence
            FROM deformations
            WHERE point_id = p.id
            AND coherence >= ${minCoh}
            ORDER BY date DESC
            LIMIT 1
          ) d ON true
          WHERE p.infrastructure_id = ${infrastructureId}::uuid
        )
        SELECT 
          cluster_id,
          AVG(lat) as lat,
          AVG(lng) as lng,
          AVG(vertical_displacement_mm) as avg_displacement,
          MAX(ABS(vertical_displacement_mm)) as max_displacement,
          COUNT(*) as point_count,
          AVG(coherence) as avg_coherence
        FROM clustered_points
        WHERE vertical_displacement_mm IS NOT NULL
        GROUP BY cluster_id
        ORDER BY max_displacement DESC
      `;

      // Calculate bounds
      const lats = heatmapData.map((d: any) => d.lat);
      const lngs = heatmapData.map((d: any) => d.lng);
      const bounds = {
        minLat: Math.min(...lats),
        maxLat: Math.max(...lats),
        minLng: Math.min(...lngs),
        maxLng: Math.max(...lngs),
      };

      // Calculate statistics
      const totalPoints = heatmapData.reduce((sum: number, d: any) => sum + Number(d.point_count), 0);
      const avgDisplacement = heatmapData.reduce((sum: number, d: any) => sum + d.avg_displacement, 0) / heatmapData.length;

      const duration = performance.now() - startTime;

      const response = {
        heatmapData: heatmapData.map((d: any) => ({
          lat: d.lat,
          lng: d.lng,
          intensity: Math.abs(d.avg_displacement), // For heatmap intensity
          avgDisplacement: Math.round(d.avg_displacement * 100) / 100,
          maxDisplacement: Math.round(d.max_displacement * 100) / 100,
          pointCount: Number(d.point_count),
          avgCoherence: Math.round(d.avg_coherence * 100) / 100,
        })),
        bounds,
        statistics: {
          totalPoints,
          clusteredPoints: heatmapData.length,
          avgDisplacement: Math.round(avgDisplacement * 100) / 100,
        },
        performance: {
          durationMs: Math.round(duration),
        },
      };

      // Cache response
      await redis.setex(cacheKey, CACHE_TTL.HEATMAP, JSON.stringify(response));

      logger.info({
        infrastructureId,
        clusteredPoints: heatmapData.length,
        totalPoints,
        durationMs: Math.round(duration),
      }, 'Heatmap data retrieved');

      res.json(response);
    } catch (error) {
      logger.error({ error }, 'Failed to get heatmap data');
      res.status(500).json({
        error: 'Failed to retrieve heatmap data',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/dashboard/:id/time-series
 * 
 * Série temporelle des déformations
 * 
 * Query params:
 * - pointId: string (optional) - specific point
 * - dateFrom: string (ISO date)
 * - dateTo: string (ISO date)
 * 
 * Response:
 * - timeSeries: Array<{ date, avgDisplacement, minDisplacement, maxDisplacement, count }>
 * - statistics: { totalDataPoints, dateRange }
 */
router.get(
  '/:id/time-series',
  async (req: Request, res: Response) => {
    const startTime = performance.now();

    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id: infrastructureId } = req.params;
      const { pointId, dateFrom, dateTo } = req.query;

      // Check cache
      const cacheKey = `timeseries:${infrastructureId}:${pointId || 'all'}:${dateFrom}:${dateTo}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        logger.debug({ infrastructureId }, 'Time-series cache hit');
        res.json(JSON.parse(cached));
        return;
      }

      // Verify infrastructure
      const infrastructures = await databaseService.getUserInfrastructures(req.userId);
      const infrastructure = infrastructures.find(infra => infra.id === infrastructureId);

      if (!infrastructure) {
        res.status(404).json({ error: 'Infrastructure not found' });
        return;
      }

      // Parse filter values safely
      const pointIdVal = pointId ? (pointId as string) : null;
      const dateFromVal = dateFrom ? (dateFrom as string) : null;
      const dateToVal = dateTo ? (dateTo as string) : null;

      // Get time-series data with parameterized query
      const timeSeries = await prisma.$queryRaw<Array<{
        date: Date;
        avg_displacement: number;
        min_displacement: number;
        max_displacement: number;
        count: bigint;
        avg_coherence: number;
      }>>`
        SELECT 
          d.date,
          AVG(d.vertical_displacement_mm) as avg_displacement,
          MIN(d.vertical_displacement_mm) as min_displacement,
          MAX(d.vertical_displacement_mm) as max_displacement,
          COUNT(*) as count,
          AVG(d.coherence) as avg_coherence
        FROM deformations d
        JOIN points p ON d.point_id = p.id
        WHERE p.infrastructure_id = ${infrastructureId}::uuid
          AND (${pointIdVal}::uuid IS NULL OR d.point_id = ${pointIdVal}::uuid)
          AND (${dateFromVal}::date IS NULL OR d.date >= ${dateFromVal}::date)
          AND (${dateToVal}::date IS NULL OR d.date <= ${dateToVal}::date)
        GROUP BY d.date
        ORDER BY d.date ASC
      `;

      const duration = performance.now() - startTime;

      const response = {
        timeSeries: timeSeries.map((t: any) => ({
          date: t.date.toISOString().split('T')[0],
          avgDisplacement: Math.round(t.avg_displacement * 100) / 100,
          minDisplacement: Math.round(t.min_displacement * 100) / 100,
          maxDisplacement: Math.round(t.max_displacement * 100) / 100,
          count: Number(t.count),
          avgCoherence: Math.round(t.avg_coherence * 100) / 100,
        })),
        statistics: {
          totalDataPoints: timeSeries.length,
          dateRange: timeSeries.length > 0 ? {
            from: timeSeries[0].date.toISOString().split('T')[0],
            to: timeSeries[timeSeries.length - 1].date.toISOString().split('T')[0],
          } : null,
        },
        performance: {
          durationMs: Math.round(duration),
        },
      };

      // Cache response
      await redis.setex(cacheKey, CACHE_TTL.TIME_SERIES, JSON.stringify(response));

      logger.info({
        infrastructureId,
        dataPoints: timeSeries.length,
        durationMs: Math.round(duration),
      }, 'Time-series data retrieved');

      res.json(response);
    } catch (error) {
      logger.error({ error }, 'Failed to get time-series data');
      res.status(500).json({
        error: 'Failed to retrieve time-series data',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * DELETE /api/dashboard/cache/:id
 * 
 * Invalider le cache pour une infrastructure
 */
router.delete(
  '/cache/:id',
  async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { id: infrastructureId } = req.params;

      // Delete all cache keys for this infrastructure
      const pattern = `*:${infrastructureId}*`;
      const keys = await redis.keys(pattern);

      if (keys.length > 0) {
        await redis.del(...keys);
      }

      logger.info({ infrastructureId, deletedKeys: keys.length }, 'Cache invalidated');

      res.json({
        message: 'Cache invalidated successfully',
        deletedKeys: keys.length,
      });
    } catch (error) {
      logger.error({ error }, 'Failed to invalidate cache');
      res.status(500).json({
        error: 'Failed to invalidate cache',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;
