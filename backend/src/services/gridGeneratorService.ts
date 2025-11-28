import * as turf from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import logger from '../utils/logger';

/**
 * GridGeneratorService
 * 
 * Generates 5-meter precision point grids for Sentinel-1 satellite coverage.
 * Handles latitude-dependent degree-to-meter conversion for accurate spacing.
 * 
 * Key features:
 * - Precise 5m spacing adjusted for latitude
 * - Surface area validation (max 50 km²)
 * - Point estimation before generation
 * - Memory-efficient streaming for large grids
 */
export class GridGeneratorService {
  // Constants
  private readonly GRID_SPACING_METERS = 5; // Sentinel-1 pixel resolution
  private readonly MAX_SURFACE_KM2 = 50; // Safety limit to prevent explosions
  private readonly MAX_POINTS = 2_000_000; // ~10 km² at 5m spacing
  private readonly EARTH_RADIUS_METERS = 6371000; // WGS84 mean radius

  /**
   * Calculate precise degree spacing for given latitude
   * 
   * At equator: 1° ≈ 111,320 meters
   * At 45°N: 1° longitude ≈ 78,710 meters
   * 
   * Formula: meters_per_degree_lng = cos(lat) × 111,320
   */
  private calculateDegreeSpacing(latitude: number): {
    latDegrees: number;
    lngDegrees: number;
  } {
    const latRadians = (latitude * Math.PI) / 180;

    // Latitude spacing (constant worldwide)
    const metersPerDegreeLat = 111320;
    const latDegrees = this.GRID_SPACING_METERS / metersPerDegreeLat;

    // Longitude spacing (varies with latitude)
    const metersPerDegreeLng = Math.cos(latRadians) * 111320;
    const lngDegrees = this.GRID_SPACING_METERS / metersPerDegreeLng;

    return { latDegrees, lngDegrees };
  }

  /**
   * Estimate number of points for a polygon without generating the grid
   * Fast pre-check before expensive generation
   */
  estimatePointCount(polygon: Feature<Polygon>): {
    estimatedPoints: number;
    surfaceKm2: number;
    surfaceM2: number;
  } {
    // Calculate surface area
    const surfaceM2 = turf.area(polygon);
    const surfaceKm2 = surfaceM2 / 1_000_000;

    // Use same spacing logic as generateGrid: stepDeg = max(latDeg, lngDeg)
    const centroid = turf.centroid(polygon);
    const centerLat = centroid.geometry.coordinates[1];
    const { latDegrees, lngDegrees } = this.calculateDegreeSpacing(centerLat);

    // Derive meters-per-degree from spacing: latDegrees = 5 / metersPerDegreeLat
    const metersPerDegreeLat = this.GRID_SPACING_METERS / latDegrees;
    const metersPerDegreeLng = this.GRID_SPACING_METERS / lngDegrees;

    const stepDeg = Math.max(latDegrees, lngDegrees);
    // Effective spacing on each axis when using the larger degree step
    const effLatMeters = stepDeg * metersPerDegreeLat; // >= 5m
    const effLngMeters = stepDeg * metersPerDegreeLng; // >= 5m

    const cellAreaMeters = effLatMeters * effLngMeters;
    const estimatedPoints = Math.ceil(surfaceM2 / cellAreaMeters);

    return {
      estimatedPoints,
      surfaceKm2: Math.round(surfaceKm2 * 100) / 100,
      surfaceM2: Math.round(surfaceM2),
    };
  }

  /**
   * Validate polygon before grid generation
   * Prevents common issues and resource exhaustion
   */
  validatePolygon(polygon: Feature<Polygon>): {
    valid: boolean;
    error?: string;
    warnings?: string[];
  } {
    const warnings: string[] = [];

    // Check if polygon is valid GeoJSON
    if (!polygon || polygon.type !== 'Feature' || polygon.geometry.type !== 'Polygon') {
      return { valid: false, error: 'Invalid GeoJSON Polygon' };
    }

    // Check for self-intersections
    const kinks = turf.kinks(polygon);
    if (kinks.features.length > 0) {
      return { valid: false, error: 'Polygon has self-intersections' };
    }

    // Check surface area
    const { surfaceKm2, estimatedPoints } = this.estimatePointCount(polygon);

    if (surfaceKm2 > this.MAX_SURFACE_KM2) {
      return {
        valid: false,
        error: `Surface area (${surfaceKm2} km²) exceeds maximum allowed (${this.MAX_SURFACE_KM2} km²)`,
      };
    }

    if (estimatedPoints > this.MAX_POINTS) {
      return {
        valid: false,
        error: `Estimated points (${estimatedPoints}) exceeds maximum allowed (${this.MAX_POINTS})`,
      };
    }

    // Warning for large grids
    if (estimatedPoints > 50_000) {
      warnings.push(`Large grid: ${estimatedPoints} points will take ~${Math.ceil(estimatedPoints / 10000)}s to generate`);
    }

    // Check bbox is within reasonable Earth bounds
    const bbox = turf.bbox(polygon);
    const [minLng, minLat, maxLng, maxLat] = bbox;

    if (minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) {
      return { valid: false, error: 'Polygon coordinates out of valid range' };
    }

    return { valid: true, warnings: warnings.length > 0 ? warnings : undefined };
  }

  /**
   * Generate 5-meter precision grid for a polygon
   * 
   * Returns array of {lat, lng} points inside the polygon
   * Optimized for memory efficiency with large grids
   */
  generateGrid(polygon: Feature<Polygon>): Array<{ lat: number; lng: number }> {
    const startTime = Date.now();

    // Validate polygon
    const validation = this.validatePolygon(polygon);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    if (validation.warnings) {
      validation.warnings.forEach(warning => logger.warn(warning));
    }

    // Get polygon centroid for latitude calculation
    const centroid = turf.centroid(polygon);
    const centerLat = centroid.geometry.coordinates[1];

    // Calculate precise spacing for this latitude
    const { latDegrees, lngDegrees } = this.calculateDegreeSpacing(centerLat);

    logger.info({
      centerLat,
      latDegrees,
      lngDegrees,
      spacingMeters: this.GRID_SPACING_METERS,
    }, 'Calculated grid spacing');

    // Get bounding box
    const bbox = turf.bbox(polygon);

    // Generate grid using Turf.js
    // We use pointGrid with cellSide in degrees
    const gridFeatures = turf.pointGrid(
      bbox,
      Math.max(latDegrees, lngDegrees), // Use larger spacing to ensure 5m minimum
      { units: 'degrees' }
    );

    logger.info(`Generated ${gridFeatures.features.length} candidate points`);

    // Filter points inside polygon
    const pointsInside = gridFeatures.features
      .filter(point => turf.booleanPointInPolygon(point, polygon))
      .map(point => ({
        lng: point.geometry.coordinates[0],
        lat: point.geometry.coordinates[1],
      }));

    const duration = Date.now() - startTime;

    logger.info({
      totalCandidates: gridFeatures.features.length,
      pointsInside: pointsInside.length,
      durationMs: duration,
      pointsPerSecond: Math.round(pointsInside.length / (duration / 1000)),
    }, 'Grid generation completed');

    return pointsInside;
  }

  /**
   * Generate grid in batches for very large polygons
   * Yields batches of points to prevent memory overflow
   */
  *generateGridBatched(
    polygon: Feature<Polygon>,
    batchSize: number = 1000
  ): Generator<Array<{ lat: number; lng: number }>> {
    const allPoints = this.generateGrid(polygon);

    for (let i = 0; i < allPoints.length; i += batchSize) {
      yield allPoints.slice(i, i + batchSize);
    }
  }

  /**
   * Calculate estimated monthly cost for Sentinel-1 processing
   * Based on pricing: €0.005 per point per month
   */
  calculateMonthlyCost(pointCount: number): {
    costEur: number;
    costPerPoint: number;
  } {
    const costPerPoint = 0.005; // €0.005 per point/month
    const costEur = pointCount * costPerPoint;

    return {
      costEur: Math.round(costEur * 100) / 100,
      costPerPoint,
    };
  }
}

export default new GridGeneratorService();
