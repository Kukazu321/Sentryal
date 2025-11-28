import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validateQuery } from '../middleware/validation';
import { databaseService } from '../services/databaseService';
import { prisma } from '../db/prisma';
import { exportService, ExportFormat } from '../services/exportService';
import logger from '../utils/logger';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/deformations
 * Get deformations for an infrastructure with statistics
 * Query params: infrastructureId (required), startDate, endDate, pointId
 */
router.get(
  '/',
  validateQuery(z.object({
    infrastructureId: z.string().uuid(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    pointId: z.string().uuid().optional()
  })),
  async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { infrastructureId, startDate, endDate, pointId } = req.query as {
        infrastructureId: string;
        startDate?: string;
        endDate?: string;
        pointId?: string;
      };

      // Verify infrastructure belongs to user
      const infrastructures = await databaseService.getUserInfrastructures(req.userId);
      const infrastructure = infrastructures.find((infra) => infra.id === infrastructureId);

      if (!infrastructure) {
        res.status(404).json({ error: 'Infrastructure not found' });
        return;
      }

      // Get statistics (simplified - just return basic info)
      // TODO: Implement proper statistics service
      const stats = {
        totalPoints: 0,
        totalDeformations: 0,
        averageDisplacement: 0,
        minDisplacement: 0,
        maxDisplacement: 0,
        dateRange: { start: null, end: null }
      };

      // If specific point requested, get time series
      if (pointId) {
        const timeSeries = await prisma.$queryRaw<Array<{
          date: Date;
          displacement_mm: number | null;
          velocity_mm_year: number | null;
          coherence: number | null;
        }>>`
          SELECT 
            date,
            displacement_mm,
            velocity_mm_year,
            coherence
          FROM deformations
          WHERE point_id::text = ${pointId}
          ORDER BY date ASC
        `;

        const formattedTimeSeries = timeSeries.map((ts) => ({
          date: ts.date.toISOString().split('T')[0],
          displacement_mm: ts.displacement_mm !== null ? Number(ts.displacement_mm) : null,
          velocity_mm_year: ts.velocity_mm_year !== null ? Number(ts.velocity_mm_year) : null,
          coherence: ts.coherence !== null ? Number(ts.coherence) : null,
        }));
        
        res.json({
          infrastructureId,
          pointId,
          timeSeries: formattedTimeSeries,
          count: formattedTimeSeries.length
        });
        return;
      }

      res.json({
        infrastructureId,
        statistics: stats,
        dateRange: stats.dateRange,
        filters: {
          startDate,
          endDate
        }
      });
    } catch (error) {
      logger.error({ error }, 'Failed to get deformations');
      res.status(500).json({ error: 'Failed to retrieve deformations' });
    }
  }
);

/**
 * GET /api/deformations/time-series/:pointId
 * Get time series for a specific point
 */
router.get(
  '/time-series/:pointId',
  async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { pointId } = req.params;

      logger.info({ pointId }, 'Fetching time series for point');

      // Get time series directly from database
      const timeSeries = await prisma.$queryRaw<Array<{
        date: Date;
        displacement_mm: number | null;
        velocity_mm_year: number | null;
        coherence: number | null;
      }>>`
        SELECT 
          date,
          displacement_mm,
          velocity_mm_year,
          coherence
        FROM deformations
        WHERE point_id::text = ${pointId}
        ORDER BY date ASC
      `;

      logger.info({ pointId, count: timeSeries.length }, 'Time series query result');

      // Convert BigInt and Date to proper types, and ensure proper date sorting
      const rawTimeSeries = timeSeries.map((ts) => {
        const dateStr = ts.date instanceof Date 
          ? ts.date.toISOString().split('T')[0] 
          : new Date(ts.date).toISOString().split('T')[0];
        return {
          date: dateStr, // Format as YYYY-MM-DD for consistent sorting
          dateObj: ts.date instanceof Date ? ts.date : new Date(ts.date), // Keep Date object for sorting
          displacement_mm: ts.displacement_mm !== null ? Number(ts.displacement_mm) : null,
          velocity_mm_year: ts.velocity_mm_year !== null ? Number(ts.velocity_mm_year) : null,
          coherence: ts.coherence !== null ? Number(ts.coherence) : null,
        };
      });

      // Sort by date to ensure correct order (in case SQL didn't sort correctly)
      rawTimeSeries.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

      // Return raw values - each measurement is relative to its job's reference image
      // The frontend will display these as-is, showing the actual displacement values
      const formattedTimeSeries = rawTimeSeries.map((ts) => ({
        date: ts.date,
        displacement_mm: ts.displacement_mm !== null ? Math.round(ts.displacement_mm * 100) / 100 : null,
        velocity_mm_year: ts.velocity_mm_year !== null ? Math.round(ts.velocity_mm_year * 100) / 100 : null,
        coherence: ts.coherence !== null ? Math.round(ts.coherence * 100) / 100 : null,
      }));

      logger.info({ pointId, count: formattedTimeSeries.length }, 'Time series retrieved');

      // Return empty array instead of 404 - frontend can handle empty data
      res.json({
        pointId,
        timeSeries: formattedTimeSeries,
        count: formattedTimeSeries.length
      });
    } catch (error) {
      logger.error({ error, pointId: req.params.pointId }, 'Failed to get time series');
      res.status(500).json({ error: 'Failed to retrieve time series' });
    }
  }
);

/**
 * GET /api/deformations/export
 * Export deformations data in multiple formats
 * 
 * Query parameters:
 * - infrastructureId (required): Infrastructure UUID
 * - format (required): csv | geojson | json
 * - startDate (optional): Filter by start date (YYYY-MM-DD)
 * - endDate (optional): Filter by end date (YYYY-MM-DD)
 * - pointIds (optional): Comma-separated point IDs
 * - includeMetadata (optional): Include metadata in export
 * 
 * Returns file download with appropriate content-type
 */
router.get(
  '/export',
  validateQuery(z.object({
    infrastructureId: z.string().uuid(),
    format: z.enum(['csv', 'geojson', 'json']),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    pointIds: z.string().optional(),
    includeMetadata: z.string().optional(),
  })),
  async (req: Request, res: Response) => {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { 
        infrastructureId, 
        format, 
        startDate, 
        endDate, 
        pointIds,
        includeMetadata 
      } = req.query as {
        infrastructureId: string;
        format: ExportFormat;
        startDate?: string;
        endDate?: string;
        pointIds?: string;
        includeMetadata?: string;
      };

      // Verify infrastructure belongs to user
      const infrastructures = await databaseService.getUserInfrastructures(req.userId);
      const infrastructure = infrastructures.find((infra) => infra.id === infrastructureId);

      if (!infrastructure) {
        res.status(404).json({ error: 'Infrastructure not found' });
        return;
      }

      logger.info(
        { infrastructureId, format, userId: req.userId },
        'Exporting deformations data'
      );

      // Parse optional parameters
      const pointIdsArray = pointIds ? pointIds.split(',') : undefined;
      const includeMetadataBool = includeMetadata === 'true';

      // Generate export
      const exportData = await exportService.exportDeformations(infrastructureId, {
        format,
        startDate,
        endDate,
        pointIds: pointIdsArray,
        includeMetadata: includeMetadataBool,
      });

      // Set response headers for file download
      res.setHeader('Content-Type', exportData.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${exportData.filename}"`);
      res.setHeader('X-Export-Format', format);
      res.setHeader('X-Infrastructure-Id', infrastructureId);

      res.send(exportData.data);

      logger.info(
        { infrastructureId, format, filename: exportData.filename },
        'Export completed successfully'
      );
    } catch (error) {
      logger.error({ error, query: req.query }, 'Failed to export deformations');
      res.status(500).json({ error: 'Failed to export data' });
    }
  }
);

export default router;
