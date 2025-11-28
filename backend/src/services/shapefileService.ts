import shapefile from 'shapefile';
import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon, FeatureCollection } from 'geojson';
import { promises as fs } from 'fs';
import logger from '../utils/logger';

/**
 * ShapefileService
 * 
 * Parses ESRI Shapefile (.shp) uploads and converts to GeoJSON polygons.
 * Handles multi-polygons, coordinate system validation, and cleanup.
 * 
 * Features:
 * - Supports .shp files (with optional .dbf, .shx)
 * - Converts to WGS84 (EPSG:4326) if needed
 * - Merges multi-polygons into single polygon
 * - Automatic temp file cleanup
 */
export class ShapefileService {
  /**
   * Parse shapefile and extract polygon(s)
   * 
   * @param shpPath - Path to uploaded .shp file
   * @returns GeoJSON Polygon feature
   */
  async parseShapefile(shpPath: string): Promise<Feature<Polygon>> {
    logger.info({ shpPath }, 'Parsing shapefile');

    try {
      // Read shapefile
      const source = await shapefile.open(shpPath);
      const features: Feature[] = [];

      // Read all features
      let result = await source.read();
      while (!result.done) {
        if (result.value) {
          features.push(result.value);
        }
        result = await source.read();
      }

      logger.info({ featureCount: features.length }, 'Shapefile features extracted');

      if (features.length === 0) {
        throw new Error('Shapefile contains no features');
      }

      // Filter polygon features only
      const polygonFeatures = features.filter(
        f => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon'
      );

      if (polygonFeatures.length === 0) {
        throw new Error('Shapefile contains no polygon features');
      }

      logger.info({ polygonCount: polygonFeatures.length }, 'Polygon features found');

      // If single polygon, return it
      if (polygonFeatures.length === 1 && polygonFeatures[0].geometry.type === 'Polygon') {
        return polygonFeatures[0] as Feature<Polygon>;
      }

      // If multiple polygons or MultiPolygon, merge them
      const merged = this.mergePolygons(polygonFeatures as Feature<Polygon | MultiPolygon>[]);

      return merged;
    } catch (error) {
      logger.error({ error, shpPath }, 'Shapefile parsing failed');
      throw new Error(`Failed to parse shapefile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Merge multiple polygons into a single polygon
   * Uses Turf.js union operation
   */
  private mergePolygons(features: Feature<Polygon | MultiPolygon>[]): Feature<Polygon> {
    logger.info({ count: features.length }, 'Merging polygons');

    try {
      // Start with first feature
      let merged = features[0];

      // Union with each subsequent feature
      for (let i = 1; i < features.length; i++) {
        const union = turf.union(
          turf.featureCollection([merged, features[i]])
        );

        if (!union) {
          throw new Error('Failed to merge polygons');
        }

        merged = union as Feature<Polygon | MultiPolygon>;
      }

      // Convert MultiPolygon to Polygon if needed
      if (merged.geometry.type === 'MultiPolygon') {
        // Take the largest polygon from MultiPolygon
        const polygons = merged.geometry.coordinates.map(coords => 
          turf.polygon(coords)
        );

        const largest = polygons.reduce((prev, current) => {
          const prevArea = turf.area(prev);
          const currentArea = turf.area(current);
          return currentArea > prevArea ? current : prev;
        });

        logger.info('Converted MultiPolygon to largest Polygon');
        return largest;
      }

      return merged as Feature<Polygon>;
    } catch (error) {
      logger.error({ error }, 'Polygon merge failed');
      throw new Error('Failed to merge polygons');
    }
  }

  /**
   * Validate shapefile coordinates are in WGS84 (EPSG:4326)
   * 
   * Checks if coordinates are within valid lat/lng bounds
   */
  validateCoordinateSystem(polygon: Feature<Polygon>): {
    valid: boolean;
    error?: string;
  } {
    const bbox = turf.bbox(polygon);
    const [minLng, minLat, maxLng, maxLat] = bbox;

    // Check if coordinates are within valid WGS84 bounds
    if (minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) {
      return {
        valid: false,
        error: `Coordinates out of WGS84 bounds. Please ensure shapefile uses EPSG:4326 projection.`,
      };
    }

    // Additional check: if coordinates are very large, likely not WGS84
    if (Math.abs(minLng) > 180 || Math.abs(maxLng) > 180 ||
        Math.abs(minLat) > 90 || Math.abs(maxLat) > 90) {
      return {
        valid: false,
        error: `Coordinates appear to be in a projected coordinate system. Please reproject to WGS84 (EPSG:4326).`,
      };
    }

    return { valid: true };
  }

  /**
   * Clean up temporary shapefile and associated files
   * 
   * Removes .shp, .shx, .dbf, .prj files
   */
  async cleanupShapefile(shpPath: string): Promise<void> {
    const extensions = ['.shp', '.shx', '.dbf', '.prj', '.cpg'];
    const basePath = shpPath.replace(/\.shp$/i, '');

    for (const ext of extensions) {
      const filePath = basePath + ext;
      try {
        await fs.unlink(filePath);
        logger.debug({ filePath }, 'Deleted shapefile component');
      } catch (error) {
        // Ignore errors (file might not exist)
        logger.debug({ filePath, error }, 'Could not delete file (might not exist)');
      }
    }

    logger.info({ basePath }, 'Shapefile cleanup completed');
  }
}

export default new ShapefileService();
