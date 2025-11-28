import { prisma } from '../db/prisma';
import { Prisma } from '@prisma/client';
import logger from '../utils/logger';

/**
 * Export Service
 * 
 * Provides data export functionality in multiple formats:
 * - CSV: Tabular data for Excel/analysis
 * - GeoJSON: Geographic data for GIS software
 * - JSON: Raw data for programmatic access
 * 
 * All exports are optimized for large datasets with streaming where applicable.
 */

export type ExportFormat = 'csv' | 'geojson' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  startDate?: string;
  endDate?: string;
  pointIds?: string[];
  includeMetadata?: boolean;
}

class ExportService {
  /**
   * Export deformations for an infrastructure
   */
  async exportDeformations(
    infrastructureId: string,
    options: ExportOptions
  ): Promise<{ data: string; contentType: string; filename: string }> {
    try {
      logger.info({ infrastructureId, options }, 'Starting data export');

      // Build query with filters
      const deformations = await this.fetchDeformations(infrastructureId, options);

      // Generate export based on format
      switch (options.format) {
        case 'csv':
          return this.generateCSV(deformations, infrastructureId);
        case 'geojson':
          return this.generateGeoJSON(deformations, infrastructureId);
        case 'json':
          return this.generateJSON(deformations, infrastructureId);
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }
    } catch (error) {
      logger.error({ error, infrastructureId, options }, 'Export failed');
      throw new Error('Failed to export data');
    }
  }

  /**
   * Fetch deformations with optional filters
   */
  private async fetchDeformations(
    infrastructureId: string,
    options: ExportOptions
  ) {
    // Validate UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(infrastructureId)) {
      throw new Error('Invalid infrastructure ID');
    }

    // Validate pointIds if provided
    if (options.pointIds) {
      for (const pointId of options.pointIds) {
        if (!uuidRegex.test(pointId)) {
          throw new Error('Invalid point ID');
        }
      }
    }

    // Parse date options
    const startDate = options.startDate || null;
    const endDate = options.endDate || null;
    const pointIds = options.pointIds && options.pointIds.length > 0 ? options.pointIds : null;
    const includeMetadata = options.includeMetadata || false;

    // Use parameterized query
    return await prisma.$queryRaw<
      Array<{
        deformation_id: string;
        point_id: string;
        job_id: string;
        date: Date;
        displacement_mm: number;
        velocity_mm_year: number | null;
        coherence: number | null;
        created_at: Date;
        latitude: number;
        longitude: number;
        metadata: any;
      }>
    >`
      SELECT 
        d.id::text as deformation_id,
        d.point_id::text as point_id,
        d.job_id::text as job_id,
        d.date,
        d.displacement_mm::float as displacement_mm,
        d.velocity_mm_year::float as velocity_mm_year,
        d.coherence::float as coherence,
        d.created_at,
        ST_Y(p.geom::geometry) as latitude,
        ST_X(p.geom::geometry) as longitude,
        CASE WHEN ${includeMetadata} THEN d.metadata ELSE NULL END as metadata
      FROM deformations d
      JOIN points p ON d.point_id = p.id
      WHERE p.infrastructure_id = ${infrastructureId}::uuid
        AND (${startDate}::date IS NULL OR d.date >= ${startDate}::date)
        AND (${endDate}::date IS NULL OR d.date <= ${endDate}::date)
        AND (${pointIds}::text[] IS NULL OR d.point_id::text = ANY(${pointIds}))
      ORDER BY d.date DESC, p.id
    `;
  }

  /**
   * Generate CSV export
   */
  private generateCSV(
    data: Array<{
      deformation_id: string;
      point_id: string;
      job_id: string;
      date: Date;
      displacement_mm: number;
      velocity_mm_year: number | null;
      coherence: number | null;
      latitude: number;
      longitude: number;
      created_at: Date;
    }>,
    infrastructureId: string
  ): { data: string; contentType: string; filename: string } {
    // CSV Header
    const headers = [
      'Deformation ID',
      'Point ID',
      'Job ID',
      'Date',
      'Latitude',
      'Longitude',
      'Displacement (mm)',
      'Velocity (mm/year)',
      'Coherence',
      'Created At',
    ];

    // CSV Rows
    const rows = data.map(d => [
      d.deformation_id,
      d.point_id,
      d.job_id,
      d.date.toISOString().split('T')[0],
      d.latitude.toFixed(8),
      d.longitude.toFixed(8),
      d.displacement_mm.toFixed(3),
      d.velocity_mm_year?.toFixed(3) || '',
      d.coherence?.toFixed(3) || '',
      d.created_at.toISOString(),
    ]);

    // Combine header and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => this.escapeCSV(cell)).join(',')),
    ].join('\n');

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `deformations_${infrastructureId}_${timestamp}.csv`;

    return {
      data: csvContent,
      contentType: 'text/csv',
      filename,
    };
  }

  /**
   * Generate GeoJSON export
   */
  private generateGeoJSON(
    data: Array<{
      deformation_id: string;
      point_id: string;
      date: Date;
      displacement_mm: number;
      velocity_mm_year: number | null;
      coherence: number | null;
      latitude: number;
      longitude: number;
    }>,
    infrastructureId: string
  ): { data: string; contentType: string; filename: string } {
    // Group by point to create time series
    const pointsMap = new Map<
      string,
      {
        latitude: number;
        longitude: number;
        measurements: Array<{
          date: string;
          displacement_mm: number;
          velocity_mm_year: number | null;
          coherence: number | null;
        }>;
      }
    >();

    data.forEach(d => {
      if (!pointsMap.has(d.point_id)) {
        pointsMap.set(d.point_id, {
          latitude: d.latitude,
          longitude: d.longitude,
          measurements: [],
        });
      }

      pointsMap.get(d.point_id)!.measurements.push({
        date: d.date.toISOString().split('T')[0],
        displacement_mm: d.displacement_mm,
        velocity_mm_year: d.velocity_mm_year,
        coherence: d.coherence,
      });
    });

    // Create GeoJSON FeatureCollection
    const features = Array.from(pointsMap.entries()).map(([pointId, pointData]) => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [pointData.longitude, pointData.latitude],
      },
      properties: {
        pointId,
        measurementCount: pointData.measurements.length,
        latestDisplacement:
          pointData.measurements[0]?.displacement_mm || null,
        latestVelocity:
          pointData.measurements[0]?.velocity_mm_year || null,
        measurements: pointData.measurements,
      },
    }));

    const geojson = {
      type: 'FeatureCollection',
      features,
      metadata: {
        infrastructureId,
        exportDate: new Date().toISOString(),
        totalPoints: pointsMap.size,
        totalMeasurements: data.length,
      },
    };

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `deformations_${infrastructureId}_${timestamp}.geojson`;

    return {
      data: JSON.stringify(geojson, null, 2),
      contentType: 'application/geo+json',
      filename,
    };
  }

  /**
   * Generate JSON export
   */
  private generateJSON(
    data: Array<any>,
    infrastructureId: string
  ): { data: string; contentType: string; filename: string } {
    const exportData = {
      infrastructureId,
      exportDate: new Date().toISOString(),
      count: data.length,
      deformations: data,
    };

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `deformations_${infrastructureId}_${timestamp}.json`;

    return {
      data: JSON.stringify(exportData, null, 2),
      contentType: 'application/json',
      filename,
    };
  }

  /**
   * Escape CSV cell content
   */
  private escapeCSV(value: string | number): string {
    const stringValue = String(value);

    // If contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  /**
   * Export infrastructure summary (points only, no deformations)
   */
  async exportInfrastructurePoints(
    infrastructureId: string,
    format: 'csv' | 'geojson'
  ): Promise<{ data: string; contentType: string; filename: string }> {
    try {
      const points = await prisma.$queryRaw<
        Array<{
          point_id: string;
          latitude: number;
          longitude: number;
          created_at: Date;
        }>
      >`
        SELECT 
          id::text as point_id,
          ST_Y(geom::geometry) as latitude,
          ST_X(geom::geometry) as longitude,
          created_at
        FROM points
        WHERE infrastructure_id::text = ${infrastructureId}
        ORDER BY created_at
      `;

      if (format === 'csv') {
        const headers = ['Point ID', 'Latitude', 'Longitude', 'Created At'];
        const rows = points.map(p => [
          p.point_id,
          p.latitude.toFixed(8),
          p.longitude.toFixed(8),
          p.created_at.toISOString(),
        ]);

        const csvContent = [
          headers.join(','),
          ...rows.map(row => row.join(',')),
        ].join('\n');

        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `points_${infrastructureId}_${timestamp}.csv`;

        return {
          data: csvContent,
          contentType: 'text/csv',
          filename,
        };
      } else {
        // GeoJSON
        const features = points.map(p => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [p.longitude, p.latitude],
          },
          properties: {
            pointId: p.point_id,
            createdAt: p.created_at.toISOString(),
          },
        }));

        const geojson = {
          type: 'FeatureCollection',
          features,
          metadata: {
            infrastructureId,
            exportDate: new Date().toISOString(),
            totalPoints: points.length,
          },
        };

        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `points_${infrastructureId}_${timestamp}.geojson`;

        return {
          data: JSON.stringify(geojson, null, 2),
          contentType: 'application/geo+json',
          filename,
        };
      }
    } catch (error) {
      logger.error({ error, infrastructureId }, 'Failed to export points');
      throw new Error('Failed to export infrastructure points');
    }
  }
}

export const exportService = new ExportService();
