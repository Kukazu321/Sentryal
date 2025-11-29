import { prisma } from '../db/prisma';
import { Prisma } from '@prisma/client';
import logger from '../utils/logger';

/**
 * Service for generating map visualization data
 * Handles GeoJSON generation with intelligent color coding and risk assessment
 */

export interface MapPoint {
  pointId: string;
  longitude: number;
  latitude: number;
  displacement_mm: number | null;
  velocity_mm_year: number | null;
  coherence: number | null;
  lastUpdate: Date | null;
  measurementCount: number;
  color: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'stable' | 'unknown';
  trend: 'accelerating' | 'stable' | 'decelerating' | 'unknown';
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  properties: {
    pointId: string;
    latestDisplacement: number | null;
    latestVelocity: number | null;
    latestCoherence: number | null;
    latestDate: string | null;
    measurementCount: number;
    color: string;
    riskLevel: string;
    trend: string;
    // Additional metadata for advanced visualization
    metadata: {
      displacementRange: { min: number; max: number } | null;
      averageCoherence: number | null;
      dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
    };
  };
}

export interface MapDataResponse {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
  metadata: {
    infrastructureId: string;
    totalPoints: number;
    activePoints: number; // Points with measurements
    dateRange: {
      earliest: Date | null;
      latest: Date | null;
    };
    statistics: {
      averageDisplacement: number | null;
      minDisplacement: number | null;
      maxDisplacement: number | null;
      averageVelocity: number | null;
    };
    riskDistribution: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      stable: number;
      unknown: number;
    };
  };
}

/**
 * Color scale configuration
 * Based on displacement magnitude (mm)
 */
const COLOR_SCALE = {
  // Critical subsidence (> 20mm)
  CRITICAL_SUBSIDENCE: '#8B0000', // Dark red
  // High subsidence (10-20mm)
  HIGH_SUBSIDENCE: '#FF0000', // Red
  // Medium subsidence (5-10mm)
  MEDIUM_SUBSIDENCE: '#FF4500', // Orange red
  // Low subsidence (2-5mm)
  LOW_SUBSIDENCE: '#FFA500', // Orange
  // Minimal movement (0-2mm)
  MINIMAL: '#FFFF00', // Yellow
  // Stable (-2 to 0mm)
  STABLE: '#90EE90', // Light green
  // Uplift (< -2mm)
  UPLIFT: '#00FF00', // Green
  // No data
  NO_DATA: '#808080', // Gray
} as const;

/**
 * Thresholds for risk assessment (mm)
 */
const RISK_THRESHOLDS = {
  CRITICAL: 20,
  HIGH: 10,
  MEDIUM: 5,
  LOW: 2,
} as const;

/**
 * Velocity thresholds for trend analysis (mm/year)
 */
const VELOCITY_THRESHOLDS = {
  ACCELERATING: -10, // Worsening subsidence
  STABLE: -2, // Minimal change
} as const;

class MapDataService {
  /**
   * Get color based on displacement value
   * Uses a scientifically-informed color scale
   */
  private getColorByDisplacement(displacement_mm: number | null): string {
    if (displacement_mm === null) return COLOR_SCALE.NO_DATA;

    // Positive = subsidence (going down), negative = uplift (going up)
    // Note: InSAR convention varies, adjust based on your data
    const absDisplacement = Math.abs(displacement_mm);

    if (displacement_mm > RISK_THRESHOLDS.CRITICAL) {
      return COLOR_SCALE.CRITICAL_SUBSIDENCE;
    }
    if (displacement_mm > RISK_THRESHOLDS.HIGH) {
      return COLOR_SCALE.HIGH_SUBSIDENCE;
    }
    if (displacement_mm > RISK_THRESHOLDS.MEDIUM) {
      return COLOR_SCALE.MEDIUM_SUBSIDENCE;
    }
    if (displacement_mm > RISK_THRESHOLDS.LOW) {
      return COLOR_SCALE.LOW_SUBSIDENCE;
    }
    if (displacement_mm > 0) {
      return COLOR_SCALE.MINIMAL;
    }
    if (displacement_mm > -RISK_THRESHOLDS.LOW) {
      return COLOR_SCALE.STABLE;
    }
    return COLOR_SCALE.UPLIFT;
  }

  /**
   * Assess risk level based on displacement and velocity
   */
  private assessRiskLevel(
    displacement_mm: number | null,
    velocity_mm_year: number | null
  ): 'critical' | 'high' | 'medium' | 'low' | 'stable' | 'unknown' {
    if (displacement_mm === null) return 'unknown';

    const absDisplacement = Math.abs(displacement_mm);

    // Critical if displacement is very high OR velocity indicates rapid change
    if (
      absDisplacement > RISK_THRESHOLDS.CRITICAL ||
      (velocity_mm_year !== null && Math.abs(velocity_mm_year) > 15)
    ) {
      return 'critical';
    }

    if (absDisplacement > RISK_THRESHOLDS.HIGH) {
      return 'high';
    }

    if (absDisplacement > RISK_THRESHOLDS.MEDIUM) {
      return 'medium';
    }

    if (absDisplacement > RISK_THRESHOLDS.LOW) {
      return 'low';
    }

    return 'stable';
  }

  /**
   * Determine trend based on velocity
   */
  private determineTrend(
    velocity_mm_year: number | null
  ): 'accelerating' | 'stable' | 'decelerating' | 'unknown' {
    if (velocity_mm_year === null) return 'unknown';

    if (velocity_mm_year < VELOCITY_THRESHOLDS.ACCELERATING) {
      return 'accelerating'; // Worsening
    }

    if (velocity_mm_year > VELOCITY_THRESHOLDS.STABLE) {
      return 'decelerating'; // Improving
    }

    return 'stable';
  }

  /**
   * Assess data quality based on coherence and measurement count
   */
  private assessDataQuality(
    coherence: number | null,
    measurementCount: number
  ): 'excellent' | 'good' | 'fair' | 'poor' {
    if (measurementCount === 0) return 'poor';

    const avgCoherence = coherence || 0;

    if (measurementCount >= 10 && avgCoherence >= 0.8) return 'excellent';
    if (measurementCount >= 5 && avgCoherence >= 0.6) return 'good';
    if (measurementCount >= 3 && avgCoherence >= 0.4) return 'fair';
    return 'poor';
  }

  /**
   * Get map data for an infrastructure
   * Optimized with a single complex query to minimize DB round-trips
   */
  async getMapData(
    infrastructureId: string,
    options?: { limit?: number; bbox?: { minLat: number; maxLat: number; minLon: number; maxLon: number } }
  ): Promise<MapDataResponse> {
    try {
      logger.info({ infrastructureId }, 'Fetching map data for infrastructure');

      // Single optimized query to get all point data with latest deformation
      // NOTE: geom is stored as JSON text (no PostGIS), we parse coordinates in JS
      const limitValue = options?.limit && Number.isFinite(options.limit)
        ? Math.max(1, Math.min(100000, Math.floor(options.limit)))
        : undefined;
      const limitClause = limitValue ? Prisma.sql`LIMIT ${limitValue}` : Prisma.sql``;
      // bbox filtering done in JS since no PostGIS

      // Get total count of points for metadata (not impacted by preview limit)
      const totalCountRows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
        SELECT COUNT(*)::integer as count
        FROM points p
        WHERE p.infrastructure_id = ${infrastructureId}
      `);
      const totalPoints = totalCountRows?.[0]?.count || 0;

      const pointsData = await prisma.$queryRaw<
        Array<{
          point_id: string;
          geom: string;
          latest_displacement_mm: string | null;
          latest_velocity_mm_year: string | null;
          latest_coherence: string | null;
          latest_date: Date | null;
          measurement_count: number;
          min_displacement_mm: string | null;
          max_displacement_mm: string | null;
          avg_coherence: string | null;
          earliest_date: Date | null;
        }>
      >(Prisma.sql`
        SELECT 
          p.id::text as point_id,
          p.geom as geom,
          latest.displacement_mm::text as latest_displacement_mm,
          latest.velocity_mm_year::text as latest_velocity_mm_year,
          latest.coherence::text as latest_coherence,
          latest.date as latest_date,
          COALESCE(CAST(stats.measurement_count AS INTEGER), 0) as measurement_count,
          stats.min_displacement_mm::text as min_displacement_mm,
          stats.max_displacement_mm::text as max_displacement_mm,
          stats.avg_coherence::text as avg_coherence,
          stats.earliest_date
        FROM points p
        LEFT JOIN LATERAL (
          SELECT 
            displacement_mm,
            velocity_mm_year,
            coherence,
            date
          FROM deformations
          WHERE point_id = p.id
          ORDER BY date DESC
          LIMIT 1
        ) latest ON true
        LEFT JOIN LATERAL (
          SELECT 
            CAST(COUNT(*) AS INTEGER) as measurement_count,
            MIN(displacement_mm) as min_displacement_mm,
            MAX(displacement_mm) as max_displacement_mm,
            AVG(coherence) as avg_coherence,
            MIN(date) as earliest_date
          FROM deformations
          WHERE point_id = p.id
        ) stats ON true
        WHERE p.infrastructure_id = ${infrastructureId}
        ORDER BY p.created_at
        ${limitClause}
      `);

      // Parse geom JSON and extract coordinates, apply bbox filter in JS
      const bbox = options?.bbox;
      const parsedPointsData = pointsData.map(p => {
        let longitude = 0, latitude = 0;
        try {
          const geomObj = typeof p.geom === 'string' ? JSON.parse(p.geom) : p.geom;
          if (geomObj && geomObj.coordinates) {
            longitude = geomObj.coordinates[0];
            latitude = geomObj.coordinates[1];
          }
        } catch (e) {
          logger.warn({ geom: p.geom }, 'Failed to parse geom JSON');
        }
        return { ...p, longitude, latitude };
      }).filter(p => {
        if (!bbox) return true;
        return p.longitude >= bbox.minLon && p.longitude <= bbox.maxLon &&
          p.latitude >= bbox.minLat && p.latitude <= bbox.maxLat;
      });

      logger.debug(
        { infrastructureId, pointCount: parsedPointsData.length },
        'Retrieved point data from database'
      );

      // Transform to GeoJSON features
      const features: GeoJSONFeature[] = parsedPointsData.map((point) => {
        const displacement_mm = point.latest_displacement_mm
          ? parseFloat(point.latest_displacement_mm)
          : null;
        const velocity_mm_year = point.latest_velocity_mm_year
          ? parseFloat(point.latest_velocity_mm_year)
          : null;
        const coherence = point.latest_coherence
          ? parseFloat(point.latest_coherence)
          : null;
        // Convert BigInt to Number for JSON serialization
        const measurementCount = typeof point.measurement_count === 'bigint'
          ? Number(point.measurement_count)
          : Number(point.measurement_count || 0);

        const color = this.getColorByDisplacement(displacement_mm);
        const riskLevel = this.assessRiskLevel(displacement_mm, velocity_mm_year);
        const trend = this.determineTrend(velocity_mm_year);
        const dataQuality = this.assessDataQuality(coherence, measurementCount);

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [point.longitude, point.latitude],
          },
          properties: {
            pointId: point.point_id,
            latestDisplacement: displacement_mm,
            latestVelocity: velocity_mm_year,
            latestCoherence: coherence,
            latestDate: point.latest_date ? point.latest_date.toISOString() : null,
            measurementCount,
            color,
            riskLevel,
            trend,
            metadata: {
              displacementRange:
                point.min_displacement_mm && point.max_displacement_mm
                  ? {
                    min: parseFloat(point.min_displacement_mm),
                    max: parseFloat(point.max_displacement_mm),
                  }
                  : null,
              averageCoherence: point.avg_coherence
                ? parseFloat(point.avg_coherence)
                : null,
              dataQuality,
            },
          },
        };
      });

      // Calculate metadata statistics
      const activePoints = features.filter(
        (f) => f.properties.measurementCount > 0
      ).length;

      const displacements = features
        .map((f) => f.properties.latestDisplacement)
        .filter((d): d is number => d !== null);

      const velocities = features
        .map((f) => f.properties.latestVelocity)
        .filter((v): v is number => v !== null);

      const dates = features
        .map((f) => f.properties.latestDate)
        .filter((d): d is string => d !== null)
        .map((d) => new Date(d));

      const riskDistribution = features.reduce(
        (acc, f) => {
          const risk = f.properties.riskLevel as keyof typeof acc;
          acc[risk]++;
          return acc;
        },
        {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
          stable: 0,
          unknown: 0,
        }
      );

      // Calculate date range using iterative approach to avoid stack overflow
      let earliestDate: Date | null = null;
      let latestDate: Date | null = null;
      if (dates.length > 0) {
        let minTime = dates[0].getTime();
        let maxTime = dates[0].getTime();
        for (let i = 1; i < dates.length; i++) {
          const time = dates[i].getTime();
          if (time < minTime) minTime = time;
          if (time > maxTime) maxTime = time;
        }
        earliestDate = new Date(minTime);
        latestDate = new Date(maxTime);
      }

      // Calculate statistics using iterative approach to avoid stack overflow
      let minDisplacement: number | null = null;
      let maxDisplacement: number | null = null;
      if (displacements.length > 0) {
        minDisplacement = displacements[0];
        maxDisplacement = displacements[0];
        for (let i = 1; i < displacements.length; i++) {
          const d = displacements[i];
          if (d < minDisplacement) minDisplacement = d;
          if (d > maxDisplacement) maxDisplacement = d;
        }
      }

      // All BigInt values should already be converted to Number during feature creation
      // Just ensure totalPoints and activePoints are numbers (they already are from the conversion above)
      const response: MapDataResponse = {
        type: 'FeatureCollection',
        features,
        metadata: {
          infrastructureId,
          totalPoints: Number(totalPoints),
          activePoints: Number(activePoints),
          dateRange: {
            earliest: earliestDate,
            latest: latestDate,
          },
          statistics: {
            averageDisplacement:
              displacements.length > 0
                ? displacements.reduce((a, b) => a + b, 0) / displacements.length
                : null,
            minDisplacement,
            maxDisplacement,
            averageVelocity:
              velocities.length > 0
                ? velocities.reduce((a, b) => a + b, 0) / velocities.length
                : null,
          },
          riskDistribution,
        },
      };

      logger.info(
        {
          infrastructureId,
          totalPoints: response.metadata.totalPoints,
          activePoints: response.metadata.activePoints,
          riskDistribution: response.metadata.riskDistribution,
        },
        'Map data generated successfully'
      );

      return response;
    } catch (error) {
      logger.error(
        {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          infrastructureId
        },
        'Failed to generate map data'
      );
      throw error instanceof Error ? error : new Error('Failed to generate map data');
    }
  }
}

export const mapDataService = new MapDataService();
