import { fromFile, GeoTIFF, GeoTIFFImage } from 'geotiff';
import proj4 from 'proj4';
import logger from '../utils/logger';

/**
 * GeoTIFF Parser Service
 * 
 * Parses InSAR displacement GeoTIFF files from GMTSAR
 * 
 * GeoTIFF Structure:
 * - 32-bit floating-point raster
 * - Values in METERS (convert to mm for storage)
 * - Georeferenced (lat/lon → pixel x/y conversion)
 * - NoData values (typically -9999 or NaN)
 * 
 * Files:
 * - *_vert_disp.tif: Vertical displacement (up/down)
 * - *_los_disp.tif: Line-of-sight displacement (towards/away sensor)
 * - *_corr.tif: Coherence (quality metric, 0.0-1.0)
 * 
 * Performance:
 * - Uses geotiff.js (fast, native)
 * - Batch processing for multiple points
 * - Spatial indexing for quick lookups
 */

export interface Point {
  id: string;
  latitude: number;
  longitude: number;
}

export interface Deformation {
  pointId: string;
  date: Date;
  verticalDisplacementMm: number;
  losDisplacementMm?: number;
  coherence?: number;
}

export interface ParseOptions {
  losDisplacementPath?: string;
  coherencePath?: string;
  noDataValue?: number;
  minCoherence?: number; // Filter out low-quality data
}

export class GeoTIFFParser {
  /**
   * Parse vertical displacement GeoTIFF and extract values for given points
   * 
   * @param vertDispPath Path to *_vert_disp.tif file
   * @param points Array of points with lat/lon
   * @param options Optional LOS displacement and coherence files
   * @returns Array of deformations with displacement values in mm
   */
  async parseVerticalDisplacement(
    vertDispPath: string,
    points: Point[],
    options: ParseOptions = {}
  ): Promise<Deformation[]> {
    logger.info({ vertDispPath, pointCount: points.length }, 'Parsing vertical displacement GeoTIFF');

    try {
      // 1. Open GeoTIFF files
      const vertTiff = await fromFile(vertDispPath);
      const vertImage = await vertTiff.getImage();
      
      // Optional: LOS displacement
      let losTiff: GeoTIFF | null = null;
      let losImage: GeoTIFFImage | null = null;
      if (options.losDisplacementPath) {
        losTiff = await fromFile(options.losDisplacementPath);
        losImage = await losTiff.getImage();
      }

      // Optional: Coherence
      let corrTiff: GeoTIFF | null = null;
      let corrImage: GeoTIFFImage | null = null;
      if (options.coherencePath) {
        corrTiff = await fromFile(options.coherencePath);
        corrImage = await corrTiff.getImage();
      }

      // 2. Read raster data
      const vertData = await vertImage.readRasters({ interleave: false });
      const losData = losImage ? await losImage.readRasters({ interleave: false }) : null;
      const corrData = corrImage ? await corrImage.readRasters({ interleave: false }) : null;

      // 3. Get image metadata
      const width = vertImage.getWidth();
      const height = vertImage.getHeight();
      const bboxRaw = vertImage.getBoundingBox();
      const bbox: [number, number, number, number] = [bboxRaw[0], bboxRaw[1], bboxRaw[2], bboxRaw[3]];
      const noDataValue = options.noDataValue ?? -9999;
      const minCoherence = options.minCoherence ?? 0.3; // Default: filter coherence < 0.3
      
      // Get GeoTIFF transformation (handles projections like UTM)
      const geoKeys = vertImage.getGeoKeys();
      const fileDirectory = vertImage.fileDirectory;

      logger.info(
        { width, height, bbox, pointCount: points.length, geoKeys },
        'GeoTIFF metadata retrieved'
      );
      
      // Log first point coordinates for debugging
      if (points.length > 0) {
        logger.info(
          { firstPoint: { lat: points[0].latitude, lon: points[0].longitude } },
          'First point coordinates'
        );
      }

      // 4. Extract displacement for each point
      const deformations: Deformation[] = [];
      let validCount = 0;
      let invalidCount = 0;

      for (const point of points) {
        try {
          // Convert lat/lon to pixel coordinates (handles projections)
          const [pixelX, pixelY] = this.latLonToPixel(
            point.latitude,
            point.longitude,
            bbox,
            width,
            height,
            geoKeys
          );

          // Check if pixel is within bounds
          if (pixelX < 0 || pixelX >= width || pixelY < 0 || pixelY >= height) {
            logger.debug(
              { pointId: point.id, lat: point.latitude, lon: point.longitude, pixelX, pixelY },
              'Point outside GeoTIFF bounds'
            );
            invalidCount++;
            continue;
          }

          // Get pixel index (row-major order)
          const pixelIndex = Math.floor(pixelY) * width + Math.floor(pixelX);

          // Extract vertical displacement (in meters)
          const vertDispMeters = (vertData[0] as Float32Array)[pixelIndex];
          
          // Check for NoData
          if (vertDispMeters === noDataValue || isNaN(vertDispMeters)) {
            logger.debug(
              { pointId: point.id, pixelIndex, value: vertDispMeters },
              'NoData value encountered'
            );
            invalidCount++;
            continue;
          }

          // Extract LOS displacement (optional)
          let losDispMeters: number | undefined;
          if (losData) {
            losDispMeters = (losData[0] as Float32Array)[pixelIndex];
            if (losDispMeters === noDataValue || isNaN(losDispMeters)) {
              losDispMeters = undefined;
            }
          }

          // Extract coherence (optional)
          let coherence: number | undefined;
          if (corrData) {
            coherence = (corrData[0] as Float32Array)[pixelIndex];
            if (coherence === noDataValue || isNaN(coherence)) {
              coherence = undefined;
            }
            // Filter low coherence data
            if (coherence !== undefined && coherence < minCoherence) {
              logger.debug(
                { pointId: point.id, coherence },
                'Low coherence, skipping point'
              );
              invalidCount++;
              continue;
            }
          }

          // Convert meters to millimeters (more precise for infrastructure monitoring)
          const vertDispMm = Math.round(vertDispMeters * 1000 * 100) / 100; // Round to 0.01mm
          const losDispMm = losDispMeters !== undefined 
            ? Math.round(losDispMeters * 1000 * 100) / 100 
            : undefined;

          // Extract date from filename (format: S1AA_YYYYMMDD_YYYYMMDD_...)
          // The date should be the secondary image date (second date in filename)
          const date = this.extractDateFromFilename(vertDispPath);
          
          // Log the extracted date for debugging
          logger.debug({ 
            filename: vertDispPath, 
            extractedDate: date.toISOString().split('T')[0] 
          }, 'Extracted date from GeoTIFF filename');

          deformations.push({
            pointId: point.id,
            date,
            verticalDisplacementMm: vertDispMm,
            losDisplacementMm: losDispMm,
            coherence,
          });

          validCount++;
        } catch (error) {
          logger.error(
            { error, pointId: point.id, lat: point.latitude, lon: point.longitude },
            'Error extracting displacement for point'
          );
          invalidCount++;
        }
      }

      logger.info(
        { 
          totalPoints: points.length, 
          validCount, 
          invalidCount,
          validPercent: Math.round((validCount / points.length) * 100)
        },
        'GeoTIFF parsing completed'
      );

      return deformations;
    } catch (error) {
      logger.error({ error, vertDispPath }, 'Failed to parse GeoTIFF');
      throw error;
    }
  }

  /**
   * Convert lat/lon to pixel coordinates
   * 
   * Handles both geographic (lat/lon) and projected (UTM, etc.) coordinate systems
   * 
   * Note: Y is inverted (top-left origin)
   */
  private latLonToPixel(
    lat: number,
    lon: number,
    bbox: [number, number, number, number], // [minX, minY, maxX, maxY]
    width: number,
    height: number,
    geoKeys: any
  ): [number, number] {
    const [minX, minY, maxX, maxY] = bbox;
    
    let x = lon;
    let y = lat;
    
    // Check if GeoTIFF is in a projected coordinate system (e.g., UTM)
    // If bbox values are > 180, it's likely projected (not lat/lon)
    const isProjected = Math.abs(minX) > 180 || Math.abs(maxX) > 180;
    logger.debug({ bbox, isProjected, lat, lon }, 'Checking if projection needed');
    
    if (isProjected) {
      // GeoTIFF is projected - need to transform lat/lon to projected coords
      // Most GMTSAR products use UTM - detect zone from geoKeys or bbox
      
      // Estimate UTM zone from longitude
      const utmZone = Math.floor((lon + 180) / 6) + 1;
      const hemisphere = lat >= 0 ? 'north' : 'south';
      
      // Define projection (WGS84 to UTM)
      const utmProj = `+proj=utm +zone=${utmZone} +${hemisphere} +datum=WGS84 +units=m +no_defs`;
      
      logger.debug({ utmZone, hemisphere, utmProj }, 'Projecting coordinates to UTM');
      
      try {
        // Transform from WGS84 (lat/lon) to UTM
        const [projX, projY] = proj4('EPSG:4326', utmProj, [lon, lat]);
        x = projX;
        y = projY;
        logger.debug({ lat, lon, projX, projY }, 'Coordinates projected successfully');
      } catch (error) {
        logger.warn({ lat, lon, error }, 'Failed to project coordinates, using raw values');
      }
    }

    // Normalize to 0-1
    const normalizedX = (x - minX) / (maxX - minX);
    const normalizedY = (maxY - y) / (maxY - minY); // Inverted Y

    // Scale to pixel coordinates
    const pixelX = normalizedX * width;
    const pixelY = normalizedY * height;

    return [pixelX, pixelY];
  }

  /**
   * Extract date from GMTSAR filename
   * 
   * Format: S1AA_YYYYMMDD_YYYYMMDD_VVP012_INT80_G_ueF_B92B_vert_disp.tif
   * We use the SECOND date (secondary image date)
   */
  private extractDateFromFilename(filename: string): Date {
    // Extract dates from filename
    // Format can be:
    // - S1AA_20240106_20240118_... (old format: reference_secondary)
    // - S1AA_20241113T055935_20241125T055934_... (new format with timestamp)
    // The SECOND date is the secondary image date, which is what we want to store
    
    // Try new format first (with timestamp)
    // Pattern: S1AA_YYYYMMDDTHHMMSS_YYYYMMDDTHHMMSS_...
    let match = filename.match(/S1[AB][AB]_(\d{8})T\d{6}_(\d{8})T\d{6}/);
    
    if (match) {
      const referenceDate = match[1]; // First date (reference image)
      const secondaryDate = match[2]; // Second date (secondary image) - this is what we store
      const year = parseInt(secondaryDate.substring(0, 4));
      const month = parseInt(secondaryDate.substring(4, 6)) - 1; // JS months are 0-indexed
      const day = parseInt(secondaryDate.substring(6, 8));
      
      const extractedDate = new Date(year, month, day);
      logger.debug({ 
        filename, 
        referenceDate, 
        secondaryDate,
        extractedDate: extractedDate.toISOString().split('T')[0] 
      }, 'Extracted date from filename (timestamp format)');
      return extractedDate;
    }
    
    // Try old format (without timestamp)
    // Pattern: S1AA_YYYYMMDD_YYYYMMDD_...
    match = filename.match(/S1[AB][AB]_(\d{8})_(\d{8})/);
    
    if (match) {
      const referenceDate = match[1]; // First date (reference image)
      const secondaryDate = match[2]; // Second date (secondary image) - this is what we store
      const year = parseInt(secondaryDate.substring(0, 4));
      const month = parseInt(secondaryDate.substring(4, 6)) - 1; // JS months are 0-indexed
      const day = parseInt(secondaryDate.substring(6, 8));
      
      const extractedDate = new Date(year, month, day);
      logger.debug({ 
        filename, 
        referenceDate, 
        secondaryDate,
        extractedDate: extractedDate.toISOString().split('T')[0] 
      }, 'Extracted date from filename (simple format)');
      return extractedDate;
    }

    // Fallback to current date if parsing fails
    logger.warn({ filename }, 'Could not extract date from filename, using current date');
    return new Date();
  }

  /**
   * Get statistics from displacement data
   * 
   * Useful for debugging and validation
   */
  async getStatistics(filePath: string): Promise<{
    min: number;
    max: number;
    mean: number;
    stdDev: number;
    noDataCount: number;
    validCount: number;
  }> {
    const tiff = await fromFile(filePath);
    const image = await tiff.getImage();
    const data = await image.readRasters({ interleave: false });
    const values = data[0] as Float32Array;

    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let validCount = 0;
    let noDataCount = 0;

    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      
      if (isNaN(value) || value === -9999) {
        noDataCount++;
        continue;
      }

      validCount++;
      sum += value;
      min = Math.min(min, value);
      max = Math.max(max, value);
    }

    const mean = sum / validCount;

    // Calculate standard deviation
    let sumSquaredDiff = 0;
    for (let i = 0; i < values.length; i++) {
      const value = values[i];
      if (!isNaN(value) && value !== -9999) {
        sumSquaredDiff += Math.pow(value - mean, 2);
      }
    }
    const stdDev = Math.sqrt(sumSquaredDiff / validCount);

    return {
      min: Math.round(min * 1000 * 100) / 100, // Convert to mm
      max: Math.round(max * 1000 * 100) / 100,
      mean: Math.round(mean * 1000 * 100) / 100,
      stdDev: Math.round(stdDev * 1000 * 100) / 100,
      noDataCount,
      validCount,
    };
  }
}

export const geotiffParser = new GeoTIFFParser();

