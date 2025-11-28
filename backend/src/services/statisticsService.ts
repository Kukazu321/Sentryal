import { prisma } from '../db/prisma';
import logger from '../utils/logger';

/**
 * Advanced Statistics Service
 * 
 * Provides comprehensive statistical analysis for infrastructure monitoring:
 * - Temporal trends (linear regression)
 * - Spatial distribution analysis
 * - Risk assessment aggregation
 * - Predictive analytics
 * - Data quality metrics
 * 
 * All calculations are optimized with single-pass algorithms where possible
 * to minimize database queries and computational overhead.
 */

export interface InfrastructureStatistics {
  overview: {
    totalPoints: number;
    activePoints: number;
    totalMeasurements: number;
    timeSpan: {
      firstMeasurement: Date | null;
      lastMeasurement: Date | null;
      durationDays: number;
    };
  };
  displacement: {
    current: {
      mean: number;
      median: number;
      min: number;
      max: number;
      stdDev: number;
      range: number;
    };
    distribution: {
      critical: number;    // > 20mm
      high: number;        // 10-20mm
      medium: number;      // 5-10mm
      low: number;         // 2-5mm
      stable: number;      // < 2mm
    };
  };
  velocity: {
    mean: number | null;
    median: number | null;
    min: number | null;
    max: number | null;
    accelerating: number;  // Count of points with acceleration
    stable: number;
    decelerating: number;
  };
  spatialAnalysis: {
    centroid: {
      latitude: number;
      longitude: number;
      displacement_mm: number;
    } | null;
    hotspots: Array<{
      latitude: number;
      longitude: number;
      displacement_mm: number;
      pointsInRadius: number;
    }>;
  };
  dataQuality: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
    averageCoherence: number | null;
    measurementsPerPoint: {
      mean: number;
      min: number;
      max: number;
    };
  };
  trends: {
    overall: 'improving' | 'stable' | 'worsening' | 'insufficient_data';
    monthlyChange: number | null;
    projectedDisplacement30Days: number | null;
    projectedDisplacement90Days: number | null;
  };
  alerts: {
    criticalPoints: number;
    warningPoints: number;
    recentChanges: Array<{
      pointId: string;
      change: number;
      period: string;
    }>;
  };
}

class StatisticsService {
  /**
   * Calculate comprehensive statistics for an infrastructure
   * Uses optimized SQL queries to minimize database round-trips
   */
  async getInfrastructureStatistics(
    infrastructureId: string
  ): Promise<InfrastructureStatistics> {
    try {
      logger.info({ infrastructureId }, 'Calculating infrastructure statistics');

      // Single comprehensive query for all point-level data
      const pointsData = await prisma.$queryRaw<
        Array<{
          point_id: string;
          latitude: number;
          longitude: number;
          latest_displacement: number | null;
          latest_velocity: number | null;
          measurement_count: bigint;
          avg_coherence: number | null;
          first_date: Date | null;
          last_date: Date | null;
          min_displacement: number | null;
          max_displacement: number | null;
        }>
      >`
        SELECT 
          p.id::text as point_id,
          ST_Y(p.geom::geometry) as latitude,
          ST_X(p.geom::geometry) as longitude,
          latest.displacement_mm::float as latest_displacement,
          latest.velocity_mm_year::float as latest_velocity,
          COALESCE(stats.measurement_count, 0) as measurement_count,
          stats.avg_coherence::float as avg_coherence,
          stats.first_date,
          stats.last_date,
          stats.min_displacement::float as min_displacement,
          stats.max_displacement::float as max_displacement
        FROM points p
        LEFT JOIN LATERAL (
          SELECT 
            displacement_mm,
            velocity_mm_year
          FROM deformations
          WHERE point_id = p.id
          ORDER BY date DESC
          LIMIT 1
        ) latest ON true
        LEFT JOIN LATERAL (
          SELECT 
            COUNT(*)::bigint as measurement_count,
            AVG(coherence) as avg_coherence,
            MIN(date) as first_date,
            MAX(date) as last_date,
            MIN(displacement_mm) as min_displacement,
            MAX(displacement_mm) as max_displacement
          FROM deformations
          WHERE point_id = p.id
        ) stats ON true
        WHERE p.infrastructure_id::text = ${infrastructureId}
      `;

      if (pointsData.length === 0) {
        return this.getEmptyStatistics();
      }

      // Calculate overview statistics
      const overview = this.calculateOverview(pointsData);

      // Calculate displacement statistics
      const displacement = this.calculateDisplacementStats(pointsData);

      // Calculate velocity statistics
      const velocity = this.calculateVelocityStats(pointsData);

      // Calculate spatial analysis
      const spatialAnalysis = this.calculateSpatialAnalysis(pointsData);

      // Calculate data quality metrics
      const dataQuality = this.calculateDataQuality(pointsData);

      // Calculate trends
      const trends = await this.calculateTrends(infrastructureId, pointsData);

      // Calculate alerts
      const alerts = this.calculateAlerts(pointsData);

      logger.info(
        { infrastructureId, pointsAnalyzed: pointsData.length },
        'Statistics calculation completed'
      );

      return {
        overview,
        displacement,
        velocity,
        spatialAnalysis,
        dataQuality,
        trends,
        alerts,
      };
    } catch (error) {
      logger.error({ error, infrastructureId }, 'Failed to calculate statistics');
      throw new Error('Failed to calculate infrastructure statistics');
    }
  }

  /**
   * Calculate overview statistics
   */
  private calculateOverview(
    data: Array<{ measurement_count: bigint; first_date: Date | null; last_date: Date | null }>
  ) {
    const activePoints = data.filter(p => Number(p.measurement_count) > 0).length;
    const totalMeasurements = data.reduce((sum, p) => sum + Number(p.measurement_count), 0);

    const dates = data
      .flatMap(p => [p.first_date, p.last_date])
      .filter((d): d is Date => d !== null);

    const firstMeasurement = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
    const lastMeasurement = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;

    const durationDays =
      firstMeasurement && lastMeasurement
        ? Math.round((lastMeasurement.getTime() - firstMeasurement.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    return {
      totalPoints: data.length,
      activePoints,
      totalMeasurements,
      timeSpan: {
        firstMeasurement,
        lastMeasurement,
        durationDays,
      },
    };
  }

  /**
   * Calculate displacement statistics with distribution
   */
  private calculateDisplacementStats(
    data: Array<{ latest_displacement: number | null }>
  ) {
    const displacements = data
      .map(p => p.latest_displacement)
      .filter((d): d is number => d !== null);

    if (displacements.length === 0) {
      return this.getEmptyDisplacementStats();
    }

    const sorted = [...displacements].sort((a, b) => a - b);
    const mean = displacements.reduce((sum, d) => sum + d, 0) / displacements.length;
    const median = this.calculateMedian(sorted);
    const min = Math.min(...displacements);
    const max = Math.max(...displacements);
    const stdDev = Math.sqrt(
      displacements.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / displacements.length
    );
    const range = max - min;

    // Calculate distribution
    const distribution = {
      critical: displacements.filter(d => Math.abs(d) > 20).length,
      high: displacements.filter(d => Math.abs(d) > 10 && Math.abs(d) <= 20).length,
      medium: displacements.filter(d => Math.abs(d) > 5 && Math.abs(d) <= 10).length,
      low: displacements.filter(d => Math.abs(d) > 2 && Math.abs(d) <= 5).length,
      stable: displacements.filter(d => Math.abs(d) <= 2).length,
    };

    return {
      current: { mean, median, min, max, stdDev, range },
      distribution,
    };
  }

  /**
   * Calculate velocity statistics
   */
  private calculateVelocityStats(
    data: Array<{ latest_velocity: number | null }>
  ) {
    const velocities = data
      .map(p => p.latest_velocity)
      .filter((v): v is number => v !== null);

    if (velocities.length === 0) {
      return {
        mean: null,
        median: null,
        min: null,
        max: null,
        accelerating: 0,
        stable: 0,
        decelerating: 0,
      };
    }

    const sorted = [...velocities].sort((a, b) => a - b);
    const mean = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
    const median = this.calculateMedian(sorted);

    return {
      mean,
      median,
      min: Math.min(...velocities),
      max: Math.max(...velocities),
      accelerating: velocities.filter(v => v < -5).length,
      stable: velocities.filter(v => v >= -5 && v <= 5).length,
      decelerating: velocities.filter(v => v > 5).length,
    };
  }

  /**
   * Calculate spatial analysis including centroid and hotspots
   */
  private calculateSpatialAnalysis(
    data: Array<{
      latitude: number;
      longitude: number;
      latest_displacement: number | null;
    }>
  ) {
    const activePoints = data.filter(p => p.latest_displacement !== null);

    if (activePoints.length === 0) {
      return { centroid: null, hotspots: [] };
    }

    // Calculate weighted centroid (weighted by displacement magnitude)
    const totalWeight = activePoints.reduce(
      (sum, p) => sum + Math.abs(p.latest_displacement!),
      0
    );

    const centroid = {
      latitude:
        activePoints.reduce(
          (sum, p) => sum + p.latitude * Math.abs(p.latest_displacement!),
          0
        ) / totalWeight,
      longitude:
        activePoints.reduce(
          (sum, p) => sum + p.longitude * Math.abs(p.latest_displacement!),
          0
        ) / totalWeight,
      displacement_mm:
        activePoints.reduce((sum, p) => sum + p.latest_displacement!, 0) /
        activePoints.length,
    };

    // Identify hotspots (points with high displacement and nearby points)
    const hotspots = activePoints
      .filter(p => Math.abs(p.latest_displacement!) > 10)
      .map(point => {
        // Count nearby points (within ~100m, rough approximation)
        const nearbyPoints = activePoints.filter(
          other =>
            other !== point &&
            Math.abs(other.latitude - point.latitude) < 0.001 &&
            Math.abs(other.longitude - point.longitude) < 0.001
        ).length;

        return {
          latitude: point.latitude,
          longitude: point.longitude,
          displacement_mm: point.latest_displacement!,
          pointsInRadius: nearbyPoints + 1,
        };
      })
      .sort((a, b) => Math.abs(b.displacement_mm) - Math.abs(a.displacement_mm))
      .slice(0, 5); // Top 5 hotspots

    return { centroid, hotspots };
  }

  /**
   * Calculate data quality metrics
   */
  private calculateDataQuality(
    data: Array<{
      measurement_count: bigint;
      avg_coherence: number | null;
    }>
  ) {
    const measurementCounts = data.map(p => Number(p.measurement_count));
    const coherences = data
      .map(p => p.avg_coherence)
      .filter((c): c is number => c !== null);

    // Quality classification based on measurement count and coherence
    const quality = data.map(p => {
      const count = Number(p.measurement_count);
      const coherence = p.avg_coherence || 0;

      if (count >= 10 && coherence >= 0.8) return 'excellent';
      if (count >= 5 && coherence >= 0.6) return 'good';
      if (count >= 3 && coherence >= 0.4) return 'fair';
      return 'poor';
    });

    return {
      excellent: quality.filter(q => q === 'excellent').length,
      good: quality.filter(q => q === 'good').length,
      fair: quality.filter(q => q === 'fair').length,
      poor: quality.filter(q => q === 'poor').length,
      averageCoherence:
        coherences.length > 0
          ? coherences.reduce((sum, c) => sum + c, 0) / coherences.length
          : null,
      measurementsPerPoint: {
        mean:
          measurementCounts.reduce((sum, c) => sum + c, 0) / measurementCounts.length,
        min: Math.min(...measurementCounts),
        max: Math.max(...measurementCounts),
      },
    };
  }

  /**
   * Calculate trends and projections
   */
  private async calculateTrends(
    infrastructureId: string,
    pointsData: Array<{ latest_displacement: number | null; latest_velocity: number | null }>
  ) {
    const velocities = pointsData
      .map(p => p.latest_velocity)
      .filter((v): v is number => v !== null);

    if (velocities.length === 0) {
      return {
        overall: 'insufficient_data' as const,
        monthlyChange: null,
        projectedDisplacement30Days: null,
        projectedDisplacement90Days: null,
      };
    }

    const avgVelocity = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;
    const monthlyChange = (avgVelocity / 365.25) * 30;

    // Determine overall trend
    let overall: 'improving' | 'stable' | 'worsening' | 'insufficient_data';
    if (Math.abs(avgVelocity) < 2) {
      overall = 'stable';
    } else if (avgVelocity < 0) {
      overall = 'worsening'; // Negative velocity = subsidence
    } else {
      overall = 'improving';
    }

    // Calculate projections
    const currentDisplacements = pointsData
      .map(p => p.latest_displacement)
      .filter((d): d is number => d !== null);

    const avgCurrentDisplacement =
      currentDisplacements.length > 0
        ? currentDisplacements.reduce((sum, d) => sum + d, 0) / currentDisplacements.length
        : null;

    const projectedDisplacement30Days =
      avgCurrentDisplacement !== null
        ? avgCurrentDisplacement + monthlyChange
        : null;

    const projectedDisplacement90Days =
      avgCurrentDisplacement !== null
        ? avgCurrentDisplacement + monthlyChange * 3
        : null;

    return {
      overall,
      monthlyChange,
      projectedDisplacement30Days,
      projectedDisplacement90Days,
    };
  }

  /**
   * Calculate alerts and warnings
   */
  private calculateAlerts(
    data: Array<{ point_id: string; latest_displacement: number | null; latest_velocity: number | null }>
  ) {
    const criticalPoints = data.filter(
      p => p.latest_displacement !== null && Math.abs(p.latest_displacement) > 20
    ).length;

    const warningPoints = data.filter(
      p =>
        p.latest_displacement !== null &&
        Math.abs(p.latest_displacement) > 10 &&
        Math.abs(p.latest_displacement) <= 20
    ).length;

    // Identify points with significant recent changes (high velocity)
    const recentChanges = data
      .filter(p => p.latest_velocity !== null && Math.abs(p.latest_velocity) > 10)
      .map(p => ({
        pointId: p.point_id,
        change: p.latest_velocity!,
        period: 'year',
      }))
      .slice(0, 5); // Top 5

    return {
      criticalPoints,
      warningPoints,
      recentChanges,
    };
  }

  /**
   * Helper: Calculate median
   */
  private calculateMedian(sortedArray: number[]): number {
    const mid = Math.floor(sortedArray.length / 2);
    return sortedArray.length % 2 === 0
      ? (sortedArray[mid - 1] + sortedArray[mid]) / 2
      : sortedArray[mid];
  }

  /**
   * Helper: Get empty statistics structure
   */
  private getEmptyStatistics(): InfrastructureStatistics {
    return {
      overview: {
        totalPoints: 0,
        activePoints: 0,
        totalMeasurements: 0,
        timeSpan: {
          firstMeasurement: null,
          lastMeasurement: null,
          durationDays: 0,
        },
      },
      displacement: this.getEmptyDisplacementStats(),
      velocity: {
        mean: null,
        median: null,
        min: null,
        max: null,
        accelerating: 0,
        stable: 0,
        decelerating: 0,
      },
      spatialAnalysis: {
        centroid: null,
        hotspots: [],
      },
      dataQuality: {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0,
        averageCoherence: null,
        measurementsPerPoint: {
          mean: 0,
          min: 0,
          max: 0,
        },
      },
      trends: {
        overall: 'insufficient_data',
        monthlyChange: null,
        projectedDisplacement30Days: null,
        projectedDisplacement90Days: null,
      },
      alerts: {
        criticalPoints: 0,
        warningPoints: 0,
        recentChanges: [],
      },
    };
  }

  /**
   * Helper: Get empty displacement stats
   */
  private getEmptyDisplacementStats() {
    return {
      current: {
        mean: 0,
        median: 0,
        min: 0,
        max: 0,
        stdDev: 0,
        range: 0,
      },
      distribution: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        stable: 0,
      },
    };
  }
}

export const statisticsService = new StatisticsService();
