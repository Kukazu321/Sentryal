/**
 * API Types - Type-safe API responses
 * Used across the entire application for consistency
 */

// ============================================================================
// INFRASTRUCTURE TYPES
// ============================================================================

export interface Infrastructure {
  id: string;
  user_id: string;
  name: string;
  type: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// MAP DATA TYPES (GeoJSON)
// ============================================================================

export interface MapDataPoint {
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
    measurementCount: number;
    latestDate: string | null;
    color: string;
    riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'stable' | 'unknown';
    trend: 'accelerating' | 'stable' | 'decelerating' | 'unknown';
  };
}

export interface MapDataResponse {
  type: 'FeatureCollection';
  features: MapDataPoint[];
  metadata: {
    infrastructureId: string;
    totalPoints: number;
    activePoints: number;
    dateRange: {
      earliest: string | null;
      latest: string | null;
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

// ============================================================================
// STATISTICS TYPES
// ============================================================================

export interface StatisticsResponse {
  infrastructureId: string;
  infrastructureName: string;
  calculatedAt: string;
  statistics: {
    overview: {
      totalPoints: number;
      activePoints: number;
      totalMeasurements: number;
      timeSpan: {
        firstMeasurement: string;
        lastMeasurement: string;
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
        critical: number;
        high: number;
        medium: number;
        low: number;
        stable: number;
      };
    };
    velocity: {
      mean: number;
      median: number;
      accelerating: number;
      stable: number;
      decelerating: number;
    };
    spatialAnalysis: {
      centroid: {
        latitude: number;
        longitude: number;
        displacement_mm: number;
      };
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
      averageCoherence: number;
      measurementsPerPoint: {
        mean: number;
        min: number;
        max: number;
      };
    };
    trends: {
      overall: 'improving' | 'stable' | 'worsening';
      monthlyChange: number;
      projectedDisplacement30Days: number;
      projectedDisplacement90Days: number;
    };
    alerts: {
      criticalPoints: number;
      warningPoints: number;
      recentChanges: Array<{
        pointId: string;
        change: number;
        date: string;
      }>;
    };
  };
}

// ============================================================================
// DEFORMATION TYPES
// ============================================================================

export interface Deformation {
  id: string;
  point_id: string;
  job_id: string;
  date: string;
  displacement_mm: number;
  velocity_mm_year: number | null;
  coherence: number | null;
  created_at: string;
}

export interface TimeSeriesResponse {
  pointId: string;
  infrastructureId: string;
  measurements: Array<{
    date: string;
    displacement_mm: number;
    velocity_mm_year: number | null;
    coherence: number | null;
  }>;
  statistics: {
    count: number;
    avgDisplacement: number;
    avgVelocity: number | null;
    trend: 'accelerating' | 'stable' | 'decelerating' | 'unknown';
  };
}

// ============================================================================
// JOB TYPES
// ============================================================================

export type JobStatus = 'PENDING' | 'RUNNING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface Job {
  id: string;
  infrastructure_id: string;
  hyp3_job_id: string | null;
  status: JobStatus;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

// ============================================================================
// SCHEDULE TYPES
// ============================================================================

export interface JobSchedule {
  id: string;
  infrastructure_id: string;
  user_id: string;
  name: string;
  frequency_days: number;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  options: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// API ERROR TYPES
// ============================================================================

export interface ApiError {
  error: string;
  message?: string;
  details?: any;
}

// ============================================================================
// PAGINATION TYPES
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
